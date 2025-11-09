# Directory Sync to AT Protocol Blob Store

This utility demonstrates how to store entire directories in the AT Protocol blob store and restore them later.

## How It Works

1. **Upload**: Each file in the directory is uploaded as a blob to your Personal Data Server (PDS)
2. **Manifest**: A JSON manifest is created tracking all files, their paths, and blob references (CIDs)
3. **Anchor**: The manifest is saved as a custom record (`ai.focus.sync.directory`) which anchors ALL blobs, making them retrievable
4. **Post**: A post is created for discoverability, referencing the custom record
5. **Download**: The manifest can be used to reconstruct the original directory structure by fetching blobs via `com.atproto.sync.getBlob`

## Key Innovation: Custom Record Type for Blob Anchoring

AT Protocol requires blobs to be "anchored" to records before they can be retrieved. This utility uses a **custom record type** (`ai.focus.sync.directory`) that references all uploaded blobs in a single record. This approach:

- ✅ **Anchors all blobs at once** - One record can hold references to multiple blobs
- ✅ **Scales to many files** - Supports 15+ files (20-100MB total) in a single directory sync
- ✅ **Makes blobs retrievable** - Blobs can be downloaded via `com.atproto.sync.getBlob` endpoint
- ✅ **No feed spam** - Only one post is created for the entire directory

**Limits:**
- Individual blob size: 50MB (PDS limit)
- Total storage: Currently unlimited
- Number of files: No hard limit, tested with 15 files

## Quick Start

### Upload a Directory

```bash
npm run sync upload <directory-path>
```

Example:
```bash
npm run sync upload ./my-documents
```

This will:
- Upload all files recursively
- Create a manifest file (`{directory-name}-manifest.json`)
- Create a post with the manifest embedded
- Show you the Bluesky post URL

### List Synced Directories

```bash
npm run sync list
```

Shows all directories you've synced with their URIs and creation dates.

### Download/Restore a Directory

```bash
npm run sync download <manifest-file> <output-directory>
```

Example:
```bash
npm run sync download my-documents-manifest.json ./restored
```

**Note**: The current implementation creates the directory structure and shows blob references. To actually download blob content, you would fetch from:
```
https://bsky.social/xrpc/com.atproto.sync.getBlob?did={your-did}&cid={blob-cid}
```

## Manifest Structure

The manifest is a JSON file that tracks everything about your synced directory:

```json
{
  "$type": "app.bsky.sync.directory",
  "name": "my-documents",
  "rootPath": "/path/to/my-documents",
  "files": [
    {
      "path": "README.md",
      "blobRef": {
        "$type": "blob",
        "ref": { "$link": "bafkrei..." },
        "mimeType": "text/markdown",
        "size": 295
      },
      "size": 295,
      "mimeType": "text/markdown",
      "uploadedAt": "2025-11-08T21:58:47.381Z"
    }
  ],
  "totalSize": 1013,
  "createdAt": "2025-11-08T21:58:46.768Z"
}
```

## Use Cases

### Backup Important Documents
```bash
npm run sync upload ~/important-docs
# Keep the manifest file safe
```

### Share Configuration Files
```bash
npm run sync upload ~/.config/my-app
# Share the manifest with others
```

### Version Your Project
```bash
npm run sync upload ./my-project
# Creates a snapshot with all file references
```

## Features

✅ **Recursive Upload** - Handles nested directories automatically
✅ **MIME Type Detection** - Automatically sets correct content types
✅ **Manifest Tracking** - JSON manifest with all file metadata
✅ **Post Integration** - Manifest saved as a post for easy discovery
✅ **Path Preservation** - Directory structure maintained in manifest

## Limitations & Future Work

**Current Implementation:**
- Upload works fully - all files are uploaded as blobs
- Manifest creation and tracking works
- Download creates directory structure but doesn't fetch blob content

**To Complete Download:**
You would need to implement blob fetching using:
```typescript
const blobUrl = `https://bsky.social/xrpc/com.atproto.sync.getBlob?did=${did}&cid=${cid}`;
const response = await fetch(blobUrl, {
  headers: { 'Authorization': `Bearer ${accessToken}` }
});
const blob = await response.arrayBuffer();
writeFileSync(outputPath, Buffer.from(blob));
```

## Example

Try the included example directory:

```bash
# Upload the example
npm run sync upload example-sync-dir

# List it
npm run sync list

# The manifest is saved as: example-sync-dir-manifest.json
cat example-sync-dir-manifest.json
```

## Technical Details

### Blob Storage

- Each file is uploaded via `agent.uploadBlob()`
- Returns a blob reference with CID (Content Identifier)
- Blobs are content-addressed (same content = same CID)
- No size limits mentioned in docs, but practical limits likely exist

### Manifest Post

The manifest is embedded in a post's external embed:

```typescript
{
  $type: 'app.bsky.embed.external',
  external: {
    uri: 'atproto://sync/{name}',
    title: `Directory: {name}`,
    description: JSON.stringify(manifest)
  }
}
```

This makes it:
- Easy to find via your posts
- Searchable by directory name
- Viewable on Bluesky

### File Recovery

To recover files:
1. Load the manifest JSON
2. For each file entry, fetch blob using CID
3. Write blob content to the file path
4. Preserve the directory structure

## Code

See [`examples/directory-sync.ts`](examples/directory-sync.ts) for the full implementation.

## License

MIT
