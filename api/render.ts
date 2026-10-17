// Sayfa HTML'ini sunarken başlık, açıklama ve paylaşım (Open Graph) etiketlerini
// yazıya özel olarak doldurur. Böylece Google ve WhatsApp/Twitter gibi önizleme
// botları JavaScript çalıştırmadan doğru başlığı ve görseli görür.
// vercel.json içindeki rewrite, /api dışındaki tüm sayfa isteklerini buraya yönlendirir.
import { readFile } from 'fs/promises';
import path from 'path';
import { getBlogDocument, str } from './_lib/firestore';

const SITE_NAME = 'teslimolan.com';
const DEFAULT_DESCRIPTION = 'Kuran üzerine incelemeler ve yazılar.';
const NO_INDEX_PATHS = ['admin', 'edit'];

interface PageMeta {
  title: string;
  description: string;
  image?: string;
  url: string;
  type: 'website' | 'article';
  noIndex?: boolean;
}

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const htmlToText = (html: string) =>
  html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .replace(/\s+([.,;:!?)])/g, '$1')
    .trim();

const truncate = (text: string, max: number) =>
  text.length <= max ? text : text.slice(0, max - 1).replace(/\s+\S*$/, '') + '…';

async function fetchBlog(slug: string) {
  const fields = await getBlogDocument(slug);
  if (!fields) return null;

  const blocks: any[] = (fields.content?.arrayValue?.values || []).map((v: any) => v.mapValue?.fields || {});
  const image =
    str(blocks.find(b => str(b.type) === 'hero' && str(b.imageUrl))?.imageUrl) ||
    str(blocks.find(b => str(b.type) === 'image' && str(b.imageUrl))?.imageUrl);
  const firstText = blocks
    .filter(b => str(b.type) === 'text')
    .map(b => htmlToText(str(b.content) || ''))
    .find(text => text.length > 0);

  return {
    title: str(fields.title) || SITE_NAME,
    description: firstText ? truncate(firstText, 160) : DEFAULT_DESCRIPTION,
    image: image && !image.startsWith('data:') ? image : undefined,
  };
}

async function getPageMeta(pagePath: string, origin: string): Promise<PageMeta> {
  const slug = pagePath.replace(/^\/+|\/+$/g, '');
  const meta: PageMeta = {
    title: SITE_NAME,
    description: DEFAULT_DESCRIPTION,
    url: `${origin}/${slug}`,
    type: 'website',
  };

  if (!slug) return meta;
  if (NO_INDEX_PATHS.includes(slug.split('/')[0])) return { ...meta, noIndex: true };
  if (slug.length > 128 || !/^[a-zA-Z0-9_-]+$/.test(slug)) return meta;

  try {
    const blog = await fetchBlog(slug);
    if (blog) {
      return {
        ...meta,
        title: `${blog.title} – ${SITE_NAME}`,
        description: blog.description,
        image: blog.image,
        type: 'article',
      };
    }
  } catch (error) {
    console.error('Firestore meta fetch failed:', error);
  }
  return meta;
}

function renderMetaTags(meta: PageMeta) {
  const tags = [
    `<title>${escapeHtml(meta.title)}</title>`,
    `<meta name="description" content="${escapeHtml(meta.description)}" />`,
    `<link rel="canonical" href="${escapeHtml(meta.url)}" />`,
    `<meta property="og:site_name" content="${SITE_NAME}" />`,
    `<meta property="og:type" content="${meta.type}" />`,
    `<meta property="og:title" content="${escapeHtml(meta.title)}" />`,
    `<meta property="og:description" content="${escapeHtml(meta.description)}" />`,
    `<meta property="og:url" content="${escapeHtml(meta.url)}" />`,
    `<meta property="og:locale" content="tr_TR" />`,
    `<meta name="twitter:card" content="${meta.image ? 'summary_large_image' : 'summary'}" />`,
  ];
  if (meta.image) tags.push(`<meta property="og:image" content="${escapeHtml(meta.image)}" />`);
  if (meta.noIndex) tags.push(`<meta name="robots" content="noindex" />`);
  return tags.join('\n    ');
}

async function loadIndexHtml(request: Request) {
  try {
    return await readFile(path.join(process.cwd(), 'dist', 'index.html'), 'utf8');
  } catch {
    // Dosya fonksiyonla birlikte paketlenmediyse statik kopyayı çek
    const res = await fetch(new URL('/index.html', request.url));
    if (!res.ok) throw new Error(`index.html fetch failed: ${res.status}`);
    return await res.text();
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const pagePath = url.searchParams.get('path') || '';
  const origin = `https://${request.headers.get('x-forwarded-host') || request.headers.get('host') || url.host}`;

  const [html, meta] = await Promise.all([loadIndexHtml(request), getPageMeta(pagePath, origin)]);
  const body = html.replace(/<!-- seo:start -->[\s\S]*?<!-- seo:end -->/, renderMetaTags(meta));

  return new Response(body, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      // Vercel CDN'inde 5 dk taze tut, arka planda yenile
      'Cache-Control': 'public, max-age=0, s-maxage=300, stale-while-revalidate=86400',
    },
  });
}
