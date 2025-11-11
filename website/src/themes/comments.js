/**
 * Bluesky Comments Loader
 * Fetches and displays comments from Bluesky for a post
 */

(function() {
  'use strict';

  const BLUESKY_API = 'https://public.api.bsky.app/xrpc';

  /**
   * Initialize comments on page load
   */
  function init() {
    const commentsContainer = document.getElementById('comments');
    if (!commentsContainer) return;

    const postUri = commentsContainer.dataset.postUri;
    if (!postUri) {
      console.warn('No post URI found in comments container');
      return;
    }

    loadComments(postUri, commentsContainer);
  }

  /**
   * Load comments for a post
   */
  async function loadComments(postUri, container) {
    try {
      const response = await fetch(
        `${BLUESKY_API}/app.bsky.feed.getPostThread?uri=${encodeURIComponent(postUri)}&depth=10`
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.thread || data.thread.$type !== 'app.bsky.feed.defs#threadViewPost') {
        throw new Error('Invalid thread response');
      }

      const comments = extractComments(data.thread);

      if (comments.length === 0) {
        container.innerHTML = `
          <h3>Comments</h3>
          <p class="comments-empty">No comments yet. <a href="${getPostUrl(postUri)}" target="_blank" rel="noopener">Be the first to comment on Bluesky!</a></p>
        `;
        return;
      }

      renderComments(comments, container, postUri);
    } catch (error) {
      console.error('Failed to load comments:', error);
      container.innerHTML = `
        <h3>Comments</h3>
        <p class="comments-error">Failed to load comments. <a href="${getPostUrl(postUri)}" target="_blank" rel="noopener">View on Bluesky</a></p>
      `;
    }
  }

  /**
   * Extract comments from thread response
   */
  function extractComments(thread) {
    const comments = [];

    if (!thread.replies || thread.replies.length === 0) {
      return comments;
    }

    function collectReplies(post, depth = 0) {
      if (!post.replies) return;

      for (const reply of post.replies) {
        if (reply.$type !== 'app.bsky.feed.defs#threadViewPost') {
          continue;
        }

        const comment = {
          uri: reply.post.uri,
          cid: reply.post.cid,
          author: {
            did: reply.post.author.did,
            handle: reply.post.author.handle,
            displayName: reply.post.author.displayName,
            avatar: reply.post.author.avatar,
          },
          text: reply.post.record.text,
          createdAt: reply.post.record.createdAt,
          depth,
          replies: [],
        };

        comments.push(comment);

        // Recursively collect nested replies
        if (reply.replies && reply.replies.length > 0) {
          const nestedReplies = [];
          collectRepliesNested(reply, depth + 1, nestedReplies);
          comment.replies = nestedReplies;
        }
      }
    }

    function collectRepliesNested(post, depth, collection) {
      if (!post.replies) return;

      for (const reply of post.replies) {
        if (reply.$type !== 'app.bsky.feed.defs#threadViewPost') {
          continue;
        }

        const comment = {
          uri: reply.post.uri,
          cid: reply.post.cid,
          author: {
            did: reply.post.author.did,
            handle: reply.post.author.handle,
            displayName: reply.post.author.displayName,
            avatar: reply.post.author.avatar,
          },
          text: reply.post.record.text,
          createdAt: reply.post.record.createdAt,
          depth,
          replies: [],
        };

        collection.push(comment);

        // Recursively collect nested replies
        if (reply.replies && reply.replies.length > 0) {
          collectRepliesNested(reply, depth + 1, comment.replies);
        }
      }
    }

    collectReplies(thread);

    return comments;
  }

  /**
   * Render comments HTML
   */
  function renderComments(comments, container, postUri) {
    let html = '<h3>Comments</h3>';
    html += `<p class="comments-info">${comments.length} comment${comments.length !== 1 ? 's' : ''} from Bluesky. <a href="${getPostUrl(postUri)}" target="_blank" rel="noopener">Join the conversation</a></p>`;
    html += '<div class="comments-list">';

    for (const comment of comments) {
      html += renderComment(comment);
    }

    html += '</div>';

    container.innerHTML = html;
  }

  /**
   * Render a single comment
   */
  function renderComment(comment) {
    const displayName = escapeHtml(comment.author.displayName || comment.author.handle);
    const handle = escapeHtml(comment.author.handle);
    const text = escapeHtml(comment.text);
    const date = new Date(comment.createdAt);
    const dateStr = formatDate(date);
    const url = getPostUrl(comment.uri);
    const avatar = comment.author.avatar || '';

    let html = `<div class="comment" style="margin-left: ${comment.depth * 1.5}rem;">`;

    // Author info
    html += '<div class="comment-author">';
    if (avatar) {
      html += `<img src="${escapeHtml(avatar)}" alt="${displayName}" class="comment-avatar" width="40" height="40">`;
    }
    html += `<span class="comment-author-name">${displayName}</span> `;
    html += `<span class="comment-handle">@${handle}</span>`;
    html += '</div>';

    // Comment text
    html += `<div class="comment-text">${linkifyText(text)}</div>`;

    // Meta
    html += `<div class="comment-meta">`;
    html += `<time datetime="${comment.createdAt}">${dateStr}</time> · `;
    html += `<a href="${url}" target="_blank" rel="noopener">View on Bluesky</a>`;
    html += '</div>';

    // Nested replies
    if (comment.replies && comment.replies.length > 0) {
      for (const reply of comment.replies) {
        html += renderComment(reply);
      }
    }

    html += '</div>';

    return html;
  }

  /**
   * Get Bluesky post URL from AT-URI
   */
  function getPostUrl(uri) {
    // Parse AT-URI: at://did:plc:xxx/app.bsky.feed.post/rkey
    const parts = uri.replace('at://', '').split('/');
    const did = parts[0];
    const rkey = parts[2];

    // We need to resolve DID to handle, but for now use a direct link
    // This will redirect properly on Bluesky
    return `https://bsky.app/profile/${did}/post/${rkey}`;
  }

  /**
   * Format date for display
   */
  function formatDate(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  /**
   * Escape HTML special characters
   */
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Linkify URLs in text
   */
  function linkifyText(text) {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.replace(urlRegex, (url) => {
      return `<a href="${escapeHtml(url)}" target="_blank" rel="noopener">${escapeHtml(url)}</a>`;
    });
  }

  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
