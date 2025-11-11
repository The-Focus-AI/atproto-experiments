import { marked } from 'marked';
import { RenderContext, RenderedArticle, RenderedMicropost, AuthorInfo } from './types.js';

/**
 * Generate HTML page with layout
 */
export function generatePage(
  title: string,
  content: string,
  ctx: RenderContext
): string {
  const fullTitle = title ? `${title} - ${ctx.siteConfig.siteTitle}` : ctx.siteConfig.siteTitle;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(fullTitle)}</title>
  <link rel="stylesheet" href="/style.css">
</head>
<body>
  ${generateHeader(ctx)}

  <main class="site-main">
    ${content}
  </main>

  ${generateFooter(ctx)}
</body>
</html>`;
}

/**
 * Generate site header with navigation
 */
function generateHeader(ctx: RenderContext): string {
  return `<header class="site-header">
    <h1 class="site-title"><a href="/">${escapeHtml(ctx.siteConfig.siteTitle)}</a></h1>
    <nav class="site-nav">
      <a href="/articles/">Articles</a>
      <a href="/microposts/">Microposts</a>
    </nav>
  </header>`;
}

/**
 * Generate site footer with author info
 */
function generateFooter(ctx: RenderContext): string {
  const author = ctx.author;

  let authorHtml = '';
  if (author.avatar) {
    authorHtml += `<img src="${escapeHtml(author.avatar)}" alt="${escapeHtml(author.displayName || author.handle)}" class="author-avatar">`;
  }

  authorHtml += `<div class="author-details">`;
  authorHtml += `<p class="author-name">${escapeHtml(author.displayName || author.handle)}</p>`;
  authorHtml += `<p class="author-handle">@${escapeHtml(author.handle)}</p>`;

  if (author.description) {
    authorHtml += `<p class="author-bio">${escapeHtml(author.description)}</p>`;
  }
  authorHtml += `</div>`;

  return `<footer class="site-footer">
    <div class="author-info">
      ${authorHtml}
    </div>
  </footer>`;
}

/**
 * Generate article page
 */
export function generateArticlePage(article: RenderedArticle, ctx: RenderContext): string {
  const dateStr = formatDate(article.date);

  let tagsHtml = '';
  if (article.tags.length > 0) {
    tagsHtml = `<div class="article-tags">
      ${article.tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}
    </div>`;
  }

  const articleContent = `<article class="article">
    <header class="article-header">
      <h1 class="article-title">${escapeHtml(article.title)}</h1>
      <time class="article-date" datetime="${article.date.toISOString()}">${dateStr}</time>
      ${tagsHtml}
    </header>

    <div class="article-content">
      ${article.htmlContent}
    </div>

    <footer class="article-footer">
      ${generateCommentsSection(article.postUri || article.announcementPostUri)}
    </footer>
  </article>`;

  return generatePage(article.title, articleContent, ctx);
}

/**
 * Generate micropost page
 */
export function generateMicropostPage(micropost: RenderedMicropost, ctx: RenderContext): string {
  const dateStr = formatDateTime(micropost.date);

  // Generate navigation links
  let navHtml = '';
  if (micropost.prevPermalink || micropost.nextPermalink) {
    navHtml = '<nav class="micropost-nav">';
    if (micropost.prevPermalink) {
      navHtml += `<a href="/microposts/${micropost.prevPermalink}.html" class="nav-prev" data-nav="prev">← Older</a>`;
    } else {
      navHtml += '<span class="nav-prev nav-disabled">← Older</span>';
    }
    if (micropost.nextPermalink) {
      navHtml += `<a href="/microposts/${micropost.nextPermalink}.html" class="nav-next" data-nav="next">Newer →</a>`;
    } else {
      navHtml += '<span class="nav-next nav-disabled">Newer →</span>';
    }
    navHtml += '</nav>';
  }

  const micropostContent = `<article class="micropost">
    ${navHtml}
    <div class="micropost-content">
      ${micropost.htmlContent}
    </div>
    <footer class="micropost-footer">
      <time class="micropost-date" datetime="${micropost.date.toISOString()}">${dateStr}</time>
    </footer>
    ${generateCommentsSection(micropost.postUri)}
    ${navHtml}
  </article>
  <script>
    // Keyboard navigation
    document.addEventListener('keydown', function(e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if (e.key === 'ArrowLeft') {
        const prevLink = document.querySelector('[data-nav="prev"]');
        if (prevLink) prevLink.click();
      } else if (e.key === 'ArrowRight') {
        const nextLink = document.querySelector('[data-nav="next"]');
        if (nextLink) nextLink.click();
      }
    });
  </script>`;

  return generatePage('', micropostContent, ctx);
}

/**
 * Generate comments section placeholder
 */
function generateCommentsSection(postUri?: string): string {
  if (!postUri) {
    return '';
  }

  return `<div id="comments" class="comments" data-post-uri="${escapeHtml(postUri)}">
    <h3>Comments</h3>
    <p class="comments-loading">Loading comments...</p>
  </div>
  <script src="/comments.js"></script>`;
}

/**
 * Generate homepage with recent posts
 */
export function generateHomePage(
  recentArticles: RenderedArticle[],
  recentMicroposts: RenderedMicropost[],
  ctx: RenderContext
): string {
  // Take first 10 articles for main content
  const displayArticles = recentArticles.slice(0, 10);

  // Generate article previews with first paragraph
  const articlesHtml = displayArticles.map(article => {
    const dateStr = formatDate(article.date);
    // Extract first paragraph or first 500 chars
    const preview = article.summary || extractPreview(article.htmlContent, 500);

    return `<article class="article-preview">
      <h2 class="article-title"><a href="/articles/${article.slug}.html">${escapeHtml(article.title)}</a></h2>
      <time class="article-date" datetime="${article.date.toISOString()}">${dateStr}</time>
      <div class="article-excerpt">${preview}</div>
      <a href="/articles/${article.slug}.html" class="read-more">Read more →</a>
    </article>`;
  }).join('\n');

  // Sidebar with recent microposts
  const micropostsHtml = recentMicroposts.slice(0, 10).map(micropost => {
    const dateStr = formatDateTime(micropost.date);
    return `<li class="sidebar-micropost">
      <a href="/microposts/${micropost.permalink}.html">
        <div class="micropost-excerpt">${extractPreview(micropost.htmlContent, 150)}</div>
        <time class="micropost-date" datetime="${micropost.date.toISOString()}">${dateStr}</time>
      </a>
    </li>`;
  }).join('\n');

  const content = `<div class="homepage-layout">
    <main class="main-content">
      <div class="articles-feed">
        ${articlesHtml}
      </div>
      ${recentArticles.length > 10 ? '<a href="/articles/" class="view-all">View all articles →</a>' : ''}
    </main>
    <aside class="sidebar">
      <h3>Recent Updates</h3>
      <ul class="microposts-sidebar">
        ${micropostsHtml}
      </ul>
      <a href="/microposts/" class="view-all-microposts">View all →</a>
    </aside>
  </div>`;

  return generatePage('', content, ctx);
}

/**
 * Extract preview text from HTML
 */
function extractPreview(html: string, maxLength: number): string {
  // Strip HTML tags
  const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

  if (text.length <= maxLength) {
    return text;
  }

  // Cut at word boundary
  const truncated = text.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');

  return lastSpace > 0 ? truncated.substring(0, lastSpace) + '...' : truncated + '...';
}

/**
 * Generate articles index page
 */
export function generateArticlesIndexPage(
  articles: RenderedArticle[],
  ctx: RenderContext
): string {
  const articlesList = articles.map(article => {
    const dateStr = formatDate(article.date);

    return `<article class="post-list-item">
      <h3 class="post-title"><a href="/articles/${article.slug}.html">${escapeHtml(article.title)}</a></h3>
      <time class="post-date" datetime="${article.date.toISOString()}">${dateStr}</time>
      ${article.summary ? `<p class="post-summary">${escapeHtml(article.summary)}</p>` : ''}
    </article>`;
  }).join('\n');

  const content = `<div class="articles-index">
    <h2>Articles</h2>
    <div class="post-list">
      ${articlesList}
    </div>
  </div>`;

  return generatePage('Articles', content, ctx);
}

/**
 * Generate microposts index page
 */
export function generateMicropostsIndexPage(
  microposts: RenderedMicropost[],
  ctx: RenderContext
): string {
  const micropostsList = microposts.map(micropost => {
    const dateStr = formatDateTime(micropost.date);

    return `<article class="post-list-item micropost-preview">
      <div class="micropost-content">${micropost.htmlContent}</div>
      <time class="post-date" datetime="${micropost.date.toISOString()}">${dateStr}</time>
      <a href="/microposts/${micropost.permalink}.html" class="micropost-link">View post</a>
    </article>`;
  }).join('\n');

  const content = `<div class="microposts-index">
    <h2>Microposts</h2>
    <div class="post-list">
      ${micropostsList}
    </div>
  </div>`;

  return generatePage('Microposts', content, ctx);
}

/**
 * Generate combined post list for homepage
 */
function generatePostList(
  articles: RenderedArticle[],
  microposts: RenderedMicropost[]
): string {
  // Combine and sort by date
  const combined: Array<{ type: 'article' | 'micropost'; date: Date; item: any }> = [
    ...articles.map(a => ({ type: 'article' as const, date: a.date, item: a })),
    ...microposts.map(m => ({ type: 'micropost' as const, date: m.date, item: m })),
  ];

  combined.sort((a, b) => b.date.getTime() - a.date.getTime());

  return `<div class="post-list">
    ${combined.map(({ type, item }) => {
      if (type === 'article') {
        const article = item as RenderedArticle;
        const dateStr = formatDate(article.date);

        return `<article class="post-list-item">
          <h3 class="post-title"><a href="/articles/${article.slug}.html">${escapeHtml(article.title)}</a></h3>
          <time class="post-date" datetime="${article.date.toISOString()}">${dateStr}</time>
          ${article.summary ? `<p class="post-summary">${escapeHtml(article.summary)}</p>` : ''}
        </article>`;
      } else {
        const micropost = item as RenderedMicropost;
        const dateStr = formatDateTime(micropost.date);

        return `<article class="post-list-item micropost-preview">
          <div class="micropost-content">${micropost.htmlContent}</div>
          <time class="post-date" datetime="${micropost.date.toISOString()}">${dateStr}</time>
          <a href="/microposts/${micropost.permalink}.html" class="micropost-link">View post</a>
        </article>`;
      }
    }).join('\n')}
  </div>`;
}

/**
 * Render markdown to HTML
 */
export function renderMarkdown(markdown: string): string {
  return marked.parse(markdown) as string;
}

/**
 * Format date (articles)
 */
function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Format datetime (microposts)
 */
function formatDateTime(date: Date): string {
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  const map: { [key: string]: string } = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };

  return text.replace(/[&<>"']/g, m => map[m]);
}
