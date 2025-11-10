#!/usr/bin/env tsx
/**
 * Generate Web Links for Directory Sync
 *
 * Creates an HTML page with direct links to view/download all files from the blob store.
 * Files are served directly from Bluesky's CDN using com.atproto.sync.getBlob endpoint.
 *
 * Usage:
 *   npm run web-links                               # Generate for latest sync
 *   npm run web-links <record-uri>                  # Generate for specific record
 *   npm run web-links <manifest-file.json>          # Generate from local manifest
 */

import { BskyAgent } from '@atproto/api';
import { readFileSync, writeFileSync } from 'fs';
import * as dotenv from 'dotenv';

dotenv.config();

interface FileManifest {
  path: string;
  blobRef: any;
  size: number;
  mimeType: string;
  uploadedAt: string;
}

interface DirectoryManifest {
  $type: 'app.bsky.sync.directory';
  name: string;
  rootPath: string;
  files: FileManifest[];
  totalSize: number;
  createdAt: string;
}

async function loadManifestFromRecord(agent: BskyAgent, recordUri: string): Promise<DirectoryManifest> {
  console.log(`\n📖 Loading manifest from record: ${recordUri}`);

  // Parse AT URI: at://did:plc:abc123/ai.focus.sync.directory/abc123
  const uriParts = recordUri.replace('at://', '').split('/');
  const repo = uriParts[0];
  const collection = uriParts.slice(1, -1).join('.');
  const rkey = uriParts[uriParts.length - 1];

  // Fetch the record
  const record = await agent.api.com.atproto.repo.getRecord({
    repo,
    collection,
    rkey,
  });

  console.log(`✅ Loaded manifest: ${record.data.value.name}`);

  return record.data.value as DirectoryManifest;
}

async function loadManifestFromFile(manifestPath: string): Promise<DirectoryManifest> {
  console.log(`\n📖 Loading manifest from local file: ${manifestPath}`);
  const data = readFileSync(manifestPath, 'utf-8');
  return JSON.parse(data);
}

async function getLatestManifest(agent: BskyAgent): Promise<{ manifest: DirectoryManifest; did: string; uri: string }> {
  console.log('\n🔍 Finding latest directory sync record...');

  const records = await agent.api.com.atproto.repo.listRecords({
    repo: agent.session!.did,
    collection: 'ai.focus.sync.directory',
    limit: 1,
  });

  if (records.data.records.length === 0) {
    throw new Error('No directory sync records found');
  }

  const record = records.data.records[0];
  console.log(`✅ Found: ${record.value.name} (${record.uri})`);

  return {
    manifest: record.value as DirectoryManifest,
    did: agent.session!.did,
    uri: record.uri,
  };
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(mimeType: string): string {
  if (mimeType.startsWith('image/')) return '🖼️';
  if (mimeType.startsWith('text/')) return '📄';
  if (mimeType === 'application/json') return '📋';
  if (mimeType === 'application/pdf') return '📕';
  if (mimeType.startsWith('video/')) return '🎬';
  if (mimeType.startsWith('audio/')) return '🎵';
  return '📎';
}

function canPreview(mimeType: string): boolean {
  return (
    mimeType.startsWith('image/') ||
    mimeType.startsWith('text/') ||
    mimeType === 'application/json' ||
    mimeType === 'application/pdf'
  );
}

async function generateHTML(manifest: DirectoryManifest, did: string, recordUri?: string): Promise<string> {
  const files = manifest.files.map(file => {
    let cid = file.blobRef.ref?.$link || file.blobRef.ref;
    if (cid && typeof cid === 'object' && cid.toString) {
      cid = cid.toString();
    }

    const blobUrl = `https://bsky.social/xrpc/com.atproto.sync.getBlob?did=${did}&cid=${cid}`;
    const icon = getFileIcon(file.mimeType);
    const preview = canPreview(file.mimeType);
    const isImage = file.mimeType.startsWith('image/');

    // Extract directory from path
    const parts = file.path.split('/');
    const dir = parts.length > 1 ? parts.slice(0, -1).join('/') : '';
    const filename = parts[parts.length - 1];

    return {
      path: file.path,
      dir,
      filename,
      url: blobUrl,
      size: file.size,
      mimeType: file.mimeType,
      uploadedAt: file.uploadedAt,
      icon,
      preview,
      isImage,
      cid,
    };
  });

  // Group files by directory
  const filesByDir = new Map<string, typeof files>();
  files.forEach(file => {
    const dirKey = file.dir || '_root';
    if (!filesByDir.has(dirKey)) {
      filesByDir.set(dirKey, []);
    }
    filesByDir.get(dirKey)!.push(file);
  });

  // Sort directories for consistent display
  const sortedDirs = Array.from(filesByDir.keys()).sort((a, b) => {
    if (a === '_root') return -1;
    if (b === '_root') return 1;
    return a.localeCompare(b);
  });

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${manifest.name} - AT Protocol Blob Store</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Helvetica Neue', Arial, sans-serif;
      background: #000;
      color: #fff;
      line-height: 1.6;
      padding: 0;
      margin: 0;
    }

    .container {
      max-width: 1400px;
      margin: 0 auto;
      background: #fff;
      color: #000;
    }

    .header {
      background: #000;
      color: #fff;
      padding: 3rem 2rem;
      position: relative;
      overflow: hidden;
    }

    .header::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 8px;
      background: linear-gradient(90deg, #de0029 0%, #de0029 33%, #ffca05 33%, #ffca05 66%, #0066b3 66%, #0066b3 100%);
    }

    .header h1 {
      font-size: 2.5rem;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: -1px;
      margin-bottom: 0.5rem;
    }

    .header p {
      font-size: 1rem;
      font-weight: 300;
      opacity: 0.8;
    }

    .header code {
      background: rgba(255,255,255,0.1);
      color: #ffca05;
      padding: 0.3rem 0.6rem;
      border-radius: 2px;
      font-family: 'Courier New', monospace;
      font-size: 0.85rem;
      display: inline-block;
      margin-top: 0.5rem;
    }

    .stats {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      background: #000;
      border-top: 3px solid #de0029;
    }

    .stat {
      padding: 2rem;
      text-align: center;
      border-right: 1px solid #333;
      color: #fff;
    }

    .stat:last-child {
      border-right: none;
    }

    .stat:nth-child(1) { background: #de0029; }
    .stat:nth-child(2) { background: #ffca05; color: #000; }
    .stat:nth-child(3) { background: #0066b3; }

    .stat-value {
      font-size: 2.5rem;
      font-weight: 900;
      display: block;
    }

    .stat-label {
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 2px;
      font-weight: 700;
      margin-top: 0.5rem;
    }

    .content {
      padding: 3rem 2rem;
    }

    .directory {
      margin-bottom: 3rem;
    }

    .directory-header {
      background: #000;
      color: #fff;
      padding: 1rem 1.5rem;
      font-size: 1.2rem;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 1px;
      border-left: 8px solid #de0029;
      margin-bottom: 1.5rem;
      cursor: pointer;
      user-select: none;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .directory-header:hover {
      background: #222;
    }

    .directory-toggle {
      font-size: 1.5rem;
      transition: transform 0.3s;
    }

    .directory.collapsed .directory-toggle {
      transform: rotate(-90deg);
    }

    .directory.collapsed .directory-content {
      display: none;
    }

    .directory-content {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 1.5rem;
    }

    .file {
      border: 3px solid #000;
      background: #f5f5f5;
      overflow: hidden;
    }

    .file-preview {
      width: 100%;
      height: 300px;
      background: #000;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      position: relative;
    }

    .file-preview img {
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
    }

    .file-preview.no-image {
      height: 80px;
      background: linear-gradient(135deg, #de0029 0%, #de0029 50%, #000 50%, #000 100%);
      background-size: 20px 20px;
    }

    .file-icon-large {
      font-size: 3rem;
      filter: drop-shadow(2px 2px 4px rgba(0,0,0,0.5));
    }

    .file-info {
      padding: 1.5rem;
      background: #fff;
    }

    .file-name {
      font-weight: 900;
      font-size: 1.1rem;
      margin-bottom: 0.5rem;
      word-break: break-word;
      color: #000;
    }

    .file-meta {
      font-size: 0.85rem;
      color: #666;
      margin-bottom: 1rem;
      font-family: 'Courier New', monospace;
    }

    .file-actions {
      display: flex;
      gap: 0;
    }

    .btn {
      flex: 1;
      padding: 0.75rem 1.5rem;
      text-decoration: none;
      font-size: 0.9rem;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 1px;
      border: none;
      cursor: pointer;
      transition: all 0.2s;
      text-align: center;
    }

    .btn-view {
      background: #0066b3;
      color: #fff;
    }

    .btn-view:hover {
      background: #004a80;
    }

    .btn-download {
      background: #ffca05;
      color: #000;
    }

    .btn-download:hover {
      background: #e5b500;
    }

    .footer {
      padding: 2rem;
      background: #000;
      color: #fff;
      text-align: center;
      font-size: 0.85rem;
      border-top: 8px solid #de0029;
    }

    .footer a {
      color: #ffca05;
      text-decoration: none;
      font-weight: 700;
    }

    .footer a:hover {
      text-decoration: underline;
    }

    .footer code {
      background: #222;
      color: #ffca05;
      padding: 0.2rem 0.5rem;
      border-radius: 2px;
      font-family: 'Courier New', monospace;
      font-size: 0.8rem;
    }

    .footer p {
      margin: 0.5rem 0;
    }

    /* Lightbox */
    .lightbox {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.95);
      z-index: 9999;
      align-items: center;
      justify-content: center;
    }

    .lightbox.active {
      display: flex;
    }

    .lightbox-content {
      max-width: 90%;
      max-height: 90%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      position: relative;
    }

    .lightbox-preview {
      max-width: 85vw;
      max-height: 70vh;
      overflow: auto;
      background: #fff;
      border: 4px solid #ffca05;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
    }

    .lightbox-preview img {
      max-width: 100%;
      max-height: 100%;
      width: auto;
      height: auto;
      object-fit: contain;
      display: block;
    }

    .lightbox-preview pre {
      margin: 0;
      padding: 2rem;
      white-space: pre-wrap;
      word-wrap: break-word;
      font-family: 'Courier New', monospace;
      font-size: 0.9rem;
      line-height: 1.5;
      color: #000;
    }

    .lightbox-info {
      background: #000;
      color: #fff;
      padding: 1rem 2rem;
      margin-top: 1rem;
      border: 3px solid #ffca05;
      text-align: center;
      min-width: 400px;
    }

    .lightbox-filename {
      font-weight: 900;
      font-size: 1.1rem;
      margin-bottom: 0.5rem;
    }

    .lightbox-meta {
      font-size: 0.85rem;
      color: #ffca05;
      font-family: 'Courier New', monospace;
    }

    .lightbox-nav {
      position: absolute;
      top: 50%;
      transform: translateY(-50%);
      background: #de0029;
      color: #fff;
      border: none;
      width: 60px;
      height: 60px;
      font-size: 2rem;
      cursor: pointer;
      transition: background 0.2s;
      font-weight: 900;
      z-index: 10000;
    }

    .lightbox-nav:hover {
      background: #b5001f;
    }

    .lightbox-nav:disabled {
      opacity: 0.3;
      cursor: not-allowed;
    }

    .lightbox-nav.prev {
      left: 2rem;
    }

    .lightbox-nav.next {
      right: 2rem;
    }

    .lightbox-close {
      position: absolute;
      top: 2rem;
      right: 2rem;
      background: #de0029;
      color: #fff;
      border: none;
      width: 50px;
      height: 50px;
      font-size: 2rem;
      cursor: pointer;
      font-weight: 900;
      transition: background 0.2s;
      z-index: 10000;
    }

    .lightbox-close:hover {
      background: #b5001f;
    }

    .lightbox-download {
      background: #ffca05;
      color: #000;
      border: none;
      padding: 0.75rem 2rem;
      font-size: 1rem;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 1px;
      cursor: pointer;
      margin-top: 1rem;
      transition: background 0.2s;
      text-decoration: none;
      display: inline-block;
    }

    .lightbox-download:hover {
      background: #e5b500;
    }

    @media (max-width: 768px) {
      .stats {
        grid-template-columns: 1fr;
      }

      .stat {
        border-right: none;
        border-bottom: 1px solid #333;
      }

      .stat:last-child {
        border-bottom: none;
      }

      .header h1 {
        font-size: 1.8rem;
      }

      .file-preview {
        height: 200px;
      }

      .file-actions {
        flex-direction: column;
      }
    }
  </style>
  <script>
    const files = ${JSON.stringify(files)};
    let currentIndex = 0;

    function toggleDirectory(element) {
      element.parentElement.classList.toggle('collapsed');
    }

    function openLightbox(index) {
      currentIndex = index;
      showFile(currentIndex);
      document.getElementById('lightbox').classList.add('active');
      document.body.style.overflow = 'hidden';
    }

    function closeLightbox() {
      document.getElementById('lightbox').classList.remove('active');
      document.body.style.overflow = 'auto';
    }

    function nextFile() {
      if (currentIndex < files.length - 1) {
        currentIndex++;
        showFile(currentIndex);
      }
    }

    function prevFile() {
      if (currentIndex > 0) {
        currentIndex--;
        showFile(currentIndex);
      }
    }

    async function showFile(index) {
      const file = files[index];
      const preview = document.getElementById('lightbox-preview');
      const filename = document.getElementById('lightbox-filename');
      const meta = document.getElementById('lightbox-meta');
      const download = document.getElementById('lightbox-download');
      const prevBtn = document.getElementById('lightbox-prev');
      const nextBtn = document.getElementById('lightbox-next');

      filename.textContent = file.filename;
      meta.textContent = \`\${file.mimeType} • \${formatBytes(file.size)}\`;
      download.href = file.url;
      download.download = file.filename;

      prevBtn.disabled = index === 0;
      nextBtn.disabled = index === files.length - 1;

      preview.innerHTML = '<div style="padding: 2rem; text-align: center;">Loading...</div>';

      if (file.isImage) {
        preview.innerHTML = \`<img src="\${file.url}" alt="\${file.filename}">\`;
      } else if (file.mimeType.startsWith('text/') || file.mimeType === 'application/json') {
        try {
          const response = await fetch(file.url);
          const text = await response.text();
          preview.innerHTML = \`<pre>\${escapeHtml(text)}</pre>\`;
        } catch (error) {
          preview.innerHTML = '<div style="padding: 2rem; color: #de0029;">Failed to load preview</div>';
        }
      } else {
        preview.innerHTML = \`
          <div style="padding: 3rem; text-align: center;">
            <div style="font-size: 4rem; margin-bottom: 1rem;">\${file.icon}</div>
            <div style="font-size: 1.2rem; font-weight: 900; margin-bottom: 1rem;">\${file.filename}</div>
            <div style="color: #666;">Preview not available for this file type</div>
          </div>
        \`;
      }
    }

    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    function formatBytes(bytes) {
      if (bytes < 1024) return bytes + ' B';
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
      return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
      const lightbox = document.getElementById('lightbox');
      if (!lightbox.classList.contains('active')) return;

      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowLeft') prevFile();
      if (e.key === 'ArrowRight') nextFile();
    });

    // Click outside to close
    document.addEventListener('click', (e) => {
      if (e.target.id === 'lightbox') {
        closeLightbox();
      }
    });
  </script>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${manifest.name}</h1>
      <p>AT Protocol Blob Store Directory</p>
      ${recordUri ? `<code>${recordUri}</code>` : ''}
    </div>

    <div class="stats">
      <div class="stat">
        <span class="stat-value">${manifest.files.length}</span>
        <span class="stat-label">Files</span>
      </div>
      <div class="stat">
        <span class="stat-value">${formatBytes(manifest.totalSize)}</span>
        <span class="stat-label">Total Size</span>
      </div>
      <div class="stat">
        <span class="stat-value">${new Date(manifest.createdAt).toLocaleDateString()}</span>
        <span class="stat-label">Created</span>
      </div>
    </div>

    <div class="content">
      ${sortedDirs.map(dirKey => {
        const dirFiles = filesByDir.get(dirKey)!;
        const displayDir = dirKey === '_root' ? 'Root Directory' : dirKey;

        return `
          <div class="directory">
            <div class="directory-header" onclick="toggleDirectory(this)">
              <span>${displayDir} (${dirFiles.length})</span>
              <span class="directory-toggle">▼</span>
            </div>
            <div class="directory-content">
              ${dirFiles.map(file => {
                const fileIndex = files.indexOf(file);
                return `
                  <div class="file">
                    <div class="file-preview ${!file.isImage ? 'no-image' : ''}" onclick="openLightbox(${fileIndex})" style="cursor: pointer;">
                      ${file.isImage
                        ? `<img src="${file.url}" alt="${file.filename}" loading="lazy">`
                        : `<span class="file-icon-large">${file.icon}</span>`
                      }
                    </div>
                    <div class="file-info">
                      <div class="file-name">${file.filename}</div>
                      <div class="file-meta">
                        ${file.mimeType} • ${formatBytes(file.size)}<br>
                        ${new Date(file.uploadedAt).toLocaleString()}
                      </div>
                      <div class="file-actions">
                        <button onclick="openLightbox(${fileIndex})" class="btn btn-view">View</button>
                        <a href="${file.url}" class="btn btn-download" download="${file.filename}">Download</a>
                      </div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        `;
      }).join('')}
    </div>

    <!-- Lightbox -->
    <div id="lightbox" class="lightbox">
      <button class="lightbox-close" onclick="closeLightbox()">×</button>
      <button id="lightbox-prev" class="lightbox-nav prev" onclick="prevFile()">‹</button>
      <button id="lightbox-next" class="lightbox-nav next" onclick="nextFile()">›</button>

      <div class="lightbox-content">
        <div id="lightbox-preview" class="lightbox-preview">
          <!-- Preview content will be inserted here -->
        </div>
        <div class="lightbox-info">
          <div id="lightbox-filename" class="lightbox-filename"></div>
          <div id="lightbox-meta" class="lightbox-meta"></div>
          <a id="lightbox-download" class="lightbox-download" href="#" download>Download</a>
        </div>
      </div>
    </div>

    <div class="footer">
      <p>
        Powered by <a href="https://atproto.com" target="_blank">AT Protocol</a> •
        Files served from Bluesky's blob store via <code>com.atproto.sync.getBlob</code>
      </p>
      <p>
        DID: <code>${did}</code>
      </p>
    </div>
  </div>
</body>
</html>`;

  return html;
}

async function main() {
  const arg = process.argv[2];

  const agent = new BskyAgent({ service: 'https://bsky.social' });
  await agent.login({
    identifier: process.env.BLUESKY_HANDLE!,
    password: process.env.BLUESKY_PASSWORD!,
  });

  console.log(`\n🔐 Logged in as: ${agent.session?.handle}`);
  console.log(`📍 DID: ${agent.session?.did}`);

  let manifest: DirectoryManifest;
  let did: string;
  let recordUri: string | undefined;

  if (!arg) {
    // No argument - use latest
    const result = await getLatestManifest(agent);
    manifest = result.manifest;
    did = result.did;
    recordUri = result.uri;
  } else if (arg.startsWith('at://')) {
    // Record URI
    manifest = await loadManifestFromRecord(agent, arg);
    // Extract DID from URI
    did = arg.replace('at://', '').split('/')[0];
    recordUri = arg;
  } else {
    // Local manifest file
    manifest = await loadManifestFromFile(arg);
    // Need to get DID from current session
    did = agent.session!.did;
  }

  console.log('\n🌐 Generating HTML page with blob links...');

  const html = await generateHTML(manifest, did, recordUri);
  const outputPath = `${manifest.name}-web.html`;
  writeFileSync(outputPath, html);

  console.log(`✅ HTML page generated: ${outputPath}`);
  console.log(`\n📝 Open this file in your browser to view/download files!`);
  console.log(`   file://${process.cwd()}/${outputPath}`);
  console.log('\n💡 All files are loaded directly from Bluesky\'s blob store.');
  console.log('   No local files needed - just share the HTML page!');
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
