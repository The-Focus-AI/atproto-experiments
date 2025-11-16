# Firehose Blob Downloader

Connect to the Bluesky firehose and download images and videos in real-time as they're posted to the network.

## Overview

This tool streams from Bluesky's public firehose using the `@atproto/sync` library and automatically downloads any media blobs (images and videos) it encounters.

## Usage

```bash
# Download all media to default directory (./output/firehose)
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

## Features

- ✅ Real-time streaming from Bluesky's firehose using `@atproto/sync`
- ✅ Automatically detects and downloads images (JPEG, PNG, GIF, WebP)
- ✅ Automatically detects and downloads videos (MP4, WebM, MOV)
- ✅ Saves metadata for each blob (post URL, CID, MIME type, etc.)
- ✅ Organized output: separate directories for images and videos
- ✅ Duplicate detection to avoid re-downloading
- ✅ Live statistics and progress tracking
- ✅ Graceful shutdown with Ctrl+C

## Output Structure

```
output/firehose/
├── images/
│   ├── bafkrei...jpg                 # Image files
│   ├── bafkrei...png
│   └── ...
├── videos/
│   ├── bafkrei...mp4                 # Video files
│   └── ...
└── metadata/
    ├── bafkrei...json                # Metadata for each download
    └── ...
```

## Use Cases

### Media Archival
```bash
npm run firehose -- --limit=1000
# Download the first 1000 media files from the firehose
```

### Image Collection
```bash
npm run firehose ./art-images -- --images-only
# Collect only images for analysis or training data
```

### Monitoring Network Activity
```bash
npm run firehose
# Watch real-time media uploads to the network
```

## Technical Details

- Connects to Bluesky's websocket firehose at `wss://bsky.network`
- Parses commit records to find blob references
- Filters for image and video MIME types
- Downloads blobs via `https://bsky.social/xrpc/com.atproto.sync.getBlob`
- Tracks downloaded CIDs to prevent duplicates
- Shows live progress with download count and data transferred

## Code

See [firehose-blobs.ts](firehose-blobs.ts) for the full implementation.
