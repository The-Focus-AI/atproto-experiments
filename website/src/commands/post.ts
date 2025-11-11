import { BskyAgent } from '@atproto/api';
import * as fs from 'fs';
import * as path from 'path';
import { EnvConfig, SiteConfig, ArticleBlob } from '../lib/types.js';
import {
  parseArticle,
  parseDailyNote,
  updateArticleFile,
  updateDailyNoteFile,
  extractImagesForEmbed,
  extractVideoForEmbed,
  stripMediaMarkdown,
  replaceMediaWithBlobUrls,
} from '../lib/parser.js';
import {
  uploadMediaFiles,
  createArticleBlobs,
  uploadCssBlob,
} from '../lib/media.js';
import {
  putArticleRecord,
  getArticleRecord,
  putSiteConfigRecord,
  createPost,
  getPostRecord,
  listPosts,
  extractRkey,
  createArticleAnnouncement,
} from '../lib/pds.js';

/**
 * Post command: Sync content from local to PDS
 */
export async function postCommand(agent: BskyAgent, config: EnvConfig): Promise<void> {
  console.log('📤 Starting post command: syncing local content to PDS...\n');

  // 1. Read and sync config.json
  await syncSiteConfig(agent, config);

  // 2. Sync articles
  await syncArticles(agent, config);

  // 3. Sync microposts
  await syncMicroposts(agent, config);

  console.log('\n✅ All content synced to PDS successfully!');
}

/**
 * Sync site configuration
 */
async function syncSiteConfig(agent: BskyAgent, envConfig: EnvConfig): Promise<void> {
  const configPath = path.join(envConfig.contentDir, 'config.json');

  if (!fs.existsSync(configPath)) {
    console.log('⚠️  content/config.json not found. Creating default...');
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
    fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
    console.log('✅ Created content/config.json - please customize it and run post again');
    return;
  }

  const siteConfig: SiteConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

  console.log('📝 Syncing site configuration...');

  // Generate theme CSS (we'll upload it as a blob for storage)
  const { generateThemeCSS } = await import('../lib/theme-generator.js');
  const themeCSS = generateThemeCSS(siteConfig.theme);

  // Upload as blob
  const themeBlobRef = await agent.uploadBlob(
    Buffer.from(themeCSS, 'utf-8'),
    { encoding: 'text/css' }
  );

  // Create site config record
  await putSiteConfigRecord(agent, {
    siteTitle: siteConfig.siteTitle,
    theme: siteConfig.theme,
    themeBlobRef: themeBlobRef.data.blob,
    articleAnnouncements: siteConfig.articleAnnouncements,
    siteUrl: siteConfig.siteUrl,
    updatedAt: new Date().toISOString(),
  });

  console.log('✅ Site configuration synced\n');
}

/**
 * Sync all articles
 */
async function syncArticles(agent: BskyAgent, config: EnvConfig): Promise<void> {
  const articlesDir = path.join(config.contentDir, 'articles');

  if (!fs.existsSync(articlesDir)) {
    console.log('ℹ️  No articles directory found, skipping articles\n');
    return;
  }

  const files = fs.readdirSync(articlesDir).filter(f => f.endsWith('.md'));

  if (files.length === 0) {
    console.log('ℹ️  No article files found\n');
    return;
  }

  console.log(`📚 Syncing ${files.length} article(s)...\n`);

  // Load site config for announcements
  const siteConfigPath = path.join(config.contentDir, 'config.json');
  const siteConfig: SiteConfig = JSON.parse(fs.readFileSync(siteConfigPath, 'utf-8'));

  for (const file of files) {
    const filePath = path.join(articlesDir, file);
    console.log(`📄 Processing: ${file}`);

    const article = parseArticle(filePath, config.contentDir);

    // Check if article already exists
    let existingRkey: string | undefined;
    let existingBlobs: ArticleBlob[] | undefined;

    if (article.frontmatter.articleUri) {
      existingRkey = extractRkey(article.frontmatter.articleUri);
      const existing = await getArticleRecord(agent, existingRkey);

      if (existing) {
        console.log('   ℹ️  Article already exists, updating...');
        // Preserve existing blobs to avoid re-uploading
        existingBlobs = existing.record.blobs;
      }
    }

    // Upload media files only if they don't already exist in the record
    let blobMap = new Map<string, any>();
    let articleBlobs: ArticleBlob[] = [];
    let contentWithBlobUrls = article.content;

    if (article.mediaFiles.length > 0 && !existingBlobs) {
      // Only upload if this is a new article or blobs don't exist
      console.log(`   📤 Uploading ${article.mediaFiles.length} media file(s)...`);
      blobMap = await uploadMediaFiles(agent, article.mediaFiles);
      articleBlobs = createArticleBlobs(article.mediaFiles, blobMap);

      // Convert blob refs to CDN URLs and replace in content
      const blobUrlMap = new Map<string, string>();
      for (const [localPath, blobRef] of blobMap.entries()) {
        // ATProto blob URL format: https://cdn.bsky.app/img/feed_thumbnail/plain/{did}/{cid}@jpeg
        // For now, use a simpler format that works with the ATProto API
        const did = agent.session?.did || '';
        const cid = blobRef.ref.toString();
        const blobUrl = `https://cdn.bsky.app/img/feed_fullsize/plain/${did}/${cid}@jpeg`;
        blobUrlMap.set(localPath, blobUrl);
      }

      contentWithBlobUrls = replaceMediaWithBlobUrls(article.content, blobUrlMap);
    } else if (existingBlobs) {
      // Use existing blobs and reconstruct URLs from them
      articleBlobs = existingBlobs;

      // Reconstruct blob URLs from existing blobs to update content
      const blobUrlMap = new Map<string, string>();
      const did = agent.session?.did || '';

      for (const blob of existingBlobs) {
        const cid = blob.blobRef.ref.toString();
        const blobUrl = `https://cdn.bsky.app/img/feed_fullsize/plain/${did}/${cid}@jpeg`;
        blobUrlMap.set(blob.relativePath, blobUrl);
      }

      // Replace local paths with blob URLs (in case content still has local paths)
      contentWithBlobUrls = replaceMediaWithBlobUrls(article.content, blobUrlMap);
    }

    // Create article record
    const { uri, cid } = await putArticleRecord(agent, existingRkey, {
      title: article.frontmatter.title || article.slug,
      slug: article.slug,
      content: contentWithBlobUrls,
      createdAt: article.frontmatter.date || new Date().toISOString(),
      summary: article.frontmatter.summary,
      tags: article.frontmatter.tags,
      blobs: articleBlobs.length > 0 ? articleBlobs : undefined,
    });

    const articleUrl = `${siteConfig.siteUrl}/articles/${article.slug}.html`;

    // Update local file with URI
    updateArticleFile(filePath, {
      articleUri: uri,
      articleUrl,
    });

    console.log(`   ✅ Article published: ${uri}`);

    // Create announcement post if enabled
    if (
      siteConfig.articleAnnouncements?.enabled &&
      !article.frontmatter.articleUri // Only for new articles
    ) {
      console.log('   📣 Creating announcement post...');

      const announcementResponse = await createArticleAnnouncement(agent, siteConfig.articleAnnouncements.template, {
        title: article.frontmatter.title || article.slug,
        summary: article.frontmatter.summary,
        tags: article.frontmatter.tags,
        url: articleUrl,
      });

      // Update article record with announcement URI
      await putArticleRecord(agent, extractRkey(uri), {
        title: article.frontmatter.title || article.slug,
        slug: article.slug,
        content: article.content,
        createdAt: article.frontmatter.date || new Date().toISOString(),
        summary: article.frontmatter.summary,
        tags: article.frontmatter.tags,
        blobs: articleBlobs.length > 0 ? articleBlobs : undefined,
        announcementPostUri: announcementResponse.uri,
      });

      console.log(`   ✅ Announcement posted: ${announcementResponse.uri}`);
    }

    console.log('');
  }

  console.log('✅ All articles synced\n');
}

/**
 * Sync all microposts (daily notes)
 */
async function syncMicroposts(agent: BskyAgent, config: EnvConfig): Promise<void> {
  const micropostsDir = path.join(config.contentDir, 'microposts');

  if (!fs.existsSync(micropostsDir)) {
    console.log('ℹ️  No microposts directory found, skipping microposts\n');
    return;
  }

  const files = fs.readdirSync(micropostsDir).filter(f => f.endsWith('.md'));

  if (files.length === 0) {
    console.log('ℹ️  No micropost files found\n');
    return;
  }

  console.log(`💬 Syncing ${files.length} daily note(s)...\n`);

  for (const file of files) {
    const filePath = path.join(micropostsDir, file);
    console.log(`📅 Processing: ${file}`);

    const dailyNote = parseDailyNote(filePath, config.contentDir);

    // Fetch existing posts for this date
    const existingPosts = await getExistingPostsForDate(agent, dailyNote.date);

    console.log(`   ℹ️  Found ${existingPosts.length} existing post(s), ${dailyNote.posts.length} in file`);

    // Track first post URI for file metadata
    let firstPostUri: string | undefined;

    // Post only new posts (those not yet published)
    for (let i = 0; i < dailyNote.posts.length; i++) {
      const post = dailyNote.posts[i];

      // Check if this post already exists by position
      if (i < existingPosts.length) {
        console.log(`   ✅ Post ${i + 1} already published`);
        if (i === 0) {
          firstPostUri = existingPosts[0].uri;
        }
        continue;
      }

      console.log(`   📝 Publishing post ${i + 1}...`);

      // Upload media files
      let embed: any = undefined;
      let postText = post.content;

      if (post.mediaFiles.length > 0) {
        console.log(`      📤 Uploading ${post.mediaFiles.length} media file(s)...`);
        const blobMap = await uploadMediaFiles(agent, post.mediaFiles);

        // Check for video first (can't mix with images)
        const videoBlob = extractVideoForEmbed(post.content, blobMap);

        if (videoBlob) {
          embed = {
            $type: 'app.bsky.embed.video',
            video: videoBlob,
          };
        } else {
          // Extract images (max 4)
          const images = extractImagesForEmbed(post.content, blobMap);

          if (images.length > 0) {
            embed = {
              $type: 'app.bsky.embed.images',
              images,
            };
          }
        }

        // Strip image markdown from post text since it will be in the embed
        postText = stripMediaMarkdown(post.content);
      }

      // Create post
      const response = await createPost(agent, postText, embed);

      if (i === 0) {
        firstPostUri = response.uri;
      }

      console.log(`   ✅ Post ${i + 1} published: ${response.uri}`);
    }

    // Update file with first post URI
    if (firstPostUri) {
      updateDailyNoteFile(filePath, firstPostUri);
    }

    console.log('');
  }

  console.log('✅ All microposts synced\n');
}

/**
 * Get existing posts for a specific date
 * Returns posts sorted chronologically
 */
async function getExistingPostsForDate(
  agent: BskyAgent,
  date: string
): Promise<Array<{ uri: string; cid: string; text: string }>> {
  const allPosts = await listPosts(agent);

  // Filter posts created on this date
  const dayStart = new Date(date);
  const dayEnd = new Date(date);
  dayEnd.setDate(dayEnd.getDate() + 1);

  const postsForDate = allPosts
    .filter(post => {
      const createdAt = new Date(post.value.createdAt);
      return createdAt >= dayStart && createdAt < dayEnd;
    })
    .filter(post => {
      // Exclude replies (only top-level posts for daily notes)
      return !post.value.reply;
    })
    .sort((a, b) => {
      // Sort by creation time
      return new Date(a.value.createdAt).getTime() - new Date(b.value.createdAt).getTime();
    });

  return postsForDate.map(post => ({
    uri: post.uri,
    cid: post.cid,
    text: post.value.text,
  }));
}
