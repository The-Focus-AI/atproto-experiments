/**
 * Main Application Module for Bluesky PDS Explorer
 *
 * Ties together OAuth, CAR parsing, and UI management
 */

import { ATProtoOAuthClient } from './oauth-client.js';
import { scanCarForCollections } from './car-parser.js';

export class PDSExplorer {
    constructor(elements) {
        this.elements = elements;
        this.oauthClient = new ATProtoOAuthClient();
        this.discoveredCollections = [];
        this.currentCollection = null;
        this.currentRecord = null;
    }

    /**
     * Initialize the application
     */
    async init() {
        // Setup event handlers
        this.elements.loginBtn.onclick = () => this.handleLogin();
        this.elements.logoutBtn.onclick = () => this.handleLogout();
        this.elements.scanCarBtn.onclick = () => this.downloadAndScanCar();
        this.elements.handleInput.onkeypress = (e) => {
            if (e.key === 'Enter') this.handleLogin();
        };
        this.elements.addCollectionBtn.onclick = () => this.addCustomCollection();
        this.elements.customCollectionInput.onkeypress = (e) => {
            if (e.key === 'Enter') this.addCustomCollection();
        };
        this.elements.copyBtn.onclick = () => this.copyCurrentRecord();

        // Initialize OAuth and check for existing session
        try {
            this.showStatus('Initializing OAuth client...', 'info');

            const result = await this.oauthClient.init();

            if (result) {
                this.showStatus(`✓ Logged in as ${result.did}`, 'success');

                this.elements.userInfo.innerHTML = `
                    <strong>DID:</strong> ${result.did}<br>
                    <strong>Handle:</strong> ${result.handle}
                `;
                this.elements.userInfo.style.display = 'block';

                this.elements.loginBtn.style.display = 'none';
                this.elements.logoutBtn.style.display = 'inline-block';
                this.elements.scanCarBtn.style.display = 'inline-block';
                this.elements.handleInput.disabled = true;

                await this.loadCollections();
            } else {
                this.hideStatus();
            }
        } catch (error) {
            console.error('Init error:', error);
            this.showStatus(`Initialization error: ${error.message}`, 'error');
        }
    }

    /**
     * Handle login
     */
    async handleLogin() {
        const handle = this.elements.handleInput.value.trim();

        try {
            this.showStatus('Initiating login...', 'info');
            this.elements.loginBtn.disabled = true;

            await this.oauthClient.login(handle);
            // Note: This will redirect, so we won't reach here
        } catch (error) {
            console.error('Login error:', error);
            this.showStatus(`Login failed: ${error.message}`, 'error');
            this.elements.loginBtn.disabled = false;
        }
    }

    /**
     * Handle logout
     */
    async handleLogout() {
        await this.oauthClient.logout();
    }

    /**
     * Download CAR file and scan for collections
     */
    async downloadAndScanCar() {
        this.elements.scanCarBtn.disabled = true;
        this.elements.scanCarBtn.textContent = '⏳ Downloading...';
        this.showStatus('Downloading repository...', 'info');

        try {
            const agent = this.oauthClient.getAgent();
            console.log('📥 Downloading repository as CAR...');

            const response = await agent.com.atproto.sync.getRepo({
                did: agent.did
            });

            console.log(`✅ Downloaded ${response.data.byteLength} bytes, parsing...`);
            this.showStatus('Parsing CAR file for collections...', 'info');

            // Parse the CAR file
            const carData = new Uint8Array(response.data);
            const result = await scanCarForCollections(carData);

            console.log(`✅ Found ${result.collections.length} collections, ${result.totalRecords} records in ${result.totalBlocks} blocks`);

            // Update discovered collections with what we found in the CAR
            this.discoveredCollections = result.collections;
            this.renderCollectionsList();

            this.showStatus(`✓ Found ${result.collections.length} collections!`, 'success');
            this.elements.scanCarBtn.textContent = '✓ Scan Complete';

            setTimeout(() => {
                this.elements.scanCarBtn.textContent = '📦 Download & Scan CAR';
                this.elements.scanCarBtn.disabled = false;
            }, 3000);

        } catch (error) {
            console.error('Scan error:', error);
            this.showStatus(`Scan failed: ${error.message}`, 'error');
            this.elements.scanCarBtn.textContent = '❌ Scan Failed';

            setTimeout(() => {
                this.elements.scanCarBtn.textContent = '📦 Download & Scan CAR';
                this.elements.scanCarBtn.disabled = false;
            }, 3000);
        }
    }

    /**
     * Discover collections using API
     */
    async discoverCollections() {
        const agent = this.oauthClient.getAgent();
        console.log('🔍 Discovering ALL collections via describeRepo...');

        try {
            // Try using describeRepo first - this should list all collections
            const response = await agent.com.atproto.repo.describeRepo({
                repo: agent.did
            });

            if (response.data.collections && response.data.collections.length > 0) {
                console.log(`✓ Found ${response.data.collections.length} collections via describeRepo`);
                return response.data.collections.sort();
            }
        } catch (error) {
            console.warn('describeRepo failed, falling back to manual discovery:', error.message);
        }

        // Fallback: try known collections manually
        console.log('Using fallback collection discovery...');
        const collections = new Set();

        const knownCollections = [
            'app.bsky.feed.post',
            'app.bsky.feed.like',
            'app.bsky.feed.repost',
            'app.bsky.graph.follow',
            'app.bsky.graph.block',
            'app.bsky.actor.profile',
            'app.bsky.feed.threadgate',
            'app.bsky.graph.list',
            'app.bsky.graph.listitem',
            'chat.bsky.actor.declaration',
            // Custom Focus.AI collections
            'ai.focus.sync.directory',
            'ai.focus.viewer.template',
            'ai.thefocus.blog.article',
            'ai.thefocus.blog.site',
        ];

        for (const collection of knownCollections) {
            try {
                const response = await agent.com.atproto.repo.listRecords({
                    repo: agent.did,
                    collection: collection,
                    limit: 1
                });
                if (response.data.records.length > 0 || response.success) {
                    collections.add(collection);
                    console.log(`  ✓ ${collection}`);
                }
            } catch (error) {
                // Collection doesn't exist or is empty
            }
        }

        return Array.from(collections).sort();
    }

    /**
     * Load collections
     */
    async loadCollections() {
        this.showLoading(this.elements.collectionsContainer, 'Discovering collections...');

        try {
            this.discoveredCollections = await this.discoverCollections();

            console.log(`📊 Found ${this.discoveredCollections.length} collections`);

            // Show the custom collection form
            this.elements.addCollectionForm.style.display = 'block';

            this.renderCollectionsList();
        } catch (error) {
            console.error('Error loading collections:', error);
            this.elements.collectionsContainer.innerHTML = `<div class="loading"><p>Error loading collections: ${error.message}</p></div>`;
        }
    }

    /**
     * Render collections list
     */
    renderCollectionsList() {
        if (this.discoveredCollections.length === 0) {
            this.elements.collectionsContainer.innerHTML = '<div class="loading"><p>No collections found. Try scanning the CAR file.</p></div>';
            return;
        }

        const list = document.createElement('ul');
        list.className = 'collection-list';

        for (const collection of this.discoveredCollections) {
            const li = document.createElement('li');
            li.textContent = collection;
            li.onclick = () => this.selectCollection(collection);
            if (collection === this.currentCollection) {
                li.classList.add('selected');
            }
            list.appendChild(li);
        }

        this.elements.collectionsContainer.innerHTML = '';
        this.elements.collectionsContainer.appendChild(list);
    }

    /**
     * Select a collection
     */
    async selectCollection(collection) {
        this.currentCollection = collection;
        this.currentRecord = null;
        this.renderCollectionsList();

        this.showLoading(this.elements.recordsContainer, `Loading records from ${collection}...`);

        try {
            const agent = this.oauthClient.getAgent();
            const response = await agent.com.atproto.repo.listRecords({
                repo: agent.did,
                collection: collection,
                limit: 100
            });

            if (response.data.records.length === 0) {
                this.elements.recordsContainer.innerHTML = '<div class="loading"><p>No records found in this collection</p></div>';
                return;
            }

            const list = document.createElement('ul');
            list.className = 'record-list';

            for (const record of response.data.records) {
                const li = document.createElement('li');
                const rkey = record.uri.split('/').pop();

                // Show a preview based on record type
                let preview = rkey;
                if (record.value.text) {
                    preview = record.value.text.substring(0, 50) + (record.value.text.length > 50 ? '...' : '');
                } else if (record.value.displayName) {
                    preview = record.value.displayName;
                } else if (record.value.subject) {
                    preview = `Subject: ${record.value.subject}`;
                }

                li.innerHTML = `
                    <div class="record-preview">
                        <strong>${rkey}</strong>
                        <div class="record-meta">${preview}</div>
                    </div>
                `;
                li.onclick = () => this.selectRecord(record);
                list.appendChild(li);
            }

            this.elements.recordsContainer.innerHTML = '';
            this.elements.recordsContainer.appendChild(list);

            // Update stats
            this.elements.stats.textContent = `${response.data.records.length} records`;
            this.elements.stats.style.display = 'block';

        } catch (error) {
            console.error('Error loading records:', error);
            this.elements.recordsContainer.innerHTML = `<div class="loading"><p>Error: ${error.message}</p></div>`;
        }
    }

    /**
     * Select a record
     */
    selectRecord(record) {
        this.currentRecord = record;
        this.renderRecordDetail(record);
    }

    /**
     * Render record detail
     */
    renderRecordDetail(record) {
        // Detect blobs in the record
        const blobs = this.detectBlobs(record);

        let blobsHtml = '';
        if (blobs.length > 0) {
            const agent = this.oauthClient.getAgent();
            blobsHtml = '<h3>Blobs</h3><ul class="blob-list">';
            for (const blob of blobs) {
                const downloadUrl = `https://bsky.social/xrpc/com.atproto.sync.getBlob?did=${agent.did}&cid=${blob.cid}`;
                blobsHtml += `
                    <li>
                        <strong>Type:</strong> ${blob.type}<br>
                        ${blob.path ? `<strong>Path:</strong> ${blob.path}<br>` : ''}
                        ${blob.alt ? `<strong>Alt:</strong> ${blob.alt}<br>` : ''}
                        <strong>CID:</strong> <code>${blob.cid}</code><br>
                        <strong>MIME:</strong> ${blob.mimeType || 'unknown'}<br>
                        <strong>Size:</strong> ${blob.size ? (blob.size / 1024).toFixed(2) + ' KB' : 'unknown'}<br>
                        <a href="${downloadUrl}" target="_blank">Download</a>
                        ${blob.mimeType?.startsWith('image/') ? ` | <a href="${downloadUrl}" target="_blank">View</a>` : ''}
                    </li>
                `;
            }
            blobsHtml += '</ul>';
        }

        const html = `
            <div class="record-detail">
                <h2>Record Details</h2>
                <div class="record-info">
                    <p><strong>URI:</strong> ${record.uri}</p>
                    <p><strong>CID:</strong> ${record.cid}</p>
                    ${blobs.length > 0 ? `<p><strong>Blobs:</strong> ${blobs.length}</p>` : ''}
                </div>
                ${blobsHtml}
                <h3>JSON Value</h3>
                <pre><code>${JSON.stringify(record.value, null, 2)}</code></pre>
            </div>
        `;

        this.elements.detailContainer.innerHTML = html;
    }

    /**
     * Detect blobs in a record
     */
    detectBlobs(record) {
        const blobs = [];

        // Standard Bluesky image embeds
        if (record.value?.embed?.images) {
            blobs.push(...record.value.embed.images.map(img => ({
                type: 'image',
                cid: img.image?.ref?.$link || img.image?.ref,
                alt: img.alt,
                mimeType: img.image?.mimeType,
                size: img.image?.size
            })));
        }

        // Profile avatar/banner
        if (record.value?.avatar) {
            blobs.push({
                type: 'avatar',
                cid: record.value.avatar.ref?.$link || record.value.avatar.ref,
                mimeType: record.value.avatar.mimeType,
                size: record.value.avatar.size
            });
        }

        if (record.value?.banner) {
            blobs.push({
                type: 'banner',
                cid: record.value.banner.ref?.$link || record.value.banner.ref,
                mimeType: record.value.banner.mimeType,
                size: record.value.banner.size
            });
        }

        // Custom blog article blobs
        if (record.value?.blobs && Array.isArray(record.value.blobs)) {
            blobs.push(...record.value.blobs.map(blob => ({
                type: 'article-image',
                cid: blob.blobRef?.ref?.$link || blob.blobRef?.ref,
                path: blob.relativePath,
                alt: blob.alt,
                mimeType: blob.mimeType || blob.blobRef?.mimeType,
                size: blob.blobRef?.size
            })));
        }

        // Custom sync directory files
        if (record.value?.files && Array.isArray(record.value.files)) {
            blobs.push(...record.value.files.map(file => ({
                type: 'file',
                cid: file.blobRef?.ref?.$link || file.blobRef?.ref,
                path: file.path,
                mimeType: file.mimeType || file.blobRef?.mimeType,
                size: file.size || file.blobRef?.size
            })));
        }

        return blobs.filter(b => b.cid);
    }

    /**
     * Add custom collection
     */
    async addCustomCollection() {
        const collection = this.elements.customCollectionInput.value.trim();
        if (!collection) return;

        if (!this.discoveredCollections.includes(collection)) {
            this.discoveredCollections.push(collection);
            this.discoveredCollections.sort();
            this.renderCollectionsList();
        }

        this.elements.customCollectionInput.value = '';
        this.selectCollection(collection);
    }

    /**
     * Copy current record to clipboard
     */
    copyCurrentRecord() {
        if (this.currentRecord) {
            navigator.clipboard.writeText(JSON.stringify(this.currentRecord, null, 2));
            this.showStatus('JSON copied to clipboard!', 'success');
            setTimeout(() => this.hideStatus(), 2000);
        }
    }

    /**
     * Show status message
     */
    showStatus(message, type = 'info') {
        this.elements.status.textContent = message;
        this.elements.status.className = `status ${type}`;
        this.elements.status.style.display = 'block';
    }

    /**
     * Hide status message
     */
    hideStatus() {
        this.elements.status.style.display = 'none';
    }

    /**
     * Show loading state
     */
    showLoading(container, message) {
        container.innerHTML = `
            <div class="loading">
                <div class="spinner"></div>
                <p>${message}</p>
            </div>
        `;
    }
}
