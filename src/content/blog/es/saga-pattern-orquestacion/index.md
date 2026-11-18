---
title: 'Patrón Saga: cómo mantener la consistencia entre microservicios sin transacciones distribuidas'
summary: 'Cuando cada servicio tiene su propia base de datos, el rollback deja de ser gratis. El patrón Saga lo resuelve con transacciones locales y compensaciones. Qué es, cómo funciona un orquestador por dentro y cómo se comporta ante timeouts, duplicados y fallas, con un proyecto en Kotlin + RabbitMQ que podés levantar en tu máquina.'
date: '2026-11-17'
draft: false
tags:
  - Microservices
  - Kotlin
  - DistributedSystems
  - RabbitMQ
  - Architecture
---

## Contenido
- [El problema](#el-problema)
- [¿Qué es una Saga?](#qué-es-una-saga)
- [Coreografía vs orquestación](#coreografía-vs-orquestación)
- [El proyecto](#el-proyecto)
- [¿Cómo se define una saga?](#cómo-se-define-una-saga)
- [¿Cómo funciona el orquestador?](#cómo-funciona-el-orquestador)
- [Viéndolo en acción](#viéndolo-en-acción)
- [Lo que nadie te cuenta](#lo-que-nadie-te-cuenta)
- [¿Conviene usarlo?](#conviene-usarlo)

## El problema
Pensemos en algo bien común: un cliente hace una compra. Para que eso funcione hay que crear la orden, cobrarle y reservar el stock del producto.

En un monolito con una sola base de datos esto es fácil. Abrimos una transacción, hacemos los tres `INSERT`/`UPDATE` y si algo falla hacemos rollback. ACID nos cubre y el sistema nunca queda a medias.

Ahora, si estamos trabajando con microservicios, lo normal es que cada servicio sea dueño de sus datos: `order-service` tiene su base, `payment-service` la suya y `inventory-service` la suya. Ya no hay una transacción que abarque todo. Si el pago se aprobó pero después no hay stock, no existe un rollback mágico que deshaga el cobro en otra base de datos.

Acá es donde entra el patrón Saga.

## ¿Qué es una Saga?
Una saga es **una secuencia de transacciones locales**, donde cada paso se ejecuta en un solo servicio y confirma sus cambios en su propia base de datos. Si algún paso falla, se ejecutan **compensaciones** para deshacer lo que ya se hizo.

La palabra clave es esa: compensación. No es un rollback, es un "deshacer" semántico. Si ya cobramos, no borramos la fila del pago como si nunca hubiera existido, sino que hacemos un reembolso. Si ya creamos la orden, no la eliminamos, sino que la marcamos como rechazada. Queda registro de todo lo que pasó.

Esto tiene una consecuencia importante: **la consistencia es eventual**. Durante un rato el sistema puede estar "a medias" (por ejemplo, con el pago aprobado y la orden todavía pendiente), pero eventualmente la saga termina y todo queda consistente: o se completó todo, o se compensó todo.

## Coreografía vs orquestación
Hay dos formas de coordinar una saga:

- **Coreografía:** no hay nadie a cargo. Cada servicio escucha eventos y reacciona. `order-service` publica "orden creada", `payment-service` lo escucha, cobra y publica "pago aprobado", y así.
- **Orquestación:** hay un componente central, el orquestador, que le dice a cada servicio qué hacer y espera su respuesta para decidir el próximo paso.

| | Coreografía | Orquestación |
|---|---|---|
| ¿Dónde vive el flujo? | Repartido entre los servicios | En un solo lugar |
| Acoplamiento | Bajo, pero implícito | Los servicios solo conocen al orquestador |
| Seguir lo que pasó | Difícil, hay que juntar eventos de todos lados | Fácil, el orquestador tiene el estado |
| Contra | Con muchos pasos se vuelve un spaghetti de eventos | Un componente más para mantener |

Para este post decidí desarrollar una Saga **orquestada**. Cuando el flujo tiene pocos pasos, la coreografía funciona bien. Pero a medida que crece, tener toda la lógica en un solo lugar (y poder testearla) vale mucho más que ahorrarse un servicio.

## El proyecto
Para entender bien el patrón armé un proyecto que implementa una saga de creación de órdenes con un orquestador. Está hecho en Kotlin con Spring Boot, usa RabbitMQ como broker y Postgres como base de datos. Tiene 4 servicios:

- `order-service`: crea y aprueba/rechaza órdenes.
- `payment-service`: autoriza y reembolsa pagos.
- `inventory-service`: reserva stock.
- `saga-orchestrator`: coordina todo.

Lo importante es que **los servicios nunca se llaman entre sí** y ninguno lee la base de datos de otro. Todo pasa por mensajes en RabbitMQ: el orquestador manda comandos (`AuthorizePayment`, `ReserveStock`, etc.) y los servicios le contestan con respuestas.

Además tiene una UI donde se pueden ejecutar distintos escenarios (el camino feliz, pagos rechazados, falta de stock, mensajes duplicados, servicios lentos o caídos) y ver en vivo qué hace la saga.

<!-- IMAGEN: captura general de la UI (home de localhost:3000: título "Saga orquestada, en vivo", las 3 cards y la lista de escenarios). Ya está en /photos/saga_overview.jpg -->
<!-- IMAGEN: captura de la página /datos ("Cuatro bases, ningún join.") mostrando las 4 bases separadas. Alternativa: exportar a PNG el diagrama de arquitectura Mermaid del README -->

__Link al repositorio: https://github.com/PatricioPoncini/saga-orchestration__

## ¿Cómo se define una saga?
Una saga es una lista de pasos. Cada paso dice qué servicio lo ejecuta, qué comando mandarle y, si corresponde, cómo compensarlo:

```kotlin
enum class StepKind { COMPENSATABLE, PIVOT, RETRIABLE }

class SagaStep<D>(
    val name: String,
    val participant: String,
    val kind: StepKind,
    val description: String,
    val action: ((D) -> SagaCommand)? = null,
    val onSuccess: (D, Map<String, String>) -> D = { data, _ -> data },
    val compensation: ((D, String) -> SagaCommand)? = null,
    val compensationName: String? = null,
)
```

Y así se ve uno de los pasos reales, el de autorizar el pago:

```kotlin
SagaStep(
    name = "AUTHORIZE_PAYMENT",
    participant = PAYMENT,
    kind = StepKind.COMPENSATABLE,
    description = "Autorizar el cobro al cliente",
    action = { data ->
        SagaCommand(PAYMENT, "AuthorizePayment",
            mapOf("orderId" to data.orderId, "customerId" to data.customerId, "amount" to data.amount))
    },
    onSuccess = { data, reply -> data.copy(paymentId = reply["paymentId"]) },
    compensation = { data, _ -> SagaCommand(PAYMENT, "RefundPayment", mapOf("orderId" to data.orderId)) },
    compensationName = "RefundPayment",
),
```

La saga completa tiene 4 pasos:

| Paso | Servicio | Tipo | Compensación |
|---|---|---|---|
| `CREATE_ORDER` | order | Compensable | `RejectOrder` |
| `AUTHORIZE_PAYMENT` | payment | Compensable | `RefundPayment` |
| `RESERVE_STOCK` | inventory | Pivot | — |
| `APPROVE_ORDER` | order | Retriable | — |

### Los tipos de paso
Esto es algo que en muchos artículos se saltea y para mí es lo que hace que el patrón cierre:

- **Compensable:** se puede deshacer. Si algo falla más adelante, se ejecuta su compensación.
- **Pivot:** es el punto de no retorno. Si el pivot sale bien, la saga *va* a completarse sí o sí. Si falla, se compensa todo lo anterior.
- **Retriable:** son los pasos que vienen después del pivot. No pueden fallar por reglas de negocio, así que si fallan (por ejemplo porque el servicio está caído) **se reintentan hasta que salgan**, nunca se compensan.

Por eso `APPROVE_ORDER` no tiene compensación: una vez que reservamos stock, no tiene sentido echar todo para atrás porque la base de `order-service` tardó en responder. Lo reintentamos y listo.

## ¿Cómo funciona el orquestador?
El corazón del orquestador es `SagaEngine`, una máquina de estados escrita en Kotlin puro, sin Spring, sin base de datos y sin RabbitMQ. Recibe el estado actual de la saga y un evento (una respuesta o un timeout) y devuelve una decisión: avanzar mandando un comando, o ignorar el mensaje.

Esto tiene una ventaja enorme: toda la lógica de la saga se puede testear con tests unitarios comunes, sin levantar nada de infraestructura.

Cuando un paso falla, el engine marca la saga como `COMPENSATING` y empieza a compensar **en orden inverso**, desde el paso anterior al que falló hacia atrás:

```kotlin
private fun compensateFrom(instance: SagaInstance<D>, fromIndex: Int, now: Instant, notes: List<String>): SagaDecision.Advance<D> {
    for (i in fromIndex downTo 0) {
        val step = steps[i]
        val compensation = step.compensation
        // Solo se compensan los pasos que salieron bien y que tienen compensación
        if (instance.stepStates[i] == StepState.SUCCEEDED && compensation != null) {
            val command = compensation(instance.data, instance.failureReason ?: "Falla en la saga")
            return SagaDecision.Advance(
                instance.copy(
                    stepStates = instance.stepStates.replace(i, StepState.COMPENSATING),
                    awaiting = AwaitingReply(i, command.type, command.participant, compensating = true, sentAt = now, attempts = 1),
                    updatedAt = now,
                ),
                command = command,
                notes = notes,
            )
        }
    }
    // No queda nada por compensar: el sistema volvió a un estado consistente
    return SagaDecision.Advance(
        instance.copy(status = SagaStatus.COMPENSATED, awaiting = null, updatedAt = now),
        command = null,
        notes = notes + "Todas las compensaciones completadas: saga COMPENSATED",
    )
}
```

¿Por qué en orden inverso? Por lo mismo que en una pila: lo último que hiciste es lo primero que deshacés. Si se creó la orden y después se cobró, primero se reembolsa y después se rechaza la orden.

Una saga termina en uno de estos estados:

- `COMPLETED`: todos los pasos salieron bien.
- `COMPENSATED`: algo falló y se deshizo todo lo anterior.
- `FAILED`: algo no respondió después de varios reintentos y necesita intervención manual.

Otro detalle importante: **el estado de cada saga se guarda en Postgres** (en qué paso está, qué respuesta espera, cuántos intentos lleva). Si el orquestador se reinicia en medio de una saga, cuando vuelve a levantar la retoma desde donde estaba.

## Viéndolo en acción
El proyecto tiene una UI con 6 escenarios. Cada uno muestra un aspecto distinto del patrón:

1. **Camino feliz:** se crea la orden, se autoriza el pago, se reserva el stock y se aprueba la orden. La saga termina en `COMPLETED`.
2. **Pago rechazado:** el monto supera el límite de crédito del cliente, así que falla `AUTHORIZE_PAYMENT`. Solo hay que compensar un paso (`RejectOrder`) y la saga termina en `COMPENSATED`.
3. **Sin stock:** el pago se autoriza pero no hay stock, así que falla el pivot (`RESERVE_STOCK`). El orquestador ejecuta `RefundPayment` y después `RejectOrder`, en orden inverso.
4. **Mensajes duplicados:** el orquestador publica cada comando dos veces con el mismo ID. Cada servicio procesa el primero e ignora el segundo.
5. **Pago lento:** `payment-service` tarda 14 segundos en responder y el timeout del orquestador es de 10. El orquestador reenvía el comando, `payment-service` detecta que ese pago ya existe y no cobra dos veces, y cuando la primera respuesta llega tarde, se descarta.
6. **Inventario caído:** `inventory-service` deja de aceptar mensajes. Los mensajes esperan en la cola y, si el servicio vuelve a tiempo, la saga se completa. Si no, termina en `FAILED`.

Para cada escenario se ve el diagrama de la saga avanzando (o compensando) en vivo y una línea de tiempo con cada mensaje y cada decisión del orquestador.

Si lo querés ver en acción, cloná el repo y levantalo en tu máquina. Solo necesitás Docker:

```sh
git clone https://github.com/PatricioPoncini/saga-orchestration.git
cd saga-orchestration
docker compose up --build -d
```

Después abrís `http://localhost:3000` y empezás a romper cosas 😄

## Lo que nadie te cuenta
La idea de la saga es simple. Lo difícil está en todo lo que puede salir mal con los mensajes. Hay tres cosas que sí o sí hay que resolver:

**1. Idempotencia.** Si un mensaje puede llegar dos veces, procesarlo dos veces tiene que dar el mismo resultado. En el proyecto esto se resuelve en dos niveles:

- **Por mensaje (Inbox):** cada servicio guarda el ID de los mensajes que ya procesó, en la misma transacción que el cambio de negocio. Si el ID ya existe, se ignora.
- **Por negocio:** cuando el orquestador reintenta por timeout, el comando viaja con un ID nuevo, así que el Inbox no lo detecta. Por eso `payment-service` busca si ya existe un pago para esa orden antes de crear otro. Es lo que pasa en el escenario del pago lento.

Si querés profundizar en esto, tengo un [post entero sobre idempotencia](/blog/que-es-la-idempotencia).

**2. Transactional outbox.** Un servicio no puede guardar en su base y publicar en RabbitMQ "al mismo tiempo": si guarda y se cae antes de publicar, el mensaje se pierde, y si publica y después falla el commit, mandó algo que nunca pasó. La solución es guardar el mensaje en una tabla `outbox` **dentro de la misma transacción** y que un proceso aparte lo publique después. Ese proceso usa `for update skip locked` para que varias instancias no publiquen el mismo mensaje.

**3. Las compensaciones también fallan.** ¿Qué pasa si falla el reembolso? No se puede "compensar la compensación". En el proyecto las compensaciones se reintentan hasta que salen. Y si un servicio directamente no responde después de 5 intentos, la saga queda en `FAILED`: es la forma de decir "esto necesita que lo mire una persona". Ningún patrón te salva del 100% de los casos, pero sí te deja saber exactamente dónde quedó todo.

## ¿Conviene usarlo?
Depende (como muchas respuestas en IT). Si tenés una operación de negocio que cruza varios servicios, cada uno con su propia base de datos, la saga es prácticamente la única forma sana de mantener la consistencia.

Ahora, si podés resolver esa operación dentro de un solo servicio y una sola base de datos, hacelo. Una transacción ACID común va a ser siempre más simple que cualquier saga. Muchas veces la necesidad de una saga es una señal de que los límites entre servicios no están bien puestos.

De manera personal, lo que más me gustó de armar este proyecto fue darme cuenta de que el patrón en sí es bastante simple: una lista de pasos y una lista de compensaciones. Lo que realmente cuesta es todo lo de alrededor: timeouts, duplicados, mensajes que llegan tarde, servicios que se caen. Y verlo funcionando en vivo ayuda muchísimo más que cualquier diagrama.

__Link al repositorio: https://github.com/PatricioPoncini/saga-orchestration__

__¡Gracias por leer, nos vemos en la próxima entrega! 👋__
