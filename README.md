# AT Protocol Examples

Comprehensive TypeScript test cases for exploring the AT Protocol (ATProto) and Bluesky social network API.

## TL;DR - Get Started in 2 Commands

```bash
npm install && npm run setup
npm test
```

That's it! The setup wizard will create your Bluesky account and configure everything automatically.

---

## Overview

This project provides a complete testing suite to help you understand and experiment with the AT Protocol, which powers Bluesky. It includes examples for authentication, posting, messaging, profile management, blob storage, and more.

## Features

✨ **All 56 tests passing!** The test suite covers all major AT Protocol features:

1. **Authentication** - Account login, session management, token handling
2. **Posting** - Create posts, replies, quotes, with mentions and hashtags
3. **Thread Retrieval** - Get posts, comments, timelines, and feeds
4. **Attachments** - Upload/download images and blobs
5. **Profile Management** - View/edit profiles, followers, follows
6. **Direct Messages** - ✅ **Full working DM implementation using chat.bsky API!**
7. **Sync Operations** - Repository sync, blob management, directory sync
8. **Advanced Features** - Custom feeds, lists, moderation, search

## Quick Start

### One-Command Setup (Easiest!)

```bash
# Install dependencies
npm install

# Run the interactive setup wizard
npm run setup
```

This will:
1. ✅ Create a new Bluesky account (or let you enter existing credentials)
2. ✅ Automatically create your `.env` file
3. ✅ Make a test post to verify everything works
4. ✅ Show you your profile link

**That's it!** You're ready to run tests.

---

### Manual Setup (Alternative)

If you prefer to set things up manually:

#### 1. Install Dependencies
```bash
npm install
```

#### 2. Create Account

**Option A: Via Web**
Visit [bsky.app](https://bsky.app) and sign up.

**Option B: Via Script**
```bash
npm run create-account your-handle.bsky.social your-email@example.com YourPassword123!
```

#### 3. Configure Environment
```bash
cp .env.example .env
# Edit .env and add your credentials:
# BLUESKY_HANDLE=your-handle.bsky.social
# BLUESKY_PASSWORD=your-password
```

---

## Running Tests

```bash
# Run all tests
npm test

# Run in watch mode
npm run test:watch

# Run with UI
npm run test:ui

# Run specific test file
npm test -- tests/01-authentication.test.ts
```


## Test Structure

- [tests/01-authentication.test.ts](tests/01-authentication.test.ts) - Login, sessions, token management
- [tests/02-posting.test.ts](tests/02-posting.test.ts) - Creating posts, replies, quotes
- [tests/03-thread-retrieval.test.ts](tests/03-thread-retrieval.test.ts) - Getting threads, feeds, likes
- [tests/04-attachments.test.ts](tests/04-attachments.test.ts) - Upload/download images and blobs
- [tests/05-profile.test.ts](tests/05-profile.test.ts) - Profile operations, follows, search
- [tests/06-direct-messages.test.ts](tests/06-direct-messages.test.ts) - ✅ Working DM functionality with chat.bsky API
- [tests/07-sync-operations.test.ts](tests/07-sync-operations.test.ts) - Repo sync, blob management
- [tests/08-advanced-features.test.ts](tests/08-advanced-features.test.ts) - Feeds, lists, moderation

## Advanced Features

### Directory Sync to Blob Store

📦 Sync entire directories to the AT Protocol blob store!

```bash
# Upload a directory
npm run sync upload ./my-documents

# List synced directories (shows record URIs)
npm run sync list

# Download latest sync to ./restored-dir (default)
npm run sync download

# Download latest sync to specific directory
npm run sync download ./my-restored-files

# Download specific version by record URI
npm run sync download at://did:plc:.../ai.focus.sync.directory/... ./restored
```

**Key Innovation:** Uses custom record type `ai.focus.sync.directory` to anchor all blobs, making them retrievable via the AT Protocol API. No local manifest files needed!

See [DIRECTORY_SYNC.md](DIRECTORY_SYNC.md) for full documentation.

### PDS Repository Sync

🔄 Download and unpack your entire Personal Data Server repository!

```bash
# Full sync - downloads and unpacks everything (default)
npm run pds-sync

# The above creates an organized directory structure:
#   pds-exports/repo-{handle}-{timestamp}/
#     ├── _metadata.json                    # Export metadata
#     ├── _complete.json                    # Complete export in one file
#     ├── _blobs/                           # Downloaded blobs (images, files)
#     │   ├── _index.json                   # Blob metadata
#     │   ├── bafkre...                     # Individual blob files
#     │   └── ...
#     ├── app-bsky-feed-post/              # Posts directory
#     │   ├── 1.json                       # Individual post records
#     │   ├── 2.json
#     │   └── ...
#     ├── app-bsky-graph-follow/           # Follows directory
#     └── ...                               # Other collections

# Advanced usage:
npm run pds-sync download                   # Just download CAR file
npm run pds-sync list pds-exports/repo-*.car    # Just list contents
npm run pds-sync unpack pds-exports/repo-*.car  # Just unpack
npm run pds-sync did:plc:abc123            # Sync specific DID
```

Features:
- ✅ **One command** downloads and unpacks everything
- ✅ **Organized directories** - each collection in its own folder
- ✅ **Individual JSON files** - one per record for easy browsing
- ✅ **Blob downloading** - fetches all images, avatars, and custom blobs
- ✅ **Complete export** - also saves everything in one JSON file
- ✅ **Offline backup** - perfect for account migration or analysis
- ✅ **Works with any DID** - defaults to your own repo

### Firehose Blob Downloader

🔥 Connect to the Bluesky firehose and download images and videos in real-time!

```bash
# Download all media to default directory (./firehose-blobs)
npm run firehose

# Specify custom output directory
npm run firehose ./my-blobs

# Download only first 50 blobs
npm run firehose -- --limit=50

# Download only images (skip videos)
npm run firehose -- --images-only

# Download only videos (skip images)
npm run firehose -- --videos-only
```

Features:
- Real-time streaming from Bluesky's firehose using `@atproto/sync`
- Automatically detects and downloads images (JPEG, PNG, GIF, WebP)
- Automatically detects and downloads videos (MP4, WebM, MOV)
- Saves metadata for each blob (post URL, CID, MIME type, etc.)
- Organized output: separate directories for images and videos
- Duplicate detection to avoid re-downloading
- Live statistics and progress tracking
- Graceful shutdown with Ctrl+C

## Examples

### Basic Post

```typescript
import { createAuthenticatedClient } from './tests/utils/client';

const agent = await createAuthenticatedClient();
const post = await agent.post({
  text: 'Hello from AT Protocol!',
  createdAt: new Date().toISOString(),
});
```

### Upload Image

```typescript
import { readFileSync } from 'fs';

const imageData = readFileSync('image.png');
const upload = await agent.uploadBlob(imageData, {
  encoding: 'image/png',
});

await agent.post({
  text: 'Check out this image!',
  embed: {
    $type: 'app.bsky.embed.images',
    images: [{ alt: 'My image', image: upload.data.blob }],
  },
});
```

### Get Profile

```typescript
const profile = await agent.getProfile({
  actor: 'bsky.app',
});

console.log(profile.data.displayName);
console.log(profile.data.followersCount);
```

### Send Direct Message

```typescript
// Get target user's DID
const profile = await agent.getProfile({ actor: 'user.bsky.social' });

// Get or create conversation
const convo = await agent.api.chat.bsky.convo.getConvoForMembers(
  { members: [profile.data.did] },
  { headers: { 'atproto-proxy': 'did:web:api.bsky.chat#bsky_chat' } }
);

// Send message
await agent.api.chat.bsky.convo.sendMessage(
  {
    convoId: convo.data.convo.id,
    message: { text: 'Hello!' },
  },
  {
    headers: { 'atproto-proxy': 'did:web:api.bsky.chat#bsky_chat' },
    encoding: 'application/json'
  }
);
```

**Note:** The `atproto-proxy` header is required to route DM requests to Bluesky's chat service.

## Key Concepts

### AT Protocol URIs

Records are identified by AT URIs in the format:
```
at://did:plc:xxx/app.bsky.feed.post/yyy
```

Where:
- `did:plc:xxx` is the user's DID (Decentralized Identifier)
- `app.bsky.feed.post` is the collection/record type
- `yyy` is the record key (rkey)

### Blobs

Binary data (images, files) are stored as blobs and referenced by CID (Content Identifier). Blobs must be uploaded before being referenced in posts.

### Repository

Each user has a signed data repository containing all their records. The repo can be synced and exported.

## Troubleshooting

### "BLUESKY_HANDLE and BLUESKY_PASSWORD must be set"

Your `.env` file is missing or incomplete. Run:
```bash
npm run setup
```

### "Account creation failed"

Common issues:
- **Handle already taken** - Try a different handle
- **Email already used** - Use a different email
- **Rate limited** - Wait a few minutes and try again
- **Network error** - Check your internet connection

### Tests are failing

Make sure:
1. Your `.env` file exists and has valid credentials
2. You can login at [bsky.app](https://bsky.app) with those credentials
3. Your internet connection is working

## Resources

- [AT Protocol Documentation](https://atproto.com)
- [AT Protocol API Docs](https://docs.bsky.app)
- [Bluesky](https://bsky.app)
- [@atproto/api on npm](https://www.npmjs.com/package/@atproto/api)

## License

MIT
