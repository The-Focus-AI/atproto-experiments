# Output Directory

This is the centralized output directory for all tools in the ATProto experiments project.

## Structure

```
output/
├── firehose/          # Firehose blob downloads
│   ├── images/        # Downloaded images
│   ├── videos/        # Downloaded videos
│   └── metadata/      # Blob metadata JSON files
├── pds-exports/       # PDS repository exports
│   └── repo-*.car     # CAR files and unpacked directories
├── directory-sync/    # Directory sync manifests
│   └── *-manifest.json
├── private-groups/    # Private group data (sensitive)
│   └── .group-keys.json
└── .gitkeep           # Ensures directory exists in git
```

## Usage

Each tool automatically writes to its subdirectory under `output/`:

- **Firehose Blobs**: `npm run firehose-blobs` writes to `output/firehose/`
- **PDS Sync**: `npm run pds-sync` writes to `output/pds-exports/`
- **Directory Sync**: `npm run directory-sync upload` writes manifests to `output/directory-sync/`
- **Private Groups**: Encryption keys stored in `output/private-groups/`

## Security Notes

- The entire `output/` directory is gitignored (except this README)
- Encryption keys and sensitive data should remain in `output/private-groups/`
- PDS exports may contain personal data
- Clean this directory periodically to free disk space
