# PDS Server

A local AT Protocol Personal Data Server (PDS) implementation that runs directly with Node.js/TypeScript without Docker.

## Prerequisites

- Node.js 20 (LTS)
- OpenSSL (for generating secrets)
- pnpm

## Quick Start

### 1. Setup

Run the setup script to generate your environment configuration:

```bash
./setup.sh example.test admin@example.com
```

Or run interactively:

```bash
./setup.sh
```

This will:
- Create a `./pds-data` directory for storing data
- Generate secure JWT secrets and private keys
- Create a `.env` file with your configuration
- Disable invite codes (open registration)

### 2. Start the Server

From the project root:

```bash
pnpm run pds-server
```

Or from this directory:

```bash
./test-server.sh
```

Or directly:

```bash
npx tsx server.ts
```

### 3. Test the Server

Health check:
```bash
curl http://localhost:3000/xrpc/_health
```

Server information:
```bash
curl http://localhost:3000/xrpc/com.atproto.server.describeServer
```

### 4. Create an Account

Create an account on your local PDS:

```bash
# From the project root
ATP_SERVICE=http://localhost:3000 npm run create-account alice.example.test alice@test.com SecurePass123!

# Or set in your .env file
echo "ATP_SERVICE=http://localhost:3000" >> .env
npm run create-account alice.example.test alice@test.com SecurePass123!
```

## Configuration

The server is configured via the `.env` file. Key settings:

| Variable | Description | Default |
|----------|-------------|---------|
| `PDS_HOSTNAME` | Server hostname | (required) |
| `PDS_PORT` | Server port | 3000 |
| `PDS_ADMIN_PASSWORD` | Admin password | (generated) |
| `PDS_DATA_DIRECTORY` | Data storage path | ./pds-data |
| `PDS_INVITE_REQUIRED` | Require invite codes | false |
| `BIND_HOST` | Bind address | 0.0.0.0 |

## Directory Structure

```
pds-server/
├── .env                    # Environment configuration
├── pds-data/              # Data directory
│   ├── blocks/            # Blob storage
│   └── *.sqlite          # SQLite databases
├── server.ts              # Server entry point
├── setup.sh               # Setup script
├── test-server.sh         # Start script
└── README.md             # This file
```

## API Endpoints

The PDS server exposes the full AT Protocol API:

- Health: `GET /xrpc/_health`
- Server Info: `GET /xrpc/com.atproto.server.describeServer`
- Create Account: `POST /xrpc/com.atproto.server.createAccount`
- Create Session: `POST /xrpc/com.atproto.server.createSession`

See [AT Protocol Documentation](https://atproto.com) for full API reference.

## Troubleshooting

### better-sqlite3 Build Errors

If you get native binding errors, ensure you're using Node.js 20:

```bash
mise use node@20
pnpm rebuild better-sqlite3
```

### Invalid Hostname

The PDS requires a valid domain name format (not `localhost` or `.local`). For local development, use:
- `example.test`
- `dev.example.com`
- Any valid domain format

### Port Already in Use

If port 3000 is in use, change `PDS_PORT` in your `.env` file:

```bash
PDS_PORT=3001
```

## Development

The server uses:
- `@atproto/pds` - AT Protocol PDS implementation
- `better-sqlite3` - SQLite database (requires native compilation)
- `tsx` - TypeScript execution
- `dotenv` - Environment configuration

## Notes

- This is a development setup - for production use, consider the official Docker-based deployment
- The server requires a valid domain name (not localhost)
- Data is stored in `./pds-data` - back this up if needed
- Invite codes are disabled by default for easier testing
