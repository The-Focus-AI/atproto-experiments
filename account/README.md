# Account Creation

Programmatically create Bluesky accounts using the AT Protocol API.

## Overview

This tool demonstrates how to create new Bluesky accounts using the `com.atproto.server.createAccount` endpoint. It's useful for automation, testing, or bulk account creation scenarios.

## Usage

```bash
# Create an account with handle, email, and password
npm run create-account your-handle.bsky.social your-email@example.com YourPassword123!

# Or just run the command to see usage
npm run create-account
```

### Custom PDS Server

To create accounts on your local PDS or custom server, set the `ATP_SERVICE` environment variable:

```bash
# For local PDS server
ATP_SERVICE=http://localhost:3000 npm run create-account alice.example.test alice@test.com SecurePass123!

# Or add to your .env file:
# ATP_SERVICE=http://localhost:3000
```

## Features

- ✅ Creates accounts on Bluesky's public PDS or custom servers
- ✅ Respects `ATP_SERVICE` environment variable
- ✅ Validates input parameters
- ✅ Returns DID (Decentralized Identifier) and access tokens
- ✅ Handles errors gracefully with helpful messages

## Arguments

1. **Handle** - Your desired username (e.g., `alice.bsky.social`)
2. **Email** - Valid email address for the account
3. **Password** - Strong password for the account

## Output

Upon successful creation, you'll receive:
- **DID**: Your decentralized identifier (e.g., `did:plc:abc123...`)
- **Handle**: Confirmed handle
- **Access JWT**: Authentication token
- **Refresh JWT**: Token for refreshing sessions

## Common Issues

### Handle Already Taken
The handle you requested is already in use. Try a different one.

### Email Already Used
This email is already associated with another account. Use a different email.

### Rate Limited
Too many account creation requests. Wait a few minutes and try again.

### Invalid Password
Password must meet minimum requirements (usually 8+ characters).

## Security Notes

- **Never commit credentials** to version control
- Store tokens securely if automating
- Use strong, unique passwords
- Be aware of rate limits on account creation

## Use Cases

### Testing
```bash
npm run create-account test-user-1.bsky.social test@example.com TestPass123!
# Create test accounts for development
```

### Automation
```bash
# Programmatically create accounts for bots or services
# Make sure to follow Bluesky's Terms of Service
```

### Onboarding
```bash
# Create accounts as part of a larger onboarding flow
# Useful for white-label implementations
```

## Technical Details

- Uses `com.atproto.server.createAccount` endpoint
- Connects to `https://bsky.social` by default (or `ATP_SERVICE` if set)
- Returns JWT tokens for immediate authentication
- Account is immediately active and ready to use
- Works with any AT Protocol PDS implementation

## Code

See [create-account.ts](create-account.ts) for the full implementation.
