/**
 * ATProto Lexicon Definitions
 *
 * These define the custom record types stored in the PDS.
 */

export const LEXICON_ARTICLE = 'ai.thefocus.blog.article';
export const LEXICON_SITE = 'ai.thefocus.blog.site';

// Record key for site config (single record per user)
export const SITE_CONFIG_RKEY = 'self';

/**
 * Lexicon: ai.thefocus.blog.article
 *
 * Schema for blog articles stored in PDS
 */
export const articleLexicon = {
  lexicon: 1,
  id: 'ai.thefocus.blog.article',
  defs: {
    main: {
      type: 'record',
      description: 'A blog article with long-form content',
      key: 'tid', // Use TID (timestamp identifier) for chronological ordering
      record: {
        type: 'object',
        required: ['title', 'slug', 'content', 'createdAt'],
        properties: {
          title: {
            type: 'string',
            description: 'Article title',
            maxLength: 300,
          },
          slug: {
            type: 'string',
            description: 'URL-friendly slug for permalinks',
            maxLength: 200,
          },
          content: {
            type: 'string',
            description: 'Article content in markdown format',
            maxLength: 100000, // ~100KB
          },
          createdAt: {
            type: 'string',
            format: 'datetime',
            description: 'Article creation timestamp',
          },
          summary: {
            type: 'string',
            description: 'Brief summary or excerpt',
            maxLength: 500,
          },
          tags: {
            type: 'array',
            description: 'Article tags',
            items: {
              type: 'string',
              maxLength: 50,
            },
            maxLength: 10,
          },
          blobs: {
            type: 'array',
            description: 'Media files (images, videos)',
            items: {
              type: 'object',
              required: ['relativePath', 'blobRef', 'mimeType'],
              properties: {
                relativePath: {
                  type: 'string',
                  description: 'Local file path relative to article',
                },
                blobRef: {
                  type: 'blob',
                  description: 'Reference to uploaded blob',
                  accept: ['image/*', 'video/*'],
                  maxSize: 50000000, // 50MB
                },
                mimeType: {
                  type: 'string',
                  description: 'MIME type of the blob',
                },
                alt: {
                  type: 'string',
                  description: 'Alt text for accessibility',
                  maxLength: 300,
                },
              },
            },
          },
          announcementPostUri: {
            type: 'string',
            format: 'at-uri',
            description: 'URI of the feed post announcing this article',
          },
        },
      },
    },
  },
};

/**
 * Lexicon: ai.thefocus.blog.site
 *
 * Schema for site-wide configuration stored in PDS
 */
export const siteLexicon = {
  lexicon: 1,
  id: 'ai.thefocus.blog.site',
  defs: {
    main: {
      type: 'record',
      description: 'Website configuration and theme settings',
      key: 'literal:self', // Single record with key "self"
      record: {
        type: 'object',
        required: ['siteTitle', 'theme', 'siteUrl', 'updatedAt'],
        properties: {
          siteTitle: {
            type: 'string',
            description: 'Website title',
            maxLength: 100,
          },
          theme: {
            type: 'string',
            description: 'CSS theme filename',
            maxLength: 50,
          },
          themeBlobRef: {
            type: 'blob',
            description: 'Uploaded CSS theme file',
            accept: ['text/css'],
            maxSize: 1000000, // 1MB
          },
          articleAnnouncements: {
            type: 'object',
            description: 'Article announcement settings',
            properties: {
              enabled: {
                type: 'boolean',
                description: 'Whether to post announcements',
              },
              template: {
                type: 'string',
                description: 'Announcement template with placeholders',
                maxLength: 500,
              },
            },
          },
          siteUrl: {
            type: 'string',
            format: 'uri',
            description: 'Base URL of the generated website',
          },
          updatedAt: {
            type: 'string',
            format: 'datetime',
            description: 'Last update timestamp',
          },
        },
      },
    },
  },
};
