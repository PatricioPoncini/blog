---
title: 'Saga pattern: how to keep consistency across microservices without distributed transactions'
summary: 'When each service has its own database, rollback is no longer free. The Saga pattern solves this with local transactions and compensations. What it is, how an orchestrator works inside and how it behaves with timeouts, duplicates and failures, with a Kotlin + RabbitMQ project you can run on your machine.'
date: '2026-11-17'
draft: false
tags:
  - Microservices
  - Kotlin
  - DistributedSystems
  - RabbitMQ
  - Architecture
---

## Contents

- [The problem](#the-problem)
- [What is a Saga?](#what-is-a-saga)
- [Choreography vs orchestration](#choreography-vs-orchestration)
- [The project](#the-project)
- [How is a saga defined?](#how-is-a-saga-defined)
- [How does the orchestrator work?](#how-does-the-orchestrator-work)
- [Seeing it in action](#seeing-it-in-action)
- [What nobody tells you](#what-nobody-tells-you)
- [Is it worth using?](#is-it-worth-using)

## The problem

Let's think about something very common: a customer makes a purchase. For that to work, we need to create the order, charge the customer and reserve the product's stock.

In a monolith with a single database, this is easy. We open a transaction, run the three `INSERT`/`UPDATE` statements and, if something fails, we roll back. ACID has our back and the system never ends up half done.

Now, if we are working with microservices, each service usually owns its data: `order-service` has its own database, `payment-service` has its own, and so does `inventory-service`. There is no longer a transaction that covers everything. If the payment was approved but then there is no stock, there is no magic rollback that undoes the charge in another database.

This is where the Saga pattern comes in.

## What is a Saga?

A saga is **a sequence of local transactions**, where each step runs in a single service and commits its changes to its own database. If a step fails, **compensations** run to undo what was already done.

That is the key word: compensation. It is not a rollback; it is a semantic "undo". If we already charged the customer, we do not delete the payment row as if it never existed; we issue a refund. If we already created the order, we do not delete it; we mark it as rejected. There is a record of everything that happened.

This has an important consequence: **consistency is eventual**. For a while the system can be "half done" (for example, with the payment approved and the order still pending), but eventually the saga finishes and everything becomes consistent: either everything was completed, or everything was compensated.

## Choreography vs orchestration

There are two ways to coordinate a saga:

- **Choreography:** nobody is in charge. Each service listens to events and reacts. `order-service` publishes "order created", `payment-service` listens to it, charges and publishes "payment approved", and so on.
- **Orchestration:** there is a central component, the orchestrator, that tells each service what to do and waits for its response to decide the next step.

|                           | Choreography                                     | Orchestration                        |
| ------------------------- | ------------------------------------------------ | ------------------------------------ |
| Where does the flow live? | Spread across the services                       | In a single place                    |
| Coupling                  | Low, but implicit                                | Services only know the orchestrator  |
| Following what happened   | Hard, you need to collect events from everywhere | Easy, the orchestrator has the state |
| Downside                  | With many steps it becomes event spaghetti       | One more component to maintain       |

For this post I decided to build an **orchestrated** Saga. When the flow has few steps, choreography works well. But as it grows, having all the logic in one place (and being able to test it) is worth much more than saving one service.

## The project

To really understand the pattern, I built a project that implements an order creation saga with an orchestrator. It is built in Kotlin with Spring Boot, uses RabbitMQ as the broker and Postgres as the database. It has 4 services:

- `order-service`: creates and approves/rejects orders.
- `payment-service`: authorizes and refunds payments.
- `inventory-service`: reserves stock.
- `saga-orchestrator`: coordinates everything.

The important part is that **services never call each other** and none of them reads another service's database. Everything goes through messages in RabbitMQ: the orchestrator sends commands (`AuthorizePayment`, `ReserveStock`, etc.) and the services answer with replies.

It also has a UI where you can run different scenarios (the happy path, rejected payments, out of stock, duplicate messages, slow or down services) and watch live what the saga does.

<!-- IMAGEN: captura general de la UI (home de localhost:3000: título "Saga orquestada, en vivo", las 3 cards y la lista de escenarios). Ya está en /photos/saga_overview.jpg -->
<!-- IMAGEN: captura de la página /datos ("Cuatro bases, ningún join.") mostrando las 4 bases separadas. Alternativa: exportar a PNG el diagrama de arquitectura Mermaid del README -->

**Repository link: https://github.com/PatricioPoncini/saga-orchestration**

## How is a saga defined?

A saga is a list of steps. Each step says which service runs it, which command to send and, if needed, how to compensate it:

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

And this is what one of the real steps looks like, the one that authorizes the payment:

```kotlin
SagaStep(
    name = "AUTHORIZE_PAYMENT",
    participant = PAYMENT,
    kind = StepKind.COMPENSATABLE,
    description = "Authorize the customer payment",
    action = { data ->
        SagaCommand(PAYMENT, "AuthorizePayment",
            mapOf("orderId" to data.orderId, "customerId" to data.customerId, "amount" to data.amount))
    },
    onSuccess = { data, reply -> data.copy(paymentId = reply["paymentId"]) },
    compensation = { data, _ -> SagaCommand(PAYMENT, "RefundPayment", mapOf("orderId" to data.orderId)) },
    compensationName = "RefundPayment",
),
```

The full saga has 4 steps:

| Step                | Service   | Type          | Compensation    |
| ------------------- | --------- | ------------- | --------------- |
| `CREATE_ORDER`      | order     | Compensatable | `RejectOrder`   |
| `AUTHORIZE_PAYMENT` | payment   | Compensatable | `RefundPayment` |
| `RESERVE_STOCK`     | inventory | Pivot         | —               |
| `APPROVE_ORDER`     | order     | Retriable     | —               |

### Step types

Many articles skip this, but for me it is what makes the pattern come together:

- **Compensatable:** it can be undone. If something fails later, its compensation runs.
- **Pivot:** the point of no return. If the pivot succeeds, the saga _will_ complete no matter what. If it fails, everything before it is compensated.
- **Retriable:** the steps that come after the pivot. They cannot fail because of business rules, so if they fail (for example, because the service is down) **they are retried until they succeed**; they are never compensated.

That is why `APPROVE_ORDER` has no compensation: once we reserved stock, it makes no sense to roll everything back because the `order-service` database was slow to respond. We just retry it.

## How does the orchestrator work?

The heart of the orchestrator is `SagaEngine`, a state machine written in plain Kotlin, with no Spring, no database and no RabbitMQ. It receives the current state of the saga and an event (a reply or a timeout) and returns a decision: move forward by sending a command, or ignore the message.

This has a huge advantage: all the saga logic can be tested with regular unit tests, without starting any infrastructure.

When a step fails, the engine marks the saga as `COMPENSATING` and starts compensating **in reverse order**, going backwards from the step before the one that failed:

```kotlin
private fun compensateFrom(instance: SagaInstance<D>, fromIndex: Int, now: Instant, notes: List<String>): SagaDecision.Advance<D> {
    for (i in fromIndex downTo 0) {
        val step = steps[i]
        val compensation = step.compensation
        // Only steps that succeeded and have a compensation are compensated
        if (instance.stepStates[i] == StepState.SUCCEEDED && compensation != null) {
            val command = compensation(instance.data, instance.failureReason ?: "Saga failure")
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
    // Nothing left to compensate: the system is back in a consistent state
    return SagaDecision.Advance(
        instance.copy(status = SagaStatus.COMPENSATED, awaiting = null, updatedAt = now),
        command = null,
        notes = notes + "All compensations completed: saga COMPENSATED",
    )
}
```

Why in reverse order? For the same reason as a stack: the last thing you did is the first thing you undo. If the order was created and then the customer was charged, first we refund and then we reject the order.

A saga ends in one of these states:

- `COMPLETED`: all steps succeeded.
- `COMPENSATED`: something failed and everything before it was undone.
- `FAILED`: something did not respond after several retries and needs manual intervention.

Another important detail: **the state of each saga is stored in Postgres** (which step it is on, which reply it is waiting for, how many attempts it has made). If the orchestrator restarts in the middle of a saga, it picks up where it left off when it comes back.

## Seeing it in action

The project has a UI with 6 scenarios. Each one shows a different aspect of the pattern:

1. **Happy path:** the order is created, the payment is authorized, the stock is reserved and the order is approved. The saga ends in `COMPLETED`.
2. **Payment rejected:** the amount is over the customer's credit limit, so `AUTHORIZE_PAYMENT` fails. Only one step needs to be compensated (`RejectOrder`) and the saga ends in `COMPENSATED`.
3. **Out of stock:** the payment is authorized but there is no stock, so the pivot (`RESERVE_STOCK`) fails. The orchestrator runs `RefundPayment` and then `RejectOrder`, in reverse order.
4. **Duplicate messages:** the orchestrator publishes each command twice with the same ID. Each service processes the first one and ignores the second.
5. **Slow payment:** `payment-service` takes 14 seconds to respond and the orchestrator's timeout is 10. The orchestrator resends the command, `payment-service` detects that the payment already exists and does not charge twice, and when the first reply arrives late, it is discarded.
6. **Inventory down:** `inventory-service` stops accepting messages. The messages wait in the queue and, if the service comes back in time, the saga completes. If not, it ends in `FAILED`.

For each scenario you can see the saga diagram moving forward (or compensating) live, and a timeline with every message and every decision the orchestrator makes.

If you want to see it in action, clone the repo and run it on your machine. You only need Docker:

```sh
git clone https://github.com/PatricioPoncini/saga-orchestration.git
cd saga-orchestration
docker compose up --build -d
```

Then open `http://localhost:3000` and start breaking things 😄

## What nobody tells you

The idea of the saga is simple. The hard part is everything that can go wrong with messages. There are three things you absolutely need to solve:

**1. Idempotency.** If a message can arrive twice, processing it twice must give the same result. In the project this is solved at two levels:

- **Per message (Inbox):** each service stores the ID of the messages it already processed, in the same transaction as the business change. If the ID already exists, the message is ignored.
- **Per business operation:** when the orchestrator retries after a timeout, the command travels with a new ID, so the Inbox does not detect it. That is why `payment-service` checks whether a payment already exists for that order before creating another one. This is what happens in the slow payment scenario.

If you want to go deeper into this, I have a [whole post about idempotency](/en/blog/que-es-la-idempotencia).

**2. Transactional outbox.** A service cannot save to its database and publish to RabbitMQ "at the same time": if it saves and crashes before publishing, the message is lost, and if it publishes and then the commit fails, it sent something that never happened. The solution is to save the message in an `outbox` table **within the same transaction** and have a separate process publish it later. That process uses `for update skip locked` so that multiple instances do not publish the same message.

**3. Compensations fail too.** What happens if the refund fails? You cannot "compensate the compensation". In the project, compensations are retried until they succeed. And if a service does not respond at all after 5 attempts, the saga ends in `FAILED`: that is the way of saying "a person needs to look at this". No pattern saves you in 100% of cases, but it does let you know exactly where everything stopped.

## Is it worth using?

It depends (like many answers in tech). If you have a business operation that spans several services, each with its own database, the saga is practically the only sane way to keep consistency.

Now, if you can solve that operation inside a single service and a single database, do it. A regular ACID transaction will always be simpler than any saga. Often, needing a saga is a sign that the boundaries between services are not in the right place.

Personally, what I liked most about building this project was realizing that the pattern itself is quite simple: a list of steps and a list of compensations. What really takes effort is everything around it: timeouts, duplicates, late messages, services going down. And seeing it work live helps much more than any diagram.

**Repository link: https://github.com/PatricioPoncini/saga-orchestration**

**Thanks for reading, see you in the next one! 👋**
