---
title: 'TypeScript 7.0: 10x faster thanks to a compiler written in Go'
summary: 'The TypeScript compiler is no longer written in TypeScript: it now runs natively in Go. The reasons behind the decision, the real benchmark numbers, and the detail that might hold back your migration to 7.0.'
date: '2026-08-28'
draft: false
tags:
  - Typescript
  - Go
  - Compilers
  - Performance
---

# Contents

- [The TypeScript compiler is no longer written in TypeScript](#the-typescript-compiler-is-no-longer-written-in-typescript)
- [New version: 7.0](#new-version-70)
- [What does Go bring to TypeScript?](#what-does-go-bring-to-typescript)
- [Why Go and not something else?](#why-go-and-not-something-else)
- [What real benefits did the benchmarks show?](#what-real-benefits-did-the-benchmarks-show)
- [What other important changes does 7.0 bring besides performance?](#what-other-important-changes-does-70-bring-besides-performance)
- [Conclusion](#conclusion)

# The TypeScript compiler is no longer written in TypeScript

For years, every time you opened a large project in your editor and waited those seconds (or minutes) while autocomplete caught up, the reason was the same: the TypeScript compiler runs on Node.js, it is single-threaded, and it does not scale well on projects with millions of lines of code.

Microsoft found the solution in an unexpected place: rewriting that compiler, literally file by file, in Go.

# New version: 7.0

A few months ago Microsoft announced the new version and said its compiler would be built in Go. According to them, the plan is to maintain the old and the new versions in parallel until the new one is mature.

If you already have some programming experience, you have probably heard about this language. Go (or Golang) is the language created by Google that is showing up more and more as a replacement for heavy tools: simple syntax, a short learning curve, and performance that competes with much more complex compiled languages.

On a personal note, it is my favorite language: I have rarely found a language where you write so little code to solve so much.

# What does Go bring to TypeScript?

The improvements Go brings are not about how fast your code runs, but about compiling projects: faster builds, less RAM usage, better scaling, among other things. All of this is an improvement for the developer; nothing changes for the end user, because the code that runs is still JavaScript underneath.

You notice this especially in projects with large codebases, where editors used to take a long time to load the whole project, and the same happened when generating builds or running CI processes. That was exactly the problem that pushed Microsoft to port the entire compiler to Go.

# Why Go and not something else?

They knew what they wanted to do, but they did not know which language to use. That is why they tried different options (Rust, C#, C++). In fact, many people complained that they did not use C#, since Microsoft created it and it is also Anders Hejlsberg's favorite language.

After trying several alternatives, these were their reasons for choosing Go:

- Its garbage collector fit well with what they needed.
- Go's design mapped well to how the TypeScript checker was already structured internally.
- Go is a simple language.
- Good support for concurrency.

# What real benefits did the benchmarks show?

All those design decisions turned into a concrete number: compared to version 6.0, the new version compiles up to 10 times faster, which also affects builds. And this is not only because of Go's good concurrency support: in a test using a single thread, the Go compiler was already 3 times faster than the TypeScript one.

You can see this evidence in the 2025 video where they announced the change and showed some examples of Go's advantages over TypeScript. They compiled a project with 1.5 million lines of code and measured how long it took.

**Link to the native port announcement (2025)**: https://devblogs.microsoft.com/typescript/typescript-native-port/

**Link to the official 7.0 announcement (2026)**: https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/

It is worth separating these two announcements: the first one, from 2025, is where Microsoft presented the native Go compiler as a preview and showed the performance tests I mentioned above. The second one, from July 2026, is the official release of version 7.0, which now ships that compiler by default.

## Times with the compiler built in TypeScript

<img src="/photos/typescript_compiler_time.png" alt="TS Compiler" width="500" />

_Source: [native port announcement (2025)](https://devblogs.microsoft.com/typescript/typescript-native-port/)_

## Times with the compiler built in Go

<img src="/photos/golang_compiler_time.png" alt="Go Compiler" width="500" />

_Source: [native port announcement (2025)](https://devblogs.microsoft.com/typescript/typescript-native-port/)_

# What other important changes does 7.0 bring besides performance?

Beyond the Go compiler, 7.0 also updates some defaults that came from 6.0: `strict` is now enabled by default, `module` becomes `esnext`, and support is removed for ES5, AMD/UMD modules, `baseUrl` and "classic" module resolution. If you have an old project, you will probably need to change its configuration before upgrading.

But the most important point, and the one that might hold back your migration, is this: **7.0 ships without a programmatic API**. That API only arrives in version 7.1. This means that tools that need to call the TypeScript compiler programmatically, like Vue, Angular, Svelte, Astro or MDX, cannot use 7.0 for their embedded type support yet and will keep relying on 6.0 in the meantime. As a temporary workaround, you can install `@typescript/typescript6` as `npm:@typescript/typescript6` to unblock tools like typescript-eslint.

# Conclusion

Moving an entire compiler to another language is not a small decision, especially when that compiler is the base of an ecosystem as large as TypeScript's. What is interesting about this change is not only the speed gain, but the philosophy behind it: improving the developer experience without touching the end-user experience at all, since users still run the same JavaScript as always.

Also, seeing Microsoft set aside "its own language" to choose the tool that best solved the problem is a good sign: no matter how much investment there is behind a technology, if another one solves the problem better, the change is worth it.

**Thanks for reading, see you in the next one!** 👋
