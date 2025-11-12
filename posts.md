---
title: atprotos-experiments
postUri: at://did:plc:mvrzcvom3logcxas5razpnq3/app.bsky.feed.post/3m5ffstgduu2r
postUrl: https://bsky.app/profile/willschenk.com/post/3m5ffstgduu2r
createdAt: 2025-11-12T00:35:39.486Z
---

#atproto is cooool!  I've put together a whole bunch of experiments.  storing/restoring a directory of files, capturing blobs from the firehose, a distributed job queue, syncing markdown files as a series of posts, and being able to store articles in the pds and make it a website.

---

[directory-sync](https://github.com/The-Focus-AI/atproto-experiments/tree/main/directory-sync) stores arbitrary data in the PDS.  Pass it in a directory path and it will upload it to the PDS.  List your collections, download them again later.

---

[firehose](https://github.com/The-Focus-AI/atproto-experiments/tree/main/firehose) captures blobs from the firehose.  Save images, videos, or both.  Its fun to watch them all stream in.

---

[job-queue](https://github.com/The-Focus-AI/atproto-experiments/tree/main/job-queue) is a distributed job queue.  Post a json describing your job, and have a listered say start working, and pass and succeed.  You can pass blog data back in the response.

---

[markdown-sync](https://github.com/The-Focus-AI/atproto-experiments/tree/main/markdown-sync) is a tool for syncing markdown files as a series of posts.  Pass it in a markdown file and it will upload it to the PDS as a series of posts.  List your collections, download them again later.

---

[pds-server](https://github.com/The-Focus-AI/atproto-experiments/tree/main/pds-server) is a tool for running your own PDS server.  Its way simplier than using the docker container.  (Never thought I'd say that!)

---

[pds-sync](https://github.com/The-Focus-AI/atproto-experiments/tree/main/pds-sync) is a tool for syncing the PDS. Download and unpack whats in your PDS.

---

[static-oauth](https://github.com/The-Focus-AI/atproto-experiments/tree/main/static-oauth) is a better PDS explorer than from the cookbook, supports custom collections and you can see blobs.

---

[website](https://github.com/The-Focus-AI/atproto-experiments/tree/main/website) is a tool for storing all the data that you'd need for a blog with microposts and articles.  You store the data in the PDS, and then the site generator creates a static site from the PDS data.

---

Being able to store -- and write -- data into the PDS from the browser blows open the doors.  It's a key/value store that you can put anything in from wherever! With the webside idea I was thinking you could make a static HTML site editor stores everything directly in the PDS, and then have a great way to publish it to the web.

---

So many possiblities with #atproto !