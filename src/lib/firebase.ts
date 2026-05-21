import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { 
  initializeFirestore, 
  doc, 
  getDoc,
  getDocFromServer,
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
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
}, firebaseConfig.firestoreDatabaseId);
export const googleProvider = new GoogleAuthProvider();

async function testConnection() {
  try {
    // Attempt to read from a non-existent or restricted document just to test core connection
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error: any) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
  }
}
testConnection();

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
  const trMap: { [key: string]: string } = {
    'ç': 'c', 'Ç': 'c', 'ğ': 'g', 'Ğ': 'g', 'ş': 's', 'Ş': 's',
    'ü': 'u', 'Ü': 'u', 'ı': 'i', 'İ': 'i', 'ö': 'o', 'Ö': 'o'
  };
  return text.toLowerCase()
    .replace(/[çğşüıö]/g, (match) => trMap[match])
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
      
      if (!isStillCompatible) {
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
