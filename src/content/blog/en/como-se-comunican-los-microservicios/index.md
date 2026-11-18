---
title: 'How microservices communicate: REST, queues and more'
summary: 'When you split a system into microservices, communication between them becomes a design decision. REST for immediate responses, queues for deferred processes, and a quick look at gRPC. With Go examples and criteria to choose.'
date: '2026-06-17'
draft: false
tags:
  - Backend
  - SystemsDesign
  - Microservices
---

# Contents

- [From monolith to microservices](#from-monolith-to-microservices)
- [Synchronous vs asynchronous communication](#how-microservices-communicate-synchronous-vs-asynchronous-communication)
  - [Synchronous](#synchronous)
  - [Asynchronous](#asynchronous)
- [REST API](#rest-api)
  - [When to use it?](#when-to-use-it)
  - [Code example](#code-example)
- [Message queues](#message-queues)
  - [When to use it?](#when-to-use-it-1)
  - [Code example](#code-example-1)
- [Which one to choose?](#which-one-to-choose)
- [Extra: did you know about gRPC?](#extra-did-you-know-about-grpc)
- [Conclusion](#conclusion)

# From monolith to microservices

When we start developing, we usually build everything in a single service. The classic "To-Do List" project: create notes, complete them, edit them, delete them. Simple, with examples from websites or YouTube tutorials, but it helped (and still helps) to take the first steps in the programming world.

And that is fine. A well-built monolith is perfectly valid for many systems, and there is nothing wrong with starting there.

But when the system grows, whether in users, features or teams working on it, many companies choose to split it into smaller, independent parts: **microservices**. Each one has its own responsibility, its own lifecycle and, often, its own team. This makes it possible to scale, deploy and maintain each part independently.

And that separation brings a new question: if before everything was together and communicated through internal calls, now that it is split... how do the services talk to each other?

# How microservices communicate: Synchronous vs asynchronous communication

Before looking at each technology, it is important to understand the difference between these two models, because it defines how services relate to each other.

## Synchronous

Imagine you call someone on the phone. You dial the number, wait for them to answer, talk, and get an answer right away. If they do not answer, you know immediately. If they do, you know too.

This is how synchronous communication between microservices works: service **A** sends a request to service **B** and stays blocked waiting for the response before continuing. If **B** is slow, **A** waits. If **B** fails, **A** knows right away and can react.

For this to work, **A** must know **B**: where it is and how to talk to it. It is direct communication between two parties.

**Example**: Before publishing a post, the posts service needs to check that the author exists and is active. It asks the users service and stays blocked waiting for the response. It cannot continue without knowing the result.

### Advantages

- **Predictable flow**: The request-response model is linear and easy to follow, which makes the system's behavior easier to understand.
- **Immediate consistency**: Data changes are confirmed right away, with no room for intermediate or inconsistent states.
- **Clear errors**: When something fails, the error goes straight back to the client, which can react immediately.
- **Well-known protocols**: It relies on widely adopted standards like HTTP and REST, which reduces the learning curve.

### Disadvantages

- **Direct coupling**: Sometimes, if service **B** is not available, service **A** cannot work either.
- **More network load**: Keeping connections open between services increases network traffic.
- **Resource usage**: Keeping the state of each active connection means higher memory usage.
- **Cascading failures**: A service that is down can drag down the ones that depend on it, spreading the problem across the whole system.

## Asynchronous

Now imagine that instead of calling, you leave a voice message in a group chat. You record it, send it and go on with your day. You do not know exactly when they will listen to it, or who, but you trust the message will arrive and at some point someone will listen to it.

This is how asynchronous communication works: service **A** publishes a message to an intermediary (a queue or an event bus) and keeps working without waiting for a response. **A** does not need to know who will process that message or when.

On the other side, service **B** listens to that intermediary and processes the message when it receives it. And not only B: several services can listen to the same channel and react independently to the same event.

**Example**: When a user publishes a post, the posts service emits the `post_created` event and keeps working. The notifications service receives it and notifies the followers. The analytics service receives it and records the activity. Neither of them knows about the other, and the posts service knows nothing about them.

### Advantages

- **Real decoupling**: Services do not need to know each other, which makes them more independent and easier to change separately.
- **Better resource usage**: Each service processes messages at its own pace, without being blocked waiting for another one.
- **Failure isolation**: If a service fails, the messages stay in the queue and are processed when it comes back, without affecting the rest of the system.
- **Tolerance to traffic spikes**: Messages pile up in the queue and are processed in order, preventing a load spike from bringing the system down.

### Disadvantages

- **Getting the result is harder**: If service **A** needs to follow the lifecycle of the message it sent, building that mechanism takes extra work.
- **Harder debugging**: Tracking an error means checking the logs of several services separately, which slows down the investigation.
- **More complex testing**: Testing asynchronous flows requires coordinating multiple services at the same time, which adds complexity when testing new features.

## REST API

REST is based on the HTTP protocol and is the most common way services communicate. Each service exposes endpoints that others can call using the standard methods: `GET` to fetch data, `POST` to create, `PUT` or `PATCH` to update, and `DELETE` to remove. Responses travel in JSON format, which is readable and easy to work with in any language.

![alt text](/photos/rest.png)

### When to use it?

REST is a good choice when the response matters right away: validating data, fetching information before continuing, or when the flow depends on the result of another service. It is also the natural choice when your teams already know HTTP well and you do not need to squeeze every bit of performance out of the communication.

**Example**: Before publishing a post, the posts service needs to check that the author exists and is active. It asks the users service and waits for the response. It cannot continue without knowing the result.

### Code example

```go
func getAuthorProfile(userID string) (string, error) {
    // HTTP GET call to the users service to verify the author
    resp, err := http.Get("http://users-service/users/" + userID)
    if err != nil {
        return "", err
    }
    defer resp.Body.Close()

    // Struct to decode the JSON response
    var result struct {
        Username string `json:"username"`
    }
    if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
        return "", err
    }

    return result.Username, nil
}
```

## Message queues

Message queues are an intermediary between services: service **A** puts a message in the queue and service **B** consumes it when it is ready. RabbitMQ and Amazon SQS are two of the most common implementations. The queue makes sure the message is not lost even if **B** is down when it is sent.

![alt text](/photos/queue.jpeg)

### When to use it?

When service **A** does not need to know the result immediately, when you want to decouple producers from consumers, or when you need to absorb traffic spikes without overloading the services that process the messages.

**Example**: When a user publishes a post, the posts service emits the `post_created` event and finishes its work. The notifications service receives it and notifies the author's followers. If the notifications service was temporarily down, the message waits for it in the queue.

### Code example

```go
// Publish a message (from the posts service)
func publishPostCreated(ch *amqp.Channel, postID string) error {
    // Serialize the event as JSON
    body, _ := json.Marshal(map[string]string{"post_id": postID})
    // Publish the message to the "post_created" queue and finish its job
    return ch.Publish("", "post_created", false, false, amqp.Publishing{
        ContentType: "application/json",
        Body:        body,
    })
}

// Consume the message (from the notifications service)
func consumeNewPosts(ch *amqp.Channel) {
    // Listen to the queue continuously
    msgs, _ := ch.Consume("post_created", "", true, false, false, false, nil)
    for msg := range msgs {
        var event map[string]string
        // Decode the received message
        json.Unmarshal(msg.Body, &event)
        notifyFollowers(event["post_id"])
    }
}
```

## Which one to choose?

|                    | REST                                    | Message queues                                |
| ------------------ | --------------------------------------- | --------------------------------------------- |
| **Type**           | Synchronous                             | Asynchronous                                  |
| **Format**         | JSON / HTTP                             | Depends on the broker                         |
| **Coupling**       | High                                    | Low                                           |
| **Performance**    | Medium                                  | Medium                                        |
| **Complexity**     | Low                                     | Medium                                        |
| **Best for**       | Queries that need an immediate response | Deferred processes, notifications, events     |
| **Common example** | Checking data before continuing a flow  | Notifying followers after a post is published |

## Extra: did you know about gRPC?

Besides REST and queues, there is a third option worth mentioning: **gRPC**. It is a protocol developed by Google that replaces JSON with binary buffers (Protocol Buffers), which makes it much faster. Contracts between services are defined in `.proto` files, with strict typing.

You will not see it in most projects, and that is fine. Adopting it makes sense in systems with a very high volume of internal calls where latency is a real bottleneck. Outside that context, the complexity it adds (`.proto` files, code generation, learning curve) usually does not justify the change.

## Conclusion

There is no single right way to connect microservices. REST is simple and direct, ideal when you need a response right away. Message queues give you decoupling and resilience when the result can wait.

The key is to understand what each flow needs: does the calling service need the response to continue? Can it go on without it? How many times per second will that communication happen? Those questions guide the decision better than any fixed rule.

In practice, most systems use REST and queues together. It is not a lifelong choice; it is a tool for each problem.

**Thanks for reading, see you in the next one 👋**
