# Firehose Private Groups Filter

Connects to the Bluesky firehose and filters for `ai.thefocus.groups.*` records, storing them in a JSON database file.

## Usage

```bash
npx tsx firehose-filter/firehose-filter.ts [output-file] [options]
```

### Options

- `output-file` - JSON file to store records (default: `./output/private-groups-db.json`)
- `--limit=N` - Stop after collecting N records (default: unlimited)
- `--groups` - Only collect group records
- `--memberships` - Only collect membership records
- `--messages` - Only collect message records

### Examples

```bash
# Collect all private groups records
npx tsx firehose-filter/firehose-filter.ts

# Collect first 100 records
npx tsx firehose-filter/firehose-filter.ts --limit=100

# Only collect messages
npx tsx firehose-filter/firehose-filter.ts --messages

# Custom output file
npx tsx firehose-filter/firehose-filter.ts ./my-database.json
```

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
      "indexedAt": "2025-01-01T00:00:00Z"
    }
  ],
  "memberships": [...],
  "messages": [...],
  "metadata": {
    "lastUpdated": "2025-01-01T00:00:00Z",
    "totalRecords": 0,
    "startedAt": "2025-01-01T00:00:00Z"
  }
}
```

## Notes

- The database is automatically saved every 10 records and on shutdown
- Duplicate records (by URI) are automatically skipped
- Press Ctrl+C to gracefully stop and save
- Existing database files are loaded and appended to
