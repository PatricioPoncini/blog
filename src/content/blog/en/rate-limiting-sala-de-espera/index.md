---
title: 'Why ticket sites crash when tickets go on sale'
summary: 'It happened with Taylor Swift and it happens every time thousands of people try to buy in the same second. What''s behind those crashes and three ways to prevent them: rate limiting, a virtual waiting room and load shedding. With a Go simulator to see it in action.'
date: '2026-11-25'
draft: false
tags:
  - RateLimiting
  - Go
  - DistributedSystems
  - Architecture
  - SystemDesign
---

## Contents
- [The scene](#the-scene)
- [What happens without protection](#what-happens-without-protection)
- [First defense: token bucket rate limiting](#first-defense-token-bucket-rate-limiting)
- [Why rejecting is not enough](#why-rejecting-is-not-enough)
- [Second defense: the waiting room](#second-defense-the-waiting-room)
- [Third defense: load shedding](#third-defense-load-shedding)
- [Seeing it in action](#seeing-it-in-action)
- [What else can go wrong](#what-else-can-go-wrong)
- [Conclusion](#conclusion)

## The scene
Friday, 7:59 PM. A band announces that tickets go on sale at 8 PM, and thousands of people have the page open, hitting F5. At 8:00:00 they all click "Buy" at the same time.

This is not a hypothetical case. In November 2022, during the presale for Taylor Swift | The Eras Tour, Ticketmaster [reported](https://business.ticketmaster.com/business-solutions/taylor-swift-the-eras-tour-onsale-explained/) **3.5 billion total system requests, 4x its previous peak**. Over 3.5 million people had pre-registered. Around 1.5 million were sent codes to join the onsale, and the other 2 million were placed on a waiting list. More than 2 million tickets were sold that day.

The underlying problem is simple: **the demand in one second can be many times the system's capacity**. In this post we'll use toy numbers, the same ones the simulator at the end uses:

- **20,000 buyers** arriving within the first 10 seconds.
- A checkout that processes **500 requests per second**.
- On top of that, **100 catalog requests per second** (people browsing and searching) that hit the same backend.

That's 2,000 buyers per second against a capacity of 500. What happens?

## What happens without protection
Intuition says the system will be slow but will keep selling at 500 per second. It doesn't, and to see why it helps to separate two things:

- **Throughput**: all the requests per second sent to the server.
- **Goodput**: the part of the throughput handled without errors and with latency low enough for the client to use the response.

When the server is saturated, the queue grows. When the wait in the queue goes past the client's timeout, the client leaves and treats the request as failed. But the server doesn't know that: it keeps processing the request and answers nobody. All that work is thrown away.

On top of that, the client **retries**. Each retry is one more request in a queue that was already overflowing, so the wait grows even longer and even more requests arrive too late. It's a vicious circle: the more saturated the system is, the more load it gets, and it can stay that way for a while even after the original spike is over.

In the simulator, with no protection at all, that's exactly what happens. The first ~1,900 buyers, who arrived before the queue built up, get their tickets. After that **successful purchases drop to zero** while the backend runs at 100%. The server produces 118,000 answers for clients that were no longer waiting. 90% of the buyers end up leaving without a ticket.

It's the worst possible outcome: the system is busy, nobody buys, and everyone loses, even the people who got there first.

## First defense: token bucket rate limiting
The first idea is to never let in more work than the system can do. That's rate limiting, and one of its classic algorithms is the **token bucket**:

- There's a bucket that holds `b` tokens and starts full.
- The bucket is refilled at `r` tokens per second.
- Each request takes one token. If there is one, the request goes through. If not, it's rejected.

This controls two things separately: the **sustained rate** (`r`) and the **burst** you tolerate (`b`). A bucket of 50 tokens refilled at 500 per second lets 500 requests per second through on average, but absorbs a short spike of 50 at once without rejecting anyone. It's the algorithm used, for example, by Stripe to limit each user's requests to its API and by AWS API Gateway, where you configure it with exactly a rate and a burst.

In Go you don't need to write one: [`golang.org/x/time/rate`](https://pkg.go.dev/golang.org/x/time/rate) is a ready-to-use token bucket, and it's what the simulator uses:

```go
// One bucket per user (so a single client can't eat the whole budget)
// and a global one that protects the backend.
perUser := rate.NewLimiter(1, 2)   // 1 req/s, burst of 2
global  := rate.NewLimiter(500, 50) // the backend's capacity

if !perUser.Allow() || !global.Allow() {
    w.Header().Set("Retry-After", "1")
    w.WriteHeader(http.StatusTooManyRequests) // 429
    return
}
```

What do you answer the ones who don't get in? That's what **429 Too Many Requests** is for: the user has sent too many requests in a given amount of time. The response can include a **`Retry-After`** header, which tells the client how long to wait before trying again, either as a number of seconds or as a date.

Does it work? In the simulator, with rate limiting **all 20,000 buy** and the backend never gets saturated: no timeouts, no wasted work. Technical problem solved.

## Why rejecting is not enough
Now let's look at it from the user's side. In the same run:

- **Each buyer saw more than 20 errors on average** before being able to buy. In total, the system answered `429` more than 430,000 times.
- **Who buys first is close to random.** Whoever is lucky enough to have their retry land when a token is free gets in. Someone who arrived in second 1 can buy after someone who arrived in second 9.

For the user, a 429 is an error screen, and the natural reaction to an error is hitting F5 again. Rate limiting protects the **system**, but it gives the **user** no useful information: they don't know whether they're one second or ten minutes away, or whether it's worth waiting at all.

This is the twist of this post. Rejecting is a technical decision. What's missing is a **product** decision.

## Second defense: the waiting room
Instead of rejecting the extra buyers, you put them **in a line** and let them into the checkout at a pace the system can handle. While they wait, you show them where they are: "1,240 people ahead of you".

That's what products like Cloudflare Waiting Room offer. The room is configured with two thresholds: **how many simultaneous users** you want inside the application, and **the maximum rate** at which new users can come in. When those are exceeded, the visitor stays in the room until it's their turn, seeing an estimated wait time that keeps updating.

The important part is that **waiting costs the backend nothing**: the user isn't sending purchase requests that have to be rejected, they're waiting their turn on a page served separately.

In the simulator, I implemented the admission rate with the same token bucket as before. It no longer decides whom to reject, but **how many get through per second**.

### Fairness is a product decision
Who gets in first? There are two typical answers:

- **FIFO**: visitors are served in the order they entered the room.
- **Random**: visitors are picked at random to leave the room.

FIFO rewards whoever arrived first, which is often whoever has the best connection or the most tabs open. Random spreads the chances among everyone who was in the room. Neither one is right: it's a business decision with technical consequences. The simulator lets you try both.

Back to Ticketmaster: the Verified Fan presale codes are another way of deciding who gets in, decided before the sale instead of during it.

### The result
With the waiting room letting 350 people in per second:

- **Each buyer sends a single request** and sees no errors.
- The purchase order exactly follows the arrival order.
- The system sells at a steady pace, and the last buyer completes their purchase at second 57.

On paper, the waiting room is **slower** than rate limiting: 350 per second against a capacity of 500. That's on purpose, to leave room for the rest of the site, which also uses the backend. The difference is that nobody sees an error screen and everyone knows how long they have left.

## Third defense: load shedding
Even with all of the above, the backend can still get saturated: a deploy, a slow dependency, or traffic that doesn't go through the room. That's what **load shedding** is for: when the server is overloaded, it rejects work right away instead of queueing it, and **it chooses what to reject first**.

The key idea is that **not all endpoints are worth the same**. Stripe, for example, reserves part of its infrastructure for critical requests and, when it fills up, rejects lower-priority traffic first.

In our case, the checkout is what makes money and the catalog can wait. In the simulator, catalog requests are shed when the estimated queue wait goes above 100 ms, and checkout only above 1 second. That ensures nothing waits longer than the client timeout, so no work is wasted.

The result: the backend sells at 500 per second, its full capacity, and the catalog is the first thing sacrificed. But buyers still see errors (503s), about 10 each on average. Load shedding protects what matters, but it isn't a user experience.

## Seeing it in action
I built a Go simulator that runs the four variants with the same traffic. It's a discrete-event simulation in virtual time, and it's deterministic: the same seed always gives the same result.

__Repository link: https://github.com/PatricioPoncini/ticket-rush__

![Successful purchases per second in the four scenarios](/photos/ticket-rush-purchases.png)

The chart shows it all at a glance:

- **No protection** sells for 4 seconds and then collapses to zero while the server runs at 100%.
- **Rate limiting** stays close to capacity, at the cost of hundreds of thousands of 429s.
- **Load shedding** sells at full capacity by sacrificing the catalog.
- **The waiting room** sells at a flat, predictable pace.

The second chart shows the other side: **who buys first**. Each dot is a buyer. The horizontal axis is their arrival order and the vertical axis is when they bought.

![Arrival order vs. purchase time in the four scenarios](/photos/ticket-rush-who-buys-first.png)

With the waiting room it's a straight line: whoever arrived earlier buys earlier. With rate limiting and load shedding it's a cloud: arriving first guarantees nothing.

| Scenario | Bought | Gave up | Wait p50 | Wait p95 | Requests per buyer | Errors per buyer | Catalog OK | Wasted work |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| No protection | 1,872 | 18,128 | 1.5 s | 2.9 s | 19.4 | 18.9 | 0% | 118,010 |
| Rate limiting | 20,000 | 0 | 16.1 s | 37.1 s | 22.5 | 21.5 | 91% | 0 |
| Waiting room | 20,000 | 0 | 23.6 s | 44.9 s | 1.0 | 0.0 | 100% | 0 |
| Load shedding | 20,000 | 0 | 14.5 s | 33.3 s | 11.6 | 10.6 | 84% | 0 |

The numbers are illustrative parameters of a simulation, not measurements of a real system.

If you want to try it, all you need is Go installed. Clone the repo, start the server and open the page, where you pick the scenarios, change the parameters (number of buyers, capacity, FIFO or random) and open the sale to see how each strategy behaves. The README has the steps and the details of the model.

## What else can go wrong
A spike brings other problems that don't fit in this post, but they're worth naming:

- **Retries that duplicate purchases.** If the client retries a payment whose request did arrive, you can charge it twice. The fix is an idempotency key, as I explained in [Idempotency: how to design systems that survive retries](/en/blog/que-es-la-idempotencia).
- **Scaling at the last minute.** If you know when the spike will hit, don't wait for autoscaling to react. Most cloud providers let you schedule scaling so the extra capacity is already there before 8 PM.
- **Retry with backoff and jitter.** If you control the client, make it retry with exponential backoff (waiting longer between each attempt) and some randomness. That keeps everyone from coming back at the same time.

## Conclusion
The three defenses don't compete, they complement each other:

- **Rate limiting protects the system** from being asked for more than it can give.
- **The waiting room protects the experience**, turning an error into a wait with information.
- **Load shedding protects what makes money** when nothing else is enough.

The token bucket shows up in all three stories: as a limit in the first, as an admission rate in the second, and, in the background, in the idea that capacity is a budget to be shared.

Protecting the business from its own success is a product decision before it's a technical one. What gets rejected, who has to wait and who gets in first are questions the code can only answer after someone has decided them.
