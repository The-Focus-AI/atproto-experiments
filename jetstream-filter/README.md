# Jetstream Private Groups Filter

Connects to the Bluesky Jetstream service and filters for `ai.thefocus.groups.*` records, storing them in a JSON database file.

Jetstream is a lightweight JSON-based alternative to the full firehose that's easier to consume and requires no authentication.

## Usage

```bash
pnpm run jetstream-filter [output-file] [options]
```

### Options

- `output-file` - JSON file to store records (default: `./output/private-groups-jetstream.json`)
- `--limit=N` - Stop after collecting N records (default: unlimited)
- `--groups` - Only collect group records
- `--memberships` - Only collect membership records
- `--messages` - Only collect message records

### Examples

```bash
# Collect all private groups records
pnpm run jetstream-filter

# Collect first 100 records
pnpm run jetstream-filter --limit=100

# Only collect messages
pnpm run jetstream-filter --messages

# Custom output file
pnpm run jetstream-filter ./my-database.json
```

## Advantages over Firehose

- **Simpler protocol**: Plain JSON over WebSocket (no CBOR/CAR decoding)
- **No authentication required**: Freely accessible
- **Lighter weight**: Less bandwidth and processing overhead
- **Server-side filtering**: Collections filtered at the source using `wantedCollections`
- **Cursor support**: Can resume from last position using microsecond timestamps

## Database Structure

The JSON database has the following structure:

```json
{
  "groups": [
    {
      "uri": "at://did:plc:.../ai.thefocus.groups.group/...",
      "cid": "...",
      "did": "did:plc:...",
      "rkey": "...",
      "collection": "ai.thefocus.groups.group",
      "record": {
        "$type": "ai.thefocus.groups.group",
        "name": "Group Name",
        "visibility": "public",
        "createdAt": "2025-01-01T00:00:00Z"
      },
      "indexedAt": "2025-01-01T00:00:00Z",
      "jetstreamTimeUs": 1725911162329308
    }
  ],
  "memberships": [...],
  "messages": [...],
  "metadata": {
    "lastUpdated": "2025-01-01T00:00:00Z",
    "totalRecords": 0,
    "startedAt": "2025-01-01T00:00:00Z",
    "lastCursor": 1725911162329308
  }
}
```

## Jetstream Endpoints

The filter connects to `wss://jetstream2.us-east.bsky.network/subscribe` by default.

Available public instances:
- `wss://jetstream1.us-east.bsky.network/subscribe`
- `wss://jetstream2.us-east.bsky.network/subscribe`
- `wss://jetstream1.us-west.bsky.network/subscribe`
- `wss://jetstream2.us-west.bsky.network/subscribe`

## Notes

- The database is automatically saved every 10 records and on shutdown
- Duplicate records (by URI) are automatically skipped
- Automatically reconnects on connection loss
- Uses `lastCursor` to resume from where it left off
- Press Ctrl+C to gracefully stop and save

## Comparison with firehose-filter

| Feature | firehose-filter | jetstream-filter |
|---------|----------------|------------------|
| Protocol | CBOR/CAR | JSON |
| Library | @atproto/sync | Native WebSocket |
| Authentication | No | No |
| Filtering | Client-side | Server-side |
| Resume support | No | Yes (cursor) |
| Self-authenticating | Yes | No |
