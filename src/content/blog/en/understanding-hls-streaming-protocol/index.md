---
title: 'Why can you jump to the end of a 4K movie instantly? The secret of the HLS protocol.'
summary: 'Have you ever wondered how platforms like Netflix or YouTube let you watch a 2-hour 4K video and, when you click on minute 90, playback starts almost immediately? The browser did not download the whole 20GB movie at once. The answer is a "divide and conquer" architecture...'
date: '2026-04-26'
draft: false
tags:
  - Go
  - Backend
  - Streaming
  - Infrastructure
  - SystemsDesign
---

# The story behind it

Some time ago I ran into a recurring problem: we needed to play very large videos on a platform, but serving them as plain files (`.mp4`) was not viable. The browser tried to download huge blocks of data before showing the first frame, and this created a very bad user experience.

While researching how to optimize the delivery of this data, I found a technique that completely changed my mindset. I understood that a video does not have to be a static 1GB block; it can be a constant stream of events. Implementing HLS not only solved the heavy loading, it completely changed the way I understand how streaming works.

But what exactly is this protocol and how does it make everything feel instant? Let's see.

# What is HLS?

HLS (HTTP Live Streaming) is an **adaptive bitrate streaming communication protocol** based on HTTP, introduced by Apple in 2009. It was originally the answer to bring video streaming to iPhones without overloading them, replacing the heavy proprietary technologies of that time. Today it is the default industry standard for streaming on the web and mobile devices.

HLS runs over **TCP**, which is key because it **guarantees that every packet arrives intact and in order**. Basically, the protocol follows a **high-fidelity philosophy**: it ensures highly reliable media delivery where video integrity is not negotiable.

# Why over HTTP and TCP?

As I just mentioned, HLS relies on 3 core pillars that make it so robust and, at the same time, easy to scale:

### Universal compatibility

Because it is fully based on HTTP, **HLS is compatible with almost any modern web infrastructure**. This lets it pass freely through firewalls, proxies and strict corporate networks, using the standard web ports (80 and 443). Unlike older protocols (like RTMP), HLS **does not need specialized servers or complex network setups**, which simplifies infrastructure work and large-scale deployment.

### Reliability through TCP + ABR

You might think that using TCP (a protocol that prioritizes retransmitting packets to guarantee integrity) adds too much latency for streaming. However, **HLS makes up for** this trade-off **with Adaptive Bitrate (ABR)**. If TCP takes a bit longer to make sure a segment arrives intact, the player simply adjusts the quality of the next segment. **It prioritizes smooth playback and a perfect image over zero latency** (vital for video calls, but not for VOD).

### Massive scalability with caching

Since segments are just static files served over HTTP, **video segments are "cacheable"** by design. This makes it easy to add CDNs (like AWS CloudFront or Cloudflare) to store content very close to the end user. This strategy greatly reduces loading latency and, most importantly, frees the origin server from handling thousands of concurrent requests.

![alt text](/photos/hls_and_tcp.png)

# How exactly does it work?

HLS does not stream a file; it streams a playlist.

- **Segmentation**: Before playback, the video must be cut into small chunks (`.ts` segments) of, for example, 6 seconds.
- **The manifest (`.m3u8`)**: A text file that works as an index. When you move the timeline to minute 90, the player looks in the manifest for the segments that match that time and requests them over HTTP.
- **Adaptive Bitrate (ABR)**: For me, this is the real competitive advantage. During segmentation, HLS does not create just one group of files, but several duplicated sets in different qualities (480p, 720p, 1080p, etc.).
  - **The advantage?** The user's video player constantly monitors the bandwidth. If it detects that the network is getting weak, it does not show an error message; it uses the lower-quality manifest and downloads the next segment in 480p.
  - **Quality vs. availability**: When the network recovers, it goes back up to 1080p. This maximizes the quality the network can handle at every second, preventing the video from stopping completely. Without ABR, streaming on mobile devices would be much more complicated.

![alt text](/photos/how_hls_works.png)

# Trying HLS locally

Enough text, let's see how it really works. For this test, we need three things: a segmented video, a server that delivers it and a client that plays it.

### Prerequisites

Before starting, make sure you have these tools installed on your machine:

- [Go](https://go.dev/doc/install): To run the server that serves the files.
- [FFmpeg](https://ffmpeg.org/download.html): To process and segment the video (_Optional: I already left the segmented video in the repo in case you want to skip this step_).
- [Git](https://git-scm.com/install/): To clone the sample repository.

As always, I made a small basic repo for this post so you can try it right away:

#### **Repo link: 👉 https://github.com/PatricioPoncini/hls-server**

To automate everything, I prepared this script (`init.sh`) that prepares the video and starts the server:

```shell
#!/bin/sh

# 1. Create the output folder
mkdir -p hls_output

# 2. Segment 'video.mp4' with specific parameters
ffmpeg -i video.mp4 \
  -codec:v libx264 -codec:a aac \
  -map 0 \
  -f hls \
  -hls_time 6 \
  -hls_playlist_type vod \
  -hls_segment_filename "hls_output/seg_%03d.ts" \
  hls_output/index.m3u8

# 3. Start the Go server
go run .
```

### What does each command do?

Here is what each one does:

- `-codec:v libx264` and `-codec:a aac`: We use the standard video and audio formats so any browser can understand them.
- `-hls_time 6`: We tell FFmpeg to cut the video into 6-second chunks.
- `hls_playlist_type vod`: We say it is "Video on Demand". This tells the player that the file has a beginning and an end (unlike a live stream).
- `hls_segment_filename`: We define the naming pattern. In this case, the files will look like `seg_001.ts`, `seg_002.ts`, etc.

## Checking it in the browser

Once you run `./init.sh`, the Go server will be listening on port `:8080`. Now open the `index.html` file in your browser.

Why open the HTML manually? Because the Go server only "serves" the static video files (`.m3u8` and `.ts`) with the right CORS headers. The `index.html` contains the player, which acts as the client and requests the data from the server.

After running the script and opening `index.html`, follow these steps:

- Open DevTools (F12) and go to the Network tab.
- Filter by "All" and press Play on the video.
- Haha, yes... you just got Rickrolled.

## What will you see?

### The first downloads

You will see that the first thing downloaded is the `index.m3u8` file, and right after it the first segment (`seg_000.ts` in this case).

- **Why?** The manifest is only the map. The player reads it to know where to start, but to avoid leaving you staring at a loading spinner, it immediately requests the first video segment to fill the buffer.

![alt text](/photos/hls-network-0.png)

If you double-click the `.m3u8` file it gets downloaded locally, and if you open it you will see it is just a text list with the segment names.
![alt text](/photos/hls-network-3.png)

### The waterfall of segments

When you press play, you will notice that the whole video is not downloaded. As the player needs data, it makes new HTTP requests for each `seg_XXX.ts`.
![alt text](/photos/hls-network-1.png)

### The jump

Try jumping much further ahead. You will see how the browser immediately cancels what it was downloading and requests the exact segment for that minute. This is where you really understand why HLS is so powerful.
![alt text](/photos/hls-network-2.png)

_(In the example I am showing, it jumps from segment `_005.ts` to `_030.ts`. This is because I skipped quite far ahead in the video)._

This ability to request only what we need is what makes HLS so efficient. We not only save bandwidth on the server, we also give the user a smooth experience, whether they are watching a 15-second ad or the Dakar Rally in 4K.

# Current alternatives

Even though we are talking about HLS, it is not the only protocol. There are different alternatives:

- **MPEG-DASH**: The big "vendor-neutral" competitor. Unlike HLS (Apple), DASH is an international standard. It works in a very similar way but is more common on Android and Smart TVs.
- **WebRTC**: If you need latency under 500ms (like in a video call, for example), HLS is too slow. That is where WebRTC comes in, although it is harder to scale.
- **Low-Latency HLS (LL-HLS)**: Apple's evolution to reduce the delay to a few seconds.

## Conclusion

Implementing this solution taught me that, many times, the key is not looking for the most complex tool, but deeply understanding the protocols we already have. Going from seeing a video as a "heavy file" to understanding it as a smart stream of data changed my perspective as a backend developer.

I hope this post helped you understand what is behind that "Play" button we press a thousand times a day. Thanks for reading, and I hope you enjoyed the local experiment! See you in the next one 👋
