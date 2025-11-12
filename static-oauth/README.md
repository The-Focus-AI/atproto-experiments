# Bluesky PDS Explorer - OAuth Test Page

A static HTML/CSS/JavaScript application for exploring Bluesky Personal Data Server (PDS) data using proper OAuth authentication with PKCE.

Based on the [official Bluesky cookbook vanillajs-oauth-web-app example](https://github.com/bluesky-social/cookbook/tree/main/vanillajs-oauth-web-app).

## Features

- **Proper OAuth Flow**: Uses `@atproto/oauth-client-browser` for secure authentication
- **PKCE Support**: Implements Proof Key for Code Exchange for enhanced security
- **DPoP Tokens**: Demonstrates Proof of Possession for token binding
- **PDS Browsing**: Explore all record collections in your PDS
- **Blob Viewer**: Inline preview of images, avatars, and banners
- **No Backend Required**: Completely static - runs in the browser
- **Localhost Development**: Uses special localhost client ID format for easy local testing

## Quick Start

### 1. Serve the Files

The OAuth client requires a web server (file:// protocol won't work):

**Python:**
```bash
cd static-oauth
python3 -m http.server 8080
```

**Node.js:**
```bash
cd static-oauth
npx http-server -p 8080
```

### 2. Open in Browser

Navigate to: `http://localhost:8080/`

**No configuration needed for localhost!** The OAuth client automatically uses the [special localhost client ID format](https://atproto.com/specs/oauth#localhost-client-development) for development.

For production deployment, you'll need to host a `client-metadata.json` file (see Production Deployment section).

## Usage

1. **Enter Your Handle**: Type your Bluesky handle (e.g., `username.bsky.social`)
2. **Click Login**: You'll be redirected to your authorization server
3. **Authorize**: Grant access to the application
4. **Explore**: Browse collections, records, and view blobs

## How It Works

### OAuth Flow

1. **Initialize**: `BrowserOAuthClient.load()` creates the OAuth client
2. **Authorize**: `oauthClient.authorize(handle)` generates authorization URL
3. **Redirect**: User is sent to their PDS authorization server
4. **Callback**: After auth, user returns with authorization code
5. **Token Exchange**: Client exchanges code for access/refresh tokens (automatic)
6. **Session**: `Agent` is created with the authenticated session

### Security Features

- **PKCE**: Code challenge prevents authorization code interception
- **DPoP**: Tokens are bound to cryptographic keys
- **No Secrets**: Public client - no client secret needed
- **Local Storage**: Tokens stored securely in IndexedDB

## Collections Available

- `app.bsky.feed.post` - Your posts
- `app.bsky.feed.like` - Likes
- `app.bsky.feed.repost` - Reposts
- `app.bsky.graph.follow` - Follows
- `app.bsky.graph.block` - Blocks
- `app.bsky.actor.profile` - Profile data
- `app.bsky.feed.threadgate` - Thread settings
- `app.bsky.graph.list` - Lists
- `app.bsky.graph.listitem` - List items
- `chat.bsky.actor.declaration` - Chat declarations

## Troubleshooting

### "CORS errors"
- Must be served from a web server, not file://
- Ensure proper HTTPS in production

### "OAuth initialization failed"
- Check browser console for detailed errors
- Ensure all URLs use HTTPS in production (HTTP only for localhost)

## Production Deployment

### GitHub Pages

1. Push `index.html` to your repo under the `static-oauth` folder
2. Enable GitHub Pages in settings
3. Access via `https://username.github.io/repo-name/static-oauth/`

### Custom Domain

1. Host files on any static hosting (Netlify, Vercel, Cloudflare Pages, etc.)
2. Ensure HTTPS is enabled
3. No configuration needed - metadata is auto-generated!

## Privacy Note

Using `https://bsky.social` as the `handleResolver` will send user handles and IP addresses to Bluesky. For maximum privacy, consider running your own handle resolution service.

## Technical Details

- **No Dependencies**: Uses ES modules and importmaps
- **CDN**: Libraries loaded from esm.sh
- **Storage**: OAuth state in IndexedDB via BrowserOAuthClient
- **Standards**: OAuth 2.1, PKCE (RFC 7636), DPoP (RFC 9449)

## Resources

- [AT Protocol OAuth Spec](https://atproto.com/specs/oauth)
- [Bluesky OAuth Guide](https://docs.bsky.app/docs/advanced-guides/oauth-client)
- [@atproto/oauth-client-browser](https://github.com/bluesky-social/atproto/tree/main/packages/oauth/oauth-client-browser)
