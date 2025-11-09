# Directory Sync to AT Protocol Blob Store

This utility demonstrates how to store entire directories in the AT Protocol blob store and restore them later.

## How It Works

1. **Upload**: Each file in the directory is uploaded as a blob to your Personal Data Server (PDS)
2. **Manifest**: A JSON manifest is created tracking all files, their paths, and blob references (CIDs)
3. **Anchor**: The manifest is saved as a custom record (`ai.focus.sync.directory`) which anchors ALL blobs, making them retrievable
4. **Post**: A post is created for discoverability, referencing the custom record
5. **Download**: The manifest is fetched from the custom record and used to reconstruct the original directory structure by downloading blobs via `com.atproto.sync.getBlob`

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
- Create a custom record (`ai.focus.sync.directory`) anchoring all blobs
- Create a post for discoverability referencing the record URI
- Save a local manifest file (`{directory-name}-manifest.json`) for backup
- Show you the Bluesky post URL and record URI

### List Synced Directories

```bash
npm run sync list
```

Shows all directories you've synced with their record URIs, file counts, sizes, and creation dates.

Example output:
```
Found 2 directory sync records:

1. my-documents
   URI: at://did:plc:.../ai.focus.sync.directory/3m572snkmkb2a
   Files: 15
   Size: 52000 bytes
   Created: 11/9/2025, 7:02:42 AM
```

### Download/Restore a Directory

**No arguments - download latest to default directory:**
```bash
npm run sync download
# Downloads latest sync to ./restored-dir
```

**One argument - download latest to specific directory:**
```bash
npm run sync download ./my-restored-files
```

**Two arguments - download specific record by URI:**
```bash
npm run sync download at://did:plc:.../ai.focus.sync.directory/... ./restored
```

**Backward compatibility - download from local manifest file:**
```bash
npm run sync download my-documents-manifest.json ./restored
```

The download process:
1. Fetches the manifest from the custom record (or local file)
2. Creates the directory structure
3. Downloads each blob via `com.atproto.sync.getBlob`
4. Reconstructs all files with their original paths

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
# Restore on another machine:
npm run sync download
```

### Share Configuration Files
```bash
npm run sync upload ~/.config/my-app
# Share the record URI with others
```

### Version Your Project
```bash
npm run sync upload ./my-project
# Creates a snapshot with all file references
# Restore specific version by record URI later
```

## Features

✅ **Recursive Upload** - Handles nested directories automatically
✅ **MIME Type Detection** - Automatically sets correct content types
✅ **Custom Record Storage** - Manifest stored as `ai.focus.sync.directory` record
✅ **Record URI-based Download** - No local manifest file needed
✅ **Full Download Support** - Fetches and reconstructs all files
✅ **Post Integration** - Post created for discoverability
✅ **Path Preservation** - Directory structure maintained
✅ **Version Support** - Download any previous version by record URI
✅ **Backward Compatible** - Still supports local manifest files

## Known Issues

- Some blobs may return HTTP 500 errors during download (server-side issue)
- This appears to be intermittent with certain blob CIDs
- Successfully tested with 3/4 files in test directory

## Example

Try the included example directory:

```bash
# Upload the example
npm run sync upload example-sync-dir

# List synced directories (shows record URI)
npm run sync list

# Download latest version
npm run sync download ./test-restore

# Download specific version by URI
npm run sync download at://did:plc:.../ai.focus.sync.directory/3m572snkmkb2a ./test-restore
```

## Technical Details

### Blob Storage

- Each file is uploaded via `agent.uploadBlob()`
- Returns a blob reference with CID (Content Identifier)
- Blobs are content-addressed (same content = same CID)
- No size limits mentioned in docs, but practical limits likely exist

### Custom Record Type

The manifest is stored as a custom record:

```typescript
const record = {
  $type: 'ai.focus.sync.directory',
  name: manifest.name,
  rootPath: manifest.rootPath,
  files: manifest.files,
  totalSize: manifest.totalSize,
  createdAt: manifest.createdAt,
};

await agent.com.atproto.repo.createRecord({
  repo: agent.session!.did,
  collection: 'ai.focus.sync.directory',
  record: record,
});
```

This approach:
- Anchors all blobs in one record (makes them retrievable)
- Supports versioning via multiple records
- Can be queried via `listRecords` API
- Creates only one post for discoverability

### File Recovery

To recover files:
1. Fetch the record by URI using `getRecord`
2. Extract the manifest from `record.value`
3. For each file entry, fetch blob using `com.atproto.sync.getBlob`
4. Write blob content to the file path
5. Preserve the directory structure

## Code

See [`examples/directory-sync.ts`](examples/directory-sync.ts) for the full implementation.

## License

MIT
