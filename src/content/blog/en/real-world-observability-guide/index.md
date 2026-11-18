---
title: 'Resilient Systems: How proactive observability prevents user impact'
summary: "In the digital world, a system being 'on' does not mean it is working well. This post explores how to move from simple monitoring to a deep understanding of our technology, making sure the business never walks blind."
date: '2026-03-23'
draft: false
tags:
  - Backend
  - SRE
  - Observability
  - Distributed Tracing
---

## The end of the "Up/Down" era

There was a time when it was enough to know whether the server was on or off. But that era is over. Today, the complexity of distributed systems has made traditional monitoring fall short: isolated metrics are the floor, not the ceiling.

In environments that keep growing, we need to evolve towards systems that give us clear answers. The key is that, when something unexpected happens, the system can tell us exactly when it failed, where and why, so we can react before the impact reaches the user.

Observability is not a tool you buy or a plugin you install so your logs look colorful in the console. It is a property of the architecture that lets us ask the system about states we never anticipated, going far beyond a simple "CPU at 90%" alert.

![Observability](/photos/observability.png)

## Monitoring vs Observability

It is common to confuse these terms, but the difference is clear:

- **Monitoring (the "What"):** It focuses on symptoms. It is the set of metrics and configurable alerts that warn us when a predefined threshold is broken. It tells us the system has a fever, but not the cause. It is reactive by nature.
- **Observability (the "Why"):** It focuses on the internal state. By correlating the three pillars (structured logs, metrics and traces), it lets us navigate the available information to find the source of an abnormal behavior, even if it is the first time it happens.

## Impact on operations and business

Implementing a solid observability and monitoring strategy is not a technical "luxury". It is an investment that directly impacts the team's efficiency and the product's profitability. These are the concrete problems we manage to reduce:

- **Drastic reduction of MTTR (Mean Time To Recovery):** Without observability, when something fails in production the team loses hours trying to guess the source of the problem. With full traceability, we go from guessing to data-driven diagnosis in minutes. This saves hundreds of work hours and minimizes the impact on the end user.
- **Detecting failures before the customer does:** Traditional monitoring tells us when something goes down, but observability shows us when something is not working well (for example, a P95 latency spike even when the average looks normal). This lets us act proactively before users report problems.
- **Objective validation of deploys and features:** It removes technical uncertainty after a release. By monitoring internal flows in real time, we can check whether a new feature behaves as expected under real load. If something goes wrong, we detect it immediately, allowing a safe rollback or a precise hotfix and avoiding costly regressions.
- **Removing bias from decision-making:** An observable system turns discussions about scalability or architectural changes into something more than subjective opinions. Having historical metrics and event correlation lets the business plan growth on a solid base of real data.

## The data triad and the golden signals

For observability to be effective, collecting data is not enough: you need to know what to look at and where to look. We rely on three pillars:

- **Metrics:** Aggregated data that shows overall health. This is where we monitor the golden signals: What is the P99 latency? What is the error rate per second? How saturated is the pod's memory?
- **Structured logs:** Detailed records of events. A log with context and enriched with good information helps us understand the "why" of a specific failure.
- **Traces:** They let us follow a request through the whole infrastructure, identifying bottlenecks along the way.

**The magic happens when these three pillars talk to each other**. You can jump from a metric alert straight to the log of that error and end up looking at the full trace. That is a real diagnostic system.

![Pillars](/photos/pilares.png)

## Getting started

Now that we understand the operational and business value, the question is: how do we start?

Today there are many ways to do it, from free basic options to paid ones where everything is already set up. But to give you an example, I prepared a sample repository so you can see how to get started:

**👉 Repo link: https://github.com/PatricioPoncini/opentelemetry-express-bun**

This repository contains a basic service that uses [OpenTelemetry](https://opentelemetry.io/) to show a pre-configured system health dashboard in Grafana. In the `README.md` file you will find how to run it locally and some examples of what is inside. I invite you to clone it and explore how the platform works and what information it gives you.

![Dashboard](/photos/grafana_dashboard.png)

## The stack: unified and standard observability

For the project I mentioned above, I designed an observability ecosystem based on OpenTelemetry. The main idea is to decouple the application from monitoring providers, so the system is vendor-agnostic and scalable:

- **Runtime ([Bun](https://bun.com/)):** We use Bun to take advantage of its execution speed and native TypeScript support.
- **Aggregated metrics ([Prometheus](https://prometheus.io/)):** We measure the Golden Signals (Latency, Traffic, Errors and Saturation) to understand overall health and trigger alerts before the user notices any degradation.
- **Structured logs ([Loki](https://grafana.com/oss/loki/)):** We move from plain text to structured data. By centralizing logs in JSON format, we can run complex queries in milliseconds, filtering by specific application contexts.
- **Distributed tracing ([Jaeger](https://www.jaegertracing.io/)):** It lets us break down response time and understand exactly which component (code, database or external services) is hurting the user experience.

## Conclusion

As we saw throughout this post, the real difference between a system that simply "monitors" and one that is truly "observable" is not in how nice its dashboards look. It is in the ability to respond and, above all, in the ability to ask our infrastructure about states we never anticipated when we wrote the first line of code.

As developers, our job does not end when the code compiles or the tests pass. Our job ends when we make sure the system is transparent and predictable.

The question is not whether your system will fail (because eventually it will), but how fast you can understand why it happened so it does not happen again. Observability is not an extra cost; it is the foundation for building quality software.

---

**If you made it this far, thank you so much for reading 😄 See you in the next post!**
