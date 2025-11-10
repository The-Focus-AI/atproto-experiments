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

## Features

- ✅ Creates accounts on Bluesky's public PDS
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
- Connects to `https://bsky.social` by default
- Returns JWT tokens for immediate authentication
- Account is immediately active and ready to use

## Code

See [create-account.ts](create-account.ts) for the full implementation.
