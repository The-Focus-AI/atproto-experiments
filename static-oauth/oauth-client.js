/**
 * OAuth Client Module for AT Protocol
 *
 * Handles authentication with Bluesky/AT Protocol using OAuth PKCE flow
 */

import { BrowserOAuthClient } from '@atproto/oauth-client-browser';
import { Agent } from '@atproto/api';

export class ATProtoOAuthClient {
    constructor() {
        this.oauthClient = null;
        this.agent = null;
        this.session = null;
    }

    /**
     * Build client ID based on environment (localhost vs production)
     */
    buildClientID() {
        const isLocal = ["localhost", "127.0.0.1"].includes(window.location.hostname);
        if (isLocal) {
            // Special localhost client ID format for development
            // See https://atproto.com/specs/oauth#localhost-client-development
            return `http://localhost?${new URLSearchParams({
                scope: "atproto transition:generic",
                redirect_uri: Object.assign(new URL(window.location.origin), { hostname: '127.0.0.1' }).href,
            })}`;
        }
        // For production, you would host a client-metadata.json file
        return `https://${window.location.host}/client-metadata.json`;
    }

    /**
     * Initialize OAuth client and check for existing session
     * @returns {Promise<{agent: Agent, session: any} | null>}
     */
    async init() {
        const clientId = this.buildClientID();

        console.log('=== OAuth Client Initialization ===');
        console.log('Client ID:', clientId);
        console.log('Handle Resolver:', 'https://bsky.social');
        console.log('Current URL:', window.location.href);

        // Initialize OAuth client
        this.oauthClient = await BrowserOAuthClient.load({
            clientId,
            handleResolver: 'https://bsky.social'
        });

        console.log('OAuth client loaded successfully');

        // Check if we're returning from OAuth callback
        const result = await this.oauthClient.init();
        console.log('OAuth init result:', result ? 'Session found' : 'No existing session');

        if (result) {
            this.session = result.session;
            this.agent = new Agent(this.session);

            return {
                agent: this.agent,
                session: this.session,
                did: this.agent.did,
                handle: result.session.sub || 'Unknown'
            };
        }

        return null;
    }

    /**
     * Handle login with a Bluesky handle
     * @param {string} handle - User's Bluesky handle (e.g., user.bsky.social)
     */
    async login(handle) {
        // Clean handle: remove @ prefix and invisible unicode characters
        handle = handle
            .replace(/^@/, '')
            .replace(/[\u200B-\u200D\uFEFF\u202A-\u202E]/g, '')
            .trim();

        if (!handle) {
            throw new Error('Please enter your handle');
        }

        // Basic validation
        if (!handle.includes('.')) {
            throw new Error('Handle must be a domain (e.g., user.bsky.social)');
        }

        console.log('Attempting to sign in with handle:', handle);

        // Initiate OAuth flow
        await this.oauthClient.signIn(handle, {
            state: encodeURIComponent(JSON.stringify({
                timestamp: Date.now(),
                handle
            })),
            signal: new AbortController().signal
        });

        // Note: This will redirect the user, so code after this won't execute
    }

    /**
     * Handle logout
     */
    async logout() {
        if (this.session) {
            await this.session.signOut();
        }

        this.agent = null;
        this.session = null;
        this.oauthClient = null;

        // Reload to reset state
        window.location.reload();
    }

    /**
     * Get the current agent (must be logged in)
     */
    getAgent() {
        if (!this.agent) {
            throw new Error('Not logged in');
        }
        return this.agent;
    }

    /**
     * Check if user is logged in
     */
    isLoggedIn() {
        return this.agent !== null;
    }
}
