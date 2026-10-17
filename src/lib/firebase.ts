import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { 
  initializeFirestore, 
  doc, 
  getDoc,
  collection, 
  setDoc,
  updateDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  where,
  orderBy,
  serverTimestamp 
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = initializeFirestore(app, {}, firebaseConfig.firestoreDatabaseId);
export const googleProvider = new GoogleAuthProvider();

export async function checkIsAdmin(email: string | null): Promise<boolean> {
  if (!email) return false;
  try {
    const normalizedEmail = email.toLowerCase().trim();
    const adminDoc = await getDoc(doc(db, 'admins', normalizedEmail));
    return adminDoc.exists();
  } catch (error) {
    console.error('Admin kontrol hatası:', error);
    return false;
  }
}

export async function signInWithGoogle() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error('Login error:', error);
    throw error;
  }
}

// Blog İşlemleri
export const blogsCollection = collection(db, 'blogs');

export const subscribeToBlogs = (callback: (blogs: any[]) => void, isAdmin: boolean = false) => {
  let q;
  if (isAdmin) {
    q = query(blogsCollection, orderBy('updatedAt', 'desc'));
  } else {
    q = query(blogsCollection, where('status', '==', 'published'), orderBy('updatedAt', 'desc'));
  }
  
  return onSnapshot(q, (snapshot) => {
    const blogs = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    callback(blogs);
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, 'blogs');
  });
};

// Ziyaretçiler için ana sayfa listesi: yazıların sadece kart için gereken alanlarını çeker.
// Web SDK alan seçimi (projection) desteklemediği için Firestore REST API kullanılıyor.
const SUMMARY_FIELDS = ['title', 'status', 'createdAt', 'updatedAt', 'coverImage'];

const decodeRestValue = (value: any): any => {
  if (!value) return undefined;
  if ('stringValue' in value) return value.stringValue;
  if ('timestampValue' in value) return value.timestampValue;
  return undefined;
};

export const fetchPublishedBlogSummaries = async () => {
  const { projectId, firestoreDatabaseId, apiKey } = firebaseConfig;
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${firestoreDatabaseId}/documents:runQuery?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: 'blogs' }],
        where: { fieldFilter: { field: { fieldPath: 'status' }, op: 'EQUAL', value: { stringValue: 'published' } } },
        orderBy: [{ field: { fieldPath: 'updatedAt' }, direction: 'DESCENDING' }],
        select: { fields: SUMMARY_FIELDS.map(fieldPath => ({ fieldPath })) },
      },
    }),
  });
  if (!res.ok) throw new Error(`Blog listesi alınamadı: ${res.status}`);
  const rows: any[] = await res.json();
  return rows
    .filter(row => row.document)
    .map(row => {
      const summary: any = { id: row.document.name.split('/').pop() };
      for (const field of SUMMARY_FIELDS) {
        const value = decodeRestValue(row.document.fields?.[field]);
        if (value !== undefined) summary[field] = value;
      }
      return summary;
    });
};

// Tek bir yazıyı tüm içeriğiyle getirir (okuma sayfası için)
export const fetchBlog = async (id: string) => {
  const snapshot = await getDoc(doc(db, 'blogs', id));
  return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } as any : null;
};

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Başlığı URL/ID dostu hale getiren yardımcı fonksiyon
const slugify = (text: string) => {
  let str = text;
  // Türkçe karakterleri önce doğrudan dönüştürelim (böylece toLowerCase() 'İ'yi 'i\u0307'ye çevirip bozmaz)
  const chars: { [key: string]: string } = {
    'Ç': 'c', 'ç': 'c',
    'Ğ': 'g', 'ğ': 'g',
    'İ': 'i', 'ı': 'i',
    'I': 'i',
    'Ö': 'o', 'ö': 'o',
    'Ş': 's', 'ş': 's',
    'Ü': 'u', 'ü': 'u'
  };
  
  str = str.replace(/[ÇçĞğİıIÖöŞşÜü]/g, (match) => chars[match]);
  
  return str.toLowerCase()
    .replace(/[\s\W-]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

export const saveBlog = async (id: string | null, data: any) => {
  const blogData = {
    ...data,
    updatedAt: serverTimestamp(),
  };

  try {
    if (id) {
      const blogRef = doc(db, 'blogs', id);
      const blogDoc = await getDoc(blogRef);

      if (!blogDoc.exists()) {
        // Document provided but doesn't exist -> Create it with this ID
        await setDoc(blogRef, {
          ...blogData,
          createdAt: serverTimestamp()
        });
        return id;
      }

      // Existing document -> Check if title changed significantly to trigger a rename/move
      const newBaseSlug = slugify(data.title) || 'adsiz-yazi';

      // If current ID is not the same as newBaseSlug and doesn't start with newBaseSlug + '-', we rename.
      const isStillCompatible = id === newBaseSlug;
      // Yayınlanmış bir yazının adresi sabit kalır: başlık değişse de paylaşılmış linkler kırılmasın
      const wasPublished = blogDoc.data()?.status === 'published';

      if (!isStillCompatible && !wasPublished) {
        // 1. Find a unique new ID
        let finalId = newBaseSlug;
        let counter = 1;
        while (true) {
          const checkDoc = await getDoc(doc(db, 'blogs', finalId));
          if (!checkDoc.exists()) break;
          counter++;
          finalId = `${newBaseSlug}-${counter}`;
          if (counter > 100) break;
        }

        // 2. Clone old data and merge with new. Keep the original createdAt!
        const oldData = blogDoc.data();
        const mergedData = {
          ...oldData,
          ...blogData,
          createdAt: oldData?.createdAt || serverTimestamp()
        };
        
        await setDoc(doc(db, 'blogs', finalId), mergedData);
        
        // 3. Delete old document
        await deleteDoc(blogRef);
        
        return finalId;
      } else {
        // Just update existing document
        await updateDoc(blogRef, blogData);
        return id;
      }
    } else {
      // No ID provided -> standard new blog creation with auto-slug
      const baseSlug = slugify(data.title) || 'adsiz-yazi';
      let finalId = baseSlug;
      let counter = 1;
      
      // Benzersiz bir ID bulana kadar kontrol et
      while (true) {
        const checkDoc = await getDoc(doc(db, 'blogs', finalId));
        if (!checkDoc.exists()) {
          break;
        }
        counter++;
        finalId = `${baseSlug}-${counter}`;
        
        // Güvenlik: Sonsuz döngü olmaması için 100 denemeden sonra bırak
        if (counter > 100) {
          finalId = `${baseSlug}-${Math.random().toString(36).substr(2, 5)}`;
          break;
        }
      }
      
      const blogRef = doc(db, 'blogs', finalId);
      await setDoc(blogRef, {
        ...blogData,
        createdAt: serverTimestamp()
      });
      return finalId;
    }
  } catch (error) {
    handleFirestoreError(error, id ? OperationType.UPDATE : OperationType.CREATE, id ? `blogs/${id}` : 'blogs');
    throw error;
  }
};

export const deleteBlogFromFirebase = async (id: string) => {
  try {
    await deleteDoc(doc(db, 'blogs', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `blogs/${id}`);
    throw error;
  }
};
