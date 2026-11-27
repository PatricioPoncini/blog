---
title: 'Idempotency in practice: 50 identical payments, one charge'
summary: 'Without idempotency, 50 requests with the same key charged 50 times and every one answered `201`. With it, just once. A TypeScript payments API built to break on purpose: concurrency, crashes right after charging and Redis going down, with the numbers for each case.'
date: '2026-11-26'
draft: false
tags:
  - Idempotency
  - TypeScript
  - Backend
  - DistributedSystems
  - SystemDesign
---

## Contents
- [The scene](#the-scene)
- [Without idempotency: 50 requests, 50 charges](#without-idempotency-50-requests-50-charges)
- [The fingerprint: the key alone is not enough](#the-fingerprint-the-key-alone-is-not-enough)
- [Two requests at the same time](#two-requests-at-the-same-time)
- [TTL and LOCK_TTL are not the same thing](#ttl-and-lock_ttl-are-not-the-same-thing)
- [The lock needs an owner](#the-lock-needs-an-owner)
- [5xx responses are not stored, 4xx responses are](#5xx-responses-are-not-stored-4xx-responses-are)
- [When Redis goes down](#when-redis-goes-down)
- [The worst window: charge, then die](#the-worst-window-charge-then-die)
- [The last line of defense](#the-last-line-of-defense)
- [Seeing it in action](#seeing-it-in-action)
- [What this does not guarantee](#what-this-does-not-guarantee)
- [Conclusion](#conclusion)

## The scene
In [Idempotency: how to design systems that survive retries](/en/blog/que-es-la-idempotencia) I explained the idea: the client sends an `Idempotency-Key` header, the server stores the result for that key and, if the key shows up again, returns what it already answered. The example fit in twenty lines of Go.

This post is part two. I built a simulated payments API to see **what happens to those twenty lines** once reality starts pushing: 50 identical requests in the same millisecond, a client that reuses the key with a different amount, a process that dies right after charging, a Redis that stops answering.

The stack is TypeScript with [Hono](https://hono.dev), Postgres for payments and Redis (or Postgres again) for the keys. Every number below comes from tests and a load script running against real Postgres and Redis, not from estimates.

The domain is as simple as it gets: three accounts with a balance and a `POST /payments` endpoint that calls a simulated payment processor, debits the account and records the payment. The processor counts how many times it moved money. That counter is the only metric that matters.

## Without idempotency: 50 requests, 50 charges
First, the problem. With idempotency turned off, I sent 50 simultaneous requests with the same body and the same key, 10 times:

- **500 charges** for 10 operations.
- All 500 answered `201 Created`. No error tells you something went wrong.
- p50 of 8 seconds, p95 of 14.8.

Why so slow? Each payment locks the account row (`SELECT ... FOR UPDATE`) while it talks to the processor, so two different payments can't overdraw it. The 50 duplicates queue up and get charged **one at a time**, 300 ms each. You don't just overcharge: the duplicates also slow down the legitimate payments for that account.

This is how it looks in the project's UI with 10 parallel requests: 10 charges for a single key, and each response takes 300 ms longer than the previous one because they're charged in line.

![Without idempotency: 10 charges for a single key](/photos/idempotent-payments-double-charge.png)

## The fingerprint: the key alone is not enough
The key says "this is a retry", but not **of what**. Picture a client with a bug that reuses the key from a $25 payment for a $99 one. If the server only looks at the key, it returns the $25 result with a `201`. The client thinks it charged $99. Nobody notices until reconciliation.

That's why the server stores a **fingerprint** of the request next to the key: a `sha256` of the method, the path and the body. If the same key arrives with a different fingerprint, it's a `422`: a loud error instead of wrong data.

One detail: the body is normalized before hashing, with the JSON keys sorted. `{"a":1,"b":2}` and `{"b":2,"a":1}` are the same payment, and a retry shouldn't fail because some other library serialized the keys in a different order. There's a test for that.

The key also has a **scope**: `idem:{client}:{method}:{route}:{key}`. Two different clients can generate the same key without stepping on each other, and the same key on two different endpoints doesn't collide.

## Two requests at the same time
The example from the previous post did "look up the key, process if it's missing, then store". Between the lookup and the store there's a window, and with 50 requests at the same time, all 50 slip through it.

The fix is to make **taking the key a single atomic operation**. In Redis that's `SET ... NX`, which only writes if the key doesn't exist.

Exactly one of the 50 gets `OK`. The other 49 find the `in_progress` record, and there are two options:

- **Reject** with `409` and a `Retry-After`. The client retries later and gets the replay.
- **Wait** for the first one to finish and return its result.

Measured with 50 requests per round and 20 rounds:

| Strategy | Charges | Responses | p50 | p95 |
|---|---:|---|---:|---:|
| No idempotency (10 rounds) | 500 | 500 × `201` | 8,000 ms | 14,800 ms |
| Redis, reject | 20 | 20 × `201`, 980 × `409` | 14 ms | 21 ms |
| Redis, wait | 20 | 1,000 × `201` (980 replays) | 342 ms | 353 ms |
| Transactional Postgres | 20 | 1,000 × `201` (980 replays) | 333 ms | 350 ms |

Rejecting frees the server in milliseconds but hands the work to the client. Waiting is friendlier, but every waiting request holds a connection. Neither is the right one: it depends on who your client is.

The same 10 requests with idempotency on: one `201`, nine `409` in a few milliseconds and, when the client retries, the replay with the same processor reference (`ch_000001`). A single charge.

![With idempotency: one charge, nine 409s and a replay](/photos/idempotent-payments-fix.png)

## TTL and LOCK_TTL are not the same thing
There are two durations and they're easy to mix up:

- **`TTL`** (24 hours): how long a **finished** result is remembered. It defines how long a retry gets a replay. After that, the same key is a new operation.
- **`LOCK_TTL`** (30 seconds): how long the lock of a request **in progress** lives if the process that took it never finishes. It's what keeps a crash from locking the key forever.

With a single number you'd have to choose between a 24-hour lock (a crash blocks the key for a whole day) or remembering results for 30 seconds (a retry one minute later charges again). That's why they're two variables, with two tests.

`LOCK_TTL` has to be longer than the slowest handler. In one test I set it to 1 second with a processor that takes 1.5. The lock expired while the first request was still charging, a second request with the same key got in and **the payment was charged twice**. A lock isn't mutual exclusion if the handler is slower than the lock.

## The lock needs an owner
That same scenario hides a subtler bug. Request A takes the lock, takes too long and the lock expires. B comes in and takes the key. Then A finishes and stores its result... **on top of B's**. Or worse: A fails, deletes "its" lock, and actually deletes B's while B is still working. A third request comes in and charges again.

That's why every lock carries a random **owner token**, and storing or releasing only works if the token matches. The comparison and the write have to be atomic, so in Redis it's a Lua script:

```lua
local current = redis.call('GET', KEYS[1])
if not current then return 0 end
local record = cjson.decode(current)
if record.token ~= ARGV[1] then return 0 end   -- you're not the owner anymore
record.status = 'completed'
record.response = cjson.decode(ARGV[2])
redis.call('SET', KEYS[1], cjson.encode(record), 'PX', ARGV[3])
return 1
```

In the test, A finishes while B is the owner: its write is discarded and the next retry gets B's payment. Doing it in two steps from application code (read, compare, write) would bring the same race back.

## 5xx responses are not stored, 4xx responses are
Which results get stored? Not all of them.

A **5xx** says "something failed on my side, try again". If you store it, every retry gets the same error for 24 hours: idempotency turns a transient error into a permanent one. On a 5xx the lock is released and the next attempt actually runs. In the test, the processor fails, the client retries and the payment goes through: 2 processor calls, 1 charge.

A **4xx** says "your request is wrong", and repeating the same request gives the same answer. It gets stored. In the test, a payment fails with insufficient funds, then the account is topped up and the same key is retried: **it still answers `422`**. A key always answers the same thing. If the client wants to try again with the new balance, that's a different operation and it gets a different key.

## When Redis goes down
If the key store doesn't answer, you have to choose:

- **Fail-closed**: answer `503` and process nothing. Measured: 250 requests, 0 charges.
- **Fail-open**: process without protection and log a warning. Measured: 250 requests with 5 keys, **250 charges**.

For payments, closed: it's better not to charge for a few minutes than to overcharge. For "mark notification as read", open is fine. It's a business decision, not a technical one.

A detail that showed up while testing with Redis actually down: by default, `ioredis` **queues commands** while it tries to reconnect instead of failing. The request just hangs. To get the `503` back in milliseconds I had to disable the offline queue and add a command timeout.

## The worst window: charge, then die
This is the part the twenty-line example can't solve. The handler charges, commits the debit and, **before storing the result**, the process dies. I simulated it by destroying the socket without answering. The client sees a dropped connection, doesn't know whether it paid, and retries.

**With Redis**, the effect (in Postgres) and the result (in Redis) live in two different systems. After the crash, the `in_progress` lock stays until `LOCK_TTL` expires. The retry gets `409`... until the lock expires. Then it runs again: **two charges and two debits**.

When I tried it from the UI, something I hadn't planned for happened: **the browser retried the POST on its own**. The page sent a single request, the connection dropped and Chrome sent it again without the code ever knowing. That automatic retry is the 319 ms `409` in the first row: the lock was still held. For the demo I set `LOCK_TTL` to 5 seconds. After that, the next retry charged again.

![Crash with Redis: the lock expires and the retry charges again](/photos/idempotent-payments-crash-redis.png)

Retries aren't hypothetical. You don't even have to write them yourself.

**With transactional Postgres**, the key, the debit and the response are written in **the same transaction**.

If the process dies before `COMMIT`, Postgres rolls everything back: no debit and no key. The retry gets in right away and the database ends up with a single debit. Concurrency also solves itself: a duplicate blocks on the unique index until the first one commits, and then finds the result.

But the tests showed something I didn't expect to see so clearly:

| Scenario | Processor charges | Database debits |
|---|---:|---:|
| Redis | 2 | 2 |
| Transactional Postgres | **2** | 1 |
| Redis + deduplicating processor | 1 | **2** |
| Transactional Postgres + deduplicating processor | 1 | 1 |

With Postgres the database is right, but **the processor still charged twice**. The processor is an external system and none of our transactions reach it. The first charge happened, and when the transaction rolled back, nobody told the processor.

## The last line of defense
The only row in that table with no double charge and correct books is the last one: a Postgres transaction **and** a processor that doesn't charge the same operation twice.

That's why the handler passes the key to the processor as a reference (`{client}:{key}`). It's what real processors do: Stripe, for example, accepts its own `Idempotency-Key` header. If your provider supports it, propagating the key costs nothing and closes the window your code can't close.

In the UI, with Postgres and the deduplicating processor, the browser retried on its own again: while the failure was active it sent **the same POST five times**, and all five charged and "crashed". Since every crash rolls the transaction back, every retry ran again and called the processor: 6 calls in total. But the processor recognized the key and moved money **only once**. One charge, one payment, and the following retries get the replay.

![Crash with Postgres and an idempotent processor: 6 calls, 1 charge](/photos/idempotent-payments-crash-postgres.png)

The reverse isn't enough either. With the API's idempotency **turned off** and only the processor deduplicating, I measured 500 requests with 10 keys: 10 real charges, but **500 payments and 500 debits in our database**. The processor protects the customer's money, but not your books. You need both layers.

## Seeing it in action
The project has a UI to trigger all of this by hand: send a payment, retry it, send N in parallel with the same key, change the amount, turn idempotency on and off, switch stores and inject failures (processor down, crash after charging, Redis down). A counter compares processor charges with keys sent and turns red when there's a double charge.

The page opens with a short guide and three scenarios you can run with one click.

![The demo UI](/photos/idempotent-payments-overview.jpg)

__Repository link: https://github.com/PatricioPoncini/idempotent-payments__

You need Node, pnpm and Docker to try it:

```bash
pnpm install
docker compose up -d --wait
pnpm dev     # http://localhost:3000
```

Besides the UI, the repo includes:

- **Tests** with Vitest against real Postgres and Redis: the cases in this post, for both strategies. I ran the suite 6 times in a row without a single flaky failure.
- **`idemcheck`**, a script that sends N simultaneous requests with the same key for R rounds, reads how many charges the processor made and **exits with an error if any key was charged more than once**. You can point it at any API that claims to be idempotent.

The README has the environment variable table, the flow diagram and the numbers for every scenario.

## What this does not guarantee
- **That the external charge happens only once if the process dies at the worst moment**, unless the processor also deduplicates.
- **Mutual exclusion if the handler takes longer than `LOCK_TTL`.** The token keeps results from overwriting each other, but it doesn't prevent the second effect.
- **That a key is remembered forever.** After the `TTL`, it's a new operation.
- **Anything, in fail-open mode with the store down.** It does exactly what the name says.
- **Consistency across Redis replicas.** With asynchronous replication, a freshly written lock can be lost during a failover.

## Conclusion
The twenty-line version of idempotency is correct as long as requests arrive one at a time and nothing fails. The interesting part is at the edges:

- **Atomicity** solves concurrency: taking the key has to be a single operation.
- **The fingerprint** turns a silent client bug into a visible error.
- **Two separate TTLs** separate "how long I remember" from "how long I wait for someone who may be dead".
- **The owner token** keeps a slow request from overwriting the one that came after it.
- **The shared transaction** closes the window between the effect and the result, but only inside your database.
- **Propagating the key** to the external provider is the only thing that covers what happens outside.

No single layer is enough. The question in the previous post was "what happens if the same request arrives twice?". This one's is "what happens if it arrives twice **and** something fails in between?". For an endpoint that moves money, you want an answer to both.

**Thanks for reading, see you in the next one!** 👋
