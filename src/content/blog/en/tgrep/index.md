---
title: 'tgrep: a code search tool built for AI agents that already ships with GitHub Copilot CLI'
summary: 'An AI agent can run dozens of searches in a single task, and in a huge repository each one has a cost. tgrep, the Microsoft tool already used by GitHub Copilot CLI, solves this with a trigram index. How it works and how it compares to ripgrep.'
date: '2026-09-25'
draft: false
tags:
  - Rust
  - Performance
  - DeveloperTools
  - AI
  - Search
---

## Contents

- [The problem](#the-problem)
- [What is tgrep?](#what-is-tgrep)
- [How does tgrep work?](#how-does-tgrep-work)
- [Benchmark test](#benchmark-test)
- [Is it worth using?](#is-it-worth-using)

## The problem

In huge repositories, with thousands and thousands of files, `grep` and `ripgrep` (well-known tools in the tech world) read every file on each search. The problem with this is performance. You can ignore files or optimize the search with these tools, but often that is not enough.

`tgrep` solves this with an index. Instead of reading every file on each search, it builds a trigram index once and then uses it to go straight to the files that might contain what you are looking for. On top of that, it adds a server that keeps the index loaded in memory and updated as the code changes.

## What is tgrep?

It is basically an indexed search engine that uses trigram search with a client/server architecture to run regex searches quickly on large codebases. Like `ripgrep`, it is written in Rust.

Microsoft released `tgrep` to make GitHub Copilot CLI searches more efficient, so it already ships with that tool.

**Repository link: https://github.com/microsoft/tgrep**

## How does tgrep work?

`tgrep` walks through the project (respecting files like `.gitignore` and skipping binaries and files larger than 64 MiB) and splits the content of each file into trigrams: overlapping 3-byte chunks. For example, `hello` is split into `hel`, `ell` and `llo`. Then, for each trigram, it builds a posting list with the files where it appears.

### How to try tgrep on a project

We will use [gecko-dev](https://github.com/mozilla/gecko-dev), the Firefox source code. First we need to index the project, and then start the server we will use to run searches.

To index a project with `tgrep`, we run `tgrep index .` and get the following output:

```sh
➜  gecko-dev git:(master) tgrep index .
Walking /Users/tripa/projects/pruebas/gecko-dev...
Found 375031 text files (12784 binary skipped, 1 too large, 0 errors)
Extracting trigrams...
Skipped 2398 additional binary files (detected by content)
Merging 61 spill segment(s) into the index...
Writing index (1128631 trigrams, 372633 files, 61 spill segment(s))...
Index built successfully at /Users/tripa/projects/pruebas/gecko-dev/.tgrep
Indexed in 23.9s using external strategy (peak memory 814.5 MiB)
```

It tells us how many files it found, which ones it skipped, whether there were errors and how long the operation took.

Once the project is indexed, we can start the server and begin using it. We run `tgrep serve .` and it is up and ready to use:

```sh
➜  gecko-dev git:(master) ✗ tgrep serve .
[trace] opened index: 372633 files, 1128631 trigrams in 109.0ms
[trace] serve ready in 1180.6ms. TCP on port 50665. Cache: max 50000 entries / 1024 MiB (entries over 64 MiB not cached). Memory cap: 8192 MB. Index threads: 5. Watcher queue cap: 16384.
[trace] refresh mode: auto, native watch budget=8192
[trace] watcher subscriptions deferred until the ignore matcher is ready
[trace] file watcher worker started (complete native coverage: true)
[trace] stale check: comparing index against filesystem...
[trace] gitignore matcher built from stale walk in 5.7ms (100 .gitignore + 0 .ignore files)
[trace] stale check: index is up-to-date (375031 files checked in 1213ms)
```

## Benchmark test

For the benchmark, we will search for a Firefox interface that appears in a moderate number of files, which is a good use case to test search speed.

I will use [hyperfine](https://github.com/sharkdp/hyperfine), a CLI benchmarking tool.

```sh
➜  gecko-dev git:(master) ✗ hyperfine --warmup 1 --runs 10 -N \
  'rg --no-heading --color never nsIObserverService .' \
  'tgrep --no-heading --color never nsIObserverService .'
Benchmark 1: rg --no-heading --color never nsIObserverService .
  Time (mean ± σ):      7.261 s ±  0.644 s    [User: 1.628 s, System: 31.044 s]
  Range (min … max):    6.406 s …  8.182 s    10 runs

Benchmark 2: tgrep --no-heading --color never nsIObserverService .
  Time (mean ± σ):      15.1 ms ±   0.8 ms    [User: 3.7 ms, System: 1.6 ms]
  Range (min … max):    14.0 ms …  16.3 ms    10 runs

Summary
  tgrep --no-heading --color never nsIObserverService . ran
  481.98 ± 50.32 times faster than rg --no-heading --color never nsIObserverService .
```

As we can see, `ripgrep` takes about 7 seconds to go through all of gecko-dev, while `tgrep` responds in 15 milliseconds. That is roughly 480 times faster.

To check that the results are the same, we save each tool's output, sorted and with line numbers, and compare them:

```sh
➜  gecko-dev git:(master) ✗ rg    --no-heading --color never -n nsIObserverService . | sort > /tmp/rg.txt
➜  gecko-dev git:(master) ✗ tgrep --no-heading --color never -n nsIObserverService . | sort > /tmp/tg.txt
➜  gecko-dev git:(master) ✗ wc -l /tmp/rg.txt /tmp/tg.txt
    1139 /tmp/rg.txt
    1139 /tmp/tg.txt
    2278 total
➜  gecko-dev git:(master) ✗ diff /tmp/rg.txt /tmp/tg.txt && echo "Identical results"
Identical results
```

Both find the same 1139 matches, in the same files and on the same lines.

Still, there is a tradeoff. `tgrep` works on an index that you need to build first, it uses disk space and resources, and it stays up to date with a running server. `ripgrep`, on the other hand, needs none of this and searches the files directly.

## Is it worth using?

It depends (like many answers in tech). If you use [GitHub Copilot CLI](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-command-reference#environment-variables), you are already using it without knowing, because inside a Git repository the tool uses `tgrep` for its searches. It does not always use it, though: outside a Git repo it falls back to `ripgrep`. If you want to force one or the other, there is the `USE_TGREP` environment variable.

Personally, I think it is useful when working on very large projects and we want to use AI agents or run very specific searches on huge codebases (like the gecko-dev project we used for the benchmark).

The nice part is that after indexing the project, we can start the server and it listens for file changes, keeping the index alive. This way we do not need to re-index the project often, because it keeps updating itself.

For small and medium projects, I still think `ripgrep` is the best option, but it never hurts to know that other tools exist for more extreme cases.

**Thanks for reading, see you in the next one! 👋**
