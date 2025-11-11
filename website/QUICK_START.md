# Quick Start Guide

Get your ATProto-powered website up and running in 5 minutes!

## Prerequisites

- Node.js 18+ installed
- Bluesky account with app password
- Basic familiarity with markdown

## Step 1: Install

```bash
cd website
npm install
npm run build
```

## Step 2: Configure

Create `.env` file:

```bash
cp .env.example .env
```

Edit `.env`:

```env
BLUESKY_HANDLE=yourhandle.bsky.social
BLUESKY_PASSWORD=your-app-password
ATP_SERVICE=https://bsky.social
CONTENT_DIR=./content
OUTPUT_DIR=./public
```

Get your app password from: https://bsky.app/settings/app-passwords

## Step 3: Initialize

```bash
npm run website view
```

This creates:
- `config.json` - Site configuration
- `content/articles/` - For long-form posts
- `content/microposts/` - For short posts
- `content/themes/` - CSS theme files

## Step 4: Customize

Edit `config.json`:

```json
{
  "siteTitle": "My Website",
  "theme": "default.css",
  "articleAnnouncements": {
    "enabled": true,
    "template": "New article: [title]\n\n[summary]\n\n[link]"
  },
  "siteUrl": "https://yourdomain.com"
}
```

## Step 5: Create Content

### Write an Article

Create `content/articles/hello-world.md`:

```markdown
---
title: Hello World
summary: My first post on ATProto
tags: [introduction]
---

# Welcome!

This is my first article using the ATProto Website tool.

I can include images:

![My photo](hello-world/photo.jpg)

And write in markdown!
```

### Write a Micropost

Create `content/microposts/2025-01-15.md`:

```markdown
---
date: 2025-01-15
---

Just set up my ATProto website! 🎉

---

Testing the micropost feature. This is pretty cool!
```

## Step 6: Publish

```bash
npm run website post
```

This:
- Uploads your config to your PDS
- Creates article records
- Posts microposts to Bluesky
- Uploads media as blobs

## Step 7: Generate Site

```bash
npm run website generate
```

Your static site is now in `public/` directory!

## Step 8: Preview Locally

```bash
npx serve public
```

Open http://localhost:3000 to see your site!

## Step 9: Deploy

Choose your hosting:

### Netlify

```bash
npm install -g netlify-cli
netlify deploy --dir=public --prod
```

### Vercel

```bash
npm install -g vercel
vercel --prod
```

### GitHub Pages

```bash
git add public
git commit -m "Deploy site"
git subtree push --prefix public origin gh-pages
```

## Daily Workflow

1. Write content in `content/`
2. `npm run website post` - Publish to PDS
3. `npm run website generate` - Build site
4. Deploy `public/` directory

## Tips

- Use the example files in `examples/` folder
- Try different themes: change `theme` in `config.json`
- Enable article announcements to auto-post to Bluesky
- Use `--overwrite` flag to replace local files: `npm run website view --overwrite`
- Use `--remote-pre-sync` to sync before generating: `npm run website generate --remote-pre-sync`

## Troubleshooting

**"Authentication failed"**
- Check your handle and app password in `.env`
- Make sure you're using an app password, not your main password

**"No such file or directory"**
- Run `npm run website view` first to create directories
- Make sure you're in the `website` directory

**"Theme file not found"**
- Check that `theme` in `config.json` matches a file in `content/themes/`
- Default themes: `default.css`, `minimal.css`, `dark.css`, `serif.css`

## Next Steps

- Read the full [README.md](README.md) for detailed documentation
- Check out [IMPLEMENTATION_SPEC.md](IMPLEMENTATION_SPEC.md) for technical details
- Explore the example content in `examples/`
- Customize your theme CSS
- Add more articles and microposts!

## Need Help?

- Check the documentation in this repository
- Review the example files
- File an issue if you encounter bugs

Happy blogging! 🚀
