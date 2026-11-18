---
title: 'Fetchy: a CLI utility to get system information'
summary: 'What Fetchy is, why I built it and how it works under the hood.'
date: '2025-11-15'
draft: false
tags:
  - Go
  - CLI
  - Linux
  - Tools
---

## What is Fetchy?

Fetchy is a lightweight tool written in Go that shows complete system information right from the terminal. It displays details about hardware, software, kernel, memory, GPU, CPU and more, all with clean, colorful and easy-to-read output.

It started as my own version of the classic _neofetch_-like tools, but focused on being simpler, more minimal and built entirely my way.

## Why did I build Fetchy?

I have always liked tools that show system information in the terminal, but most of them are very large, have thousands of settings or need external dependencies. I wanted something:

- **simple**
- **written in Go**
- **fast to run**
- and easy to extend, so I could learn more about hardware and operating system detection

I also wanted to use it on my own machines, whether to check specs, show information in demos or just have fun building a CLI tool from scratch.

Fetchy is a mix of a personal project, a technical exercise and a tool I actually use every day.

## Technologies used

To build Fetchy, I used:

- **Main language**: Go
- **Go standard library**: for file handling, running commands and system introspection
- **ANSI terminal codes**: to add colors and styles to the output
- **Makefile**: for build and run tasks

I chose Go because it is one of my favorite languages for building small, portable and extremely fast tools. Also, compiling a single binary with no dependencies is ideal for this kind of project.

## How does it work internally?

Fetchy gets system information by combining:

1. Direct reads from `/proc` and `/sys` (on Linux).
2. Running internal commands (for example, for the GPU or kernel).
3. Parsing system files for CPU, memory and product information.
4. Detecting the shell and terminal in use.
5. Rendering the result in a clean format with ANSI colors.

## What is Fetchy useful for?

- Seeing your system information at a glance.
- Using it in screenshots, demos or technical presentations.
- Quick hardware diagnostics.
- A lightweight tool for developers who switch environments often.
- A starting point for anyone who wants to learn how to read system data from Go.

## Demo

```shell

    ______     __       __
   / ____/__  / /______/ /_  __  __
  / /_  / _ \/ __/ ___/ __ \/ / / /
 / __/ /  __/ /_/ /__/ / / / /_/ /
/_/    \___/\__/\___/_/ /_/\__, /
                          /____/

A Lightweight System Info Tool

System Information:
User:        tripa
Hostname:    kitt
OS name:     Ubuntu 22.04.5 LTS
OS version:  22.04
Arch:        amd64
CPU:         12th Gen Intel(R) Core(TM) i5-12400F
Product:     System Product Name (ASUSTeK COMPUTER INC.)

Terminal:    /usr/bin/zsh
Kernel:      6.8.0-48-generic
RAM:         15Gi total, 9,0Gi used
GPU:         01:00.0 VGA compatible controller: NVIDIA Corporation GM206 [GeForce GTX 950] (rev a1)

Storage Info:
Model                     Size (GB)
---------------------------------------------
KINGSTON                       894,3G
WD                             931,5G
---------------------------------------------
```

## What's next?

I have several ideas for future improvements:

- Support more operating systems.
- Show progress bars for RAM or disk usage.
- Add extra flags like `--json` or `--minimal`.
- Create a simple cross-platform installer.

If you want to see the code, try it or contribute, you can visit the repository on GitHub:

**[See Fetchy on GitHub](https://github.com/PatricioPoncini/fetchy)**
