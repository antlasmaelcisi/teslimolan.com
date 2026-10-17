// /sitemap.xml: yayınlanmış yazıların listesi. Yeni yazı yayınlandığında kendiliğinden güncellenir.
import { listPublishedBlogs } from './_lib/firestore.js';

const escapeXml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = `https://${request.headers.get('x-forwarded-host') || request.headers.get('host') || url.host}`;

  const blogs = await listPublishedBlogs();
  const entries = [
    `  <url><loc>${origin}/</loc></url>`,
    ...blogs.map(blog => {
      const lastmod = blog.updatedAt ? `<lastmod>${blog.updatedAt.slice(0, 10)}</lastmod>` : '';
      return `  <url><loc>${escapeXml(`${origin}/${blog.slug}`)}</loc>${lastmod}</url>`;
    }),
  ];

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join('\n')}
</urlset>
`;

  return new Response(body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
