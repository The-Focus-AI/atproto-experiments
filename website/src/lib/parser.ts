import matter from 'gray-matter';
import * as path from 'path';
import * as fs from 'fs';
import {
  ParsedArticle,
  ParsedDailyNote,
  ParsedMicropost,
  MediaFile,
  ArticleFrontmatter,
} from './types.js';

/**
 * Parse an article markdown file
 */
export function parseArticle(filePath: string, contentDir: string): ParsedArticle {
  const content = fs.readFileSync(filePath, 'utf-8');
  const { data, content: markdownContent } = matter(content);

  // Extract slug from filename
  const filename = path.basename(filePath, '.md');
  const slug = extractSlug(filename);

  // Extract date if present in filename
  const dateFromFilename = extractDateFromFilename(filename);

  const frontmatter: ArticleFrontmatter = {
    title: data.title,
    date: data.date || dateFromFilename?.toISOString(),
    summary: data.summary,
    tags: data.tags,
    articleUri: data.articleUri,
    articleUrl: data.articleUrl,
  };

  // If no date found, use file mtime
  if (!frontmatter.date) {
    const stats = fs.statSync(filePath);
    frontmatter.date = stats.mtime.toISOString();
  }

  // Extract media files from markdown
  const articleDir = path.dirname(filePath);
  const mediaFiles = extractMediaFiles(markdownContent, slug, articleDir, contentDir);

  return {
    frontmatter,
    content: markdownContent,
    slug,
    mediaFiles,
  };
}

/**
 * Parse a daily note file with multiple microposts
 */
export function parseDailyNote(filePath: string, contentDir: string): ParsedDailyNote {
  const content = fs.readFileSync(filePath, 'utf-8');
  const { data, content: body } = matter(content);

  // Extract date from filename (YYYY-MM-DD.md)
  const filename = path.basename(filePath, '.md');
  const date = filename; // Should already be YYYY-MM-DD format

  // Get timestamps from frontmatter (if synced from PDS)
  const timestamps: string[] = data.timestamps || [];

  // Split by --- to get individual posts
  const sections = body
    .split(/\n---\n/)
    .map(s => s.trim())
    .filter(s => s.length > 0);

  const dailyNoteDir = path.dirname(filePath);
  const posts: ParsedMicropost[] = sections.map((postContent, index) => {
    const mediaFiles = extractMediaFiles(postContent, date, dailyNoteDir, contentDir);
    return {
      content: postContent,
      mediaFiles,
      timestamp: timestamps[index], // Include timestamp if available
    };
  });

  return {
    date,
    posts,
  };
}

/**
 * Update article file with metadata after publishing
 */
export function updateArticleFile(
  filePath: string,
  updates: { articleUri?: string; articleUrl?: string }
): void {
  const content = fs.readFileSync(filePath, 'utf-8');
  const { data, content: markdownContent } = matter(content);

  // Merge updates into frontmatter
  const updatedData = {
    ...data,
    ...updates,
  };

  // Reconstruct file
  const output = matter.stringify(markdownContent, updatedData);
  fs.writeFileSync(filePath, output, 'utf-8');
}

/**
 * Update daily note file with post URIs
 * Note: We don't store individual post URIs in the file (position-based tracking)
 * This is kept for consistency with markdown-sync approach
 */
export function updateDailyNoteFile(
  filePath: string,
  firstPostUri?: string
): void {
  const content = fs.readFileSync(filePath, 'utf-8');
  const { data, content: body } = matter(content);

  // Store only the first post URI in frontmatter (for reference)
  if (firstPostUri && !data.firstPostUri) {
    data.firstPostUri = firstPostUri;
  }

  const output = matter.stringify(body, data);
  fs.writeFileSync(filePath, output, 'utf-8');
}

/**
 * Extract slug from filename (remove date prefix if present)
 */
function extractSlug(filename: string): string {
  // Check for date prefix: YYYY-MM-DD-slug
  const datePattern = /^\d{4}-\d{2}-\d{2}-(.+)$/;
  const match = filename.match(datePattern);

  if (match) {
    return match[1];
  }

  return filename;
}

/**
 * Extract date from filename if present
 */
function extractDateFromFilename(filename: string): Date | null {
  const datePattern = /^(\d{4}-\d{2}-\d{2})/;
  const match = filename.match(datePattern);

  if (match) {
    return new Date(match[1]);
  }

  return null;
}

/**
 * Extract media file references from markdown
 * Finds: ![alt text](path/to/file.jpg)
 */
function extractMediaFiles(
  markdown: string,
  slug: string,
  baseDir: string,
  contentDir: string
): MediaFile[] {
  const mediaFiles: MediaFile[] = [];

  // Regex to match markdown images/videos: ![alt](path)
  const mediaRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
  let match;

  while ((match = mediaRegex.exec(markdown)) !== null) {
    const alt = match[1] || undefined;
    const localPath = match[2];

    // Skip URLs (http://, https://)
    if (localPath.startsWith('http://') || localPath.startsWith('https://')) {
      continue;
    }

    // Resolve absolute path
    const absolutePath = path.resolve(baseDir, localPath);

    // Check if file exists
    if (!fs.existsSync(absolutePath)) {
      console.warn(`⚠️  Media file not found: ${absolutePath}`);
      continue;
    }

    // Detect MIME type
    const mimeType = getMimeType(absolutePath);

    mediaFiles.push({
      localPath,
      absolutePath,
      mimeType,
      alt,
    });
  }

  // Also match Obsidian syntax: ![[path]]
  const obsidianRegex = /!\[\[([^\]]+)\]\]/g;
  while ((match = obsidianRegex.exec(markdown)) !== null) {
    const localPath = match[1];

    // Skip URLs
    if (localPath.startsWith('http://') || localPath.startsWith('https://')) {
      continue;
    }

    // Resolve absolute path
    const absolutePath = path.resolve(baseDir, localPath);

    // Check if file exists
    if (!fs.existsSync(absolutePath)) {
      console.warn(`⚠️  Media file not found: ${absolutePath}`);
      continue;
    }

    // Detect MIME type
    const mimeType = getMimeType(absolutePath);

    // Extract filename for alt text
    const alt = path.basename(localPath, path.extname(localPath));

    mediaFiles.push({
      localPath,
      absolutePath,
      mimeType,
      alt,
    });
  }

  return mediaFiles;
}

/**
 * Get MIME type from file extension
 */
function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();

  const mimeTypes: { [key: string]: string } = {
    // Images
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',

    // Videos
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.mov': 'video/quicktime',
    '.avi': 'video/x-msvideo',
  };

  return mimeTypes[ext] || 'application/octet-stream';
}

/**
 * Replace media references in markdown with blob URLs
 */
export function replaceMediaWithBlobUrls(
  markdown: string,
  blobMap: Map<string, string>
): string {
  // Replace standard markdown syntax
  let result = markdown.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, localPath) => {
    const blobUrl = blobMap.get(localPath);
    if (blobUrl) {
      return `![${alt}](${blobUrl})`;
    }
    return match;
  });

  // Replace Obsidian syntax ![[path]] with ![alt](blobUrl)
  result = result.replace(/!\[\[([^\]]+)\]\]/g, (match, localPath) => {
    const blobUrl = blobMap.get(localPath);
    if (blobUrl) {
      const alt = path.basename(localPath, path.extname(localPath));
      return `![${alt}](${blobUrl})`;
    }
    return match;
  });

  return result;
}

/**
 * Extract images from markdown and create Bluesky embed structure
 */
export function extractImagesForEmbed(markdown: string, blobRefs: Map<string, any>): any[] {
  const images: any[] = [];

  // Process standard markdown syntax: ![alt](path)
  const mediaRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
  let match;

  while ((match = mediaRegex.exec(markdown)) !== null) {
    const alt = match[1] || '';
    const localPath = match[2];

    // Skip URLs
    if (localPath.startsWith('http://') || localPath.startsWith('https://')) {
      continue;
    }

    const blobRef = blobRefs.get(localPath);
    if (blobRef) {
      // Check if it's a video
      const ext = path.extname(localPath).toLowerCase();
      if (['.mp4', '.webm', '.mov'].includes(ext)) {
        // Videos are handled separately
        continue;
      }

      images.push({
        alt,
        image: blobRef,
        aspectRatio: undefined, // Could be calculated from image dimensions
      });

      // Bluesky limit: max 4 images
      if (images.length >= 4) break;
    }
  }

  // Process Obsidian syntax: ![[path]]
  const obsidianRegex = /!\[\[([^\]]+)\]\]/g;
  while ((match = obsidianRegex.exec(markdown)) !== null && images.length < 4) {
    const localPath = match[1];

    // Skip URLs
    if (localPath.startsWith('http://') || localPath.startsWith('https://')) {
      continue;
    }

    const blobRef = blobRefs.get(localPath);
    if (blobRef) {
      // Check if it's a video
      const ext = path.extname(localPath).toLowerCase();
      if (['.mp4', '.webm', '.mov'].includes(ext)) {
        // Videos are handled separately
        continue;
      }

      const alt = path.basename(localPath, path.extname(localPath));
      images.push({
        alt,
        image: blobRef,
        aspectRatio: undefined,
      });

      // Bluesky limit: max 4 images
      if (images.length >= 4) break;
    }
  }

  return images;
}

/**
 * Remove image/video markdown syntax from text (for posting to Bluesky where embeds are separate)
 */
export function stripMediaMarkdown(markdown: string): string {
  // Remove standard markdown syntax: ![alt](path)
  let result = markdown.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '');

  // Remove Obsidian syntax: ![[path]]
  result = result.replace(/!\[\[([^\]]+)\]\]/g, '');

  // Clean up extra whitespace
  result = result.replace(/\n{3,}/g, '\n\n').trim();

  return result;
}

/**
 * Extract video from markdown for Bluesky embed
 */
export function extractVideoForEmbed(markdown: string, blobRefs: Map<string, any>): any | null {
  // Check standard markdown syntax: ![alt](path)
  const mediaRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
  let match;

  while ((match = mediaRegex.exec(markdown)) !== null) {
    const localPath = match[2];

    // Skip URLs
    if (localPath.startsWith('http://') || localPath.startsWith('https://')) {
      continue;
    }

    const ext = path.extname(localPath).toLowerCase();
    if (['.mp4', '.webm', '.mov'].includes(ext)) {
      const blobRef = blobRefs.get(localPath);
      if (blobRef) {
        return blobRef;
      }
    }
  }

  // Check Obsidian syntax: ![[path]]
  const obsidianRegex = /!\[\[([^\]]+)\]\]/g;
  while ((match = obsidianRegex.exec(markdown)) !== null) {
    const localPath = match[1];

    // Skip URLs
    if (localPath.startsWith('http://') || localPath.startsWith('https://')) {
      continue;
    }

    const ext = path.extname(localPath).toLowerCase();
    if (['.mp4', '.webm', '.mov'].includes(ext)) {
      const blobRef = blobRefs.get(localPath);
      if (blobRef) {
        return blobRef;
      }
    }
  }

  return null;
}
