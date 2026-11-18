---
title: 'Introducing Dolarcito-Bot: your assistant for exchange rates'
summary: 'A look at the Dolarcito-Bot project: what it is, why I built it, how it works and which technologies I used.'
date: '2025-11-15'
draft: false
tags:
  - Bots
  - Go
  - Automation
---

## What is Dolarcito-Bot?

![Logo](https://camo.githubusercontent.com/d039cc1fe6d09d45ce8c45f3155ece46148d1742e705ea8602e718035874181a/68747470733a2f2f692e696d6775722e636f6d2f565a4d4a7a31692e706e67)
Dolarcito-Bot is a Telegram bot that gives you real-time US dollar exchange rates in Argentina, with automatic reminders.

It is a work-in-progress project that lets you get the dollar exchange rate, either by asking for it at any moment or through automatic notifications. The idea came from wanting my own way to access real-time or scheduled exchange rates, building a solution my way and with my own technical decisions.

## Why did I build Dolarcito-Bot?

This bot started from the idea of having something automatic that reminds me every day of the dollar exchange rate in Argentina. I wanted to build it as a project, both for me and for anyone else who might find it useful.

In Argentina the stock market closes at 5:00 p.m., so I thought it would be a good idea to get a notification at closing time with the different exchange rates, plus a short comparison between the "Official" and "Blue" (informal market) rates, which was the one I cared about most.

There are websites today that show exchange rates in real time, but I still wanted to build my own version with the features I thought would be interesting, and have some fun coding along the way.

I built it for myself, but also for anyone who needs a simple and reliable tool to check the dollar rate from their phone or computer.

## Technologies used

To build Dolarcito-Bot, I used:

- **Main language**: Go
- **Exchange rate API**: [DolarApi](https://dolarapi.com/docs/)
- **Database**: PostgreSQL
- **Automation**: a cron job that runs scheduled tasks to send notifications to users

I chose Go simply because I like it. In future posts you will see how much I love this language.

## How does it work internally?

1. The bot calls an external API to get the current dollar rate.
2. It processes the response to extract the relevant rate.
3. It replies to the user with the value formatted in Markdown.

This works both when the user asks for the rate at that moment and through a scheduled task run by a cron job. In the second case, the system reads the registered chats from PostgreSQL and sends the notification to each one.

## What is Dolarcito-Bot useful for?

- **Freelancers or remote workers** who get paid in dollars or another currency: they can check exchange rates quickly and automatically.
- **Regular users** who just want to know the rate without going through complicated websites.

## What's next?

My plan for the next few months includes:

- Adding more advanced commands (for example, checking rates for other currencies).
- Improving the documentation so others can contribute more easily.

If you want to collaborate, give feedback or just try it, you can visit the repo on GitHub:

**[See Dolarcito-Bot on GitHub](https://github.com/PatricioPoncini/dolarcito-bot)**
