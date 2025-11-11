import { BlobRef } from '@atproto/api';

// Lexicon: ai.thefocus.blog.article
export interface ArticleRecord {
  $type: 'ai.thefocus.blog.article';
  title: string;
  slug: string;
  content: string; // Original markdown with relative paths
  createdAt: string; // ISO datetime
  summary?: string;
  tags?: string[];
  blobs?: ArticleBlob[];
  announcementPostUri?: string; // URI of feed post announcing this article
}

export interface ArticleBlob {
  relativePath: string; // "article-name/image.jpg"
  blobRef: BlobRef; // ATProto blob reference
  mimeType: string;
  alt?: string; // Alt text from markdown
}

// Lexicon: ai.thefocus.blog.site
export interface SiteConfigRecord {
  $type: 'ai.thefocus.blog.site';
  siteTitle: string;
  theme: {
    palette: string;
    font: string;
  };
  themeBlobRef?: BlobRef; // Generated CSS blob
  articleAnnouncements?: {
    enabled: boolean;
    template: string; // e.g., "New: [title]\n\n[summary]\n\n[link]"
  };
  siteUrl: string; // e.g., "https://myblog.com"
  updatedAt: string; // ISO datetime
}

// Local config.json file
export interface SiteConfig {
  siteTitle: string;
  theme: {
    palette: string;  // e.g., "light", "dark", "warm"
    font: string;     // e.g., "system", "transitional", "monospace"
  };
  articleAnnouncements?: {
    enabled: boolean;
    template: string;
  };
  siteUrl: string;
}

// Parsed article with metadata
export interface ParsedArticle {
  frontmatter: ArticleFrontmatter;
  content: string;
  slug: string;
  mediaFiles: MediaFile[];
}

export interface ArticleFrontmatter {
  title?: string;
  date?: string;
  summary?: string;
  tags?: string[];
  articleUri?: string; // AT-URI of the article record
  articleUrl?: string; // URL on the generated site
}

// Parsed micropost
export interface ParsedMicropost {
  content: string;
  mediaFiles: MediaFile[];
  postUri?: string; // AT-URI if already published
  timestamp?: string; // ISO datetime from PDS
}

export interface ParsedDailyNote {
  date: string; // YYYY-MM-DD
  posts: ParsedMicropost[];
}

// Media file reference
export interface MediaFile {
  localPath: string; // Relative to content root
  absolutePath: string; // Full filesystem path
  mimeType: string;
  alt?: string; // Alt text from markdown
}

// Author info from Bluesky profile
export interface AuthorInfo {
  handle: string;
  displayName?: string;
  avatar?: string;
  description?: string;
}

// Environment configuration
export interface EnvConfig {
  blueskyHandle: string;
  blueskyPassword: string;
  atpService: string;
  contentDir: string;
  outputDir: string;
}

// HTML generation context
export interface RenderContext {
  siteConfig: SiteConfig;
  author: AuthorInfo;
  currentPath: string; // For navigation highlighting
}

// Rendered content for static generation
export interface RenderedArticle {
  slug: string;
  title: string;
  date: Date;
  summary?: string;
  tags: string[];
  htmlContent: string;
  postUri?: string; // For comments
  announcementPostUri?: string; // For announcement post comments
}

export interface RenderedMicropost {
  date: Date;
  index: number; // Position in daily note
  htmlContent: string;
  postUri?: string; // For comments
  permalink: string; // e.g., "2025-11-11-1"
  prevPermalink?: string; // Link to previous micropost
  nextPermalink?: string; // Link to next micropost
}

// Comment data structure (for client-side rendering)
export interface CommentData {
  uri: string;
  author: {
    handle: string;
    displayName?: string;
    avatar?: string;
  };
  text: string;
  createdAt: string;
  url: string;
  replies?: CommentData[];
}
