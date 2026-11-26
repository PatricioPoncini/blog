---
title: 'Por qué se caen las páginas cuando salen las entradas'
summary: 'Pasó con Taylor Swift y pasa cada vez que miles de personas quieren comprar en el mismo segundo. Qué hay detrás de esas caídas y tres formas de evitarlas: rate limiting, sala de espera virtual y load shedding. Con un simulador en Go para verlo en acción.'
date: '2026-11-25'
draft: false
tags:
  - RateLimiting
  - Go
  - DistributedSystems
  - Architecture
  - SystemDesign
---

## Contenido
- [La escena](#la-escena)
- [Qué pasa sin protección](#qué-pasa-sin-protección)
- [Primera defensa: rate limiting con token bucket](#primera-defensa-rate-limiting-con-token-bucket)
- [Por qué rechazar no alcanza](#por-qué-rechazar-no-alcanza)
- [Segunda defensa: la sala de espera](#segunda-defensa-la-sala-de-espera)
- [Tercera defensa: load shedding](#tercera-defensa-load-shedding)
- [Viéndolo en acción](#viéndolo-en-acción)
- [Lo que también puede salir mal](#lo-que-también-puede-salir-mal)
- [Conclusión](#conclusión)

## La escena
Viernes, 19:59. Una banda anuncia que las entradas salen a las 20:00 y miles de personas tienen la página abierta, apretando F5. A las 20:00:00 todos hacen click en "Comprar" al mismo tiempo.

No es un caso hipotético. En noviembre de 2022, en la preventa de Taylor Swift | The Eras Tour, Ticketmaster [informó](https://business.ticketmaster.com/business-solutions/taylor-swift-the-eras-tour-onsale-explained/) **3.500 millones de requests a su sistema, 4 veces su pico anterior**. Más de 3,5 millones de personas se habían preregistrado. A unas 1,5 millones les mandaron código para entrar a la venta y los otros 2 millones quedaron en lista de espera. Ese día vendieron más de 2 millones de entradas.

El problema de fondo es simple: **la demanda de un segundo puede ser muchas veces la capacidad del sistema**. Para este post vamos a usar números de juguete, los mismos que usa el simulador del final:

- **20.000 compradores** que llegan dentro de los primeros 10 segundos.
- Un checkout que procesa **500 requests por segundo**.
- Además, **100 requests por segundo de catálogo** (gente navegando y buscando), que también pegan al mismo backend.

Son 2.000 compradores por segundo contra una capacidad de 500. ¿Qué pasa?

## Qué pasa sin protección
La intuición dice que el sistema va a ir lento pero va a ir vendiendo a 500 por segundo. No es así, y para entender por qué conviene separar dos cosas:

- **Throughput**: todos los requests por segundo que llegan al servidor.
- **Goodput**: la parte del throughput que se atiende sin errores y con la latencia suficientemente baja como para que al cliente le sirva la respuesta.

Cuando el servidor está saturado, la cola crece. Cuando la espera en la cola supera el timeout del cliente, el cliente se va y considera que falló. Pero el servidor no se entera: sigue procesando ese request y le responde a nadie. Todo ese trabajo se tira.

Y encima el cliente **reintenta**. Cada reintento es un request más en una cola que ya estaba desbordada, así que la espera crece todavía más y más requests llegan tarde. Es un círculo vicioso: cuanto más saturado está el sistema, más carga recibe, y puede seguir así un buen rato aunque el pico original ya haya pasado.

En el simulador, sin ninguna protección, pasa exactamente eso: compran los primeros ~1.900 que llegaron antes de que se forme la cola y después **las compras exitosas caen a cero**, con el backend trabajando al 100%. El servidor genera 118.000 respuestas para clientes que ya no estaban esperando. El 90% de los compradores se termina yendo sin entrada.

Es el peor resultado posible: el sistema está ocupado, nadie compra y pierden todos, incluso los que llegaron primero.

## Primera defensa: rate limiting con token bucket
La primera idea es no dejar entrar más trabajo del que el sistema puede hacer. Eso es rate limiting, y uno de sus algoritmos clásicos es el **token bucket**:

- Hay un balde con capacidad para `b` tokens, que arranca lleno.
- El balde se recarga a un ritmo de `r` tokens por segundo.
- Cada request consume un token. Si hay, pasa. Si no hay, se rechaza.

Con eso se controlan dos cosas por separado: el **ritmo sostenido** (`r`) y la **ráfaga** que se tolera (`b`). Un balde de 50 tokens que se recarga a 500 por segundo deja pasar 500 requests por segundo en promedio, pero absorbe un pico corto de 50 de golpe sin rechazar a nadie. Es el algoritmo que usan, por ejemplo, Stripe para limitar los requests de cada usuario a su API y AWS API Gateway, donde se configura justamente con un rate y un burst.

En Go no hace falta implementarlo: [`golang.org/x/time/rate`](https://pkg.go.dev/golang.org/x/time/rate) es un token bucket listo para usar, y es lo que usa el simulador:

```go
// Un balde por usuario (que un solo cliente no se coma el presupuesto)
// y uno global que protege al backend.
perUser := rate.NewLimiter(1, 2)   // 1 req/s, ráfaga de 2
global  := rate.NewLimiter(500, 50) // la capacidad del backend

if !perUser.Allow() || !global.Allow() {
    w.Header().Set("Retry-After", "1")
    w.WriteHeader(http.StatusTooManyRequests) // 429
    return
}
```

¿Qué se responde al que no entra? Para eso existe el status **429 Too Many Requests**: el usuario mandó demasiados requests en un período de tiempo. La respuesta puede incluir el header **`Retry-After`**, que le indica al cliente cuánto esperar antes de volver a intentar, ya sea como una cantidad de segundos o como una fecha.

¿Funciona? En el simulador, con rate limiting **compran los 20.000** y el backend nunca se satura: no hay timeouts ni trabajo tirado. Problema técnico resuelto.

## Por qué rechazar no alcanza
Ahora mirémoslo desde el lado del usuario. En la misma corrida:

- **Cada comprador vio, en promedio, más de 20 errores** antes de poder comprar. En total el sistema respondió más de 430.000 veces `429`.
- **Quién compra primero es casi aleatorio.** Entra el que tiene la suerte de que su reintento caiga justo cuando hay un token libre. Alguien que llegó en el segundo 1 puede comprar después de alguien que llegó en el segundo 9.

Para el usuario, un 429 es una pantalla de error. Y la reacción natural ante un error es apretar F5 de nuevo. El rate limiting protege al **sistema**, pero no le da al **usuario** ninguna información útil: no sabe si le falta un segundo o diez minutos, ni si tiene sentido seguir esperando.

Acá está el giro de este post. Rechazar es una decisión técnica. Lo que falta es una decisión **de producto**.

## Segunda defensa: la sala de espera
En lugar de rechazar a los que sobran, se los pone **en una fila** y se los deja pasar al checkout a un ritmo que el sistema aguanta. Mientras esperan, se les muestra dónde están: "Tenés 1.240 personas delante".

Es lo que ofrecen productos como Cloudflare Waiting Room. La sala se configura con dos umbrales: **cuántos usuarios simultáneos** querés dentro de la aplicación y **a qué ritmo máximo** pueden entrar usuarios nuevos. Cuando se superan, el visitante queda en la sala hasta que le toca el turno, viendo un tiempo estimado de espera que se va actualizando.

Lo importante es que **la espera no le cuesta nada al backend**: el usuario no está mandando requests de compra que haya que rechazar, está esperando su turno en una página que se sirve aparte.

En el simulador, el ritmo de admisión lo implementé con el mismo token bucket de antes. Ya no decide a quién rechazar, sino **cuántos pasan por segundo**.

### La equidad es una decisión de producto
¿Quién entra primero? Hay dos respuestas típicas:

- **FIFO**: se atiende por orden de llegada a la sala.
- **Random**: se elige al azar quién sale de la sala.

FIFO premia al que llegó primero, que suele ser el que tiene mejor conexión o más pestañas abiertas. Random reparte las chances entre todos los que estaban en la sala. Ninguna de las dos es la correcta: es una decisión del negocio, con consecuencias técnicas. El simulador permite probar las dos.

Volviendo a Ticketmaster: los códigos de la preventa de Verified Fan son otra forma de decidir quién entra. Se elige antes de la venta y no durante.

### El resultado
Con la sala de espera dejando pasar 350 personas por segundo:

- **Cada comprador manda un solo request** y no ve ningún error.
- El orden de compra respeta exactamente el orden de llegada.
- El sistema vende a un ritmo estable y el último compra en el segundo 57.

En los números finos, la sala de espera es **más lenta** que el rate limiting: 350 por segundo contra 500 de capacidad. Lo hice a propósito para dejar margen al resto del sitio, que también usa el backend. La diferencia es que nadie ve una pantalla de error y todos saben cuánto les falta.

## Tercera defensa: load shedding
Aun con todo lo anterior, el backend puede saturarse: por un deploy, una dependencia lenta o tráfico que no pasa por la sala. Para eso está el **load shedding**: cuando el servidor está sobrecargado, rechaza trabajo de inmediato en lugar de encolarlo, y **elige qué rechazar primero**.

La idea clave es que **no todos los endpoints valen lo mismo**. Stripe, por ejemplo, reserva una parte de su infraestructura para los requests críticos y, si se llena, rechaza primero el tráfico de menor prioridad.

En nuestro caso, el checkout es lo que genera plata y el catálogo puede esperar. En el simulador, el catálogo se descarta cuando la espera estimada en cola supera 100 ms, y el checkout recién cuando supera 1 segundo. Así se garantiza que nada espere más que el timeout del cliente, y por lo tanto no se tira trabajo.

El resultado: el backend vende a 500 por segundo, que es su capacidad completa, y el catálogo es lo primero que se sacrifica. Pero los compradores siguen viendo errores (503), unos 10 cada uno en promedio. El load shedding protege lo que importa, pero no es una experiencia de usuario.

## Viéndolo en acción
Armé un simulador en Go que corre las cuatro variantes con el mismo tráfico. Es una simulación de eventos discretos en tiempo virtual y es determinística: con la misma semilla da siempre el mismo resultado.

__Link al repositorio: https://github.com/PatricioPoncini/ticket-rush__

![Compras exitosas por segundo en los cuatro escenarios](/photos/ticket-rush-purchases.png)

En el gráfico se ve todo de un vistazo:

- **Sin protección** vende durante 4 segundos y después se desploma a cero, con el servidor trabajando al 100%.
- **Rate limiting** sostiene cerca de la capacidad, a costa de cientos de miles de 429.
- **Load shedding** vende a la capacidad completa sacrificando el catálogo.
- **La sala de espera** vende a un ritmo plano y predecible.

El segundo gráfico muestra la otra cara: **quién compra primero**. Cada punto es un comprador; en el eje horizontal está su orden de llegada y en el vertical cuándo compró.

![Orden de llegada contra momento de compra en los cuatro escenarios](/photos/ticket-rush-who-buys-first.png)

Con la sala de espera es una línea recta: el que llegó antes, compra antes. Con rate limiting y load shedding es una nube: llegar primero no garantiza nada.

| Escenario | Compraron | Se fueron | Espera p50 | Espera p95 | Requests por comprador | Errores por comprador | Catálogo OK | Trabajo tirado |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Sin protección | 1.872 | 18.128 | 1,5 s | 2,9 s | 19,4 | 18,9 | 0% | 118.010 |
| Rate limiting | 20.000 | 0 | 16,1 s | 37,1 s | 22,5 | 21,5 | 91% | 0 |
| Sala de espera | 20.000 | 0 | 23,6 s | 44,9 s | 1,0 | 0,0 | 100% | 0 |
| Load shedding | 20.000 | 0 | 14,5 s | 33,3 s | 11,6 | 10,6 | 84% | 0 |

Los números son parámetros ilustrativos de una simulación, no mediciones de un sistema real.

Si querés probarlo, solo necesitás tener Go instalado. Clonás el repo, levantás el servidor y se abre una página donde elegís los escenarios, cambiás los parámetros (cantidad de compradores, capacidad, FIFO o random) y abrís la venta para ver cómo se comporta cada estrategia. En el README están los pasos y el detalle del modelo.

## Lo que también puede salir mal
El pico trae otros problemas que no entran en este post, pero vale la pena nombrarlos:

- **Reintentos que duplican compras.** Si el cliente reintenta un pago cuyo request sí llegó, podés cobrarle dos veces. La solución es una idempotency key, como conté en [Idempotencia: cómo diseñar sistemas que sobreviven a los reintentos](/blog/que-es-la-idempotencia).
- **Escalar sobre la hora.** Si sabés a qué hora llega el pico, no esperes a que el autoscaling reaccione. La mayoría de los proveedores cloud permiten programar el escalado para que la capacidad extra ya esté lista antes de las 20:00.
- **Reintentar con backoff y jitter.** Si controlás el cliente, que reintente con backoff exponencial (esperar cada vez más entre intentos) y algo de aleatoriedad. Así se evita que todos vuelvan a la vez.

## Conclusión
Las tres defensas no compiten, se complementan:

- **El rate limiting protege al sistema** de que le pidan más de lo que puede dar.
- **La sala de espera protege la experiencia**, convirtiendo un error en una espera con información.
- **El load shedding protege lo que genera plata** cuando todo lo demás no alcanza.

El token bucket aparece en las tres historias: como límite en la primera, como ritmo de admisión en la segunda y, de fondo, en la idea de que la capacidad es un presupuesto que se reparte.

Proteger al negocio de su propio éxito es una decisión de producto antes que técnica. Qué se rechaza, a quién se hace esperar y quién entra primero son preguntas que el código solo puede responder después de que alguien las decidió.
