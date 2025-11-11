import { BskyAgent } from '@atproto/api';
import * as fs from 'fs';
import * as path from 'path';
import matter from 'gray-matter';
import { EnvConfig, SiteConfig } from '../lib/types.js';
import {
  getSiteConfigRecord,
  listArticleRecords,
  listPosts,
} from '../lib/pds.js';
import { downloadArticleBlobs, downloadCssBlob } from '../lib/media.js';

/**
 * View command: Sync content from PDS to local
 */
export async function viewCommand(
  agent: BskyAgent,
  config: EnvConfig,
  overwrite: boolean = false
): Promise<void> {
  console.log('📥 Starting view command: syncing PDS content to local...\n');

  // Check if site config exists in PDS
  const siteConfigRecord = await getSiteConfigRecord(agent);

  if (!siteConfigRecord) {
    console.log('⚠️  No site configuration found in PDS. Scaffolding local setup...\n');
    await scaffoldLocalSetup(config);
    console.log('\n✅ Local setup scaffolded. Customize config.json and run "website post" to publish.');
    return;
  }

  // 1. Sync site config
  await syncSiteConfigToLocal(agent, siteConfigRecord.record, config, overwrite);

  // 2. Sync articles
  await syncArticlesToLocal(agent, config, overwrite);

  // 3. Sync microposts
  await syncMicropostsToLocal(agent, config, overwrite);

  console.log('\n✅ All content synced from PDS successfully!');
}

/**
 * Scaffold local directory structure with defaults
 */
async function scaffoldLocalSetup(config: EnvConfig): Promise<void> {
  console.log('📁 Creating directory structure...');

  // Create directories
  const dirs = [
    config.contentDir,
    path.join(config.contentDir, 'articles'),
    path.join(config.contentDir, 'microposts'),
    path.join(config.contentDir, 'themes'),
  ];

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`   ✅ Created ${dir}`);
    }
  }

  // Create default config.json in content directory
  const configPath = path.join(config.contentDir, 'config.json');
  if (!fs.existsSync(configPath)) {
    const defaultConfig: SiteConfig = {
      siteTitle: 'My Personal Website',
      theme: {
        palette: 'light',
        font: 'system',
      },
      articleAnnouncements: {
        enabled: false,
        template: 'New article: [title]\n\n[summary]\n\n[link]',
      },
      siteUrl: 'https://example.com',
    };

    fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2), 'utf-8');
    console.log('   ✅ Created content/config.json');
  }

  // Create sample theme files (will be created properly in theme creation task)
  const themesDir = path.join(config.contentDir, 'themes');
  const sampleTheme = path.join(themesDir, 'default.css');

  if (!fs.existsSync(sampleTheme)) {
    const sampleCss = `/* Default Theme - Minimal Starter */
body {
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem;
  font-family: system-ui, sans-serif;
  line-height: 1.6;
}
`;
    fs.writeFileSync(sampleTheme, sampleCss, 'utf-8');
    console.log('   ✅ Created default theme');
  }
}

/**
 * Sync site config from PDS to local
 */
async function syncSiteConfigToLocal(
  agent: BskyAgent,
  siteConfig: any,
  envConfig: EnvConfig,
  overwrite: boolean
): Promise<void> {
  console.log('📝 Syncing site configuration...');

  const configPath = path.join(envConfig.contentDir, 'config.json');

  if (fs.existsSync(configPath) && !overwrite) {
    console.log('   ℹ️  content/config.json exists, skipping (use --overwrite to replace)');
  } else {
    const localConfig: SiteConfig = {
      siteTitle: siteConfig.siteTitle,
      theme: siteConfig.theme,
      articleAnnouncements: siteConfig.articleAnnouncements,
      siteUrl: siteConfig.siteUrl,
    };

    fs.writeFileSync(configPath, JSON.stringify(localConfig, null, 2), 'utf-8');
    console.log('   ✅ content/config.json updated');
  }

  // Download theme CSS
  if (siteConfig.themeBlobRef) {
    const themePath = path.join(envConfig.contentDir, 'themes', 'default.css');

    if (fs.existsSync(themePath) && !overwrite) {
      console.log(`   ℹ️  Theme default.css exists, skipping`);
    } else {
      await downloadCssBlob(agent, siteConfig.themeBlobRef, themePath);
      console.log(`   ✅ Theme downloaded: default.css`);
    }
  }

  console.log('');
}

/**
 * Sync articles from PDS to local
 */
async function syncArticlesToLocal(
  agent: BskyAgent,
  config: EnvConfig,
  overwrite: boolean
): Promise<void> {
  console.log('📚 Syncing articles from PDS...\n');

  const articlesDir = path.join(config.contentDir, 'articles');

  if (!fs.existsSync(articlesDir)) {
    fs.mkdirSync(articlesDir, { recursive: true });
  }

  const articles = await listArticleRecords(agent);

  if (articles.length === 0) {
    console.log('   ℹ️  No articles found in PDS\n');
    return;
  }

  console.log(`   Found ${articles.length} article(s)\n`);

  for (const article of articles) {
    const articleData = article.value;
    console.log(`📄 Article: ${articleData.title}`);

    // Use slug as filename (no date prefix)
    const filename = `${articleData.slug}.md`;
    const filePath = path.join(articlesDir, filename);

    if (fs.existsSync(filePath) && !overwrite) {
      console.log(`   ℹ️  File exists, skipping (use --overwrite to replace)`);
      console.log('');
      continue;
    }

    // Download media blobs (use slug for directory name)
    if (articleData.blobs && articleData.blobs.length > 0) {
      console.log(`   📥 Downloading ${articleData.blobs.length} media file(s)...`);
      const articleDir = path.join(articlesDir, articleData.slug);
      await downloadArticleBlobs(agent, articleData.blobs, articleDir);
    }

    // Create frontmatter
    const frontmatter: any = {
      title: articleData.title,
      date: articleData.createdAt,
      articleUri: article.uri,
    };

    if (articleData.summary) frontmatter.summary = articleData.summary;
    if (articleData.tags) frontmatter.tags = articleData.tags;

    // Write markdown file
    const output = matter.stringify(articleData.content, frontmatter);
    fs.writeFileSync(filePath, output, 'utf-8');

    console.log(`   ✅ Downloaded: ${filename}`);
    console.log('');
  }

  console.log('✅ All articles synced\n');
}

/**
 * Sync microposts from PDS to local
 */
async function syncMicropostsToLocal(
  agent: BskyAgent,
  config: EnvConfig,
  overwrite: boolean
): Promise<void> {
  console.log('💬 Syncing microposts from PDS...\n');

  const micropostsDir = path.join(config.contentDir, 'microposts');

  if (!fs.existsSync(micropostsDir)) {
    fs.mkdirSync(micropostsDir, { recursive: true });
  }

  const allPosts = await listPosts(agent);

  // Filter to only top-level posts (not replies)
  const microposts = allPosts.filter(post => !post.value.reply);

  if (microposts.length === 0) {
    console.log('   ℹ️  No microposts found in PDS\n');
    return;
  }

  console.log(`   Found ${microposts.length} micropost(s)\n`);

  // Group posts by date
  const postsByDate = new Map<string, typeof microposts>();

  for (const post of microposts) {
    const date = new Date(post.value.createdAt).toISOString().split('T')[0];

    if (!postsByDate.has(date)) {
      postsByDate.set(date, []);
    }

    postsByDate.get(date)!.push(post);
  }

  // Create daily note files
  for (const [date, posts] of postsByDate.entries()) {
    console.log(`📅 Daily note: ${date} (${posts.length} post(s))`);

    const filename = `${date}.md`;
    const filePath = path.join(micropostsDir, filename);

    if (fs.existsSync(filePath) && !overwrite) {
      console.log(`   ℹ️  File exists, skipping (use --overwrite to replace)`);
      console.log('');
      continue;
    }

    // Sort posts by time
    posts.sort((a, b) => {
      return new Date(a.value.createdAt).getTime() - new Date(b.value.createdAt).getTime();
    });

    // Create directory for this day's media
    const dayDir = path.join(micropostsDir, date);
    if (!fs.existsSync(dayDir)) {
      fs.mkdirSync(dayDir, { recursive: true });
    }

    // Process each post and download embedded media
    const postContents = await Promise.all(posts.map(async (post, index) => {
      let content = post.value.text;

      // Check for image embeds
      if (post.value.embed?.$type === 'app.bsky.embed.images') {
        const images = post.value.embed.images;

        for (let i = 0; i < images.length; i++) {
          const image = images[i];
          const blobRef = image.image;

          // Download the blob
          const ext = blobRef.mimeType?.includes('png') ? '.png' :
                      blobRef.mimeType?.includes('jpeg') ? '.jpg' : '.jpg';
          const filename = images.length > 1 ? `image-${i + 1}${ext}` : `image${ext}`;
          const localPath = path.join(dayDir, filename);

          try {
            // Get CID from either ref.$link or ref.toString()
            const cid = blobRef.ref?.$link || blobRef.ref?.toString() || blobRef.cid;

            const response = await agent.com.atproto.sync.getBlob({
              did: agent.session?.did || '',
              cid: cid,
            });

            fs.writeFileSync(localPath, Buffer.from(response.data));

            // Append image markdown to content
            const relativePath = `${date}/${filename}`;
            const alt = image.alt || 'image';
            content += `\n\n![${alt}](${relativePath})`;
          } catch (error) {
            console.warn(`   ⚠️  Failed to download image: ${error}`);
          }
        }
      }

      // Check for video embeds
      if (post.value.embed?.$type === 'app.bsky.embed.video') {
        const blobRef = post.value.embed.video;
        const filename = 'video.mp4';
        const localPath = path.join(dayDir, filename);

        try {
          // Get CID from either ref.$link or ref.toString()
          const cid = blobRef.ref?.$link || blobRef.ref?.toString() || blobRef.cid;

          const response = await agent.com.atproto.sync.getBlob({
            did: agent.session?.did || '',
            cid: cid,
          });

          fs.writeFileSync(localPath, Buffer.from(response.data));

          // Append video markdown to content
          const relativePath = `${date}/${filename}`;
          content += `\n\n![video](${relativePath})`;
        } catch (error) {
          console.warn(`   ⚠️  Failed to download video: ${error}`);
        }
      }

      return content;
    }));

    // Build daily note content with timestamps
    const frontmatter = {
      date,
      firstPostUri: posts[0].uri,
      timestamps: posts.map(post => post.value.createdAt), // Store all post timestamps
    };

    const body = postContents.join('\n\n---\n\n');

    const output = matter.stringify(body, frontmatter);
    fs.writeFileSync(filePath, output, 'utf-8');

    console.log(`   ✅ Downloaded: ${filename}`);
    console.log('');
  }

  console.log('✅ All microposts synced\n');
}
