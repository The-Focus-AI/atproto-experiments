import { BskyAgent, RichText } from '@atproto/api';
import { ArticleRecord, SiteConfigRecord, AuthorInfo } from './types.js';
import { LEXICON_ARTICLE, LEXICON_SITE, SITE_CONFIG_RKEY } from './lexicons.js';

/**
 * Create or update an article record in PDS
 */
export async function putArticleRecord(
  agent: BskyAgent,
  rkey: string | undefined,
  record: Omit<ArticleRecord, '$type'>
): Promise<{ uri: string; cid: string }> {
  const repo = agent.session!.did;

  const fullRecord: ArticleRecord = {
    $type: LEXICON_ARTICLE,
    ...record,
  };

  if (rkey) {
    // Update existing record
    const response = await agent.api.com.atproto.repo.putRecord({
      repo,
      collection: LEXICON_ARTICLE,
      rkey,
      record: fullRecord,
    });

    return {
      uri: response.data.uri,
      cid: response.data.cid,
    };
  } else {
    // Create new record with TID
    const response = await agent.api.com.atproto.repo.createRecord({
      repo,
      collection: LEXICON_ARTICLE,
      record: fullRecord,
    });

    return {
      uri: response.data.uri,
      cid: response.data.cid,
    };
  }
}

/**
 * Get an article record from PDS
 */
export async function getArticleRecord(
  agent: BskyAgent,
  rkey: string
): Promise<{ record: ArticleRecord; cid: string } | null> {
  const repo = agent.session!.did;

  try {
    const response = await agent.api.com.atproto.repo.getRecord({
      repo,
      collection: LEXICON_ARTICLE,
      rkey,
    });

    return {
      record: response.data.value as ArticleRecord,
      cid: response.data.cid || '',
    };
  } catch (error: any) {
    // Handle both 404 status and "Could not locate record" message
    if (error?.status === 404 || error?.message?.includes('Could not locate record')) {
      return null;
    }
    throw error;
  }
}

/**
 * List all article records from PDS
 */
export async function listArticleRecords(
  agent: BskyAgent
): Promise<Array<{ uri: string; cid: string; value: ArticleRecord; rkey: string }>> {
  const repo = agent.session!.did;

  const response = await agent.api.com.atproto.repo.listRecords({
    repo,
    collection: LEXICON_ARTICLE,
    limit: 100,
  });

  return response.data.records.map(record => ({
    uri: record.uri,
    cid: record.cid,
    value: record.value as ArticleRecord,
    rkey: record.uri.split('/').pop()!,
  }));
}

/**
 * Create or update site config record in PDS
 */
export async function putSiteConfigRecord(
  agent: BskyAgent,
  record: Omit<SiteConfigRecord, '$type'>
): Promise<{ uri: string; cid: string }> {
  const repo = agent.session!.did;

  const fullRecord: SiteConfigRecord = {
    $type: LEXICON_SITE,
    ...record,
  };

  const response = await agent.api.com.atproto.repo.putRecord({
    repo,
    collection: LEXICON_SITE,
    rkey: SITE_CONFIG_RKEY,
    record: fullRecord,
  });

  return {
    uri: response.data.uri,
    cid: response.data.cid,
  };
}

/**
 * Get site config record from PDS
 */
export async function getSiteConfigRecord(
  agent: BskyAgent
): Promise<{ record: SiteConfigRecord; cid: string } | null> {
  const repo = agent.session!.did;

  try {
    const response = await agent.api.com.atproto.repo.getRecord({
      repo,
      collection: LEXICON_SITE,
      rkey: SITE_CONFIG_RKEY,
    });

    return {
      record: response.data.value as SiteConfigRecord,
      cid: response.data.cid || '',
    };
  } catch (error: any) {
    // Handle both 404 status and "Could not locate record" message
    if (error?.status === 404 || error?.message?.includes('Could not locate record')) {
      return null;
    }
    throw error;
  }
}

/**
 * Create a Bluesky post
 */
export async function createPost(
  agent: BskyAgent,
  text: string,
  embed?: any,
  reply?: any,
  createdAt?: string
): Promise<{ uri: string; cid: string }> {
  const rt = new RichText({ text });
  await rt.detectFacets(agent);

  const response = await agent.post({
    text: rt.text,
    facets: rt.facets,
    embed,
    reply,
    createdAt: createdAt || new Date().toISOString(),
  });

  return {
    uri: response.uri,
    cid: response.cid,
  };
}

/**
 * Get a post record from PDS
 */
export async function getPostRecord(
  agent: BskyAgent,
  rkey: string
): Promise<{ uri: string; cid: string; record: any } | null> {
  const repo = agent.session!.did;

  try {
    const response = await agent.api.com.atproto.repo.getRecord({
      repo,
      collection: 'app.bsky.feed.post',
      rkey,
    });

    return {
      uri: response.data.uri,
      cid: response.data.cid || '',
      record: response.data.value,
    };
  } catch (error: any) {
    // Handle both 404 status and "Could not locate record" message
    if (error?.status === 404 || error?.message?.includes('Could not locate record')) {
      return null;
    }
    throw error;
  }
}

/**
 * List all posts from PDS
 */
export async function listPosts(
  agent: BskyAgent
): Promise<Array<{ uri: string; cid: string; value: any; rkey: string }>> {
  const repo = agent.session!.did;

  const response = await agent.api.com.atproto.repo.listRecords({
    repo,
    collection: 'app.bsky.feed.post',
    limit: 100,
  });

  return response.data.records.map(record => ({
    uri: record.uri,
    cid: record.cid,
    value: record.value,
    rkey: record.uri.split('/').pop()!,
  }));
}

/**
 * Get author info from Bluesky profile
 */
export async function getAuthorInfo(agent: BskyAgent): Promise<AuthorInfo> {
  const profile = await agent.getProfile({ actor: agent.session!.did });

  return {
    handle: profile.data.handle,
    displayName: profile.data.displayName,
    avatar: profile.data.avatar,
    description: profile.data.description,
  };
}

/**
 * Extract rkey from AT-URI
 */
export function extractRkey(uri: string): string {
  return uri.split('/').pop()!;
}

/**
 * Create article announcement post
 */
export async function createArticleAnnouncement(
  agent: BskyAgent,
  template: string,
  article: {
    title: string;
    summary?: string;
    tags?: string[];
    url: string;
  }
): Promise<{ uri: string; cid: string }> {
  // Replace template placeholders
  let text = template
    .replace(/\[title\]/g, article.title)
    .replace(/\[summary\]/g, article.summary || '')
    .replace(/\[link\]/g, article.url);

  // Handle tags
  if (article.tags && article.tags.length > 0) {
    const tagsText = article.tags.map(tag => `#${tag}`).join(' ');
    text = text.replace(/\[tags\]/g, tagsText);
  } else {
    text = text.replace(/\[tags\]/g, '');
  }

  // Clean up extra whitespace
  text = text.replace(/\n{3,}/g, '\n\n').trim();

  return createPost(agent, text);
}
