#!/usr/bin/env tsx
import { BskyAgent, RichText } from '@atproto/api';
import * as fs from 'fs';
import * as path from 'path';
import 'dotenv/config';

interface PostMetadata {
  title?: string;
  createdAt?: string;
  postUri?: string;
  postUrl?: string;
}

interface ParsedPost {
  metadata: PostMetadata;
  content: string;
}

interface ParsedMarkdown {
  mainPost: ParsedPost;
  replies: Array<{ content: string }>;
}

// Parse frontmatter and content
function parseFrontmatter(content: string): { frontmatter: PostMetadata; body: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) {
    return { frontmatter: {}, body: content };
  }

  const frontmatterText = match[1];
  const body = match[2];

  const frontmatter: PostMetadata = {};
  frontmatterText.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split(':');
    if (key && valueParts.length > 0) {
      const value = valueParts.join(':').trim();
      frontmatter[key.trim() as keyof PostMetadata] = value;
    }
  });

  return { frontmatter, body };
}

// Parse markdown file with main post and replies
function parseMarkdownFile(filePath: string): ParsedMarkdown {
  const content = fs.readFileSync(filePath, 'utf-8');
  const { frontmatter, body } = parseFrontmatter(content);

  // Split by --- to get main post and replies
  const sections = body.split(/\n---\n/).map(s => s.trim()).filter(s => s.length > 0);

  if (sections.length === 0) {
    return {
      mainPost: { metadata: frontmatter, content: '' },
      replies: []
    };
  }

  // First section is the main post
  const mainPost: ParsedPost = {
    metadata: frontmatter,
    content: sections[0]
  };

  // Remaining sections are replies (just content, no metadata)
  const replies = sections.slice(1).map(content => ({ content }));

  return { mainPost, replies };
}

// Update markdown file with main post URI only
function updateMarkdownFile(
  filePath: string,
  mainPostUri: string,
  mainPostUrl: string
) {
  const parsed = parseMarkdownFile(filePath);

  // Update main post metadata
  parsed.mainPost.metadata.postUri = mainPostUri;
  parsed.mainPost.metadata.postUrl = mainPostUrl;
  if (!parsed.mainPost.metadata.createdAt) {
    parsed.mainPost.metadata.createdAt = new Date().toISOString();
  }

  // Reconstruct the file (clean, no reply URIs)
  let output = '---\n';
  Object.entries(parsed.mainPost.metadata).forEach(([key, value]) => {
    if (value) {
      output += `${key}: ${value}\n`;
    }
  });
  output += '---\n\n';
  output += parsed.mainPost.content;

  parsed.replies.forEach(reply => {
    output += '\n\n---\n\n';
    output += reply.content;
  });

  fs.writeFileSync(filePath, output, 'utf-8');
}

// Post main content or thread of replies
async function postMarkdown(filePath: string, agent: BskyAgent) {
  const parsed = parseMarkdownFile(filePath);

  let mainPostCid: string;

  // Check if main post already exists
  if (parsed.mainPost.metadata.postUri) {
    console.log('✅ Main post already published:', parsed.mainPost.metadata.postUrl);
    // Fetch the post to get its CID
    const threadResponse = await agent.getPostThread({ uri: parsed.mainPost.metadata.postUri });
    if (threadResponse.data.thread.$type === 'app.bsky.feed.defs#threadViewPost' && 'post' in threadResponse.data.thread) {
      mainPostCid = (threadResponse.data.thread as any).post.cid;
    } else {
      throw new Error('Could not fetch main post CID');
    }
  } else {
    // Create main post
    console.log('📝 Publishing main post...');
    const rt = new RichText({ text: parsed.mainPost.content });
    await rt.detectFacets(agent);

    const mainPostResponse = await agent.post({
      text: rt.text,
      facets: rt.facets,
      createdAt: parsed.mainPost.metadata.createdAt || new Date().toISOString(),
    });

    mainPostCid = mainPostResponse.cid;
    const handle = agent.session!.handle;
    const rkey = mainPostResponse.uri.split('/').pop()!;
    const postUrl = `https://bsky.app/profile/${handle}/post/${rkey}`;

    console.log('✅ Main post published:', postUrl);

    // Update file with main post URI
    updateMarkdownFile(filePath, mainPostResponse.uri, postUrl);
    parsed.mainPost.metadata.postUri = mainPostResponse.uri;
    parsed.mainPost.metadata.postUrl = postUrl;
  }

  // Fetch existing replies from the thread
  const myDid = agent.session!.did;
  const existingReplies: Array<{ text: string; uri: string; cid: string }> = [];

  if (parsed.mainPost.metadata.postUri) {
    const threadResponse = await agent.getPostThread({ uri: parsed.mainPost.metadata.postUri, depth: 100 });
    if (threadResponse.data.thread.$type === 'app.bsky.feed.defs#threadViewPost' && 'replies' in threadResponse.data.thread) {
      const thread = threadResponse.data.thread as any;

      // Collect all my replies in order
      function collectMyReplies(post: any) {
        if (!post.replies || post.replies.length === 0) return;

        for (const reply of post.replies) {
          if (reply.$type === 'app.bsky.feed.defs#threadViewPost') {
            if (reply.post.author.did === myDid) {
              existingReplies.push({
                text: reply.post.record.text,
                uri: reply.post.uri,
                cid: reply.post.cid
              });
            }
            collectMyReplies(reply);
          }
        }
      }

      collectMyReplies(thread);
    }
  }

  console.log(`📊 Found ${existingReplies.length} existing replies, ${parsed.replies.length} in file`);

  // Post only new replies (those not yet published)
  let parentUri = parsed.mainPost.metadata.postUri!;
  let parentCid = mainPostCid;

  // If there are existing replies, use the last one as the parent
  if (existingReplies.length > 0) {
    const lastReply = existingReplies[existingReplies.length - 1];
    parentUri = lastReply.uri;
    parentCid = lastReply.cid;
  }

  for (let i = 0; i < parsed.replies.length; i++) {
    const reply = parsed.replies[i];

    // Check if this reply already exists by comparing content
    if (i < existingReplies.length) {
      console.log(`✅ Reply ${i + 1} already published`);
      continue;
    }

    console.log(`📝 Publishing reply ${i + 1}...`);

    const rt = new RichText({ text: reply.content });
    await rt.detectFacets(agent);

    const replyResponse = await agent.post({
      text: rt.text,
      facets: rt.facets,
      reply: {
        root: { uri: parsed.mainPost.metadata.postUri!, cid: mainPostCid },
        parent: { uri: parentUri, cid: parentCid },
      },
      createdAt: new Date().toISOString(),
    });

    const handle = agent.session!.handle;
    const rkey = replyResponse.uri.split('/').pop()!;
    const replyUrl = `https://bsky.app/profile/${handle}/post/${rkey}`;

    console.log(`✅ Reply ${i + 1} published:`, replyUrl);

    // Update parent for next reply
    parentUri = replyResponse.uri;
    parentCid = replyResponse.cid;
  }

  console.log('\n✅ Thread published successfully!');
}

// Fetch external replies and save to separate file
async function syncReplies(filePath: string, agent: BskyAgent) {
  const parsed = parseMarkdownFile(filePath);

  if (!parsed.mainPost.metadata.postUri) {
    console.error('❌ Error: Main post has not been published yet');
    process.exit(1);
  }

  console.log('🔄 Fetching replies from Bluesky...');

  // Get the thread
  const threadResponse = await agent.getPostThread({
    uri: parsed.mainPost.metadata.postUri,
    depth: 100,
  });

  if (!threadResponse.success || threadResponse.data.thread.$type !== 'app.bsky.feed.defs#threadViewPost') {
    console.error('❌ Error: Could not fetch thread');
    process.exit(1);
  }

  const thread = threadResponse.data.thread;
  const myDid = agent.session!.did;

  // Collect all external replies (not from the author)
  const externalReplies: Array<{
    author: string;
    handle: string;
    content: string;
    createdAt: string;
    uri: string;
    url: string;
    parentUri: string;
  }> = [];

  function collectReplies(post: any, depth = 0) {
    if (!post.replies || post.replies.length === 0) return;

    for (const reply of post.replies) {
      if (reply.$type !== 'app.bsky.feed.defs#threadViewPost') continue;

      const authorDid = reply.post.author.did;
      const isExternal = authorDid !== myDid;

      if (isExternal) {
        const rkey = reply.post.uri.split('/').pop();
        const url = `https://bsky.app/profile/${reply.post.author.handle}/post/${rkey}`;

        externalReplies.push({
          author: reply.post.author.displayName || reply.post.author.handle,
          handle: reply.post.author.handle,
          content: reply.post.record.text,
          createdAt: reply.post.record.createdAt,
          uri: reply.post.uri,
          url,
          parentUri: reply.post.record.reply?.parent?.uri || parsed.mainPost.metadata.postUri!,
        });
      }

      // Recursively collect nested replies
      collectReplies(reply, depth + 1);
    }
  }

  collectReplies(thread);

  if (externalReplies.length === 0) {
    console.log('ℹ️  No external replies found');
    return;
  }

  console.log(`✅ Found ${externalReplies.length} external reply(ies)`);

  // Build replies file
  const baseName = path.basename(filePath, path.extname(filePath));
  const repliesPath = path.join(path.dirname(filePath), `${baseName}.replies.md`);

  let output = `# External Replies to: ${parsed.mainPost.metadata.title || baseName}\n\n`;
  output += `Original post: ${parsed.mainPost.metadata.postUrl}\n\n`;
  output += `Last synced: ${new Date().toISOString()}\n\n`;
  output += `---\n\n`;

  // Group replies by parent
  const replyMap = new Map<string, typeof externalReplies>();
  externalReplies.forEach(reply => {
    const parentUri = reply.parentUri;
    if (!replyMap.has(parentUri)) {
      replyMap.set(parentUri, []);
    }
    replyMap.get(parentUri)!.push(reply);
  });

  // Write replies in threaded order
  externalReplies.forEach(reply => {
    output += `## @${reply.handle}\n\n`;
    output += `**${reply.author}** · [View on Bluesky](${reply.url}) · ${new Date(reply.createdAt).toLocaleString()}\n\n`;
    output += `${reply.content}\n\n`;
    output += `---\n\n`;
  });

  fs.writeFileSync(repliesPath, output, 'utf-8');
  console.log(`✅ External replies saved to: ${repliesPath}`);
}

// Main
async function main() {
  const command = process.argv[2];
  const filePath = process.argv[3];

  if (!command || !filePath) {
    console.log(`
📝 Markdown Sync - Manage Bluesky posts as markdown files

Usage:
  npm run md-sync post <markdown-file>    Publish main post and replies
  npm run md-sync sync <markdown-file>    Fetch external replies

Examples:
  npm run md-sync post my-blog-post.md
  npm run md-sync sync my-blog-post.md
`);
    process.exit(1);
  }

  if (!fs.existsSync(filePath)) {
    console.error(`❌ Error: File not found: ${filePath}`);
    process.exit(1);
  }

  // Authenticate
  const agent = new BskyAgent({ service: 'https://bsky.social' });

  const identifier = process.env.BLUESKY_HANDLE;
  const password = process.env.BLUESKY_PASSWORD || process.env.BLUESKY_APP_PASSWORD;

  if (!identifier || !password) {
    console.error('❌ Error: BLUESKY_HANDLE and BLUESKY_PASSWORD must be set in .env');
    process.exit(1);
  }

  await agent.login({ identifier, password });
  console.log(`✅ Logged in as @${agent.session!.handle}\n`);

  if (command === 'post') {
    await postMarkdown(filePath, agent);
  } else if (command === 'sync') {
    await syncReplies(filePath, agent);
  } else {
    console.error(`❌ Error: Unknown command: ${command}`);
    process.exit(1);
  }
}

main().catch(console.error);
