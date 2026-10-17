// Vercel fonksiyonlarının Firestore REST API'si üzerinden yayınlanmış yazıları okuması için
// ortak yardımcılar. Klasör adı "_" ile başladığı için Vercel bunu ayrı bir fonksiyon yapmaz.
import firebaseConfig from '../../firebase-applet-config.json';

const { projectId, firestoreDatabaseId, apiKey } = firebaseConfig;
const DOCUMENTS_URL = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${firestoreDatabaseId}/documents`;

// REST API alanları { stringValue: ... } gibi tipli nesneler olarak döner
export const str = (field: any): string | undefined => field?.stringValue;

export async function getBlogDocument(slug: string) {
  const res = await fetch(`${DOCUMENTS_URL}/blogs/${encodeURIComponent(slug)}?key=${apiKey}`);
  // Taslaklar güvenlik kuralları gereği 403 döner, olmayan yazılar 404
  if (!res.ok) return null;
  const doc = await res.json();
  const fields = doc.fields || {};
  return str(fields.status) === 'published' ? fields : null;
}

export async function listPublishedBlogs(): Promise<{ slug: string; updatedAt?: string }[]> {
  const res = await fetch(`${DOCUMENTS_URL}:runQuery?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: 'blogs' }],
        where: { fieldFilter: { field: { fieldPath: 'status' }, op: 'EQUAL', value: { stringValue: 'published' } } },
        select: { fields: [{ fieldPath: 'updatedAt' }] },
      },
    }),
  });
  if (!res.ok) throw new Error(`Firestore query failed: ${res.status}`);
  const rows: any[] = await res.json();
  return rows
    .filter(row => row.document)
    .map(row => ({
      slug: row.document.name.split('/').pop(),
      updatedAt: row.document.fields?.updatedAt?.timestampValue,
    }));
}
