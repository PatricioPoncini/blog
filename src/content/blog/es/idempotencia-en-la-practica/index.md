---
title: 'Idempotencia en la práctica: 50 pagos iguales, un solo cobro'
summary: 'Sin idempotencia, 50 requests con la misma key cobraron 50 veces y todos respondieron `201`. Con ella, uno solo. Una API de pagos en TypeScript para romperla a propósito: concurrencia, crashes después de cobrar y Redis caído, con los números de cada caso.'
date: '2026-11-26'
draft: false
tags:
  - Idempotency
  - TypeScript
  - Backend
  - DistributedSystems
  - SystemDesign
---

## Contenido
- [La escena](#la-escena)
- [Sin idempotencia: 50 requests, 50 cobros](#sin-idempotencia-50-requests-50-cobros)
- [La huella: la key sola no alcanza](#la-huella-la-key-sola-no-alcanza)
- [Dos requests al mismo tiempo](#dos-requests-al-mismo-tiempo)
- [TTL y LOCK_TTL no son lo mismo](#ttl-y-lock_ttl-no-son-lo-mismo)
- [El lock necesita un dueño](#el-lock-necesita-un-dueño)
- [Los 5xx no se guardan, los 4xx sí](#los-5xx-no-se-guardan-los-4xx-sí)
- [Cuando Redis se cae](#cuando-redis-se-cae)
- [La peor ventana: cobrar y morirse](#la-peor-ventana-cobrar-y-morirse)
- [La última línea de defensa](#la-última-línea-de-defensa)
- [Viéndolo en acción](#viéndolo-en-acción)
- [Lo que esto no garantiza](#lo-que-esto-no-garantiza)
- [Conclusión](#conclusión)

## La escena
En [Idempotencia: cómo diseñar sistemas que sobreviven a los reintentos](/blog/que-es-la-idempotencia) conté la idea: el cliente manda un header `Idempotency-Key`, el servidor guarda el resultado asociado a esa key y, si llega de nuevo, devuelve lo que ya respondió. El ejemplo cabía en veinte líneas de Go.

Este post es la segunda parte. Armé una API de pagos simulada para ver **qué le pasa a esas veinte líneas** cuando la realidad empieza a empujar: 50 requests idénticos en el mismo milisegundo, un cliente que reutiliza la key con otro monto, un proceso que se muere justo después de cobrar, un Redis que deja de responder.

El stack es TypeScript con [Hono](https://hono.dev), Postgres para los pagos y Redis (o Postgres de nuevo) para las keys. Todo lo que cito más abajo es lo que midieron los tests y un script de carga contra Postgres y Redis reales, no estimaciones.

El dominio es lo más simple posible: tres cuentas con saldo, un endpoint `POST /payments` que llama a un procesador de pagos simulado, debita la cuenta y registra el pago. El procesador cuenta cuántas veces movió plata. Ese contador es la única métrica que importa.

## Sin idempotencia: 50 requests, 50 cobros
Primero, el problema. Con la idempotencia apagada, mandé 50 requests simultáneos con el mismo body y la misma key, 10 veces:

- **500 cobros** para 10 operaciones.
- Los 500 respondieron `201 Created`. Ningún error avisa que algo salió mal.
- p50 de 8 segundos, p95 de 14,8.

¿Por qué tan lento? Cada pago bloquea la fila de la cuenta (`SELECT ... FOR UPDATE`) mientras habla con el procesador, para que dos pagos distintos no la dejen en negativo. Los 50 duplicados hacen cola y se cobran **de a uno**, 300 ms cada uno. No solo cobrás de más: los duplicados además frenan a los pagos legítimos de esa cuenta.

Así se ve en la UI del proyecto con 10 requests en paralelo: 10 cobros para una sola key, y la duración de cada respuesta crece de a 300 ms porque se cobran en fila.

![Sin idempotencia: 10 cobros para una sola key](/photos/idempotent-payments-double-charge.png)

## La huella: la key sola no alcanza
La key dice "esto es un reintento", pero no dice **de qué**. Imaginá un cliente con un bug que reutiliza la key de un pago de $25 para uno de $99. Si el servidor solo mira la key, devuelve el resultado del pago de $25 con un `201`. El cliente cree que cobró $99. Nadie se entera hasta la conciliación.

Por eso, junto a la key se guarda una **huella** del request: un `sha256` del método, el path y el body. Si llega la misma key con otra huella, es un `422`: un error ruidoso en lugar de un dato incorrecto.

Un detalle: el body se normaliza antes de calcular el hash, con las claves del JSON ordenadas. `{"a":1,"b":2}` y `{"b":2,"a":1}` son el mismo pago, y un reintento no debería fallar porque otra librería serializó las claves en otro orden. Hay un test para eso.

La key además tiene un **alcance**: `idem:{cliente}:{método}:{ruta}:{key}`. Dos clientes distintos pueden generar la misma key sin pisarse, y la misma key en dos endpoints distintos no colisiona.

## Dos requests al mismo tiempo
El ejemplo del post anterior hacía "buscar la key, si no existe procesar, después guardar". Entre el "buscar" y el "guardar" hay una ventana, y con 50 requests al mismo tiempo los 50 entran por esa ventana.

La solución es que **tomar la key sea una sola operación atómica**. En Redis es `SET ... NX`, que escribe solo si la key no existe.

Exactamente uno de los 50 recibe `OK`. Los otros 49 encuentran el registro `in_progress` y ahí hay dos opciones:

- **Rechazar** con `409` y un `Retry-After`. El cliente reintenta más tarde y recibe el replay.
- **Esperar** a que el primero termine y devolver su resultado.

Medido con 50 requests por ronda y 20 rondas:

| Estrategia | Cobros | Respuestas | p50 | p95 |
|---|---:|---|---:|---:|
| Sin idempotencia (10 rondas) | 500 | 500 × `201` | 8.000 ms | 14.800 ms |
| Redis, rechazar | 20 | 20 × `201`, 980 × `409` | 14 ms | 21 ms |
| Redis, esperar | 20 | 1.000 × `201` (980 replays) | 342 ms | 353 ms |
| Postgres transaccional | 20 | 1.000 × `201` (980 replays) | 333 ms | 350 ms |

Rechazar libera al servidor en milisegundos, pero le pasa el trabajo al cliente. Esperar es más amable, pero cada request en espera ocupa una conexión. No hay una correcta: depende de quién es tu cliente.

Los mismos 10 requests con la idempotencia prendida: un `201`, nueve `409` en pocos milisegundos y, cuando el cliente reintenta, el replay con la misma referencia del procesador (`ch_000001`). Un solo cobro.

![Con idempotencia: un cobro, nueve 409 y un replay](/photos/idempotent-payments-fix.png)

## TTL y LOCK_TTL no son lo mismo
Hay dos tiempos y es fácil mezclarlos:

- **`TTL`** (24 horas): cuánto se recuerda un resultado **terminado**. Define hasta cuándo un reintento recibe replay. Pasado ese tiempo, la misma key es una operación nueva.
- **`LOCK_TTL`** (30 segundos): cuánto vive el lock de un request **en curso** si el proceso que lo tomó nunca termina. Es lo que evita que un crash deje la key trabada para siempre.

Con un solo número habría que elegir entre un lock de 24 horas (un crash bloquea la key un día entero) o recordar resultados 30 segundos (un reintento al minuto vuelve a cobrar). Por eso son dos variables, con dos tests.

El `LOCK_TTL` tiene que ser más largo que el handler más lento. En un test lo puse en 1 segundo con un procesador que tarda 1,5. El lock venció con el primer request todavía cobrando, entró un segundo request con la misma key y **se cobró dos veces**. El lock no es exclusión mutua si el handler es más lento que el lock.

## El lock necesita un dueño
Ese mismo escenario esconde un bug más sutil. El request A toma el lock, tarda demasiado y el lock vence. B entra y toma la key. Después A termina y guarda su resultado... **encima del de B**. O peor: A falla, borra "su" lock, y en realidad borra el de B mientras B sigue trabajando. Un tercer request entra y cobra de nuevo.

Por eso cada lock lleva un **token aleatorio** del dueño, y guardar o liberar solo funciona si el token coincide. La comparación y la escritura tienen que ser atómicas, así que en Redis es un script Lua:

```lua
local current = redis.call('GET', KEYS[1])
if not current then return 0 end
local record = cjson.decode(current)
if record.token ~= ARGV[1] then return 0 end   -- ya no sos el dueño
record.status = 'completed'
record.response = cjson.decode(ARGV[2])
redis.call('SET', KEYS[1], cjson.encode(record), 'PX', ARGV[3])
return 1
```

En el test, A termina mientras B es el dueño: su escritura se descarta y el siguiente reintento recibe el pago de B. Hacerlo en dos pasos desde el código (leer, comparar, escribir) volvería a tener la misma carrera.

## Los 5xx no se guardan, los 4xx sí
¿Qué resultados se guardan? No todos.

Un **5xx** dice "algo falló de mi lado, probá de nuevo". Si lo guardás, cada reintento recibe el mismo error durante 24 horas: la idempotencia convierte un error pasajero en uno permanente. Con un 5xx se libera el lock y el próximo intento se ejecuta de verdad. En el test, el procesador falla, el cliente reintenta y el pago sale: 2 llamadas al procesador, 1 cobro.

Un **4xx** dice "tu request está mal", y repetir el mismo request da lo mismo. Se guarda. En el test, un pago falla por saldo insuficiente, después se carga saldo en la cuenta y se reintenta con la misma key: **sigue respondiendo `422`**. Una key siempre responde lo mismo. Si el cliente quiere intentar de nuevo con el saldo nuevo, es otra operación y lleva otra key.

## Cuando Redis se cae
Si el store de keys no responde, hay que elegir:

- **Fail-closed**: responder `503` y no procesar nada. Medido: 250 requests, 0 cobros.
- **Fail-open**: procesar sin protección y loguear un warning. Medido: 250 requests con 5 keys, **250 cobros**.

Para pagos, closed: es preferible no cobrar unos minutos que cobrar de más. Para "marcar una notificación como leída", open está bien. Es una decisión de negocio, no técnica.

Un detalle que apareció probando con Redis caído de verdad: por defecto, `ioredis` **encola los comandos** mientras intenta reconectar, en lugar de fallar. El request queda colgado. Para que el `503` llegue en milisegundos hubo que desactivar la cola offline y ponerle timeout a los comandos.

## La peor ventana: cobrar y morirse
Esta es la parte que el ejemplo de veinte líneas no puede resolver. El handler cobra, hace commit del débito y, **antes de guardar el resultado**, el proceso se muere. Lo simulé cortando el socket sin responder. El cliente ve una conexión cortada, no sabe si pagó, y reintenta.

**Con Redis**, el efecto (en Postgres) y el resultado (en Redis) viven en dos sistemas distintos. Después del crash queda el lock `in_progress` hasta que vence el `LOCK_TTL`. El reintento recibe `409`... hasta que el lock vence. Ahí se ejecuta de nuevo: **dos cobros y dos débitos**.

Cuando lo probé desde la UI pasó algo que no había planeado: **el navegador reintentó el POST por su cuenta**. La página mandó un solo request, la conexión se cortó y Chrome volvió a enviarlo sin que el código se enterara. Ese reintento automático es el `409` de 319 ms de la primera fila: el lock seguía tomado. Para la demo puse el `LOCK_TTL` en 5 segundos. Pasado ese tiempo, el siguiente reintento cobró de nuevo.

![Crash con Redis: el lock vence y el reintento cobra de nuevo](/photos/idempotent-payments-crash-redis.png)

Los reintentos no son una hipótesis. Ni siquiera hace falta que los escribas vos.

**Con Postgres transaccional**, la key, el débito y la respuesta se escriben en **la misma transacción**.

Si el proceso se muere antes del `COMMIT`, Postgres deshace todo: no hay débito ni key. El reintento entra enseguida y la base termina con un solo débito. De paso, la concurrencia se resuelve sola: un duplicado se bloquea en el índice único hasta que el primero hace commit, y después encuentra el resultado.

Pero los tests mostraron algo que yo no esperaba encontrar tan claro:

| Escenario | Cobros en el procesador | Débitos en la base |
|---|---:|---:|
| Redis | 2 | 2 |
| Postgres transaccional | **2** | 1 |
| Redis + procesador que deduplica | 1 | **2** |
| Postgres transaccional + procesador que deduplica | 1 | 1 |

Con Postgres, la base queda bien, pero **el procesador igual cobró dos veces**. El procesador es un sistema externo y ninguna transacción nuestra lo alcanza. El primer cobro ocurrió y, cuando la transacción se deshizo, nadie le avisó.

## La última línea de defensa
La única fila de esa tabla sin doble cobro y con la contabilidad correcta es la última: transacción en Postgres **y** un procesador que no cobra dos veces la misma operación.

Por eso el handler le pasa la key al procesador como referencia (`{cliente}:{key}`). Es lo mismo que hacen los procesadores reales: Stripe, por ejemplo, acepta su propio header `Idempotency-Key`. Si tu proveedor lo soporta, propagar la key es gratis y cierra la ventana que tu código no puede cerrar.

En la UI, con Postgres y el procesador deduplicando, el navegador volvió a reintentar solo: mientras el fallo estuvo activo mandó **el mismo POST cinco veces**, y las cinco cobraron y "se cayeron". Como cada crash deshace la transacción, cada reintento se ejecutó de nuevo y llamó al procesador: 6 llamadas en total. Pero el procesador reconoció la key y movió plata **una sola vez**. Un cobro, un pago, y los reintentos siguientes reciben el replay.

![Crash con Postgres y procesador idempotente: 6 llamadas, 1 cobro](/photos/idempotent-payments-crash-postgres.png)

Y al revés tampoco alcanza. Con la idempotencia de la API **apagada** y solo el procesador deduplicando, medí 500 requests con 10 keys: 10 cobros reales, pero **500 pagos y 500 débitos en nuestra base**. El procesador protege la plata del cliente, pero no tu contabilidad. Hacen falta las dos capas.

## Viéndolo en acción
El proyecto tiene una UI para provocar todo esto a mano: mandar un pago, reintentarlo, mandar N en paralelo con la misma key, cambiar el monto, prender y apagar la idempotencia, cambiar de store y activar fallos (procesador caído, crash después de cobrar, Redis caído). Un contador compara cobros en el procesador contra keys enviadas y se pone en rojo cuando hay doble cobro.

La página arranca con una guía corta y tres escenarios que se corren con un click.

![La UI de la demo](/photos/idempotent-payments-overview.jpg)

__Link al repositorio: https://github.com/PatricioPoncini/idempotent-payments__

Para probarlo necesitás Node, pnpm y Docker:

```bash
pnpm install
docker compose up -d --wait
pnpm dev     # http://localhost:3000
```

Además de la UI, el repo trae:

- **Tests** con Vitest contra Postgres y Redis reales: los casos de este post, para las dos estrategias. Corrí la suite 6 veces seguidas sin un solo fallo intermitente.
- **`idemcheck`**, un script que manda N requests simultáneos con la misma key durante R rondas, lee cuántos cobros hizo el procesador y **sale con error si alguna key se cobró más de una vez**. Sirve para correrlo contra cualquier API que diga ser idempotente.

En el README están la tabla de variables de entorno, el diagrama del flujo y los números de cada escenario.

## Lo que esto no garantiza
- **Que el cobro externo ocurra una sola vez si el proceso se cae en el peor momento**, salvo que el procesador también deduplique.
- **Exclusión mutua si el handler tarda más que el `LOCK_TTL`.** El token evita que los resultados se pisen, pero no evita el segundo efecto.
- **Que una key se recuerde para siempre.** Pasado el `TTL`, es una operación nueva.
- **Nada, en modo fail-open con el store caído.** Es exactamente lo que dice el nombre.
- **Consistencia con varias réplicas de Redis.** Con una réplica asíncrona, un lock recién escrito se puede perder en un failover.

## Conclusión
La versión de veinte líneas de la idempotencia es correcta mientras los requests lleguen de a uno y nada se caiga. Lo interesante aparece en los bordes:

- **La atomicidad** resuelve la concurrencia: tomar la key tiene que ser una sola operación.
- **La huella** convierte un bug silencioso del cliente en un error visible.
- **Dos TTL distintos** separan "cuánto recuerdo" de "cuánto espero a alguien que quizás se murió".
- **El token de dueño** evita que un request lento pise al que vino después.
- **La transacción compartida** cierra la ventana entre el efecto y el resultado, pero solo dentro de tu base.
- **Propagar la key** al proveedor externo es lo único que cubre lo que pasa afuera.

Ninguna capa alcanza sola. La pregunta del post anterior era "¿qué pasa si el mismo request llega dos veces?". La de este es "¿qué pasa si llega dos veces **y** algo se cae en el medio?". Para un endpoint que mueve plata, conviene tener una respuesta para las dos.

**¡Gracias por leer, nos vemos en la próxima entrega!** 👋
