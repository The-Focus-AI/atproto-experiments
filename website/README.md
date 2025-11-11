# ATProto Website Tool

A personal blog/website generator with content stored in your ATProto PDS (Personal Data Server). Write in markdown, sync to Bluesky, and generate beautiful static sites from PDS data.

## Features

- 📝 **Markdown-First** - Write articles and microposts in markdown
- 🔄 **PDS-Native** - All content stored in your Personal Data Server
- 🎨 **Themeable** - Mix-and-match color palettes and font systems
- 💬 **Live Comments** - Dynamically load Bluesky comments on your posts
- 🖼️ **CDN Images** - Images stored as blobs, served from Bluesky CDN
- ⌨️ **Keyboard Navigation** - Arrow keys navigate between microposts
- 📱 **Obsidian Compatible** - Works with daily notes and relative paths
- 🚀 **Static Generation** - Builds site entirely from PDS (no local files needed)
- 📣 **Article Announcements** - Auto-post to Bluesky feed when publishing

## Installation

```bash
cd website
npm install
npm run build
```

## Quick Start

### 1. Setup Environment

Create a `.env` file (see `.env.example`):

```bash
BLUESKY_HANDLE=your-handle.bsky.social
BLUESKY_PASSWORD=your-app-password
ATP_SERVICE=https://bsky.social
CONTENT_DIR=./content
OUTPUT_DIR=./public
```

### 2. Initialize

Pull existing content or scaffold new setup:

```bash
npm run website view
```

This creates:
- `config.json` - Site configuration
- `content/articles/` - Long-form articles
- `content/microposts/` - Daily notes with short posts
- `content/themes/` - CSS theme files

### 3. Configure

Edit `config.json`:

```json
{
  "siteTitle": "My Personal Website",
  "theme": {
    "palette": "warm",
    "font": "traditional"
  },
  "articleAnnouncements": {
    "enabled": true,
    "template": "New article: [title]\n\n[summary]\n\n[link]"
  },
  "siteUrl": "https://yourdomain.com"
}
```

**Available Palettes:**
- `light` - Clean light mode
- `dark` - High-contrast dark mode
- `warm` - Warm, earthy tones
- `forest` - Deep greens and browns
- `ocean` - Blue and teal shades

**Available Fonts:**
- `system` - Native system fonts
- `traditional` - Classic serif + sans-serif combo
- `modern` - Contemporary sans-serif stack
- `monospace` - Terminal/code aesthetic
- `classical-humanist` - Renaissance-inspired typography

### 4. Create Content

**Article** (`content/articles/my-first-post.md`):

```markdown
---
title: My First Article
summary: A brief introduction to my new blog
tags: [introduction, blog]
---

# Welcome!

This is my first article using the ATProto Website tool.

![Photo](my-first-post/photo.jpg)

More content here...
```

**Micropost** (`content/microposts/2025-01-15.md`):

```markdown
---
date: 2025-01-15
---

Just had a great idea for a new project!

---

Another thought later in the day...

![Cat](2025-01-15/cat.jpg)

---

Evening reflection.
```

### 5. Publish to PDS

```bash
npm run website post
```

This:
- Uploads config and theme CSS to PDS
- Creates article records with `ai.thefocus.blog.article` lexicon
- Creates microposts as standard Bluesky posts
- Uploads media files as blobs
- Optionally posts article announcements to your feed

### 6. Generate Static Site

```bash
npm run website generate
```

Output in `./public/`:
- Homepage with recent posts
- Individual article pages
- Individual micropost pages
- Article and micropost index pages
- Theme CSS and comments JavaScript

## Commands

### `website post`

Sync content from local to PDS.

```bash
npm run website post
```

- Reads `config.json` and uploads site configuration
- Uploads theme CSS as blob
- Processes all articles in `content/articles/`
- Processes all daily notes in `content/microposts/`
- Uploads media files as blobs
- Creates/updates records in PDS

### `website view [--overwrite]`

Sync content from PDS to local.

```bash
npm run website view
npm run website view --overwrite
```

- Downloads site configuration to `config.json`
- Downloads theme CSS
- Downloads all articles to `content/articles/`
- Downloads all microposts to `content/microposts/`
- Downloads media blobs to subdirectories

Flags:
- `--overwrite` - Replace existing local files (default: skip existing)

### `website generate`

Generate static HTML site **entirely from PDS data**.

```bash
npm run website generate
```

How it works:
- Fetches all articles from PDS using `ai.thefocus.blog.article` lexicon
- Fetches all microposts from PDS using `app.bsky.feed.post` collection
- Extracts image embeds from posts and generates CDN URLs
- Builds navigation links between microposts (prev/next)
- Generates theme CSS from palette and font configuration
- Creates complete static site in `./public/`

**Important:** The generate command now works 100% from PDS data. Local markdown files are only needed for the `post` command. This means you can generate your site from any machine with just your PDS credentials!

## Content Structure

### Articles

Location: `content/articles/`

Filename format:
- `my-article.md` - Slug: `my-article`

The filename determines the slug/URL. The date goes in the frontmatter, not the filename.

Frontmatter:
```markdown
---
title: Article Title
date: 2025-01-15T10:00:00Z  # Optional if in filename
summary: Brief description
tags: [tag1, tag2]
articleUri: at://did:plc:.../ai.thefocus.blog.article/...  # Auto-generated
---
```

Media files:
- Store in subdirectory: `article-name/`
- Reference with relative paths: `![Alt](article-name/image.jpg)`
- Uploaded as blobs to PDS

### Microposts

Location: `content/microposts/`

Filename format: `YYYY-MM-DD.md` (daily notes)

Structure:
```markdown
---
date: 2025-01-15
firstPostUri: at://...  # Auto-generated
---

First post of the day

---

Second post

![Photo](2025-01-15/photo.jpg)

---

Third post
```

Media files:
- Store in subdirectory: `YYYY-MM-DD/`
- Reference with relative paths: `![Alt](2025-01-15/image.jpg)`
- Uploaded as blobs to PDS

### Themes

The theming system uses a **composable approach** - mix and match color palettes with font systems.

Configuration is in `config.json`:

```json
{
  "theme": {
    "palette": "warm",
    "font": "traditional"
  }
}
```

#### Color Palettes

Located in `src/themes/palettes.json`:

- **light** - Clean whites and grays
- **dark** - High-contrast dark mode
- **warm** - Earthy browns and beiges
- **forest** - Deep greens and browns
- **ocean** - Blues and teals

Each palette defines:
- `bg` - Background color
- `surface` - Card/panel backgrounds
- `text` - Primary text color
- `text-secondary` - Muted text
- `primary` - Links and accents
- `border` - Dividers and borders
- `hover-bg` - Interactive element backgrounds

#### Font Systems

Located in `src/themes/fonts.json`:

- **system** - Native system font stack (fast, familiar)
- **traditional** - Serif headings + sans body (classic blog)
- **modern** - Contemporary sans-serif (clean, geometric)
- **monospace** - Terminal aesthetic (dev/tech blogs)
- **classical-humanist** - Renaissance-style typography (elegant, literary)

Each font system defines:
- `body` - Body text font stack
- `heading` - Heading font stack

#### Creating Custom Themes

Add your palette to `src/themes/palettes.json`:

```json
{
  "sunset": {
    "name": "Sunset",
    "colors": {
      "bg": "#fff5e6",
      "surface": "#ffffff",
      "text": "#2d1810",
      "text-secondary": "#7a6d5a",
      "primary": "#d84315",
      "primary-hover": "#bf360c",
      "border": "#e0d5c7",
      "hover-bg": "#ffebcc"
    }
  }
}
```

Or add custom fonts to `src/themes/fonts.json`:

```json
{
  "handwritten": {
    "name": "Handwritten",
    "body": "'Caveat', cursive, sans-serif",
    "heading": "'Permanent Marker', cursive, sans-serif"
  }
}
```

Then rebuild and run `website post` to upload the new theme configuration.

#### Semantic CSS Classes

The generated HTML uses these semantic classes for styling:

**Layout:** `.site-header`, `.site-nav`, `.site-main`, `.site-footer`
**Articles:** `.article`, `.article-header`, `.article-title`, `.article-content`
**Microposts:** `.micropost`, `.micropost-content`, `.micropost-footer`, `.micropost-nav`
**Navigation:** `.nav-prev`, `.nav-next`, `.nav-disabled`
**Comments:** `.comments`, `.comment`, `.comment-author`, `.comment-text`
**Lists:** `.post-list`, `.post-list-item`, `.post-preview`
**Images:** `.micropost-image`

## Media Handling

### How Images Work

1. **Local markdown** - Reference images with relative paths:
   ```markdown
   ![My photo](article-name/photo.jpg)
   ```

2. **Upload to PDS** - Run `website post` to:
   - Upload image files as blobs to your PDS
   - Store blob references in article/post records
   - Replace local paths with CDN URLs in content

3. **Generate site** - Run `website generate` to:
   - Fetch content from PDS (already has CDN URLs)
   - Extract image embeds from microposts
   - Generate HTML with images served from Bluesky CDN

**CDN URL format:**
```
https://cdn.bsky.app/img/feed_fullsize/plain/{did}/{cid}@jpeg
```

### Micropost Images

Images in microposts are handled specially:
- Markdown image syntax is **stripped from text**
- Images are attached as **embeds** in the Bluesky post
- When generating HTML, embeds are extracted and displayed
- Supports up to 4 images per micropost (Bluesky limit)

Example micropost in PDS:
```json
{
  "text": "Check out this photo",
  "embed": {
    "$type": "app.bsky.embed.images",
    "images": [{
      "image": { "ref": "bafkrei..." },
      "alt": "My photo"
    }]
  }
}
```

Generated HTML:
```html
<p>Check out this photo</p>
<img src="https://cdn.bsky.app/img/feed_fullsize/plain/did:plc:.../bafkrei...@jpeg"
     alt="My photo"
     class="micropost-image">
```

## Keyboard Navigation

Micropost pages support keyboard navigation:

- **← (Left Arrow)** - Navigate to older post
- **→ (Right Arrow)** - Navigate to newer post

Navigation is automatically disabled when focus is in an input or textarea field.

Visual navigation links appear at the top and bottom of each micropost with hover effects.

## Generated Site Structure

```
public/
├── index.html                   # Homepage
├── style.css                    # Generated theme CSS
├── comments.js                  # Comment loader
├── articles/
│   ├── index.html              # Articles index
│   ├── my-first-post.html
│   └── another-post.html
└── microposts/
    ├── index.html              # Microposts index
    ├── 2025-01-15-1.html       # Individual microposts with navigation
    └── 2025-01-15-2.html
```

## Lexicons

### `ai.thefocus.blog.article`

Custom lexicon for long-form articles.

Fields:
- `title` - Article title
- `slug` - URL-friendly slug
- `content` - Markdown content
- `createdAt` - ISO datetime
- `summary` - Optional excerpt
- `tags` - Optional array of tags
- `blobs` - Media file mappings with blob references
- `announcementPostUri` - URI of announcement post (if created)

### `ai.thefocus.blog.site`

Site configuration stored in PDS.

Fields:
- `siteTitle` - Website title
- `theme` - CSS theme filename
- `themeBlobRef` - Uploaded CSS blob reference
- `articleAnnouncements` - Announcement settings
- `siteUrl` - Base URL for generated site
- `updatedAt` - Last update timestamp

### `app.bsky.feed.post`

Standard Bluesky posts used for microposts.

Supports:
- Text content with rich text facets
- Image embeds (max 4)
- Video embeds (1 per post)
- Replies (threaded conversations)

## Comments System

Comments are loaded dynamically from Bluesky using client-side JavaScript.

How it works:
1. Article/micropost pages include `data-post-uri` attribute
2. `comments.js` fetches thread from Bluesky Public API
3. Renders comments with author info, text, timestamps
4. Supports nested replies
5. Links back to original Bluesky posts

No authentication required - uses public API endpoints.

## Deployment

The generated `public/` directory can be deployed to:

- **Static Hosts:** Netlify, Vercel, GitHub Pages, Cloudflare Pages
- **Object Storage:** S3 + CloudFront, R2, GCS
- **Traditional Hosting:** Any web server that serves static files

Example with Netlify:

```bash
# Build site
npm run website generate

# Deploy
netlify deploy --dir=public --prod
```

## Obsidian Integration

This tool works seamlessly with Obsidian:

1. Set `CONTENT_DIR` to your Obsidian vault folder
2. Use daily notes for microposts (`YYYY-MM-DD.md`)
3. Store articles in a dedicated folder
4. Use relative paths for images (will be uploaded as blobs)
5. Edit locally in Obsidian, sync with `website post`

## Workflow Examples

### First-time setup from scratch

```bash
# Create initial config and content locally
npm run website view          # Scaffold directories and config
# Edit config.json, create articles/microposts
npm run website post          # Publish everything to PDS
npm run website generate      # Build static site from PDS
```

### Generate from any machine (no local files)

```bash
# With just your .env credentials, generate from PDS:
npm run website generate      # Fetches all content from PDS and builds site
```

This is the key workflow - the generate command works 100% from PDS, so you can:
- Deploy from CI/CD without checking in content
- Build from a fresh clone with just credentials
- Switch machines without syncing content files

### Edit and republish workflow

```bash
# Pull content from PDS to local files
npm run website view

# Edit markdown files locally
vim content/articles/new-post.md

# Push changes back to PDS
npm run website post

# Regenerate site from PDS
npm run website generate
```

### Fresh rebuild (discard local)

```bash
npm run website view --overwrite   # Replace everything with PDS version
# Edit content
npm run website post               # Push changes
npm run website generate           # Rebuild site
```

### Obsidian daily notes workflow

```bash
# Point CONTENT_DIR to your Obsidian vault
# Write microposts in daily notes (YYYY-MM-DD.md)
# Separate sections with ---

npm run website post          # Upload to PDS and Bluesky
npm run website generate      # Build site with images from CDN
```

## Troubleshooting

**Authentication fails:**
- Check `.env` credentials
- Use an app password, not your main password
- Verify `ATP_SERVICE` URL

**Media files not uploading:**
- Check file paths are relative
- Ensure files exist in subdirectories
- Verify MIME types are supported

**Comments not loading:**
- Check browser console for errors
- Verify `postUri` in HTML
- Ensure post is published and public

**Theme not applied:**
- Check `theme` filename in `config.json`
- Verify CSS file exists in `content/themes/`
- Run `website post` to upload theme

## Development

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Watch mode
npm run dev

# Run CLI
npm run website <command>
```

## Architecture

### Core Technology

- **TypeScript** - Type-safe implementation
- **@atproto/api** - ATProto client library for PDS operations
- **marked** - Markdown to HTML conversion
- **gray-matter** - Frontmatter parsing
- **Client-side JS** - Dynamic comment loading from Bluesky

### Data Flow

```
Local Markdown Files
         ↓
    website post
         ↓
  PDS Records + Blobs
         ↓
  website generate  ← Fetches everything from PDS
         ↓
  Static HTML Site
```

### PDS-First Design

The tool follows a **PDS-first architecture**:

1. **Source of Truth**: Your Personal Data Server is the canonical source
2. **Local Editing**: Markdown files are temporary editing workspace
3. **Static Generation**: HTML is generated entirely from PDS data
4. **Blob Storage**: Images stored as blobs, served via Bluesky CDN
5. **No Local Dependency**: Generate command needs only PDS credentials

This means:
- Content is **portable** across machines
- Site generation is **reproducible** from PDS alone
- **No git commits** needed for content (optional for code)
- Deploy from **CI/CD** without content files

### Theme Generation

Themes are generated dynamically at build time:

1. Read palette + font from `config.json`
2. Load definitions from `palettes.json` and `fonts.json`
3. Inject CSS variables into `base.css` template
4. Generate final `style.css` in output directory

This allows theme changes without editing CSS files.

## License

MIT

## Links

- [ATProto Documentation](https://atproto.com/docs)
- [Bluesky](https://bsky.app)
- [Lexicon Spec](https://atproto.com/specs/lexicon)

## Contributing

Issues and pull requests welcome!
