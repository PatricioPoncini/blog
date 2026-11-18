---
title: 'The core of concurrency in Go: Goroutines, Channels and Worker Pools'
summary: 'It is not just about running functions in the background. Learn how to synchronize processes safely and implement Worker Pool patterns to solve real bottlenecks while making the most of your hardware.'
date: '2026-03-08'
draft: false
tags:
  - Go
  - Concurrency
  - Backend
  - Performance
---

## Beyond sequential execution

In backend engineering, efficiency is defined by how well you use the hardware. While conventional software usually runs sequentially (using a single processor core and leaving the rest idle), modern architectures require a design that can distribute the workload.

Optimizing a system is not simply about "going faster"; it is about maximizing throughput (the amount of work processed) and reducing total latency through real parallelism. In this article, we will explore how Go changes this approach.

## What is concurrency in software?

It is often confused with parallelism, but concurrency is a language's ability to manage multiple tasks at the same time, while parallelism is physically running them simultaneously. Go makes both easy with an extremely lightweight execution model.

## Concurrency in Go: the CSP model

To implement this model, Go relies on two core pillars that allow safe communication between processes without the complexity of traditional threads:

- **Goroutines**: The smallest unit of asynchronous execution.
- **Channels**: The safe pipe to exchange data between them.

## What are Goroutines and Channels?

A Goroutine is a function that runs independently and concurrently when we tell it to, using the `go` keyword in the code. They are lightweight, cheap to create and managed by the Go runtime.

Channels are the main communication mechanism between Goroutines. A channel is a typed pipe that lets you send and receive values. The interesting part is that a send blocks until someone receives, and the other way around: a receive blocks until someone sends.

## How does this magic happen?

Let's start with a very practical and simple code example:

```go
package main

import (
	"fmt"
	"time"
)

func prepareCoffee(order string, out chan<- string) {
	fmt.Printf("☕ Starting: %s\n", order)
	time.Sleep(1 * time.Second) // Simulates the time the coffee machine takes
	out <- fmt.Sprintf("✅ %s is ready!", order)
}

func main() {
	orders := []string{"Espresso", "Latte", "Cappuccino"}
	results := make(chan string)
	start := time.Now()

	for _, coffee := range orders {
		go prepareCoffee(coffee, results) // The 3 coffees start being prepared at the same time
	}

	for i := 0; i < len(orders); i++ {
		fmt.Println(<-results) // We receive each coffee when it is ready
	}

	fmt.Printf("\nTotal time: %v (The 3 coffees took only 1s!)\n", time.Since(start))
}
```

- Defining the work (`prepareCoffee`): Look at the function signature. It receives a channel called `out` of type `chan<- string`. That little arrow means this channel is only for sending data. At the end of the function, the line `out <- fmt.Sprintf(...)` is the moment when the barista puts the coffee on the tray so someone else can take it.
- Creating the output tray (`results`): Inside `main`, we create our channel with `results := make(chan string)`. Without this line, we would have nowhere to receive the baristas' notifications.
- The "make it now" order (`go prepareCoffee`): In the first `for` loop, we use the `go` keyword. This is where the program becomes concurrent. Instead of waiting 1 second for the "Espresso" to be ready, the code sends the task to the background and immediately jumps to the next order ("Latte").
- Smart waiting (`<-results`): The second `for` loop is essential. The expression `<-results` tells the program: "Wait here until a value comes out of the channel". Since we sent 3 orders, we need to do this 3 times.

As a result, even though each coffee takes 1 second, since they all started almost at the same time, the final timer shows just a bit more than 1 second in total.

```shell
☕ Starting: Cappuccino
☕ Starting: Espresso
☕ Starting: Latte
✅ Latte is ready!
✅ Cappuccino is ready!
✅ Espresso is ready!

Total time: 1.000344844s (The 3 coffees took only 1s!)
```

## Implementation: syntax and typing

Now let's get more technical. Here is a short introduction so you know how to use it in your code:

### 1. Goroutines

You do not need to set up a complex thread pool. Just put the `go` keyword before any function call:

- `go myFunction()`: Runs an existing function.

### 2. Channels

They are always created with `make`:

- **Unbuffered (synchronous)**: `ch := make(chan int)`. The sender waits until there is a receiver.
- **Buffered (asynchronous)**: `ch := make(chan int, 10)`. It lets you send up to 10 items before blocking, which is ideal when the sender is faster than the receiver.

### 3. Direction (strong typing)

Go lets you be very specific to avoid logic errors:

- `chan string`: Read and write channel.
- `chan<- string`: Send-only channel (the receiver gets a compile error if it tries to read).
- `<-chan string`: Receive-only channel (the sender cannot put data in it).

## Using it in more advanced processes

We now have the basics of how to improve the performance of our Go code. Let's move on to something a bit more advanced: a more useful, real-life example.

Let's say we have a website that reduces the size of images. This is common: sometimes an image weighs 3MB, which is too heavy for some sites, so we want to reduce its size without losing quality.

For this, we can have a backend server written in Go that receives the images, processes them one by one and then returns them with a smaller size. If processing each image takes 1 second and we receive 10 images, it would take 10 seconds to process them all.

But now we know we can handle processes concurrently, so we could process several images at the same time without breaking the workflow, and with a much better response time. The following example is a bit more advanced:

```go
package main

import (
	"fmt"
	"image/jpeg"
	"os"
	"path/filepath"
	"runtime"
	"sync"
	"time"
)

const (
	inputDir  = "images"
	outputDir = "output"
	quality   = 20
)

func optimizeImage(fileName string) error {
	filePath := filepath.Join(inputDir, fileName)
	file, err := os.Open(filePath)
	if err != nil {
		return err
	}
	defer file.Close()

	img, err := jpeg.Decode(file)
	if err != nil {
		return err
	}

	outPath := filepath.Join(outputDir, "opt_"+fileName)
	outFile, err := os.Create(outPath)
	if err != nil {
		return err
	}
	defer outFile.Close()

	options := jpeg.Options{Quality: quality}
	return jpeg.Encode(outFile, img, &options)
}

func main() {
	files, _ := filepath.Glob(filepath.Join(inputDir, "*.jpg"))
	if len(files) == 0 {
		fmt.Println("No images found in 'images' folder. Please add some .jpg files.")
		return
	}
	_ = os.MkdirAll(outputDir, os.ModePerm)

	fmt.Printf("System: %d cores | Images to process: %d\n\n", runtime.NumCPU(), len(files))

	fmt.Println("Starting Sequential Optimization...")
	start := time.Now()
	for _, file := range files {
		_ = optimizeImage(filepath.Base(file))
	}
	seqDuration := time.Since(start)
	fmt.Printf("Sequential took: %v\n\n", seqDuration)

	_ = os.RemoveAll(outputDir)
	_ = os.MkdirAll(outputDir, os.ModePerm)

	numWorkers := runtime.NumCPU()
	jobs := make(chan string, len(files))
	var wg sync.WaitGroup

	fmt.Printf("Starting Worker Pool with %d workers...\n", numWorkers)
	start = time.Now()

	for w := 1; w <= numWorkers; w++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for fileName := range jobs {
				_ = optimizeImage(fileName)
			}
		}()
	}

	for _, file := range files {
		jobs <- filepath.Base(file)
	}
	close(jobs)
	wg.Wait()

	poolDuration := time.Since(start)
	fmt.Printf("Worker Pool took: %v\n", poolDuration)

	speedup := float64(seqDuration) / float64(poolDuration)
	fmt.Printf("\nPerformance gain: %.2fx faster\n", speedup)
}
```

### What changed? The power of the "Worker Pool"

In the coffee example, we started one Goroutine per order. That works fine with 3 coffees, but if you had 10,000 images, starting 10,000 processes at the same time could overload your server's memory and CPU.

![Worker Pool](/photos/worker_pool.png)

This is where we introduce the **Worker Pool** pattern, adding three key concepts:

1. `runtime.NumCPU()`: It makes our code **aware of the hardware**. Instead of assigning resources blindly, the program detects how much real power the processor has to run tasks in parallel in the best way, whether it runs on a laptop or on a high-capacity server.
2. `Worker Pool`: This pattern sets a **limit on simultaneous execution**. By processing a maximum number of images at a time, we prevent the system from trying to do everything at once, which would overload memory and make the application unstable. This way, resource usage stays under control and predictable.
3. `sync.WaitGroup`: Since the tasks run in the background, we need a mechanism to synchronize when they finish. The `WaitGroup` works as an **active task counter** that stops the main program from exiting before all images have been saved to disk.

#### The timer's verdict

If you run this code on a folder with several images, you will see something impressive. While the sequential mode uses only one core of your CPU (the rest stay idle), the Worker Pool puts the whole machine to work in parallel. The result is not only more elegant code, but a performance improvement that is usually 4x to 10x faster, depending on your processor.

```go
System: 12 cores | Images to process: 10

Starting Sequential Optimization...
Sequential took: 4.92 seconds

Starting Worker Pool with 12 workers...
Worker Pool took: 1.31 seconds

Performance gain: 3.76x faster
```

Here is the link to the GitHub repository in case you want to try it yourself on your own computer:

- https://github.com/PatricioPoncini/go-image-workerpool

## Real use cases

- **Optimizing AWS Lambdas**: By processing batches concurrently, we reduce the real execution time. This **avoids timeouts and greatly reduces billing costs** per millisecond.
- **Stream processing (Kinesis/SQS)**: It lets you **process multiple records in parallel**, balancing a high data ingestion rate with the database's write capacity.
- **CPU-intensive workloads**: Ideal for cryptographic hashing, file compression or transcoding, where we want to **use all the processor cores in a controlled way without blocking the main thread**.

## Conclusion: efficiency over speed

Concurrency in Go is much more than a language feature; it is a design philosophy that lets us build truly scalable systems.

As we saw, moving from sequential to concurrent execution not only reduces response times, it also lets us make the most of the hardware we already have, keeping the system stable and predictable under heavy load.

I hope this practical example helps you as a starting point to optimize your own processes. See you in the next post!

### Useful articles

- [A Tour of Go, Concurrency](https://go.dev/tour/concurrency/11)
- [Concurrency (computer science)](<https://en.wikipedia.org/wiki/Concurrency_(computer_science)>)
- [Worker Pool design pattern explained (in Spanish)](https://coffeebytes.dev/es/software-architecture/explicacion-del-patron-de-diseno-worker-pool/)
