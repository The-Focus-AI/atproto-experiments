# Markdown Sync to Bluesky

Write Bluesky posts and threads in markdown, publish them to the network, and sync replies back to local files.

## Overview

This tool lets you manage Bluesky posts as markdown files with frontmatter. You can:

1. **Draft posts offline** in your favorite text editor
2. **Publish to Bluesky** with a single command
3. **Create threaded posts** by separating replies with `---`
4. **Sync external replies** from other users back to markdown
5. **Version control** your posts with git

## Quick Start

### 1. Create a Markdown Post

Create a markdown file with frontmatter:

```markdown
---
title: My First Post
---

This is my main post content.

It can have multiple paragraphs, links, etc.

---

This is a reply to my own post.

---

And another reply in the thread!
```

### 2. Publish to Bluesky

```bash
npm run md-sync post my-post.md
```

This will:
- Publish the main post to Bluesky
- Thread any replies automatically
- Update the file with the main post URI only
- Skip already-published posts (safe to run multiple times)

After publishing, your file will be updated:

```markdown
---
title: My First Post
createdAt: 2025-01-10T12:00:00Z
postUri: at://did:plc:abc123/app.bsky.feed.post/abc123
postUrl: https://bsky.app/profile/you.bsky.social/post/abc123
---

This is my main post content.

---

This is a reply to my own post.

---

And another reply in the thread!
```

Note: Only the main post URI is stored. The script fetches the full thread from Bluesky to determine which replies have already been published.

### 3. Sync External Replies

Fetch replies from other users:

```bash
npm run md-sync sync my-post.md
```

This creates a `my-post.replies.md` file with all external replies:

```markdown
# External Replies to: My First Post

Original post: https://bsky.app/profile/you.bsky.social/post/abc123

Last synced: 2025-01-10T12:30:00Z

---

## @alice.bsky.social

**Alice** · [View on Bluesky](https://bsky.app/...) · 1/10/2025, 12:15:00 PM

Great post! I love this idea.

---

## @bob.bsky.social

**Bob** · [View on Bluesky](https://bsky.app/...) · 1/10/2025, 12:20:00 PM

This is really cool!

---
```

## Features

✅ **Offline drafting** - Write posts in markdown with your favorite editor
✅ **Threaded posts** - Separate posts with `---` to create threads
✅ **Idempotent** - Safe to run multiple times, only publishes new content
✅ **Git-friendly** - Version control your posts and replies
✅ **Rich text** - Automatically detects mentions, links, and hashtags
✅ **External replies** - Sync replies from others to a separate file
✅ **Thread preservation** - Maintains parent/child relationships

## File Format

### Main Post File

```markdown
---
title: Post Title (optional)
createdAt: 2025-01-10T12:00:00Z (auto-generated)
postUri: at://... (auto-generated after publishing)
postUrl: https://bsky.app/... (auto-generated after publishing)
---

Main post content here.

Can have multiple paragraphs.

---

First reply content.

---

Second reply content.
```

**Note**: Reply URIs are not stored in the file. The script determines which replies have been published by fetching the thread from Bluesky and comparing content.

### Replies File

External replies are saved to `{filename}.replies.md`:

```markdown
# External Replies to: Post Title

Original post: https://bsky.app/profile/you.bsky.social/post/abc123

Last synced: 2025-01-10T12:30:00Z

---

## @username.bsky.social

**Display Name** · [View on Bluesky](url) · timestamp

Reply content here.

---
```

## Use Cases

### Blog Post to Thread

```bash
# Write your blog post summary as a thread
cat > blog-post.md <<EOF
---
title: New Blog Post
---

I just published a new blog post about AT Protocol!

Read it here: https://myblog.com/atproto

---

Key takeaways:
- Decentralized identity
- Content addressing
- Portable accounts

---

What do you think? Let me know!
EOF

npm run md-sync post blog-post.md
```

### Daily Updates

```bash
# Create a daily update thread
npm run md-sync post updates-2025-01-10.md

# Later, sync replies
npm run md-sync sync updates-2025-01-10.md
```

### Version Control

```bash
# Draft your post
git add my-post.md
git commit -m "Draft post"

# Publish it
npm run md-sync post my-post.md

# Commit the updated URIs
git add my-post.md
git commit -m "Published post"

# Later, sync replies
npm run md-sync sync my-post.md
git add my-post.replies.md
git commit -m "Synced replies"
```

## Technical Details

- Uses `@atproto/api` RichText for facet detection (mentions, links, hashtags)
- Automatically threads replies using parent/root references
- Only publishes unpublished content (checks for existing postUri)
- Fetches thread with depth=100 to capture all replies
- Saves external replies to separate file to avoid conflicts

## Example

Try the included example:

```bash
# Publish the example post
npm run md-sync post markdown-sync/example-post.md

# View it on Bluesky (URL will be in the output)

# Sync any replies
npm run md-sync sync markdown-sync/example-post.md

# Check the replies file
cat markdown-sync/example-post.replies.md
```

## Limits

- **Post length**: 300 characters (Bluesky limit)
- **Thread depth**: No limit, all replies threaded sequentially
- **Reply sync depth**: 100 levels (API limit)

## Tips

- Run `post` multiple times safely - it won't re-publish existing posts
- Add new replies to the bottom of your file and run `post` again
- Run `sync` periodically to fetch new external replies
- Use meaningful filenames - they become the default title
- Keep the postUri/postUrl lines - they track publication status

## Code

See [sync.ts](sync.ts) for the full implementation.
