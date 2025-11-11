# Job Queue via Custom Lexicon

A distributed job queue using AT Protocol custom records - jobs are stored in your repository without cluttering your feed!

## Benefits

- ✅ Jobs stored as custom records (invisible to feed)
- ✅ Direct repository queries (instant, no indexing)
- ✅ Cleaner data model
- ✅ Better for automation and APIs
- ✅ Distributed architecture (no central server)
- ✅ Blob support for file results

## Quick Start

### 1. Start Listener

Watch your own account for jobs:

```bash
npm run job-listener 10
```

Or watch other accounts (useful for job services):

```bash
npm run job-listener 10 --watch did:plc:abc123...
```

### 2. Post a Job

```bash
echo '{"type":"echo","data":{"message":"Hello"}}' > job.json
npm run job-poster post job.json
```

Copy the URI from output.

### 3. Check Status

```bash
npm run job-poster get at://did:plc:.../ai.focus.jobqueue.job/...
npm run job-poster list
```

### 4. Finish Job (Download & Cleanup)

```bash
# Download results and delete job record
npm run job-poster finish at://... ./results

# Keep the job record
npm run job-poster finish at://... ./results --keep
```

This creates a directory with:
- `job.json` - Job metadata and results
- `result.*` - Downloaded blob (if present)

## Architecture

```
┌─────────┐         ┌──────────────┐         ┌─────────┐
│ Poster  │───(1)───│  Custom      │───(2)───│Listener │
│         │         │  Records     │         │ Worker  │
└─────────┘         └──────────────┘         └─────────┘
     │                    │                        │
     │◄───────(3)─────────┤                        │
     │                    │◄──────(4)──────────────┤

(1) Create record: ai.focus.jobqueue.job (status: pending)
(2) Listener polls repo.listRecords()
(3) Poster reads record with repo.getRecord()
(4) Worker updates record (status: working → success/failed)
```

## Custom Lexicon

The job records use a custom collection type: `ai.focus.jobqueue.job`

```json
{
  "$type": "ai.focus.jobqueue.job",
  "payload": {
    "type": "echo",
    "data": { "message": "test" }
  },
  "status": "pending",
  "createdAt": "2025-11-10T12:00:00Z",
  "workerDid": "did:plc:worker123",
  "result": { "echo": "test" },
  "blobRef": { ... }
}
```

### Record Lifecycle

1. **Pending** - Job created, waiting for worker
2. **Working** - Worker claimed job (workerDid set)
3. **Success** - Completed with results
4. **Failed** - Error occurred

## Use Cases

### 1. Personal Job Queue

Process your own background tasks:

```bash
# Terminal 1
npm run job-listener

# Terminal 2
npm run job-poster post job.json
```

### 2. Job Service

Run a worker that processes jobs from multiple accounts:

```bash
npm run job-listener 5 \
  --watch did:plc:client1... \
  --watch did:plc:client2... \
  --watch did:plc:client3...
```

Clients post jobs to their own repos, your worker picks them up!

### 3. Distributed Computing

Multiple workers can watch the same account:

```bash
# Worker 1
npm run job-listener --watch did:plc:coordinator...

# Worker 2 (different machine)
npm run job-listener --watch did:plc:coordinator...
```

First worker to claim a pending job wins!

## Job Handlers

Built-in handlers:

### Echo
```bash
echo '{"type":"echo","data":{"message":"test"}}' > job.json
npm run job-poster post job.json
```

### Reverse String
```bash
echo '{"type":"reverse","data":"Hello World"}' > job.json
npm run job-poster post job.json
```

### Wait (Long-running)
```bash
echo '{"type":"wait","data":{"seconds":10}}' > job.json
npm run job-poster post job.json
```

### Image Generation (with blob)
```bash
npm run job-poster post job-queue/example-image-job.json
```

## Custom Handlers

Edit [listener.ts](listener.ts) and add your handler:

```typescript
registerHandler('image-resize', async (payload: JobPayload): Promise<JobResult> => {
  const { url, width } = payload.data;

  // Download and resize image
  const resized = await resizeImage(url, width);

  // Save to temp file
  const outputPath = '/tmp/resized.png';
  fs.writeFileSync(outputPath, resized);

  return {
    status: 'success',
    data: { originalUrl: url, width, size: resized.length },
    blobRef: {
      path: outputPath,
      mimeType: 'image/png',
      alt: 'Resized image',
    },
  };
});
```

## Key Features

| Feature | Implementation |
|---------|---------------|
| Visibility | Hidden in repo (custom records) |
| Discovery | Direct repo queries |
| Indexing | Instant (no search needed) |
| Updates | Single record mutation |
| State | All in one record |
| Cleanup | Simple record deletion |
| API calls | Minimal (single record ops) |

## Benefits

1. **Clean Feed**: Jobs don't pollute your timeline
2. **Instant Queries**: No search indexing delays
3. **Efficient Updates**: Update single record instead of posting replies
4. **Better Data Model**: Job state in one place
5. **Easier Cleanup**: Simple record deletion
6. **API-Friendly**: Standard repo operations

## Limitations

- Custom lexicons aren't indexed by search
- Need to know DIDs to watch (can't discover via hashtag)
- Requires polling (no real-time push notifications)
- Workers must have read access to job repos
- Same 50MB blob limit

## Multi-Account Workflows

### Scenario: Image Processing Service

**Setup:**
- Client accounts post jobs to their own repos
- Service runs workers watching multiple clients
- Results (blobs) stored in client repos

**Client side:**
```bash
# Client posts job to their own repo
npm run job-poster post resize-job.json
```

**Service side:**
```bash
# Service watches all clients
npm run job-listener 10 \
  --watch did:plc:client1... \
  --watch did:plc:client2... \
  --watch did:plc:client3...
```

Worker processes jobs from all clients and updates records in their repos!

## Security Notes

- Jobs stored in your repo (read access = can see jobs)
- Worker DID recorded (track who processed jobs)
- Blobs stored by worker (download from worker's repo)
- No built-in authentication (add custom logic if needed)
- Consider private PDS for sensitive workloads

## Files

- [lexicon.json](lexicon.json) - Custom lexicon definition
- [types.ts](types.ts) - TypeScript types
- [poster.ts](poster.ts) - Job submission CLI
- [listener.ts](listener.ts) - Worker process

## License

MIT
