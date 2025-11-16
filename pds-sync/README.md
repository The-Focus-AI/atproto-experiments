# PDS Repository Sync

Download and unpack your entire Personal Data Server (PDS) repository from AT Protocol.

## Overview

This tool allows you to create a complete local backup of your AT Protocol repository by downloading the CAR (Content Addressable aRchive) file and unpacking it into an organized directory structure.

## Usage

```bash
# Full sync - downloads and unpacks everything (default)
npm run pds-sync

# Just download CAR file
npm run pds-sync download

# List contents of a CAR file
npm run pds-sync list output/pds-exports/repo-*.car

# Unpack an existing CAR file
npm run pds-sync unpack output/pds-exports/repo-*.car

# Sync a specific DID
npm run pds-sync did:plc:abc123
```

## Output Structure

The tool creates an organized directory structure:

```
output/pds-exports/repo-{handle}-{timestamp}/
├── _metadata.json                    # Export metadata
├── _complete.json                    # Complete export in one file
├── _blobs/                           # Downloaded blobs (images, files)
│   ├── _index.json                   # Blob metadata
│   ├── bafkre...                     # Individual blob files
│   └── ...
├── app-bsky-feed-post/              # Posts directory
│   ├── 1.json                       # Individual post records
│   ├── 2.json
│   └── ...
├── app-bsky-graph-follow/           # Follows directory
└── ...                               # Other collections
```

## Features

- ✅ **One command** downloads and unpacks everything
- ✅ **Organized directories** - each collection in its own folder
- ✅ **Individual JSON files** - one per record for easy browsing
- ✅ **Blob downloading** - fetches all images, avatars, and custom blobs
- ✅ **Complete export** - also saves everything in one JSON file
- ✅ **Offline backup** - perfect for account migration or analysis
- ✅ **Works with any DID** - defaults to your own repo

## Use Cases

### Backup Your Account
```bash
npm run pds-sync
# Creates a complete offline backup
```

### Analyze Your Data
```bash
npm run pds-sync
cd output/pds-exports/repo-yourhandle-*/
# Browse JSON files to see your posts, follows, etc.
```

### Account Migration
```bash
# Download from old account
npm run pds-sync
# Use the exported data to migrate to a new account
```

## Technical Details

- Downloads repository as CAR (Content Addressable aRchive) file
- Uses `@atproto/sync` and `@atproto/repo` for parsing
- Fetches blobs via `com.atproto.sync.getBlob` endpoint
- Organizes records by collection type
- Preserves all metadata and timestamps

## Code

See [sync.ts](sync.ts) for the full implementation.
