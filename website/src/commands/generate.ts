import { BskyAgent } from '@atproto/api';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import {
  EnvConfig,
  SiteConfig,
  RenderedArticle,
  RenderedMicropost,
  RenderContext,
} from '../lib/types.js';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { parseArticle, parseDailyNote, replaceMediaWithBlobUrls } from '../lib/parser.js';
import { getAuthorInfo, getSiteConfigRecord, getArticleRecord, listPosts, listArticleRecords } from '../lib/pds.js';
import { createBlobUrlMap, getBlobUrl } from '../lib/media.js';
import { generateThemeCSS } from '../lib/theme-generator.js';
import {
  generatePage,
  generateArticlePage,
  generateMicropostPage,
  generateHomePage,
  generateArticlesIndexPage,
  generateMicropostsIndexPage,
  renderMarkdown,
} from '../lib/templates.js';
import { viewCommand } from './view.js';

/**
 * Generate command: Build static HTML site
 */
export async function generateCommand(
  agent: BskyAgent,
  config: EnvConfig,
  remotePreSync: boolean = false
): Promise<void> {
  console.log('🏗️  Starting generate command: building static site...\n');

  // Pre-sync from remote if requested
  if (remotePreSync) {
    console.log('🔄 Pre-syncing content from PDS...\n');
    await viewCommand(agent, config, false);
  }

  // Load site config
  const configPath = path.join(config.contentDir, 'config.json');
  if (!fs.existsSync(configPath)) {
    console.error('❌ content/config.json not found. Run "website view" first.');
    process.exit(1);
  }

  const siteConfig: SiteConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

  // Get author info from Bluesky profile
  console.log('👤 Fetching author info...');
  const author = await getAuthorInfo(agent);
  console.log(`   ✅ Author: ${author.displayName || author.handle}\n`);

  // Create render context
  const ctx: RenderContext = {
    siteConfig,
    author,
    currentPath: '/',
  };

  // Create output directory
  if (!fs.existsSync(config.outputDir)) {
    fs.mkdirSync(config.outputDir, { recursive: true });
  }

  // Generate articles
  const renderedArticles = await generateArticles(agent, config, ctx);

  // Generate microposts
  const renderedMicroposts = await generateMicroposts(agent, config, ctx);

  // Generate index pages
  await generateIndexPages(renderedArticles, renderedMicroposts, ctx, config);

  // Copy theme CSS
  await copyTheme(siteConfig, config);

  // Copy comments.js
  await copyCommentsJs(config);

  console.log(`\n✅ Static site generated in ${config.outputDir}`);
  console.log(`   📄 ${renderedArticles.length} article(s)`);
  console.log(`   💬 ${renderedMicroposts.length} micropost(s)`);
}

/**
 * Generate all article pages
 */
async function generateArticles(
  agent: BskyAgent,
  config: EnvConfig,
  ctx: RenderContext
): Promise<RenderedArticle[]> {
  console.log('📚 Generating articles...\n');

  const outputDir = path.join(config.outputDir, 'articles');

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Fetch all articles from PDS
  const pdsArticles = await listArticleRecords(agent);
  const renderedArticles: RenderedArticle[] = [];

  if (pdsArticles.length === 0) {
    console.log('   ℹ️  No articles found in PDS\n');
    return [];
  }

  for (const pdsArticle of pdsArticles) {
    console.log(`   📄 ${pdsArticle.value.title || pdsArticle.rkey}`);

    const htmlContent = renderMarkdown(pdsArticle.value.content);

    // Parse date
    let articleDate: Date;
    if (pdsArticle.value.createdAt) {
      articleDate = new Date(pdsArticle.value.createdAt);
      if (isNaN(articleDate.getTime())) {
        articleDate = new Date();
      }
    } else {
      articleDate = new Date();
    }

    // Use slug from article (not rkey)
    const slug = pdsArticle.value.slug;

    const rendered: RenderedArticle = {
      slug,
      title: pdsArticle.value.title || slug,
      date: articleDate,
      summary: pdsArticle.value.summary,
      tags: pdsArticle.value.tags || [],
      htmlContent,
      postUri: pdsArticle.uri,
    };

    renderedArticles.push(rendered);

    // Generate article page
    const html = generateArticlePage(rendered, ctx);
    const outputPath = path.join(outputDir, `${slug}.html`);
    fs.writeFileSync(outputPath, html, 'utf-8');
  }

  console.log(`   ✅ Generated ${renderedArticles.length} article page(s)\n`);

  // Sort by date (newest first)
  renderedArticles.sort((a, b) => b.date.getTime() - a.date.getTime());

  return renderedArticles;
}

/**
 * Generate all micropost pages
 */
async function generateMicroposts(
  agent: BskyAgent,
  config: EnvConfig,
  ctx: RenderContext
): Promise<RenderedMicropost[]> {
  console.log('💬 Generating microposts...\n');

  const outputDir = path.join(config.outputDir, 'microposts');

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const renderedMicroposts: RenderedMicropost[] = [];

  // Fetch all posts from PDS
  const allPosts = await listPosts(agent);

  // Filter to only top-level posts (no replies)
  const topLevelPosts = allPosts.filter(post => !post.value.reply);

  if (topLevelPosts.length === 0) {
    console.log('   ℹ️  No microposts found in PDS\n');
    return [];
  }

  // Group posts by date
  const postsByDate = new Map<string, typeof topLevelPosts>();
  for (const post of topLevelPosts) {
    const date = new Date(post.value.createdAt);
    const dateKey = date.toISOString().split('T')[0]; // YYYY-MM-DD
    if (!postsByDate.has(dateKey)) {
      postsByDate.set(dateKey, []);
    }
    postsByDate.get(dateKey)!.push(post);
  }

  // Generate HTML for each post
  for (const [dateKey, posts] of postsByDate) {
    console.log(`   📅 ${dateKey}`);

    // Sort posts by time
    posts.sort((a, b) =>
      new Date(a.value.createdAt).getTime() - new Date(b.value.createdAt).getTime()
    );

    for (let i = 0; i < posts.length; i++) {
      const post = posts[i];
      const postValue = post.value;

      // Render text content
      let htmlContent = renderMarkdown(postValue.text);

      // Extract images from embed
      if (postValue.embed) {
        const images = extractImagesFromEmbed(postValue.embed, agent.session?.did || '');
        if (images.length > 0) {
          htmlContent += '\n' + images.map(img =>
            `<img src="${img.url}" alt="${img.alt}" class="micropost-image">`
          ).join('\n');
        }
      }

      const date = new Date(postValue.createdAt);
      const permalink = `${dateKey}-${i + 1}`;

      const rendered: RenderedMicropost = {
        date,
        index: i,
        htmlContent,
        postUri: post.uri,
        permalink,
      };

      renderedMicroposts.push(rendered);
    }
  }

  // Sort by date (newest first) before adding navigation
  renderedMicroposts.sort((a, b) => b.date.getTime() - a.date.getTime());

  // Add navigation links (prev/next)
  for (let i = 0; i < renderedMicroposts.length; i++) {
    const micropost = renderedMicroposts[i];

    // Previous (older) post
    if (i < renderedMicroposts.length - 1) {
      micropost.prevPermalink = renderedMicroposts[i + 1].permalink;
    }

    // Next (newer) post
    if (i > 0) {
      micropost.nextPermalink = renderedMicroposts[i - 1].permalink;
    }

    // Regenerate page with navigation
    const html = generateMicropostPage(micropost, ctx);
    const outputPath = path.join(outputDir, `${micropost.permalink}.html`);
    fs.writeFileSync(outputPath, html, 'utf-8');
  }

  console.log(`   ✅ Generated ${renderedMicroposts.length} micropost page(s)\n`);

  return renderedMicroposts;
}

/**
 * Generate index pages
 */
async function generateIndexPages(
  articles: RenderedArticle[],
  microposts: RenderedMicropost[],
  ctx: RenderContext,
  config: EnvConfig
): Promise<void> {
  console.log('📑 Generating index pages...\n');

  // Homepage (recent 10 items)
  const recentArticles = articles.slice(0, 5);
  const recentMicroposts = microposts.slice(0, 5);
  const homepageHtml = generateHomePage(recentArticles, recentMicroposts, ctx);
  fs.writeFileSync(path.join(config.outputDir, 'index.html'), homepageHtml, 'utf-8');
  console.log('   ✅ Generated index.html');

  // Articles index
  const articlesIndexHtml = generateArticlesIndexPage(articles, ctx);
  const articlesDir = path.join(config.outputDir, 'articles');
  if (!fs.existsSync(articlesDir)) {
    fs.mkdirSync(articlesDir, { recursive: true });
  }
  fs.writeFileSync(path.join(articlesDir, 'index.html'), articlesIndexHtml, 'utf-8');
  console.log('   ✅ Generated articles/index.html');

  // Microposts index
  const micropostsIndexHtml = generateMicropostsIndexPage(microposts, ctx);
  const micropostsDir = path.join(config.outputDir, 'microposts');
  if (!fs.existsSync(micropostsDir)) {
    fs.mkdirSync(micropostsDir, { recursive: true });
  }
  fs.writeFileSync(path.join(micropostsDir, 'index.html'), micropostsIndexHtml, 'utf-8');
  console.log('   ✅ Generated microposts/index.html');

  console.log('');
}

/**
 * Generate and copy theme CSS to output
 */
async function copyTheme(siteConfig: SiteConfig, config: EnvConfig): Promise<void> {
  console.log('🎨 Generating theme CSS...');

  try {
    // Generate CSS from palette and font choices
    const css = generateThemeCSS({
      palette: siteConfig.theme.palette,
      font: siteConfig.theme.font,
    });

    fs.writeFileSync(path.join(config.outputDir, 'style.css'), css, 'utf-8');

    console.log(`   ✅ Theme generated (${siteConfig.theme.palette} / ${siteConfig.theme.font})\n`);
  } catch (error: any) {
    console.error(`   ❌ Error generating theme: ${error.message}`);
    console.error('   Using default theme instead...');

    // Fallback to default
    const css = generateThemeCSS({ palette: 'light', font: 'system' });
    fs.writeFileSync(path.join(config.outputDir, 'style.css'), css, 'utf-8');
    console.log('   ✅ Default theme applied\n');
  }
}

/**
 * Copy comments.js to output
 */
async function copyCommentsJs(config: EnvConfig): Promise<void> {
  console.log('💬 Copying comments script...');

  // Try multiple paths to find comments.js
  const possiblePaths = [
    path.join(__dirname, '../../themes/comments.js'),  // From dist/commands
    path.join(__dirname, '../../src/themes/comments.js'),  // From dist
    path.join(process.cwd(), 'src/themes/comments.js'),  // From project root
  ];

  let commentsJsPath: string | undefined;
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      commentsJsPath = p;
      break;
    }
  }

  if (commentsJsPath) {
    const js = fs.readFileSync(commentsJsPath, 'utf-8');
    fs.writeFileSync(path.join(config.outputDir, 'comments.js'), js, 'utf-8');
    console.log('   ✅ Comments script copied\n');
  } else {
    console.log('   ⚠️  comments.js not found, skipping\n');
  }
}

/**
 * Extract image URLs from Bluesky embed
 */
function extractImagesFromEmbed(embed: any, did: string): Array<{ url: string; alt: string }> {
  const images: Array<{ url: string; alt: string }> = [];

  if (embed.$type === 'app.bsky.embed.images') {
    // Images embed
    for (const img of embed.images) {
      const cid = img.image.ref.toString();
      const url = `https://cdn.bsky.app/img/feed_fullsize/plain/${did}/${cid}@jpeg`;
      images.push({
        url,
        alt: img.alt || '',
      });
    }
  } else if (embed.$type === 'app.bsky.embed.video') {
    // Video embed - could add video support later
    // For now, just skip videos
  }

  return images;
}
