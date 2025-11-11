# ATProto Website Tool - Implementation Specification

## Overview

A tool for managing a personal blog/website with content stored in an ATProto PDS (Personal Data Server). Supports both long-form articles and short-form microposts, with bidirectional sync and static site generation.

## Architecture

### Content Types

1. **Articles** - Long-form content stored as custom lexicon records
2. **Microposts** - Short-form content stored as standard Bluesky posts
3. **Site Configuration** - Global site settings stored in PDS
4. **Media** - Images/videos stored as blobs in PDS

### Lexicons

#### `ai.thefocus.blog.article`
```typescript
{
  title: string
  slug: string
  content: string              // Original markdown with relative paths
  createdAt: string            // ISO datetime
  summary?: string
  tags?: string[]
  blobs?: {                    // Media file mappings
    relativePath: string       // "article-name/image.jpg"
    blobRef: BlobRef          // ATProto blob reference
    mimeType: string
    alt?: string              // Alt text from markdown
  }[]
  announcementPostUri?: string // URI of feed post announcing this article
}
```

#### `ai.thefocus.blog.site`
```typescript
{
  siteTitle: string
  theme: string                // Filename of CSS theme
  themeBlobRef?: BlobRef      // Uploaded CSS blob
  articleAnnouncements?: {
    enabled: boolean
    template: string           // e.g., "New: [title]\n\n[summary]\n\n[link]"
  }
  siteUrl: string              // e.g., "https://myblog.com"
  updatedAt: string            // ISO datetime
}
```

#### `app.bsky.feed.post` (standard Bluesky)
Used for microposts with standard embed support:
- `embed.images` - Max 4 images
- `embed.video` - Single video
- `embed.external` - Link cards

## Directory Structure

### Local Filesystem
```
project-root/
├── content/
│   ├── articles/
│   │   ├── my-article.md
│   │   ├── my-article/
│   │   │   ├── image1.jpg
│   │   │   └── video.mp4
│   │   ├── 2025-01-15-another-post.md
│   │   └── 2025-01-15-another-post/
│   │       └── photo.jpg
│   ├── microposts/
│   │   ├── 2025-11-11.md
│   │   ├── 2025-11-11/
│   │   │   └── cat.jpg
│   │   └── 2025-11-10.md
│   └── themes/
│       ├── default.css
│       ├── minimal.css
│       ├── dark.css
│       └── serif.css
├── config.json
├── .env
└── public/                   # Generated output
    ├── index.html
    ├── style.css
    ├── comments.js
    ├── articles/
    │   ├── index.html
    │   └── my-article.html
    └── microposts/
        ├── index.html
        └── 2025-11-11-1.html
```

### Config Files

#### `config.json`
```json
{
  "siteTitle": "My Personal Website",
  "theme": "default.css",
  "articleAnnouncements": {
    "enabled": true,
    "template": "New article: [title]\n\n[summary]\n\n[tags]\n\n[link]"
  },
  "siteUrl": "https://myblog.example.com"
}
```

#### `.env`
```bash
# Authentication
BLUESKY_HANDLE=alice.example.com
BLUESKY_PASSWORD=xxxx-xxxx-xxxx-xxxx
ATP_SERVICE=https://bsky.social

# Local paths
CONTENT_DIR=./content
OUTPUT_DIR=./public
```

## Commands

### `website post`
Syncs content from local filesystem to PDS.

**Workflow:**
1. Read `config.json`
2. Upload theme CSS file as blob
3. Create/update `ai.thefocus.blog.site` record
4. For each article in `content/articles/`:
   - Parse markdown and frontmatter
   - Extract slug from filename (strip date prefix if present)
   - Extract date from filename prefix or frontmatter or file mtime
   - Find and upload media files (images/videos) as blobs
   - Create blob mapping array
   - Create/update `ai.thefocus.blog.article` record
   - If `articleAnnouncements.enabled`, create announcement post
5. For each daily note in `content/microposts/`:
   - Parse posts separated by `---`
   - For each post:
     - Extract images/videos from markdown
     - Upload media as blobs
     - Create embed object (images/video)
     - Create/update `app.bsky.feed.post`
     - Track by position (like markdown-sync)

**Identity Tracking:**
- Articles: Use frontmatter `articleUri` field
- Microposts: Position-based (first post in file = first post in PDS for that date)

### `website view [--overwrite]`
Syncs content from PDS to local filesystem.

**Workflow:**
1. Check if `ai.thefocus.blog.site` record exists
2. If NOT exists:
   - Scaffold `config.json` with defaults
   - Create `content/articles/`, `content/microposts/`, `content/themes/`
   - Create sample theme files
   - Exit (user needs to customize and run `post`)
3. If exists:
   - Download site config to `config.json`
   - Download theme CSS blob to `content/themes/{theme}`
   - Download all `ai.thefocus.blog.article` records
     - For each article:
       - Download blob files to subdirectory
       - Write markdown with relative paths
       - Write frontmatter with metadata
   - Download all `app.bsky.feed.post` records (filter by author)
     - Group by date
     - Write to daily note files with `---` separators
     - Download embedded media to date subdirectories
4. `--overwrite` flag: Replace existing local files

**Default behavior:** Only create files that don't exist locally

### `website generate [--remote-pre-sync]`
Generates static HTML site from content.

**Workflow:**
1. If `--remote-pre-sync`: Run `view` first
2. Read `config.json`
3. Fetch author info from Bluesky profile (display name, avatar, bio, handle)
4. Read all articles from `content/articles/`
   - Parse markdown to HTML
   - Replace relative image paths with blob URLs (from frontmatter blob metadata)
   - Generate individual article pages
   - Collect for article index
5. Read all microposts from `content/microposts/`
   - Parse daily notes
   - Parse markdown to HTML
   - Replace relative media paths with blob URLs
   - Generate individual micropost pages
   - Collect for micropost index
6. Generate homepage (combined reverse-chronological feed)
7. Generate article index page
8. Generate micropost index page
9. Copy theme CSS to `public/style.css`
10. Copy comments.js to `public/comments.js`

**HTML Structure:**

All pages use semantic HTML5:
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Page Title - Site Title</title>
  <link rel="stylesheet" href="/style.css">
</head>
<body>
  <header class="site-header">
    <h1 class="site-title"><a href="/">Site Title</a></h1>
    <nav class="site-nav">
      <a href="/articles/">Articles</a>
      <a href="/microposts/">Microposts</a>
    </nav>
  </header>

  <main class="site-main">
    <!-- Content here -->
  </main>

  <footer class="site-footer">
    <p class="author-info"><!-- Author bio --></p>
  </footer>
</body>
</html>
```

**Article Page:**
```html
<article class="article">
  <header class="article-header">
    <h1 class="article-title">Title</h1>
    <time class="article-date" datetime="2025-11-11">Nov 11, 2025</time>
    <div class="article-tags">
      <span class="tag">tag1</span>
    </div>
  </header>

  <div class="article-content">
    <!-- Rendered markdown -->
  </div>

  <footer class="article-footer">
    <div id="comments" data-post-uri="at://...">
      <!-- Comments loaded via JS -->
    </div>
  </footer>
</article>
<script src="/comments.js"></script>
```

**Micropost Page:**
```html
<article class="micropost">
  <div class="micropost-content">
    <!-- Rendered markdown -->
  </div>
  <footer class="micropost-footer">
    <time class="micropost-date" datetime="2025-11-11T10:30:00">Nov 11, 2025 10:30 AM</time>
  </footer>
  <div id="comments" data-post-uri="at://...">
    <!-- Comments loaded via JS -->
  </div>
</article>
<script src="/comments.js"></script>
```

## Media Handling

### Upload Process (post command)
1. Parse markdown for image/video references: `![alt](path)`
2. For each media file:
   - Read file from disk
   - Determine MIME type
   - Upload to PDS blob storage
   - Get blob reference
   - Store mapping in article/post record

### Download Process (view command)
1. For each blob in article/post record:
   - Download blob data
   - Write to local path (article-name/file.jpg)
   - Update markdown to use relative path

### Render Process (generate command)
1. Parse markdown
2. For images: `![alt](relative/path)` → `<img src="blob-url" alt="alt">`
3. For videos: Similar transformation

### Bluesky Post Embeds
- Extract media from markdown automatically
- Create proper embed structures:
  - Images: `embed.images` array (max 4)
  - Video: `embed.video` object
  - Keep markdown syntax in post text for clients that don't render embeds

## Comment System

### Client-Side JavaScript (`comments.js`)
```javascript
// On page load:
// 1. Find elements with id="comments" and data-post-uri attribute
// 2. Fetch thread from Bluesky API: getPostThread(uri)
// 3. Extract replies (filter for external authors)
// 4. Render as HTML:
//    - Avatar
//    - Display name / handle
//    - Comment text
//    - Timestamp
//    - Link to original post
// 5. Support nested replies (thread structure)
```

**No authentication required** - Public API endpoints only

## CSS Themes

### Theme Requirements
Each theme must style these semantic classes:

**Layout:**
- `.site-header`, `.site-title`, `.site-nav`
- `.site-main`
- `.site-footer`, `.author-info`

**Articles:**
- `.article`, `.article-header`, `.article-title`, `.article-date`, `.article-tags`, `.tag`
- `.article-content`
- `.article-footer`

**Microposts:**
- `.micropost`, `.micropost-content`, `.micropost-footer`, `.micropost-date`

**Comments:**
- `.comments`, `.comment`, `.comment-author`, `.comment-text`, `.comment-meta`

**Index Pages:**
- `.post-list`, `.post-list-item`, `.post-preview`

### Sample Themes

1. **default.css** - Clean, modern, sans-serif
2. **minimal.css** - Ultra-minimal, monospace
3. **dark.css** - Dark mode with high contrast
4. **serif.css** - Classic, readable serif fonts

## Error Handling

- Missing credentials: Clear error message
- Missing config.json: Auto-scaffold on `view`, prompt on `post`
- Network errors: Retry with exponential backoff
- Invalid markdown: Warning, skip file
- Missing media files: Warning, continue without
- Blob upload failures: Error, halt process

## Date Handling (Hybrid)

For articles:
1. Check filename for date prefix: `YYYY-MM-DD-*`
2. If found, extract date and strip for slug
3. If not found, check frontmatter for `date:` field
4. If not found, use file modification time
5. Store in `createdAt` field

For microposts:
- Daily note filename IS the date: `YYYY-MM-DD.md`
- Individual post timestamps from Bluesky (on sync back)

## Implementation Notes

### Dependencies
- `@atproto/api` - ATProto client
- `marked` - Markdown parsing
- `gray-matter` - Frontmatter parsing
- `dotenv` - Environment variables
- `mime-types` - MIME type detection

### File Structure
```
website/
├── src/
│   ├── index.ts              # CLI entry point
│   ├── commands/
│   │   ├── post.ts
│   │   ├── view.ts
│   │   └── generate.ts
│   ├── lib/
│   │   ├── pds.ts            # PDS operations
│   │   ├── parser.ts         # Markdown/frontmatter parsing
│   │   ├── media.ts          # Blob upload/download
│   │   ├── templates.ts      # HTML generation
│   │   └── types.ts          # TypeScript interfaces
│   └── themes/               # Sample CSS files
├── package.json
├── tsconfig.json
└── README.md
```

## Success Criteria

- ✅ Round-trip sync: local → PDS → local preserves content
- ✅ Media uploads/downloads correctly
- ✅ Generated site is fully functional
- ✅ Comments load dynamically from Bluesky
- ✅ Themes are swappable
- ✅ Works with Obsidian (relative paths)
- ✅ Article announcements post to feed
- ✅ Position-based micropost tracking works reliably
