import React, { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import { motion, AnimatePresence, useScroll, useTransform } from 'motion/react';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { auth, signInWithGoogle, checkIsAdmin, subscribeToBlogs, saveBlog, deleteBlogFromFirebase } from './lib/firebase';
import { ContentEditable } from './components/ContentEditable';
import VibrantWallpaper from './components/VibrantWallpaper';

// Safelist for Tailwind CSS dynamic classes:
// text-left text-center text-right text-justify
// justify-start justify-center justify-end
// items-start items-center items-end

import { 
  Plus, 
  FileText, 
  Layout, 
  ChevronRight, 
  ChevronUp,
  ChevronDown,
  Save, 
  Send, 
  Trash2, 
  ArrowLeft,
  Clock,
  Eye,
  Edit3,
  Palette,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Square,
  Image as ImageIcon,
  Minus,
  Type,
  Download,
  Undo,
  Redo,
  MousePointer2,
  Copy,
  Table,
  Terminal,
  SplitSquareHorizontal,
  Info,
  Bold,
  Italic,
  Underline,
  LogOut,
  BadgeCheck,
  PanelBottomClose,
  PanelLeftClose,
  PanelRightClose,
  InspectionPanel,
  RotateCcw,
  TableCellsMerge,
  TableCellsSplit,
  PanelTop
} from 'lucide-react';

interface Note {
  text: string;
  link?: string;
  alignment?: 'left' | 'center' | 'right' | 'justify';
}

interface TableRow {
  cells: string[];
}

interface TableData {
  rows: TableRow[];
  mergedCells?: { startRow: number, startCol: number, endRow: number, endCol: number }[];
  cellStyles?: { [key: string]: any }; // Renklendirme ve stil için
  columnWidths?: { [key: number]: number };
}

interface Block {
  id: string;
  type: 'text' | 'button' | 'heading' | 'image' | 'divider' | 'hero' | 'table' | 'note';
  content: string;
  link?: string;
  alignment?: 'left' | 'center' | 'right' | 'justify';
  textColor?: string;
  hasButton?: boolean;
  buttonText?: string;
  buttonLink?: string;
  buttonIcon?: string;
  background?: 'white' | 'gray' | 'accent' | 'dark';
  imageUrl?: string;
  caption?: string;
  hasNote?: boolean;
  noteContent?: string;
  notes?: Note[];
  data?: TableData;
  tableTransparent?: boolean;
  buttons?: { text: string, link: string, icon?: string }[];
  manualBackground?: boolean;
  buttonPosition?: 'right' | 'bottom';
  tableAlignment?: 'left' | 'full' | 'right';
}

interface Blog {
  id: string;
  title: string;
  content: string; // Will store JSON string of blocks
  status: 'draft' | 'published';
  createdAt: any;
  updatedAt: any;
  authorEmail?: string;
}

type Tab = 'home' | 'create';

// Helper to fix Google Drive links to direct image links
const fixDriveLink = (url: string) => {
  if (url.includes('drive.google.com')) {
    const fileId = url.split('/d/')[1]?.split('/')[0] || url.split('id=')[1]?.split('&')[0];
    if (fileId) return `https://lh3.googleusercontent.com/d/${fileId}`;
  }
  return url;
};

// Helper to get the first hero or image block's URL for display
const unwrapElement = (el: Element) => {
  const parent = el.parentNode;
  if (!parent) return;
  while (el.firstChild) {
    parent.insertBefore(el.firstChild, el);
  }
  parent.removeChild(el);
};

const applyFormattingToHtml = (html: string, command: string, value: string = '') => {
  let content = html;
  if (!content || content.trim() === '' || content === 'Metin yazmak için çift tıklayın...') {
    content = '';
  }

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(content || '<div></div>', 'text/html');
    
    // Proactive cleanup of empty and redundant styling spans
    doc.body.querySelectorAll('span').forEach(span => {
      if (!span.getAttribute('style') || span.getAttribute('style').trim() === '') {
        unwrapElement(span);
        return;
      }
      
      const parent = span.parentElement;
      if (parent && parent.tagName.toLowerCase() === 'span') {
        const parentColor = parent.style.color;
        const myColor = span.style.color;
        if (parentColor && myColor && parentColor.toLowerCase().replace(/\s/g, '') === myColor.toLowerCase().replace(/\s/g, '')) {
          unwrapElement(span);
        }
      }
    });

    // Determine the root text-holding wrapper (like a div, p, or span from sheet import / typography styling)
    const bodyChildren = Array.from(doc.body.childNodes).filter(node => {
      if (node.nodeType === Node.TEXT_NODE && !node.textContent?.trim()) {
        return false;
      }
      return true;
    });

    let targetContainer: HTMLElement = doc.body;
    let isWrapped = false;

    if (bodyChildren.length === 1 && bodyChildren[0].nodeType === Node.ELEMENT_NODE) {
      const element = bodyChildren[0] as HTMLElement;
      const tagName = element.tagName.toLowerCase();
      if (tagName === 'div' || tagName === 'p' || tagName === 'span') {
        targetContainer = element;
        isWrapped = true;
      }
    }
    
    if (command === 'bold') {
      const bTags = targetContainer.querySelectorAll('b, strong');
      const hasFontWeightBold = targetContainer.style.fontWeight === 'bold' || targetContainer.style.fontWeight === '700';
      
      if (bTags.length > 0 || hasFontWeightBold) {
        bTags.forEach(unwrapElement);
        targetContainer.style.fontWeight = '';
        targetContainer.querySelectorAll('*').forEach(el => {
          if (el instanceof HTMLElement) el.style.fontWeight = '';
        });
      } else {
        targetContainer.innerHTML = `<b>${targetContainer.innerHTML}</b>`;
      }
      return doc.body.innerHTML;
    }

    if (command === 'italic') {
      const italicTags = targetContainer.querySelectorAll('i, em');
      const hasItalicStyle = targetContainer.style.fontStyle === 'italic';
      
      if (italicTags.length > 0 || hasItalicStyle) {
        italicTags.forEach(unwrapElement);
        targetContainer.style.fontStyle = '';
        targetContainer.querySelectorAll('*').forEach(el => {
          if (el instanceof HTMLElement) el.style.fontStyle = '';
        });
      } else {
        targetContainer.innerHTML = `<i>${targetContainer.innerHTML}</i>`;
      }
      return doc.body.innerHTML;
    }

    if (command === 'underline') {
      const uTags = targetContainer.querySelectorAll('u');
      const hasUnderlineStyle = targetContainer.style.textDecoration.includes('underline');
      
      if (uTags.length > 0 || hasUnderlineStyle) {
        uTags.forEach(unwrapElement);
        targetContainer.style.textDecoration = '';
        targetContainer.querySelectorAll('*').forEach(el => {
          if (el instanceof HTMLElement) el.style.textDecoration = '';
        });
      } else {
        targetContainer.innerHTML = `<u>${targetContainer.innerHTML}</u>`;
      }
      return doc.body.innerHTML;
    }

    if (command === 'foreColor') {
      const finalColor = value || '#000000';
      
      targetContainer.querySelectorAll('*').forEach(el => {
        if (el instanceof HTMLElement) {
          el.style.color = '';
        }
      });
      
      if (isWrapped) {
        targetContainer.style.color = finalColor;
      } else {
        doc.body.innerHTML = `<span style="color: ${finalColor};">${doc.body.innerHTML}</span>`;
      }
      return doc.body.innerHTML;
    }
  } catch (error) {
    console.error("DOMParser formatting error:", error);
  }

  return content;
};

const getTableCellAlignment = (cellHtml: string) => {
  if (!cellHtml || cellHtml === 'Metin yazmak için çift tıklayın...') return 'left';
  const match = cellHtml.match(/text-align:\s*(left|center|right|justify)/i);
  return match ? (match[1].toLowerCase() as 'left' | 'center' | 'right' | 'justify') : 'left';
};

const getBlogDisplayImage = (blog: Blog) => {
  try {
    const blocks = JSON.parse(blog.content);
    if (!Array.isArray(blocks)) return `https://picsum.photos/seed/${blog.id}/800/400`;
    
    const heroBlock = blocks.find((b: Block) => b.type === 'hero' && b.imageUrl);
    if (heroBlock && heroBlock.imageUrl) return heroBlock.imageUrl;
    
    const imageBlock = blocks.find((b: Block) => b.type === 'image' && b.imageUrl);
    if (imageBlock && imageBlock.imageUrl) return imageBlock.imageUrl;
  } catch (e) {
    // Ignore parse errors, fall back to picsum
  }
  return `https://picsum.photos/seed/${blog.id}/800/400`;
};

// Helper to compress images - Now returns base64 string and uses aggressive compression
const compressImage = (base64Str: string, maxWidth = 800, maxHeight = 800, quality = 0.5): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxWidth) {
          height *= maxWidth / width;
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width *= maxHeight / height;
          height = maxHeight;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(base64Str);
  });
};

const AppleIcon = ({ icon: Icon, colorClass, size = 20, className = "w-10 h-10", style }: { icon: any, colorClass: string, size?: number, className?: string, style?: React.CSSProperties }) => (
  <div className={`apple-icon-container ${colorClass} ${className}`} style={style}>
    <Icon size={size} strokeWidth={2.5} className="relative z-10 drop-shadow-sm" />
  </div>
);

const HeroImage = ({ src, viewMode }: { src: string, viewMode: 'read' | 'edit' }) => {
  const { scrollY } = useScroll();
  
  // Only animate in reading mode for a cleaner experience in editor
  const y = useTransform(scrollY, [0, 600], [0, 80]);
  const scale = useTransform(scrollY, [0, 600], [1.15, 1.0]);
  
  if (viewMode === 'edit') {
    return (
      <img src={src} className="absolute inset-0 w-full h-full object-cover" alt="Hero" referrerPolicy="no-referrer" />
    );
  }
  
  return (
    <motion.img 
      style={{ y, scale }}
      src={src} 
      className="absolute inset-0 w-full h-full object-cover origin-center" 
      alt="Hero" 
      referrerPolicy="no-referrer" 
    />
  );
};

const getButtonColorClass = (iconName?: string) => {
  switch (iconName) {
    case 'copy': return "apple-icon-split";
    case 'table': return "apple-icon-blue";
    case 'terminal': return "apple-icon-terminal";
    case 'split': return "apple-icon-green";
    default: return "apple-icon-blue";
  }
};

const renderButtonIcon = (iconName?: string) => {
  let Icon;

  switch (iconName) {
    case 'copy': Icon = Copy; break;
    case 'table': Icon = Table; break;
    case 'terminal': Icon = Terminal; break;
    case 'split': Icon = SplitSquareHorizontal; break;
    default: return null;
  }

  return <Icon strokeWidth={2.5} className="w-5 h-5 md:w-4 md:h-4 text-inherit drop-shadow-sm" />;
};

const Login = ({ onLoginSuccess }: { onLoginSuccess: () => void }) => {
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleGoogleLogin = async () => {
    setIsSubmitting(true);
    setError('');
    try {
      const user = await signInWithGoogle();
      const isAdmin = await checkIsAdmin(user.email);
      
      if (isAdmin) {
        onLoginSuccess();
      } else {
        await signOut(auth);
        setError(`Bu hesaba (${user.email}) admin yetkisi verilmemiş. Lütfen yetkili bir hesapla deneyin.`);
      }
    } catch (err: any) {
      console.error("Auth error details:", err);
      if (err.code === 'auth/popup-closed-by-user') {
        setError('Giriş işlemi iptal edildi.');
      } else if (err.code === 'auth/unauthorized-domain') {
        setError('Bu alan adı (domain) Firebase üzerinde yetkilendirilmemiş. Lütfen Firebase Console -> Authentication -> Settings -> Authorized Domains kısmına Vercel domaininizi ekleyin.');
      } else if (err.code === 'auth/network-request-failed') {
        setError('Ağ hatası oluştu. Lütfen bağlantınızı kontrol edin veya reklam engelleyicileri kapatıp tekrar deneyin.');
      } else {
        setError(`Giriş hatası: ${err.message || 'Bilinmeyen hata'} (${err.code || 'n/a'})`);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <div 
        className="w-full max-w-md bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-3xl shadow-2xl overflow-hidden"
      >
        <div className="p-8 text-center">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-[#1F7144]/10 rounded-2xl flex items-center justify-center">
              <BadgeCheck className="text-[#1F7144]" size={32} />
            </div>
          </div>
          
          <h2 className="text-2xl font-bold text-[#1d1d1f] mb-2">Admin Panel</h2>
          <p className="text-gray-500 text-sm mb-8">Lütfen yetkili Google hesabınızla giriş yapın.</p>
          
          <div className="space-y-4">
            <button 
              onClick={handleGoogleLogin}
              disabled={isSubmitting}
              className="w-full py-3.5 bg-white border border-gray-200 text-gray-700 rounded-xl font-medium text-lg shadow-sm hover:bg-gray-50 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
            >
              {isSubmitting ? (
                <div className="w-5 h-5 border-2 border-gray-300 border-t-[#1F7144] rounded-full animate-spin" />
              ) : (
                <>
                  <svg className="w-6 h-6" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  <span>Google ile Giriş Yap</span>
                </>
              )}
            </button>
            
            {error && (
              <p className="text-red-500 text-sm font-medium px-4">
                {error}
              </p>
            )}
          </div>
        </div>
        
        <div className="px-8 py-4 bg-gray-50/50 border-t border-gray-100 text-center">
          <p className="text-xs text-gray-400">teslimolan.com &copy; 2026</p>
        </div>
      </div>
    </div>
  );
};

const BlogSkeleton = () => (
  <div className="blogger-card overflow-hidden flex flex-col animate-pulse" style={{ height: '278.9px' }}>
    <div className="h-44 bg-gray-200" />
    <div className="p-5 flex-1 flex flex-col">
      <div className="h-6 bg-gray-200 rounded w-3/4 mb-4" />
      <div className="mt-auto pt-4 border-t border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-gray-100 rounded-full" />
          <div className="h-3 bg-gray-100 rounded w-20" />
        </div>
      </div>
    </div>
  </div>
);

export default function App() {
  const { scrollYProgress } = useScroll();
  const [activeTab, setActiveTab] = useState<Tab>(() => {
    if (typeof window !== 'undefined') {
      const path = window.location.pathname;
      const clean = path.endsWith('/') && path.length > 1 ? path.slice(0, -1) : path;
      return clean === '/admin' ? 'create' : 'home';
    }
    return 'home';
  });

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [blogs, setBlogs] = useState<Blog[]>([]);
  const [editingBlog, setEditingBlog] = useState<Blog | null>(null);
  const [viewingBlog, setViewingBlog] = useState<Blog | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [historyState, setHistoryState] = useState<{
    stack: Block[][];
    index: number;
  }>({ stack: [], index: -1 });
  const isInternalUpdate = useRef(false);
  const isInitializingBlog = useRef(false);
  const lastPushedBlocksRef = useRef<string>('');
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
  const [swipeDirection, setSwipeDirection] = useState<number>(0);
  const [editingImageUrl, setEditingImageUrl] = useState<string | null>(null);
  const [tempImageUrl, setTempImageUrl] = useState('');

  // Reset history when switching blogs or starting a new one
  const resetHistory = useCallback((initialBlocks: Block[]) => {
    const blocksStr = JSON.stringify(initialBlocks);
    setHistoryState({
      stack: [JSON.parse(blocksStr)],
      index: 0
    });
    lastPushedBlocksRef.current = blocksStr;
    isInitializingBlog.current = true;
    isInternalUpdate.current = true;
  }, []);

  const handleLocation = useCallback((targetId?: string) => {
    const path = window.location.pathname;
    const cleanPath = path.endsWith('/') && path.length > 1 ? path.slice(0, -1) : path;
    
    if (cleanPath === '/admin') {
      setActiveTab('create');
      setViewingBlog(null);
    } else if (cleanPath === '/edit') {
      if (!isAuthenticated && !isLoading) {
        navigate('/admin');
        return;
      }
      setActiveTab('create');
      setViewingBlog(null);
      setEditingBlog(null);
    } else if (cleanPath.startsWith('/edit/') || targetId) {
      if (!isAuthenticated && !isLoading) {
        navigate('/admin');
        return;
      }
      const blogId = targetId || cleanPath.split('/edit/')[1];
      if (blogId) {
        if (isLoading) return;
        const existingBlog = (editingBlog && editingBlog.id === blogId) ? editingBlog : blogs.find(b => b.id === blogId);
        if (existingBlog) {
          // Edit existing
          if (editingBlog?.id !== existingBlog.id) {
            setEditingBlog(existingBlog);
          }
        } else if ((editingBlog && editingBlog.id === blogId) || isSavingRef.current || (pendingNewBlogRef.current && pendingNewBlogRef.current.id === blogId)) {
          // Already initialized locally or in the middle of a rename save
          if ((!editingBlog || editingBlog.id !== blogId) && pendingNewBlogRef.current && pendingNewBlogRef.current.id === blogId) {
            setEditingBlog(pendingNewBlogRef.current);
            pendingNewBlogRef.current = null;
          }
        } else {
          // Blog not found or not created via button
          navigate('/');
          return;
        }
      }
      setActiveTab('create');
      setViewingBlog(null);
    } else if (cleanPath === '/' || cleanPath === '') {
      setActiveTab('home');
      setViewingBlog(null);
      if (!isAuthenticated) setEditingBlog(null);
    } else {
      const slug = cleanPath.substring(1);
      const found = blogs.find(b => b.id === slug);
      if (found) {
        setViewingBlog(prev => {
          // If we already have this blog in view and it might have unsaved local changes,
          // don't overwrite it with the list version unless IDs differ
          if (prev && prev.id === found.id) return prev;
          return found;
        });
        setActiveTab('home');
        setEditingBlog(null);
      } else if (isLoading) {
        // Bekleyelim
      } else {
        setActiveTab('home');
        setViewingBlog(null);
        setEditingBlog(null);
      }
    }
  }, [blogs, isLoading, isAuthenticated, editingBlog, resetHistory]);

  const navigate = useCallback((path: string) => {
    window.history.pushState({}, '', path);
    handleLocation();
  }, [handleLocation]);

  // Handle unauthorized access to /admin or empty editor
  useEffect(() => {
    const path = window.location.pathname;
    const cleanPath = path.endsWith('/') && path.length > 1 ? path.slice(0, -1) : path;
    if (cleanPath === '/admin' && !editingBlog && !isLoading && isAuthenticated) {
      navigate('/edit');
    }
  }, [editingBlog, isLoading, isAuthenticated, navigate]);

  useEffect(() => {
    const syncTab = () => {
      handleLocation();
    };
    
    syncTab();
    window.addEventListener('popstate', syncTab);
    window.addEventListener('focus', syncTab);
    return () => {
      window.removeEventListener('popstate', syncTab);
      window.removeEventListener('focus', syncTab);
    };
  }, [handleLocation, activeTab]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const adminStatus = await checkIsAdmin(user.email);
        setIsAdmin(adminStatus);
        if (adminStatus) {
          setIsAuthenticated(true);
          setCurrentUser(user);
        } else {
          setIsAuthenticated(false);
          setCurrentUser(null);
        }
      } else {
        setIsAuthenticated(false);
        setIsAdmin(false);
        setCurrentUser(null);
      }
      setIsAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
  };

  const handleLogout = async () => {
    await signOut(auth);
    setIsAuthenticated(false);
    setIsAdmin(false);
    setCurrentUser(null);
    setEditingBlog(null);
    setViewingBlog(null);
    navigate('/');
  };

  // Auto-hide notification
  useEffect(() => {
    if (notification) {
      setSwipeDirection(0);
      const timer = setTimeout(() => setNotification(null), 1500);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const undo = () => {
    if (historyState.index > 0) {
      isInternalUpdate.current = true;
      const newIndex = historyState.index - 1;
      const prevBlocks = JSON.parse(JSON.stringify(historyState.stack[newIndex]));
      setBlocks(prevBlocks);
      setHistoryState(prev => ({ ...prev, index: newIndex }));
      lastPushedBlocksRef.current = JSON.stringify(prevBlocks);
    }
  };

  const redo = () => {
    if (historyState.index < historyState.stack.length - 1) {
      isInternalUpdate.current = true;
      const newIndex = historyState.index + 1;
      const nextBlocks = JSON.parse(JSON.stringify(historyState.stack[newIndex]));
      setBlocks(nextBlocks);
      setHistoryState(prev => ({ ...prev, index: newIndex }));
      lastPushedBlocksRef.current = JSON.stringify(nextBlocks);
    }
  };

  // Debounced history push for all block changes
  useEffect(() => {
    if (isInitializingBlog.current) {
      if (JSON.stringify(blocks) === lastPushedBlocksRef.current) {
        isInitializingBlog.current = false;
      }
      return;
    }

    if (isInternalUpdate.current) {
      isInternalUpdate.current = false;
      return;
    }
    
    if (blocks.length === 0) return;

    const timeout = setTimeout(() => {
      const blocksStr = JSON.stringify(blocks);
      if (blocksStr === lastPushedBlocksRef.current) return;
      
      // Double check initializing flag inside timeout
      if (isInitializingBlog.current) return;

      setHistoryState(prev => {
        // If stack is empty (shouldn't happen with explicit resetHistory, but for safety)
        if (prev.stack.length === 0) {
          return {
            stack: [JSON.parse(blocksStr)],
            index: 0
          };
        }

        const newStack = prev.stack.slice(0, prev.index + 1);
        newStack.push(JSON.parse(blocksStr));
        
        let newIndex = newStack.length - 1;
        if (newStack.length > 50) {
          newStack.shift();
          newIndex = newStack.length - 1;
        }
        
        return {
          stack: newStack,
          index: newIndex
        };
      });
      lastPushedBlocksRef.current = blocksStr;
    }, 500);

    return () => clearTimeout(timeout);
  }, [blocks, historyState.index]);

  const [isButtonModalOpen, setIsButtonModalOpen] = useState(false);
  const [editingButtonBlockId, setEditingButtonBlockId] = useState<string | null>(null);
  const [editingButtonIndex, setEditingButtonIndex] = useState<number | null>(null);
  const [draftButton, setDraftButton] = useState<{ text: string; link: string; icon: string; position?: 'right' | 'bottom' }>({ text: '', link: '', icon: '', position: 'right' });
  const [selectedCells, setSelectedCells] = useState<{rowIdx: number, cellIdx: number}[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [startCell, setStartCell] = useState<{rowIdx: number, cellIdx: number} | null>(null);
  const [editingCell, setEditingCell] = useState<{rowIdx: number, cellIdx: number} | null>(null);
  const [openColorMenuBlockId, setOpenColorMenuBlockId] = useState<string | null>(null);
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);
  const [isStickyBold, setIsStickyBold] = useState(false);
  const [isStickyItalic, setIsStickyItalic] = useState(false);
  const [isStickyUnderline, setIsStickyUnderline] = useState(false);
  const [openImportDataBlockId, setOpenImportDataBlockId] = useState<string | null>(null);
  const [importDataText, setImportDataText] = useState('');
  const [importDataHtml, setImportDataHtml] = useState('');
  const [isTextColorPaletteOpen, setIsTextColorPaletteOpen] = useState(false);
  const [lastSelectedColor, setLastSelectedColor] = useState('');
  const [isIconMenuOpen, setIsIconMenuOpen] = useState(false);
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const [isHeaderFullyVisible, setIsHeaderFullyVisible] = useState(true);
  const isHeaderFullyVisibleRef = useRef(true);
  
  const [primaryHeaderHeight, setPrimaryHeaderHeight] = useState(64);
  const [totalHeaderHeight, setTotalHeaderHeight] = useState(112);
  const primaryHeaderRef = useRef<HTMLDivElement>(null);
  const secondaryHeaderRef = useRef<HTMLDivElement>(null);
  const headerContainerRef = useRef<HTMLDivElement>(null);
  const editorAreaRef = useRef<HTMLDivElement>(null);
  const [activeNoteIndex, setActiveNoteIndex] = useState<number | null>(null);
  const [isAdminMenuOpen, setIsAdminMenuOpen] = useState(false);

  // Close admin menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.admin-menu-container')) {
        setIsAdminMenuOpen(false);
      }
    };
    if (isAdminMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isAdminMenuOpen]);



  const lastScrollY = useRef(0);
  const isScrolling = useRef(false);
  const scrollTimeout = useRef<NodeJS.Timeout | null>(null);
  
  // High-performance refs to avoid scroll listener re-binding
  const phRef = useRef(64);
  const thRef = useRef(112);
  
  const updateHeights = useCallback(() => {
    // Only update if not actively scrolling to prevent jitter during transitions
    if (isScrolling.current) return;

    if (primaryHeaderRef.current && secondaryHeaderRef.current) {
      const ph = primaryHeaderRef.current.offsetHeight;
      const sh = secondaryHeaderRef.current.offsetHeight;
      const th = ph + sh;
      
      if (ph > 0 && th > 0) {
        // Update refs immediately for the scroll listener
        phRef.current = ph;
        thRef.current = th;

        // Update state to trigger predictable padding-top updates
        setPrimaryHeaderHeight(ph);
        setTotalHeaderHeight(th);
        
        document.documentElement.style.setProperty('--primary-header-height', `${ph}px`);
        document.documentElement.style.setProperty('--total-header-height', `${th}px`);
      }
    }
  }, []);

  useLayoutEffect(() => {
    updateHeights();
    
    // ResizeObserver watches the container for legitimate layout shifts
    const resizeObserver = new ResizeObserver(() => {
      updateHeights();
    });

    if (headerContainerRef.current) {
      resizeObserver.observe(headerContainerRef.current);
    }
    
    return () => resizeObserver.disconnect();
  }, [updateHeights, editingBlog?.id]);

  useEffect(() => {
    const handleScroll = () => {
      isScrolling.current = true;
      if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
      scrollTimeout.current = setTimeout(() => { isScrolling.current = false; }, 200);

      const currentScrollY = window.scrollY;
      
      // Use direct window.requestAnimationFrame for frame-perfect sync
      window.requestAnimationFrame(() => {
        // Absolute stability: compensate the browser's scroll exactly 
        // until the primary header is fully hidden.
        const ph = phRef.current;
        let headerOffset = Math.min(currentScrollY, ph);
        const editorOffset = Math.min(currentScrollY, ph);
        
        const currentlyOpen = headerOffset === 0;
        if (isHeaderFullyVisibleRef.current !== currentlyOpen) {
          setIsHeaderFullyVisible(currentlyOpen);
          isHeaderFullyVisibleRef.current = currentlyOpen;
        }

        if (headerContainerRef.current) {
          // Slide the header container up
          headerContainerRef.current.style.transform = `translate3d(0, -${Math.round(headerOffset)}px, 0)`;
        }
        if (editorAreaRef.current) {
          // Slide the content area down by the EXACT same amount to lock its screen position
          editorAreaRef.current.style.transform = `translate3d(0, ${Math.round(editorOffset)}px, 0)`;
        }

        if (!editingBlog) {
          if (currentScrollY < 10) {
            setIsHeaderVisible(true);
          } else if (currentScrollY > lastScrollY.current) {
            if (currentScrollY > 100) setIsHeaderVisible(false);
          } else {
            setIsHeaderVisible(true);
          }
        }
        lastScrollY.current = currentScrollY;
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
      window.removeEventListener('scroll', handleScroll);
    };
  }, []); // Stable listener

  useEffect(() => {
    if (isAuthLoading) return;

    const unsubscribe = subscribeToBlogs((data) => {
      const processed = data.map(blog => ({
        ...blog,
        updatedAt: blog.updatedAt?.toDate ? blog.updatedAt.toDate().toISOString() : (blog.updatedAt || new Date().toISOString()),
        createdAt: blog.createdAt?.toDate ? blog.createdAt.toDate().toISOString() : (blog.createdAt || new Date().toISOString()),
      }));
      setBlogs(processed);
      setIsLoading(false);
    }, isAdmin);
    return () => unsubscribe();
  }, [isAdmin, isAuthLoading]);

  useEffect(() => {
    const handleMouseUp = () => {
      setIsDragging(false);
      setStartCell(null);
    };
    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, []);

  // Initialize blocks and history when editingBlog changes
  useEffect(() => {
    if (editingBlog) {
      try {
        const parsed = JSON.parse(editingBlog.content);
        let finalBlocks = [];
        if (Array.isArray(parsed) && parsed.length > 0) {
          finalBlocks = parsed;
        } else {
          // Fallback for empty array or old HTML content
          finalBlocks = [{ 
            id: '1', 
            type: 'text', 
            content: editingBlog.content || 'Metin yazmak için tıklayın...',
            alignment: 'justify' as const
          }];
        }
        setBlocks(finalBlocks);
        resetHistory(finalBlocks);
      } catch (e) {
        const fallbackBlocks = [{ 
          id: '1', 
          type: 'text', 
          content: editingBlog.content || 'Metin yazmak için tıklayın...',
          alignment: 'justify' as const
        }];
        setBlocks(fallbackBlocks);
        resetHistory(fallbackBlocks);
      }
    } else {
      setBlocks([]);
      setHistoryState({ stack: [], index: -1 });
      lastPushedBlocksRef.current = '';
    }
  }, [editingBlog?.id, resetHistory]);

  const addBlock = (type: Block['type'] | 'note') => {
    if (type === 'button' && activeBlockId) {
      const activeBlock = blocks.find(b => b.id === activeBlockId);
      if (activeBlock && ['text', 'note', 'table', 'heading', 'image'].includes(activeBlock.type)) {
        if (!activeBlock.hasButton) {
          updateBlock(activeBlockId, { hasButton: true });
        } else {
          const newButtons = [...(activeBlock.buttons || []), { text: 'İncele', link: 'https://' }];
          updateBlock(activeBlockId, { buttons: newButtons });
        }
        return;
      }
    }

    if (type === 'note' && activeBlockId) {
      const activeBlock = blocks.find(b => b.id === activeBlockId);
      if (activeBlock) {
        const newNote: Note = { text: 'Metin yazmak için tıklayın...', alignment: 'justify' };
        const updatedNotes = [...(activeBlock.notes || []), newNote];
        updateBlock(activeBlockId, { notes: updatedNotes });
        return;
      }
    }

    if (type === 'table' && activeBlockId) {
      const activeBlock = blocks.find(b => b.id === activeBlockId);
      if (activeBlock) {
        if (!activeBlock.data) {
          const newTableData: TableData = {
            rows: [
              { cells: ['Metin yazmak için çift tıklayın...', 'Metin yazmak için çift tıklayın...'] },
              { cells: ['Metin yazmak için çift tıklayın...', 'Metin yazmak için çift tıklayın...'] }
            ]
          };
          updateBlock(activeBlockId, { data: newTableData, buttonPosition: 'bottom' });
        }
        return;
      }
    }

    const newBlock: Block = {
      id: Math.random().toString(36).substr(2, 9),
      type: type === 'button' ? 'text' : type,
      content: type === 'heading' ? 'Başlık Yazın' : (type === 'hero' ? 'Büyük Başlık' : (type === 'table' ? '' : (type === 'note' ? '' : 'Metin yazmak için tıklayın...'))),
      link: type === 'button' ? 'https://' : undefined,
      alignment: type === 'hero' ? 'center' : (['text', 'note', 'heading'].includes(type) ? 'justify' : 'left'),
      textColor: type === 'table' ? '' : lastSelectedColor,
      hasButton: type === 'button',
      notes: type === 'note' ? [{ text: 'Metin yazmak için tıklayın...', alignment: 'justify' }] : [],
      buttonText: 'İncele',
      buttonLink: 'https://',
      background: 'white',
      imageUrl: type === 'image' ? 'https://picsum.photos/800/400' : (type === 'hero' ? 'https://picsum.photos/1920/600' : undefined),
      buttonPosition: type === 'table' ? 'bottom' : 'right',
      data: type === 'table' ? {
        rows: [
          { cells: ['Metin yazmak için çift tıklayın...', 'Metin yazmak için çift tıklayın...'] },
          { cells: ['Metin yazmak için çift tıklayın...', 'Metin yazmak için çift tıklayın...'] }
        ]
      } : undefined
    };
    setBlocks([...blocks, newBlock]);
    setActiveBlockId(newBlock.id);
  };

  const changeBlockType = (id: string, newType: Block['type']) => {
    updateBlock(id, { type: newType });
  };

  useEffect(() => {
    const updateFormattingState = () => {
      if (activeBlockId) {
        const block = blocks.find(b => b.id === activeBlockId);
        
        // If we are editing a cell, or it's a normal block without table data, use browser command state
        if (editingCell || (block && block.type !== 'table' && !block.data)) {
          setIsBold(document.queryCommandState('bold'));
          setIsItalic(document.queryCommandState('italic'));
          setIsUnderline(document.queryCommandState('underline'));
        } else if ((block?.type === 'table' || block?.data) && selectedCells.length > 0) {
          // If we have selected cells but NOT editing one, check the content of the first selected cell
          const firstCell = selectedCells[0];
          const content = block.data?.rows[firstCell.rowIdx]?.cells[firstCell.cellIdx] || '';
          setIsBold(content.includes('<b>') || content.includes('<strong>'));
          setIsItalic(content.includes('<i>') || content.includes('<em>'));
          setIsUnderline(content.includes('<u>'));
        }
      } else {
        setIsBold(false);
        setIsItalic(false);
        setIsUnderline(false);
      }
    };

    document.addEventListener('selectionchange', updateFormattingState);
    // Also update when selectedCells or activeBlockId changes
    updateFormattingState();
    
    return () => document.removeEventListener('selectionchange', updateFormattingState);
  }, [activeBlockId, blocks, selectedCells, editingCell]);

  const execCommand = (command: string, value: string = '') => {
    if (selectedCells.length > 0 && activeBlockId && !editingCell) {
      const block = blocks.find(b => b.id === activeBlockId);
      if (block?.type === 'table' || block?.data) {
        updateSelectedTableCells((content) => {
          return applyFormattingToHtml(content, command, value);
        });
        // Update state immediately after command
        setTimeout(() => {
          const updatedBlock = blocks.find(b => b.id === activeBlockId);
          if ((updatedBlock?.type === 'table' || updatedBlock?.data) && selectedCells.length > 0) {
            const firstCell = selectedCells[0];
            const content = updatedBlock.data?.rows[firstCell.rowIdx]?.cells[firstCell.cellIdx] || '';
            setIsBold(content.includes('<b>') || content.includes('<strong>'));
            setIsItalic(content.includes('<i>') || content.includes('<em>'));
            setIsUnderline(content.includes('<u>'));
          }
        }, 0);
        return;
      }
    }

    if (command === 'foreColor') {
      document.execCommand('styleWithCSS', false, 'true');
    }
    document.execCommand(command, false, value);
    if (command === 'foreColor') {
      document.execCommand('styleWithCSS', false, 'false');
    }
    
    // Update state immediately after command
    setIsBold(document.queryCommandState('bold'));
    setIsItalic(document.queryCommandState('italic'));
    setIsUnderline(document.queryCommandState('underline'));
  };

  const handleMergeCells = (block: Block) => {
    if (selectedCells.length < 2) return;
    const minRow = Math.min(...selectedCells.map(c => c.rowIdx));
    const maxRow = Math.max(...selectedCells.map(c => c.rowIdx));
    const minCell = Math.min(...selectedCells.map(c => c.cellIdx));
    const maxCell = Math.max(...selectedCells.map(c => c.cellIdx));
    
    const newMergedCell = { startRow: minRow, startCol: minCell, endRow: maxRow, endCol: maxCell };
    const mergedCells = [...(block.data?.mergedCells || []), newMergedCell];
    
    updateBlock(block.id, { data: { ...block.data!, mergedCells } });
    setSelectedCells([]);
  };

  const handleSplitCells = (block: Block) => {
    if (selectedCells.length === 0) return;
    const mergedCells = (block.data?.mergedCells || []).filter(m => 
      !selectedCells.some(s => s.rowIdx >= m.startRow && s.rowIdx <= m.endRow && s.cellIdx >= m.startCol && s.cellIdx <= m.endCol)
    );
    
    updateBlock(block.id, { data: { ...block.data!, mergedCells } });
    setSelectedCells([]);
  };

  const updateBlock = (id: string, updates: Partial<Block>) => {
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, ...updates } : b));
  };

  const updateTableCell = (blockId: string, rowIndex: number, colIndex: number, newValue: string) => {
    setBlocks(prevBlocks => prevBlocks.map(block => {
      if (block.id === blockId && (block.type === 'table' || block.data) && block.data) {
        const newData = { ...block.data };
        const newRows = [...newData.rows];
        newRows[rowIndex] = {
          ...newRows[rowIndex],
          cells: [...newRows[rowIndex].cells]
        };
        newRows[rowIndex].cells[colIndex] = newValue;
        return { ...block, data: { ...newData, rows: newRows } };
      }
      return block;
    }));
  };

  const updateSelectedTableCells = (transform: (content: string) => string) => {
    if (!activeBlockId) return;
    const targets = selectedCells.length > 0 ? selectedCells : (editingCell ? [editingCell] : []);
    if (targets.length === 0) return;
    
    setBlocks(prev => prev.map(b => {
      if (b.id === activeBlockId && (b.type === 'table' || b.data) && b.data) {
        const newRows = b.data.rows.map((r, rIdx) => ({
          cells: r.cells.map((c, cIdx) => {
            if (targets.some(sc => sc.rowIdx === rIdx && sc.cellIdx === cIdx)) {
              return transform(c);
            }
            return c;
          })
        }));
        return { ...b, data: { ...b.data, rows: newRows } };
      }
      return b;
    }));
  };

  const applyAlignmentToCell = (html: string, alignment: string) => {
    let content = html;
    if (content === 'Metin yazmak için çift tıklayın...') {
      content = '';
    }

    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(content || '<div></div>', 'text/html');
      
      const bodyChildren = Array.from(doc.body.childNodes).filter(node => {
        if (node.nodeType === Node.TEXT_NODE && !node.textContent?.trim()) {
          return false;
        }
        return true;
      });
      
      if (bodyChildren.length === 1 && bodyChildren[0].nodeType === Node.ELEMENT_NODE) {
        const element = bodyChildren[0] as HTMLElement;
        const tagName = element.tagName.toLowerCase();
        if (tagName === 'div' || tagName === 'p') {
          element.style.textAlign = alignment;
          return doc.body.innerHTML;
        }
      }
      
      doc.body.querySelectorAll('div, p').forEach(el => {
        if (el instanceof HTMLElement && el.style.textAlign) {
          const text = el.innerHTML;
          el.replaceWith(text);
        }
      });
      
      return `<div style="text-align: ${alignment};">${doc.body.innerHTML}</div>`;
    } catch (error) {
      console.error("Error aligning cell:", error);
    }

    return `<div style="text-align: ${alignment};">${content}</div>`;
  };

  const handleImportTableData = (blockId: string) => {
    if (!importDataText.trim() && !importDataHtml.trim()) return;
    
    let rows: TableRow[] = [];
    let mergedCells: { startRow: number, startCol: number, endRow: number, endCol: number }[] = [];

    const htmlToUse = importDataHtml.includes('<table') ? importDataHtml : importDataText;

    if (htmlToUse.includes('<table')) {
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlToUse, 'text/html');
      const table = doc.querySelector('table');
      
      if (table) {
        // Parse CSS rules from style tags safely
        const styleSheetsMap: Record<string, Record<string, string>> = {};
        const tagStylesMap: Record<string, Record<string, string>> = {};
        
        doc.querySelectorAll('style').forEach(styleTag => {
          const cssText = styleTag.textContent || '';
          // Extract rules using regex: selector { rules }
          const ruleRegex = /([^{]+)\{([^}]+)\}/g;
          let match;
          while ((match = ruleRegex.exec(cssText)) !== null) {
            const selector = match[1].trim();
            const rulesText = match[2].trim();
            
            const rules: Record<string, string> = {};
            rulesText.split(';').forEach(rule => {
              const parts = rule.split(':');
              if (parts.length === 2) {
                const k = parts[0].trim().toLowerCase();
                if (k === 'font-family') return; // Ignore font-family so that we never override site default
                const v = parts[1].trim();
                rules[k] = v;
              }
            });
            
            if (selector.startsWith('.')) {
              // Try parsing classes like .s1, .s2, or grouped
              const classNames = selector.split(',').map(s => s.trim().replace(/^\./, ''));
              classNames.forEach(cls => {
                if (cls) styleSheetsMap[cls] = { ...(styleSheetsMap[cls] || {}), ...rules };
              });
            } else {
              const tagName = selector.toLowerCase();
              tagStylesMap[tagName] = { ...(tagStylesMap[tagName] || {}), ...rules };
            }
          }
        });

        // Use table.rows and row.cells to avoid picking up nested table elements via querySelectorAll
        const tableRows = Array.from(table.rows);
        let maxCols = 0;
        
        // First pass: determine max columns accurately by simulating the grid
        const tempOccupied: boolean[][] = Array.from({ length: tableRows.length }, () => []);
        tableRows.forEach((tr, r) => {
          let c = 0;
          Array.from(tr.cells).forEach(cell => {
            while (tempOccupied[r][c]) c++;
            const rs = parseInt(cell.getAttribute('rowspan') || '1');
            const cs = parseInt(cell.getAttribute('colspan') || '1');
            for (let i = 0; i < rs; i++) {
              if (r + i < tableRows.length) {
                for (let j = 0; j < cs; j++) {
                  tempOccupied[r + i][c + j] = true;
                }
              }
            }
            c += cs;
            maxCols = Math.max(maxCols, c);
          });
        });

        rows = Array.from({ length: tableRows.length }, () => ({ cells: Array(maxCols).fill('') }));
        const occupied = Array.from({ length: tableRows.length }, () => Array(maxCols).fill(false));

        tableRows.forEach((tr, rowIndex) => {
          let colIndex = 0;
          Array.from(tr.cells).forEach((td) => {
            while (occupied[rowIndex] && occupied[rowIndex][colIndex]) {
              colIndex++;
            }
            if (colIndex >= maxCols) return;

            const rowspan = parseInt(td.getAttribute('rowspan') || '1');
            const colspan = parseInt(td.getAttribute('colspan') || '1');
            
            // Strip any font-family overrides from td and all nested elements so they fall back to the site's default premium typography
            (td as HTMLElement).querySelectorAll('*').forEach((el) => {
              const htmlEl = el as HTMLElement;
              if (htmlEl.style) {
                htmlEl.style.fontFamily = '';
              }
              if (htmlEl.tagName.toLowerCase() === 'font') {
                htmlEl.removeAttribute('face');
              }
            });
            (td as HTMLElement).style.fontFamily = '';

            let content = td.innerHTML;
            const style = (td as HTMLElement).style;
            
            // Extract styles from td
            let color = style?.color || '';
            let backgroundColor = style?.backgroundColor || '';
            let fontWeight = style?.fontWeight || '';
            let textAlign = style?.textAlign || td.getAttribute('align') || '';
            let verticalAlign = style?.verticalAlign || td.getAttribute('valign') || '';
            let fontSize = style?.fontSize || '';
            
            // Fallback to tag styles in parsed stylesheet
            const tagDefault = tagStylesMap[td.tagName.toLowerCase()];
            if (tagDefault) {
              if (!color && tagDefault['color']) color = tagDefault['color'];
              if (!backgroundColor && tagDefault['background-color']) backgroundColor = tagDefault['background-color'];
              if (!fontWeight && tagDefault['font-weight']) fontWeight = tagDefault['font-weight'];
              if (!textAlign && tagDefault['text-align']) textAlign = tagDefault['text-align'];
              if (!verticalAlign && tagDefault['vertical-align']) verticalAlign = tagDefault['vertical-align'];
              if (!fontSize && tagDefault['font-size']) fontSize = tagDefault['font-size'];
            }

            // Fallback to class styles in parsed stylesheet
            const classes = td.className ? td.className.split(/\s+/) : [];
            classes.forEach(cls => {
              const classRule = styleSheetsMap[cls];
              if (classRule) {
                if (!color && classRule['color']) color = classRule['color'];
                if (!backgroundColor && classRule['background-color']) backgroundColor = classRule['background-color'];
                if (!fontWeight && classRule['font-weight']) fontWeight = classRule['font-weight'];
                if (!textAlign && classRule['text-align']) textAlign = classRule['text-align'];
                if (!verticalAlign && classRule['vertical-align']) verticalAlign = classRule['vertical-align'];
                if (!fontSize && classRule['font-size']) fontSize = classRule['font-size'];
              }
            });

            // Check if the resolved text color is a default dark/black representation
            let isDefaultDarkColor = false;
            if (color) {
              const normColor = color.trim().toLowerCase().replace(/\s+/g, '');
              if (
                normColor === '' ||
                normColor === 'inherit' ||
                normColor === '#000' ||
                normColor === '#000000' ||
                normColor === 'black' ||
                normColor === 'rgb(0,0,0)' ||
                normColor === 'rgba(0,0,0,1)' ||
                normColor === 'rgb(17,17,17)' || 
                normColor === '#111111' ||
                normColor === '#222222' ||
                normColor === 'rgb(34,34,34)' ||
                normColor === '#1d1d1f' ||
                normColor === 'rgb(29,29,31)' ||
                normColor === '#000001'
              ) {
                isDefaultDarkColor = true;
                color = '#000000';
              }
            } else {
              isDefaultDarkColor = true;
            }
            
            const isBold = fontWeight === 'bold' || fontWeight === '700' || td.tagName === 'TH' || td.querySelector('b, strong');
            
            let wrapperStyle = "display: block; width: 100%; min-height: 1.5em;";
            // Default blacks/darks should not output parent wrapper color, letting inner colors cascade/render perfectly
            if (color && !isDefaultDarkColor) {
              wrapperStyle += `color:${color};`;
            }
            if (backgroundColor && backgroundColor !== 'transparent' && backgroundColor !== 'rgba(0,0,0,0)' && backgroundColor !== 'rgba(0, 0, 0, 0)') {
              // Negative margin trick to cover td padding
              wrapperStyle += `background-color:${backgroundColor}; margin: -0.75rem -1rem; padding: 0.75rem 1rem;`;
            }
            if (isBold) wrapperStyle += `font-weight:bold;`;
            if (textAlign) wrapperStyle += `text-align:${textAlign};`;
            if (verticalAlign) wrapperStyle += `vertical-align:${verticalAlign};`;
            if (fontSize) wrapperStyle += `font-size:${fontSize};`;
            
            if (wrapperStyle) {
              content = `<div style="${wrapperStyle}">${content}</div>`;
            }

            rows[rowIndex].cells[colIndex] = content;

            if (rowspan > 1 || colspan > 1) {
              mergedCells.push({
                startRow: rowIndex,
                startCol: colIndex,
                endRow: rowIndex + rowspan - 1,
                endCol: colIndex + colspan - 1
              });
            }

            for (let r = rowIndex; r < rowIndex + rowspan; r++) {
              if (r < tableRows.length) {
                for (let c = colIndex; c < colIndex + colspan; c++) {
                  if (c < maxCols) {
                    occupied[r][c] = true;
                  }
                }
              }
            }
            
            colIndex += colspan;
          });
        });
      }
    }

    if (rows.length === 0 && importDataText.trim()) {
      const lines = importDataText.trim().split('\n');
      rows = lines.map(line => ({
        cells: line.split('\t')
      }));
    }
    
    if (rows.length > 0) {
      const currentBlock = blocks.find(b => b.id === blockId);
      const update: Partial<Block> = {
        data: { rows, mergedCells: mergedCells.length > 0 ? mergedCells : undefined },
        buttonPosition: 'bottom'
      };
      
      // Only change type to 'table' if it's currently an empty text block or already a table
      if (currentBlock?.type === 'text' && (!currentBlock.content || currentBlock.content === 'Metin yazmak için tıklayın...')) {
        update.type = 'table';
      } else if (!currentBlock) {
        update.type = 'table';
      }
      
      updateBlock(blockId, update);
    }
    
    setOpenImportDataBlockId(null);
    setImportDataText('');
    setImportDataHtml('');
  };

  const removeBlock = (id: string) => {
    setBlocks(prev => prev.filter(b => b.id !== id));
  };

  useEffect(() => {
    let changed = false;
    let expectedBg = 'white';
    
    const newBlocks = blocks.map((block) => {
      if (block.background === 'accent' || block.background === 'dark' || block.manualBackground) {
        if (block.background === 'white' || block.background === 'gray') {
          expectedBg = block.background === 'white' ? 'gray' : 'white';
        }
        return block;
      }
      
      if (block.background !== expectedBg) {
        changed = true;
        const updatedBlock = { ...block, background: expectedBg as 'white' | 'gray' };
        expectedBg = expectedBg === 'white' ? 'gray' : 'white';
        return updatedBlock;
      }
      
      expectedBg = expectedBg === 'white' ? 'gray' : 'white';
      return block;
    });
    
    if (changed) {
      setBlocks(newBlocks);
    }
  }, [blocks]);

  const moveBlock = (id: string, direction: 'up' | 'down') => {
    const index = blocks.findIndex(b => b.id === id);
    if (index === -1) return;
    const newBlocks = [...blocks];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex >= 0 && targetIndex < blocks.length) {
      [newBlocks[index], newBlocks[targetIndex]] = [newBlocks[targetIndex], newBlocks[index]];
      setBlocks(newBlocks);
    }
  };

  const openButtonModal = (id: string, index?: number) => {
    setEditingButtonBlockId(id);
    setEditingButtonIndex(index !== undefined ? index : null);
    
    const block = blocks.find(b => b.id === id);
    if (block) {
      const defaultPos = (block.type === 'table' || !!block.data) ? 'bottom' : 'right';
      const position = block.buttonPosition || defaultPos;
      if (block.type === 'button') {
        setDraftButton({ text: block.content || '', link: block.link || '', icon: block.buttonIcon || '', position });
      } else if (index !== undefined && index !== null && block.buttons && block.buttons[index]) {
        setDraftButton({ text: block.buttons[index].text || '', link: block.buttons[index].link || '', icon: block.buttons[index].icon || '', position });
      } else {
        setDraftButton({ text: block.buttonText || '', link: block.buttonLink || '', icon: block.buttonIcon || '', position });
      }
    }
    
    setIsButtonModalOpen(true);
  };

  const closeButtonModal = () => {
    setIsButtonModalOpen(false);
    setEditingButtonBlockId(null);
    setEditingButtonIndex(null);
    setIsIconMenuOpen(false);
    setDraftButton({ text: '', link: '', icon: '', position: 'right' });
  };

  const saveButtonModal = () => {
    if (!editingButtonBlockId) return;
    const block = blocks.find(b => b.id === editingButtonBlockId);
    if (block) {
      const updateData: Partial<Block> = { buttonPosition: draftButton.position };
      if (block.type === 'button') {
        updateBlock(editingButtonBlockId, { ...updateData, content: draftButton.text, link: draftButton.link, buttonIcon: draftButton.icon });
      } else if (editingButtonIndex !== null && block.buttons && block.buttons[editingButtonIndex]) {
        const newButtons = [...block.buttons];
        newButtons[editingButtonIndex] = { ...newButtons[editingButtonIndex], text: draftButton.text, link: draftButton.link, icon: draftButton.icon };
        updateBlock(editingButtonBlockId, { ...updateData, buttons: newButtons });
      } else {
        updateBlock(editingButtonBlockId, { ...updateData, buttonText: draftButton.text, buttonLink: draftButton.link, buttonIcon: draftButton.icon });
      }
    }
    closeButtonModal();
  };

  const renderFormattingToolbar = () => {
    const block = activeBlockId ? blocks.find(b => b.id === activeBlockId) : null;
    const hasTable = block?.type === 'table' || !!block?.data;
    const activeAlignment = (() => {
      if (block && activeNoteIndex !== null && block.notes && block.notes[activeNoteIndex]) {
        return block.notes[activeNoteIndex].alignment || null;
      }
      
      const targetCell = (selectedCells.length > 0) ? selectedCells[0] : (editingCell && activeBlockId === block?.id ? editingCell : null);
      
      if (block && targetCell && block.data) {
        const cell = block.data.rows[targetCell.rowIdx]?.cells[targetCell.cellIdx];
        if (cell) {
          const match = cell.match(/text-align:\s*(left|center|right|justify)/i);
          if (match) return match[1].toLowerCase();
        }
      }
      
      return block?.alignment || null;
    })();

    return (
      <div className="flex flex-row flex-wrap w-full gap-2 relative py-1 md:items-center md:gap-x-4 justify-between">
        {/* Category 1: Insertions */}
        <div className="w-full md:w-auto flex justify-between md:justify-start gap-1 px-2 py-1 md:bg-transparent md:border-none md:shadow-none md:px-0 md:py-0">
          <button onClick={(e) => { e.stopPropagation(); addBlock('text'); }} className="group relative apple-rainbow-hover" title="Metin Blok Ekle">
            <AppleIcon icon={FileText} colorClass="apple-icon-blue" size={14} className="w-7 h-7" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); addBlock('heading'); }} className="group relative apple-rainbow-hover" title="Başlık Ekle">
            <AppleIcon icon={Type} colorClass="apple-icon-purple" size={14} className="w-7 h-7" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); addBlock('table'); }} className="group relative apple-rainbow-hover" title="Tablo Ekle">
            <AppleIcon icon={Table} colorClass="apple-icon-table" size={14} className="w-7 h-7" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); addBlock('note'); }} className="group relative apple-rainbow-hover" title="Not Ekle">
            <AppleIcon icon={Info} colorClass="apple-icon-indigo" size={14} className="w-7 h-7" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); addBlock('button'); }} className="group relative apple-rainbow-hover" title="Buton Ekle">
            <AppleIcon icon={MousePointer2} colorClass="apple-icon-blue" size={14} className="w-7 h-7" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); addBlock('hero'); }} className="group relative apple-rainbow-hover" title="Banner Ekle">
            <AppleIcon icon={Layout} colorClass="apple-icon-yellow" size={14} className="w-7 h-7" />
          </button>
        </div>

        {/* Category 2: Block Actions */}
        <div className="w-[calc(50%-4px)] md:w-auto flex justify-between md:justify-start gap-1 px-2 py-1 md:bg-transparent md:border-none md:shadow-none md:px-0 md:py-0 transition-opacity duration-300">
          <div className="flex items-center gap-0.5 w-full justify-between md:justify-start">
            <button onClick={(e) => { e.stopPropagation(); block && moveBlock(block.id, 'up'); }} className="group relative" title="Üste Taşı">
              <AppleIcon icon={ChevronUp} colorClass="apple-icon-ghost" size={14} className="w-7 h-7" />
            </button>
            <button onClick={(e) => { e.stopPropagation(); block && moveBlock(block.id, 'down'); }} className="group relative" title="Alta Taşı">
              <AppleIcon icon={ChevronDown} colorClass="apple-icon-ghost" size={14} className="w-7 h-7" />
            </button>

            <div className="relative group/color-bar">
              <button onClick={(e) => { e.stopPropagation(); block && setOpenColorMenuBlockId(openColorMenuBlockId === block.id ? null : block.id); }} className="group relative" title="Blok Rengi">
                <AppleIcon icon={Palette} colorClass={openColorMenuBlockId === block?.id ? "apple-icon-blue" : "apple-icon-ghost"} size={14} className="w-7 h-7" />
              </button>
              {openColorMenuBlockId === block?.id && (
                <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-2xl p-1.5 z-[10002] grid grid-cols-2 gap-1 w-max">
                  {(['white', 'gray', 'accent', 'dark'] as const).map(bg => (
                    <button 
                      key={bg} 
                      onClick={(e) => { e.stopPropagation(); updateBlock(block.id, { background: bg, manualBackground: true }); setOpenColorMenuBlockId(null); }} 
                      className="flex items-center justify-center w-8 h-8 hover:bg-gray-50 rounded-lg transition-colors border border-gray-50"
                      title={bg === 'white' ? 'Beyaz' : bg === 'gray' ? 'Gri' : bg === 'accent' ? 'Vurgu' : 'Koyu'}
                    >
                      <div className={`w-5 h-5 rounded-full border border-gray-200 shadow-sm ${bg === 'white' ? 'bg-white' : bg === 'gray' ? 'bg-gray-100' : bg === 'accent' ? 'bg-blue-100' : 'bg-gray-900'}`} />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button onClick={(e) => { e.stopPropagation(); block && removeBlock(block.id); setActiveBlockId(null); }} className="group relative" title="Bloku Sil">
              <AppleIcon icon={Trash2} colorClass="apple-icon-ghost hover:text-red-500 transition-colors" size={14} className="w-7 h-7" />
            </button>
          </div>
        </div>

        {/* Category 3: Text Formatting */}
        <div className="w-[calc(50%-4px)] md:w-auto flex justify-between md:justify-start gap-1 px-2 py-1 md:bg-transparent md:border-none md:shadow-none md:px-0 md:py-0 transition-opacity duration-300">
          <div className="flex items-center gap-0.5 w-full justify-between md:justify-start">
            <button onMouseDown={(e) => { e.preventDefault(); const newVal = !isStickyBold; setIsStickyBold(newVal); execCommand('bold'); }} className="group relative" title="Kalın">
              <AppleIcon icon={Bold} colorClass={isStickyBold ? "apple-icon-blue" : "apple-icon-ghost"} size={14} className="w-7 h-7" />
            </button>
            <button onMouseDown={(e) => { e.preventDefault(); const newVal = !isStickyItalic; setIsStickyItalic(newVal); execCommand('italic'); }} className="group relative" title="İtalik">
              <AppleIcon icon={Italic} colorClass={isStickyItalic ? "apple-icon-blue" : "apple-icon-ghost"} size={14} className="w-7 h-7" />
            </button>
            <button onMouseDown={(e) => { e.preventDefault(); const newVal = !isStickyUnderline; setIsStickyUnderline(newVal); execCommand('underline'); }} className="group relative" title="Altı Çizili">
              <AppleIcon icon={Underline} colorClass={isStickyUnderline ? "apple-icon-blue" : "apple-icon-ghost"} size={14} className="w-7 h-7" />
            </button>
            <div 
              onMouseDown={(e) => { e.preventDefault(); setIsTextColorPaletteOpen(!isTextColorPaletteOpen); }}
              className="group relative cursor-pointer"
              title="Metin Rengi"
              role="button"
              tabIndex={0}
            >
              <AppleIcon 
                icon={Palette} 
                colorClass={(!lastSelectedColor && !isTextColorPaletteOpen) ? "apple-icon-ghost" : ""} 
                size={14} 
                className={`w-7 h-7 ${lastSelectedColor || isTextColorPaletteOpen ? 'text-white' : ''}`} 
                style={(lastSelectedColor || isTextColorPaletteOpen) ? { backgroundColor: lastSelectedColor || '#1f2937' } : {}}
              />
              {isTextColorPaletteOpen && (
                <div 
                  className="absolute top-full right-0 md:left-0 md:right-auto mt-1 grid grid-cols-2 sm:grid-cols-5 gap-1.5 p-1.5 bg-white border border-gray-200 rounded-xl shadow-2xl z-[10002] w-max" 
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  {['', '#A9A9A9', '#4285f4', '#155dfc', '#ea4335', '#34a853', '#fbbc04', '#ff00ff', '#ff6d01', '#9900ff', '#46bdc6'].map((color, idx) => (
                    <button 
                      key={idx}
                      onMouseDown={(e) => { 
                        e.preventDefault(); e.stopPropagation();
                        // Color normalization for browser compatibility
                        let finalColor = color;
                        if (color === '') finalColor = '#000000';
                        
                        setLastSelectedColor(color);
                        execCommand('foreColor', finalColor); 
                        setIsTextColorPaletteOpen(false);
                      }}
                      className="w-5 h-5 rounded-full border border-gray-100 hover:scale-110 active:scale-90 transition-all flex items-center justify-center overflow-hidden shadow-sm"
                      style={{ backgroundColor: color === '' ? '#000000' : color }}
                      title={color === '' ? 'Varsayılan (#000000)' : (color === '#A9A9A9' ? 'Koyu Gri (#A9A9A9)' : color)}
                    >
                      {color === '' && <span className="text-[8px] font-bold text-white">V</span>}
                      {color === '#A9A9A9' && <span className="text-[8px] font-bold text-white">G</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Category 4: Alignments */}
        <div className="w-[calc(50%-4px)] md:w-auto flex justify-between md:justify-start gap-1 px-2 py-1 md:bg-transparent md:border-none md:shadow-none md:px-0 md:py-0 transition-opacity duration-300">
          <div className="flex items-center gap-0.5 w-full justify-between md:justify-start">
            <button 
              onMouseDown={(e) => { 
                e.preventDefault(); 
                if ((selectedCells.length > 0 || editingCell) && activeBlockId) {
                  updateSelectedTableCells(content => applyAlignmentToCell(content, 'left'));
                } else if (block && activeNoteIndex !== null) {
                  const newNotes = [...(block.notes || [])];
                  const currentAlignment = newNotes[activeNoteIndex].alignment;
                  newNotes[activeNoteIndex] = { ...newNotes[activeNoteIndex], alignment: currentAlignment === 'left' ? undefined : 'left' };
                  updateBlock(block.id, { notes: newNotes });
                } else if (block) {
                  updateBlock(block.id, { alignment: 'left' }); 
                }
              }}
              className="group relative"
              title="Sola Yasla"
            >
              <AppleIcon icon={AlignLeft} colorClass={activeAlignment === 'left' ? "apple-icon-blue" : "apple-icon-ghost"} size={14} className="w-7 h-7" />
            </button>
            <button 
              onMouseDown={(e) => { 
                e.preventDefault(); 
                if ((selectedCells.length > 0 || editingCell) && activeBlockId) {
                  updateSelectedTableCells(content => applyAlignmentToCell(content, 'center'));
                } else if (block && activeNoteIndex !== null) {
                  const newNotes = [...(block.notes || [])];
                  const currentAlignment = newNotes[activeNoteIndex].alignment;
                  newNotes[activeNoteIndex] = { ...newNotes[activeNoteIndex], alignment: currentAlignment === 'center' ? undefined : 'center' };
                  updateBlock(block.id, { notes: newNotes });
                } else if (block) {
                  updateBlock(block.id, { alignment: 'center' }); 
                }
              }}
              className="group relative"
              title="Ortala"
            >
              <AppleIcon icon={AlignCenter} colorClass={activeAlignment === 'center' ? "apple-icon-blue" : "apple-icon-ghost"} size={14} className="w-7 h-7" />
            </button>
            <button 
              onMouseDown={(e) => { 
                e.preventDefault(); 
                if ((selectedCells.length > 0 || editingCell) && activeBlockId) {
                  updateSelectedTableCells(content => applyAlignmentToCell(content, 'right'));
                } else if (block && activeNoteIndex !== null) {
                  const newNotes = [...(block.notes || [])];
                  const currentAlignment = newNotes[activeNoteIndex].alignment;
                  newNotes[activeNoteIndex] = { ...newNotes[activeNoteIndex], alignment: currentAlignment === 'right' ? undefined : 'right' };
                  updateBlock(block.id, { notes: newNotes });
                } else if (block) {
                  updateBlock(block.id, { alignment: 'right' }); 
                }
              }}
              className="group relative"
              title="Sağa Yasla"
            >
              <AppleIcon icon={AlignRight} colorClass={activeAlignment === 'right' ? "apple-icon-blue" : "apple-icon-ghost"} size={14} className="w-7 h-7" />
            </button>
            <button 
              onMouseDown={(e) => { 
                e.preventDefault(); 
                if ((selectedCells.length > 0 || editingCell) && activeBlockId) {
                  updateSelectedTableCells(content => applyAlignmentToCell(content, 'justify'));
                } else if (block && activeNoteIndex !== null) {
                  const newNotes = [...(block.notes || [])];
                  const currentAlignment = newNotes[activeNoteIndex].alignment;
                  newNotes[activeNoteIndex] = { ...newNotes[activeNoteIndex], alignment: currentAlignment === 'justify' ? undefined : 'justify' };
                  updateBlock(block.id, { notes: newNotes });
                } else if (block) {
                  updateBlock(block.id, { alignment: 'justify' }); 
                }
              }}
              className="group relative"
              title="İki Yana Yasla"
            >
              <AppleIcon icon={AlignJustify} colorClass={activeAlignment === 'justify' ? "apple-icon-blue" : "apple-icon-ghost"} size={14} className="w-7 h-7" />
            </button>
          </div>
        </div>

        {/* Category 5: Table Operations */}
        <div className="w-[calc(50%-4px)] md:w-auto flex justify-between md:justify-start gap-1 px-2 py-1 md:bg-transparent md:border-none md:shadow-none md:px-0 md:py-0 transition-opacity duration-300">
          <div className="flex items-center gap-0.5 w-full justify-between md:justify-start">
            <button 
              onMouseDown={(e) => { e.preventDefault(); block && handleMergeCells(block); }} 
              className="group relative transition-all duration-300" 
              title="Hücre Birleştir"
            >
              <AppleIcon icon={TableCellsMerge} colorClass="apple-icon-ghost" size={14} className="w-7 h-7" />
            </button>
            <button 
              onMouseDown={(e) => { e.preventDefault(); block && handleSplitCells(block); }} 
              className="group relative transition-all duration-300" 
              title="Hücre Böl"
            >
              <AppleIcon icon={TableCellsSplit} colorClass="apple-icon-ghost" size={14} className="w-7 h-7" />
            </button>
            
            <button 
              onClick={(e) => { e.stopPropagation(); block && setOpenImportDataBlockId(block.id); }} 
              className="group relative transition-all duration-300" 
              title="Veri Aktar"
            >
              <AppleIcon icon={Download} colorClass={openImportDataBlockId === block?.id ? "apple-icon-blue" : "apple-icon-ghost"} size={14} className="w-7 h-7" />
            </button>

            <button 
              onClick={(e) => { e.stopPropagation(); block && updateBlock(block.id, { tableTransparent: !block.tableTransparent }); }} 
              className="group relative transition-all duration-300" 
              title="Şeffaf Tablo Toggle"
            >
              <AppleIcon icon={Square} colorClass={block?.tableTransparent ? 'apple-icon-blue' : 'apple-icon-ghost'} size={14} className="w-7 h-7" />
            </button>
          </div>
        </div>

        {/* Category 6: Table Alignment */}
        <div className="w-[calc(50%-4px)] md:w-auto flex justify-between md:justify-start gap-1 px-2 py-1 md:bg-transparent md:border-none md:shadow-none md:px-0 md:py-0 transition-opacity duration-300">
          <div className="flex items-center gap-0.5 w-full justify-between md:justify-start">
            <button 
              onClick={(e) => { e.stopPropagation(); block && updateBlock(block.id, { tableAlignment: 'left' }); }}
              className="group relative transition-all duration-300"
              title="Tablo Sola Yasla"
            >
              <AppleIcon icon={PanelLeftClose} colorClass={block?.tableAlignment === 'left' ? "apple-icon-blue" : "apple-icon-ghost"} size={14} className="w-7 h-7" />
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); block && updateBlock(block.id, { tableAlignment: 'full' }); }}
              className="group relative transition-all duration-300"
              title="Tablo Tam Boyut"
            >
              <AppleIcon icon={InspectionPanel} colorClass={(block?.tableAlignment === 'full' || !block?.tableAlignment) ? "apple-icon-blue" : "apple-icon-ghost"} size={14} className="w-7 h-7" />
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); block && updateBlock(block.id, { tableAlignment: 'right' }); }}
              className="group relative transition-all duration-300"
              title="Tablo Sağa Yasla"
            >
              <AppleIcon icon={PanelRightClose} colorClass={block?.tableAlignment === 'right' ? "apple-icon-blue" : "apple-icon-ghost"} size={14} className="w-7 h-7" />
            </button>
          </div>
        </div>

        {/* Global Action */}
        <div className="w-[calc(50%-4px)] md:w-auto flex justify-end md:justify-start">
          <button 
            onClick={(e) => { 
              e.stopPropagation(); 
              setIsHeaderFullyVisible(true);
              isHeaderFullyVisibleRef.current = true;
              if (headerContainerRef.current) {
                headerContainerRef.current.style.transform = `translate3d(0, 0px, 0)`;
              }
            }} 
            className="group relative transition-all duration-300 p-0 md:bg-transparent md:border-none md:shadow-none w-7 h-7 flex items-center justify-center" 
            title="Üst Menüyü Aç"
          >
            <AppleIcon icon={PanelTop} colorClass={isHeaderFullyVisible ? "apple-icon-green" : "apple-icon-red"} size={14} className="w-7 h-7" />
          </button>
        </div>
      </div>
    );
  };

  const renderBlockToolbar = (block: Block, isFirst: boolean, isLast: boolean) => {
    return null; // Logic moved to formatting toolbar
  };

  const renderTableEditor = (block: Block) => {
    if (!block.data) return null;
    return (
      <div className="relative group/table-wrapper" onClick={(e) => e.stopPropagation()}>
        <div className="w-full overflow-x-auto scrollbar-thin rounded-xl">
          <table className={`min-w-full table-fixed border-collapse border border-gray-300 ${block.tableTransparent ? 'bg-transparent' : 'bg-white'} shadow-sm text-[12pt] font-sans`}>
          <thead>
            <tr className="bg-gray-100">
              {(block.data.rows[0]?.cells || []).map((_, idx) => (
                <th 
                  key={`label-${idx}`} 
                  className={`border border-gray-300 py-1 text-center text-[10px] font-bold text-blue-500 bg-blue-50/30 relative cursor-pointer hover:bg-blue-100/50 transition-colors ${activeBlockId === block.id && selectedCells.some(c => c.cellIdx === idx) ? 'bg-blue-100/80 shadow-inner' : ''} font-sans`}
                  style={{ width: block.data?.columnWidths?.[idx] }}
                  onMouseDown={() => {
                    setActiveBlockId(block.id);
                    const colCells = block.data!.rows.map((_, rIdx) => ({ rowIdx: rIdx, cellIdx: idx }));
                    setSelectedCells(colCells);
                    setStartCell(null);
                  }}
                >
                  <div className="flex items-center justify-center gap-2 font-sans">
                    {idx === 0 && activeBlockId === block.id && selectedCells.some(c => c.cellIdx === 0) && (
                      <div className="flex gap-1">
                        <button
                          onClick={() => {
                            // Set width to fit 3 digits (approx 60px for 12pt font + padding)
                            const newWidth = 60;
                            updateBlock(block.id, { data: { ...block.data!, columnWidths: { ...block.data?.columnWidths, 0: newWidth } } });
                          }}
                          className="hover:bg-blue-100 rounded transition-colors"
                          title="3 Basamak Sığdır"
                        >
                          <AppleIcon icon={Minus} colorClass="apple-icon-blue" size={10} className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => {
                            // Reset to default (equal width)
                            const newWidths = { ...block.data?.columnWidths };
                            delete newWidths[0];
                            updateBlock(block.id, { data: { ...block.data!, columnWidths: newWidths } });
                          }}
                          className="hover:bg-blue-100 rounded transition-colors"
                          title="Sıfırla"
                        >
                          <AppleIcon icon={RotateCcw} colorClass="apple-icon-blue" size={10} className="w-5 h-5" />
                        </button>
                      </div>
                    )}
                    <span>{String.fromCharCode(65 + idx)}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const newRows = block.data!.rows.map(row => {
                          const newCells = [...row.cells];
                          newCells.splice(idx, 1);
                          return { cells: newCells };
                        });
                        updateBlock(block.id, { data: { ...block.data!, rows: newRows } });
                      }}
                      className={`transition-opacity z-10 ${activeBlockId === block.id && selectedCells.some(c => c.cellIdx === idx) ? 'opacity-100' : 'opacity-0'}`}
                      title="Sütunu Sil"
                    >
                      <AppleIcon icon={Trash2} colorClass="apple-icon-red" size={10} className="w-5 h-5" />
                    </button>
                  </div>
                </th>
              ))}
              <th className="w-10 p-0 border border-gray-300 bg-blue-50/30">
                <button
                  onClick={() => {
                    const newRows = block.data!.rows.map(row => ({
                      cells: [...row.cells, '']
                    }));
                    updateBlock(block.id, { data: { ...block.data!, rows: newRows } });
                  }}
                  className="w-full h-full flex items-center justify-center text-blue-500 hover:bg-blue-100 transition-colors"
                  title="Sütun Ekle"
                >
                  <Plus size={14} />
                </button>
              </th>
            </tr>
          </thead>
          <tbody className="font-sans">
            {block.data.rows.map((row, rowIdx) => (
              <tr key={rowIdx} className="hover:bg-gray-50/50 transition-colors relative group/tr">
                {row.cells.map((cell, cellIdx) => {
                  const merged = block.data?.mergedCells?.find(m => 
                    rowIdx >= m.startRow && rowIdx <= m.endRow && 
                    cellIdx >= m.startCol && cellIdx <= m.endCol
                  );
                  
                  if (merged) {
                    if (rowIdx === merged.startRow && cellIdx === merged.startCol) {
                      return (
                        <td 
                          key={cellIdx} 
                          rowSpan={merged.endRow - merged.startRow + 1} 
                          colSpan={merged.endCol - merged.startCol + 1}
                          className={`border border-gray-300 px-4 py-3 text-[#000000] font-sans relative overflow-hidden ${activeBlockId === block.id && selectedCells.some(c => c.rowIdx === rowIdx && c.cellIdx === cellIdx) ? 'bg-blue-100' : ''}`}
                          style={block.data?.cellStyles?.[`${rowIdx}-${cellIdx}`]}
                          onMouseDown={(e) => {
                            if (activeBlockId === block.id && editingCell?.rowIdx === rowIdx && editingCell?.cellIdx === cellIdx) return;
                            setActiveBlockId(block.id);
                            setIsDragging(true);
                            setStartCell({rowIdx, cellIdx});
                            setSelectedCells([{rowIdx, cellIdx}]);
                          }}
                          onDoubleClick={() => setEditingCell({rowIdx, cellIdx})}
                          onMouseEnter={() => {
                            if (activeBlockId === block.id && isDragging && startCell) {
                              const minRow = Math.min(startCell.rowIdx, rowIdx);
                              const maxRow = Math.max(startCell.rowIdx, rowIdx);
                              const minCell = Math.min(startCell.cellIdx, cellIdx);
                              const maxCell = Math.max(startCell.cellIdx, cellIdx);
                              const newSelectedCells = [];
                              for (let r = minRow; r <= maxRow; r++) {
                                for (let c = minCell; c <= maxCell; c++) {
                                  newSelectedCells.push({rowIdx: r, cellIdx: c});
                                }
                              }
                              setSelectedCells(newSelectedCells);
                            }
                          }}
                        >
                          <ContentEditable
                          html={cell === 'Metin yazmak için çift tıklayın...' ? '' : cell}
                          onChange={(html) => updateTableCell(block.id, rowIdx, cellIdx, html)}
                          placeholder="Metin yazmak için çift tıklayın..."
                          className={`w-full bg-transparent border-none focus:outline-none p-0 min-h-[1.5em] font-sans text-${getTableCellAlignment(cell)} ${editingCell?.rowIdx === rowIdx && editingCell?.cellIdx === cellIdx ? 'cursor-text' : 'cursor-default select-none pointer-events-none'}`}
                          style={{ color: block.textColor || '#000000', fontSize: '12pt' }}
                          onFocus={() => {
                            setActiveBlockId(block.id);
                            setEditingCell({rowIdx, cellIdx});
                          }}
                          onBlur={() => setEditingCell(null)}
                          isBold={isStickyBold}
                          isItalic={isStickyItalic}
                          isUnderline={isStickyUnderline}
                          currentColor={lastSelectedColor}
                          />
                        </td>
                      );
                    }
                    return null;
                  }
                  
                  return (
                    <td 
                      key={cellIdx} 
                      className={`border border-gray-300 px-4 py-3 text-[#000000] font-sans relative overflow-hidden ${activeBlockId === block.id && selectedCells.some(c => c.rowIdx === rowIdx && c.cellIdx === cellIdx) ? 'bg-blue-100' : ''}`}
                      style={block.data?.cellStyles?.[`${rowIdx}-${cellIdx}`]}
                      onMouseDown={(e) => {
                        if (activeBlockId === block.id && editingCell?.rowIdx === rowIdx && editingCell?.cellIdx === cellIdx) return;
                        setActiveBlockId(block.id);
                        setIsDragging(true);
                        setStartCell({rowIdx, cellIdx});
                        setSelectedCells([{rowIdx, cellIdx}]);
                      }}
                      onDoubleClick={() => setEditingCell({rowIdx, cellIdx})}
                      onMouseEnter={() => {
                        if (activeBlockId === block.id && isDragging && startCell) {
                          const minRow = Math.min(startCell.rowIdx, rowIdx);
                          const maxRow = Math.max(startCell.rowIdx, rowIdx);
                          const minCell = Math.min(startCell.cellIdx, cellIdx);
                          const maxCell = Math.max(startCell.cellIdx, cellIdx);
                          const newSelectedCells = [];
                          for (let r = minRow; r <= maxRow; r++) {
                            for (let c = minCell; c <= maxCell; c++) {
                              newSelectedCells.push({rowIdx: r, cellIdx: c});
                            }
                          }
                          setSelectedCells(newSelectedCells);
                        }
                      }}
                    >
                      <ContentEditable
                        html={cell === 'Metin yazmak için çift tıklayın...' ? '' : cell}
                        onChange={(html) => updateTableCell(block.id, rowIdx, cellIdx, html)}
                        placeholder="Metin yazmak için çift tıklayın..."
                        className={`w-full bg-transparent border-none focus:outline-none p-0 min-h-[1.5em] font-sans text-${getTableCellAlignment(cell)} ${editingCell?.rowIdx === rowIdx && editingCell?.cellIdx === cellIdx ? 'cursor-text' : 'cursor-default select-none pointer-events-none'}`}
                        style={{ color: block.textColor || '#000000', fontSize: '12pt' }}
                        onFocus={() => {
                          setActiveBlockId(block.id);
                          setEditingCell({rowIdx, cellIdx});
                        }}
                        onBlur={() => setEditingCell(null)}
                        isBold={isStickyBold}
                        isItalic={isStickyItalic}
                        isUnderline={isStickyUnderline}
                        currentColor={lastSelectedColor}
                      />
                    </td>
                  );
                })}
                <td 
                  className={`w-10 p-0 border border-gray-300 bg-blue-50/30 relative cursor-pointer hover:bg-blue-100/50 transition-colors ${activeBlockId === block.id && selectedCells.some(c => c.rowIdx === rowIdx) ? 'bg-blue-100/80 shadow-inner' : ''}`}
                  onMouseDown={() => {
                    setActiveBlockId(block.id);
                    const rowCells = block.data!.rows[rowIdx].cells.map((_, cIdx) => ({ rowIdx: rowIdx, cellIdx: cIdx }));
                    setSelectedCells(rowCells);
                    setStartCell(null);
                  }}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const newRows = block.data!.rows.filter((_, i) => i !== rowIdx);
                      updateBlock(block.id, { data: { ...block.data!, rows: newRows } });
                    }}
                    className={`absolute inset-0 w-full h-full flex items-center justify-center text-red-500 hover:bg-red-100 transition-colors transition-opacity z-10 ${activeBlockId === block.id && selectedCells.some(c => c.rowIdx === rowIdx) ? 'opacity-100' : 'opacity-0'}`}
                    title="Satırı Sil"
                  >
                    <AppleIcon icon={Trash2} colorClass="apple-icon-red" size={10} className="w-5 h-5" />
                  </button>
                </td>
              </tr>
            ))}
            <tr>
              <td colSpan={(block.data.rows[0]?.cells.length || 0)} className="p-0 border-none">
                <button
                  onClick={() => {
                    const newRows = [...(block.data?.rows || []), { cells: Array(block.data?.rows[0]?.cells.length || 0).fill('Metin yazmak için çift tıklayın...') }];
                    updateBlock(block.id, { data: { ...block.data!, rows: newRows } });
                  }}
                  className="w-full py-2 flex items-center justify-center text-blue-500 hover:bg-blue-50 transition-colors text-sm font-medium gap-1"
                >
                  <Plus size={16} /> Satır Ekle
                </button>
              </td>
              <td className="w-10 p-0 border border-gray-300 bg-blue-50/30 group/td relative">
                <button
                  onClick={() => {
                    if (block.type === 'table') {
                      removeBlock(block.id);
                      setActiveBlockId(null);
                    } else {
                      updateBlock(block.id, { data: undefined });
                    }
                  }}
                  className="absolute inset-0 w-full h-full flex items-center justify-center text-red-500 hover:bg-red-100 transition-colors opacity-0 group-hover/td:opacity-100 transition-opacity z-10"
                  title="Tabloyu Sil"
                >
                  <AppleIcon icon={Trash2} colorClass="apple-icon-red" size={10} className="w-5 h-5" />
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

  const renderNotesEditor = (block: Block) => {
    if (!block.notes || block.notes.length === 0) return null;
    return (
      <div className="space-y-4">
        {block.notes.map((note, nIdx) => (
          <div key={nIdx} className="flex items-start gap-3 group/note relative">
            <div className="shrink-0 text-gray-400 mt-0.5 select-none">
              <Info size={16} className="mt-[2px]" />
            </div>
            <div className="flex-1">
              <ContentEditable 
                html={note.text === 'Metin yazmak için tıklayın...' ? '' : note.text}
                onChange={(html) => {
                  const newNotes = [...(block.notes || [])];
                  newNotes[nIdx] = { ...newNotes[nIdx], text: html };
                  updateBlock(block.id, { notes: newNotes });
                }}
                placeholder="Metin yazmak için tıklayın..."
                className={`w-full min-h-[1.5em] text-[12pt] leading-relaxed focus:outline-none prose prose-sm prose-p:first:mt-0 prose-p:last:mb-0 max-w-none text-${note.alignment || 'left'} text-[#A9A9A9] ${block.background === 'dark' ? 'prose-invert' : ''}`}
                onFocus={() => { setActiveBlockId(block.id); setActiveNoteIndex(nIdx); setSelectedCells([]); }}
                isBold={isStickyBold}
                isItalic={isStickyItalic}
                isUnderline={isStickyUnderline}
                currentColor={lastSelectedColor}
                style={{ fontSize: '12pt' }}
              />
            </div>
            <button 
              onClick={() => {
                const newNotes = block.notes?.filter((_, i) => i !== nIdx);
                updateBlock(block.id, { notes: newNotes });
              }}
              className="opacity-0 group-hover/note:opacity-100 transition-opacity p-1 hover:bg-red-50 rounded-lg"
              title="Notu Sil"
            >
              <AppleIcon icon={Trash2} colorClass="apple-icon-red" size={10} className="w-5 h-5" />
            </button>
          </div>
        ))}
      </div>
    );
  };

  const renderTablePublic = (block: Block) => {
    if (!block.data) return null;
    const rowCount = block.data.rows.length;
    const colCount = block.data.rows[0]?.cells.length || 0;

    return (
      <div className="w-full overflow-x-auto rounded-2xl border border-gray-200 shadow-sm scrollbar-thin">
        <table className={`min-w-full table-fixed border-separate border-spacing-0 ${block.tableTransparent ? 'bg-transparent' : 'bg-white'} text-[12pt] font-sans`}>
          <colgroup>
            {Array.from({ length: colCount }).map((_, idx) => (
              <col key={idx} style={{ width: block.data?.columnWidths?.[idx] }} />
            ))}
          </colgroup>
          <tbody className="font-sans">
            {block.data.rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.cells.map((cell, colIndex) => {
                  const merged = block.data?.mergedCells?.find(m => 
                    rowIndex >= m.startRow && rowIndex <= m.endRow && 
                    colIndex >= m.startCol && colIndex <= m.endCol
                  );

                  if (merged) {
                    if (rowIndex === merged.startRow && colIndex === merged.startCol) {
                      const isBottomEdge = merged.endRow === rowCount - 1;
                      const isRightEdge = merged.endCol === colCount - 1;
                      return (
                        <td 
                          key={colIndex}
                          rowSpan={merged.endRow - merged.startRow + 1} 
                          colSpan={merged.endCol - merged.startCol + 1}
                          className={`border-gray-200 p-3 min-w-[100px] text-[#000000] text-justify font-sans ${isBottomEdge ? '' : 'border-b'} ${isRightEdge ? '' : 'border-r'}`}
                          style={block.data?.cellStyles?.[`${rowIndex}-${colIndex}`]}
                          dangerouslySetInnerHTML={{ __html: cell }}
                        />
                      );
                    }
                    return null;
                  }

                  const isBottomEdge = rowIndex === rowCount - 1;
                  const isRightEdge = colIndex === colCount - 1;
                  return (
                    <td 
                      key={colIndex}
                      className={`border-gray-200 p-3 min-w-[100px] text-[#000000] text-justify font-sans ${isBottomEdge ? '' : 'border-b'} ${isRightEdge ? '' : 'border-r'}`}
                      style={block.data?.cellStyles?.[`${rowIndex}-${colIndex}`]}
                      dangerouslySetInnerHTML={{ __html: cell }}
                    />
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderNotesPublic = (block: Block) => {
    if (!block.notes || block.notes.length === 0) return null;
    return (
      <div className="space-y-3">
        {block.notes.map((note, idx) => (
          <div key={idx} className="flex items-start gap-3 relative">
            <div className="shrink-0 text-gray-400 mt-0.5 select-none">
              <Info size={16} className="mt-[2px]" />
            </div>
            <div className={`flex-1 prose prose-sm prose-p:first:mt-0 prose-p:last:mb-0 max-w-none text-[12pt] font-normal font-sans leading-relaxed text-${note.alignment || 'justify'} text-[#A9A9A9] ${block.background === 'dark' ? 'prose-invert' : ''}`}>
              {note.link ? (
                <a 
                  href={note.link} 
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`text-[#A9A9A9] hover:text-[#888888] hover:underline transition-colors`}
                  dangerouslySetInnerHTML={{ __html: note.text }}
                />
              ) : (
                <div dangerouslySetInnerHTML={{ __html: note.text }} />
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderTextEditor = (block: Block) => {
    const isTable = block.type === 'table';
    const isEmpty = !block.content || block.content === '' || block.content === 'Metin yazmak için tıklayın...';
    
    if (isTable && isEmpty) return null;

    return (
      <ContentEditable
        html={(block.content || '') === 'Metin yazmak için tıklayın...' ? '' : (block.content || '')}
        onChange={(html) => {
          updateBlock(block.id, { content: html });
        }}
        placeholder="Metin yazmak için tıklayın..."
        onDoubleClick={(e) => {
          const el = e.currentTarget;
          el.focus();
          const range = document.createRange();
          const sel = window.getSelection();
          range.selectNodeContents(el);
          range.collapse(false);
          sel?.removeAllRanges();
          sel?.addRange(range);
        }}
        className={`w-full min-h-[1.5em] text-[12pt] leading-relaxed focus:outline-none prose prose-sm prose-p:first:mt-0 prose-p:last:mb-0 max-w-none text-${block.alignment || 'justify'} ${block.background === 'dark' ? 'prose-invert' : ''}`}
        style={{ color: block.textColor, fontSize: '12pt' }}
        onFocus={() => { setActiveBlockId(block.id); setActiveNoteIndex(null); setSelectedCells([]); }}
        isBold={isStickyBold}
        isItalic={isStickyItalic}
        isUnderline={isStickyUnderline}
        currentColor={lastSelectedColor}
      />
    );
  };

  const renderTextPublic = (block: Block) => {
    const isTable = block.type === 'table';
    const isEmpty = !block.content || block.content === '' || block.content === 'Metin yazmak için tıklayın...';
    
    if (isEmpty) return null;
    
    return (
      <div 
        className={`prose prose-sm prose-p:first:mt-0 prose-p:last:mb-0 max-w-none text-${block.alignment || 'justify'} ${block.background === 'dark' ? 'prose-invert' : ''} text-[12pt] leading-relaxed`} 
        style={{ color: block.textColor, fontSize: '12pt' }}
        dangerouslySetInnerHTML={{ 
          __html: block.content
        }} 
      />
    );
  };

  const renderButtonsEditor = (block: Block) => {
    if (!((block.buttons && block.buttons.length > 0) || block.hasButton)) return null;
    const isBottom = block.buttonPosition === 'bottom' || (block.buttonPosition === undefined && (block.type === 'table' || !!block.data));
    const alignment = block.alignment || 'center';
    
    return (
      <div className={isBottom 
        ? `flex flex-wrap justify-center gap-4 py-2` 
        : `flex flex-col md:flex-col flex-wrap items-center md:items-start justify-center md:justify-start gap-4 md:gap-2 shrink-0`}>
        {block.hasButton && (
          <div 
            className={`sites-button-small cursor-pointer group ${getButtonColorClass(block.buttonIcon)} ${!isBottom ? 'sites-button-side' : ''}`}
            onDoubleClick={(e) => {
              e.stopPropagation();
              openButtonModal(block.id);
            }}>
            {renderButtonIcon(block.buttonIcon)}
            <span className="transition-all duration-200 hidden md:inline">{block.buttonText || 'İncele'}</span>
          </div>
        )}
        {block.buttons?.map((btn, idx) => (
          <div 
            key={idx}
            className={`sites-button-small cursor-pointer group ${getButtonColorClass(btn.icon)} ${!isBottom ? 'sites-button-side' : ''}`}
            onDoubleClick={(e) => {
              e.stopPropagation();
              openButtonModal(block.id, idx);
            }}>
            {renderButtonIcon(btn.icon)}
            <span className="transition-all duration-200 hidden md:inline">{btn.text}</span>
          </div>
        ))}
      </div>
    );
  };

  const renderButtonsPublic = (block: Block) => {
    if (!((block.buttons && block.buttons.length > 0) || block.hasButton)) return null;
    const isBottom = block.buttonPosition === 'bottom' || (block.buttonPosition === undefined && (block.type === 'table' || !!block.data));
    const alignment = block.alignment || 'center';
    
    return (
      <div className={isBottom 
        ? `flex flex-wrap justify-center gap-4 py-2` 
        : `flex flex-row md:flex-col flex-wrap items-center md:items-start justify-center md:justify-start gap-4 md:gap-2 shrink-0 mt-4 md:mt-1`}>
        {block.hasButton && (
          <a 
            href={block.buttonLink} 
            target="_blank"
            rel="noopener noreferrer"
            className={`sites-button-small group ${getButtonColorClass(block.buttonIcon)} ${!isBottom ? 'sites-button-side' : ''}`}>
            {renderButtonIcon(block.buttonIcon)}
            <span className="transition-all duration-200 hidden md:inline">{block.buttonText || 'İncele'}</span>
          </a>
        )}
        {block.buttons?.map((btn, idx) => (
          <a 
            key={idx}
            href={btn.link} 
            target="_blank"
            rel="noopener noreferrer"
            className={`sites-button-small group ${getButtonColorClass(btn.icon)} ${!isBottom ? 'sites-button-side' : ''}`}>
            {renderButtonIcon(btn.icon)}
            <span className="transition-all duration-200 hidden md:inline">{btn.text}</span>
          </a>
        ))}
      </div>
    );
  };

  const createNewDraft = () => {
    // Find next available "Adsız Blog x" number
    const baseTitle = "Adsız Blog";
    let nextNum = 1;
    
    const adsizNumbers = blogs
      .map(b => {
        const match = b.title.match(/^Adsız Blog (\d+)$/);
        return match ? parseInt(match[1]) : null;
      })
      .filter((n): n is number => n !== null)
      .sort((a, b) => a - b);

    for (const num of adsizNumbers) {
      if (num === nextNum) {
        nextNum++;
      } else if (num > nextNum) {
        break;
      }
    }

    const slug = `adsiz-blog-${nextNum}`;
    const newBlog: Blog = {
      id: slug,
      title: `${baseTitle} ${nextNum}`,
      content: JSON.stringify([{ id: '1', type: 'text', content: 'Metin yazmak için tıklayın...', alignment: 'justify' }]),
      status: 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    setEditingBlog(newBlog);
    pendingNewBlogRef.current = newBlog;
    navigate(`/edit/${slug}`);
  };

  const isSavingRef = useRef(false);
  const pendingNewBlogRef = useRef<Blog | null>(null);


  const saveBlogToFirebase = async (blogToSave: Blog, status: 'draft' | 'published', skipNavigate: boolean = false) => {
    try {
      if (!currentUser) {
        setNotification({ message: 'Lütfen önce giriş yapın.', type: 'error' });
        return;
      }

      isSavingRef.current = true;
      console.log('Blog kaydediliyor...', { status, email: currentUser.email });
      
      const blogId = blogToSave.id && !blogToSave.id.startsWith('new-') ? blogToSave.id : null;
      
      const payload = {
        title: blogToSave.title || 'Adsız Blog',
        content: blocks.length > 0 ? JSON.stringify(blocks) : blogToSave.content || '[]',
        status,
        authorEmail: currentUser.email,
        updatedAt: new Date().toISOString()
      };

      const id = await saveBlog(blogId, payload);
      
      setNotification({ message: status === 'published' ? 'Blog başarıyla yayınlandı' : 'Taslak kaydedildi', type: 'success' });
      
      // Update local state with the new data from Firebase
      setEditingBlog({ 
        ...blogToSave, 
        id: id, 
        status, 
        content: payload.content 
      });
      
      const currentPath = window.location.pathname;
      const targetPath = `/edit/${id}`;
      
      if (!skipNavigate && currentPath !== targetPath) {
        // Use replaceState if we just renamed it, to keep history clean and avoid jumps
        window.history.replaceState({}, '', targetPath);
        handleLocation(id);
      }
      
      isSavingRef.current = false;
      return id;
    } catch (error: any) {
      isSavingRef.current = false;
      console.error('Error saving blog:', error);
      let errorMsg = 'Kaydedilirken bir hata oluştu';
      if (error.message?.includes('permission-denied')) {
        errorMsg = 'Yazma yetkiniz yok. Lütfen admin hesabınızla giriş yaptığınızdan emin olun.';
      }
      setNotification({ message: errorMsg, type: 'error' });
    }
  };

  const deleteBlog = async (id: string) => {
    // Iframe içinde confirm bazen sorun çıkarabildiği için geçici olarak kaldırdık veya özel modal eklenebilir
    try {
      await deleteBlogFromFirebase(id);
      setNotification({ message: 'Yazı silindi', type: 'success' });
      if (editingBlog?.id === id) setEditingBlog(null);
      if (viewingBlog?.id === id) navigate('/');
    } catch (error) {
      console.error('Error deleting blog:', error);
      setNotification({ message: 'Silinirken bir hata oluştu', type: 'error' });
    }
  };

  const publishedBlogs = blogs.filter(b => b.status === 'published');
  const draftBlogs = blogs.filter(b => b.status === 'draft');

  const renderBlockContent = (block: Block, mainContent: React.ReactNode, isEditor: boolean) => {
    const table = isEditor ? renderTableEditor(block) : renderTablePublic(block);
    const notes = isEditor ? renderNotesEditor(block) : renderNotesPublic(block);
    const legacyNote = block.hasNote && block.noteContent && (
      <div className="flex items-start gap-3 relative">
        <div className="shrink-0 text-gray-400 mt-0.5 select-none">
          <Info size={16} className="mt-[2px]" />
        </div>
        {isEditor ? (
          <div className="flex-1">
            <ContentEditable 
              html={(block.noteContent || '') === 'Metin yazmak için tıklayın...' ? '' : (block.noteContent || '')}
              onChange={(html) => {
                updateBlock(block.id, { noteContent: html });
              }}
              placeholder="Metin yazmak için tıklayın..."
              className={`w-full min-h-[1.5em] text-[12pt] leading-relaxed focus:outline-none prose prose-sm prose-p:first:mt-0 prose-p:last:mb-0 max-w-none text-${block.alignment || 'justify'} text-[#A9A9A9] ${block.background === 'dark' ? 'prose-invert' : ''}`}
              style={{ fontSize: '12pt' }}
              onFocus={() => { setActiveBlockId(block.id); setActiveNoteIndex(null); setSelectedCells([]); }}
              isBold={isStickyBold}
              isItalic={isStickyItalic}
              isUnderline={isStickyUnderline}
              currentColor={lastSelectedColor}
            />
          </div>
        ) : (
          <div className={`flex-1 prose prose-sm prose-p:first:mt-0 prose-p:last:mb-0 max-w-none text-[12pt] font-normal font-sans leading-relaxed text-${block.alignment || 'justify'} text-[#A9A9A9] ${block.background === 'dark' ? 'prose-invert' : ''}`} dangerouslySetInnerHTML={{ __html: block.noteContent }} />
        )}
      </div>
    );

    if (block.tableAlignment === 'left' || block.tableAlignment === 'right') {
      const isLeft = block.tableAlignment === 'left';
      return (
        <div className="flex flex-col md:flex-row gap-8 items-start w-full">
          {isLeft ? (
            <>
              <div className="w-full md:w-1/2 overflow-hidden">{table}</div>
              <div className="w-full md:w-1/2 space-y-6">
                {mainContent}
                {legacyNote}
                {notes}
              </div>
            </>
          ) : (
            <>
              <div className="w-full md:w-1/2 space-y-6">
                {mainContent}
                {legacyNote}
                {notes}
              </div>
              <div className="w-full md:w-1/2 overflow-hidden">{table}</div>
            </>
          )}
        </div>
      );
    }

    return (
      <div className="space-y-6 w-full">
        {mainContent}
        {legacyNote}
        {block.type === 'table' ? (
          <>
            {table}
            {notes}
          </>
        ) : (
          <>
            {notes}
            {table}
          </>
        )}
      </div>
    );
  };

  const renderBlocks = (content: string | Block[]) => {
    try {
      const parsed = typeof content === 'string' ? JSON.parse(content) : content;
      if (Array.isArray(parsed)) {
        return parsed.map((block: Block) => {
          const bgClass = block.background === 'gray' ? 'bg-gray-50 text-gray-900 theme-text-gray' : (block.background === 'accent' ? 'bg-blue-50 text-blue-900 theme-text-accent' : (block.background === 'dark' ? 'bg-gray-900 text-white theme-text-white' : 'bg-white text-gray-900 theme-text-gray'));
          
          if (block.type === 'hero') return (
            <div key={block.id} className="relative h-[400px] flex items-center justify-center overflow-hidden">
              <HeroImage src={block.imageUrl!} viewMode={editingBlog ? 'edit' : 'read'} />
              <div className="absolute inset-0 bg-black/40" />
              <div className="relative z-10 text-center text-white px-4 w-full max-w-4xl">
                {renderBlockContent(block, (
                  <h1 className="text-5xl font-bold mb-4 font-sans" style={{ color: block.textColor }}>{block.content}</h1>
                ), false)}
              </div>
            </div>
          );

          if (block.type === 'heading') return (
            <div key={block.id} className={`${bgClass} w-full`}>
              <div className="max-w-4xl mx-auto p-10">
                <div className={block.buttonPosition === 'bottom' ? "flex flex-col gap-6" : "flex flex-col md:flex-row items-stretch md:items-start justify-between gap-6 md:gap-10"}>
                  <div className={`flex-1 min-w-0 ${block.buttonPosition !== 'bottom' && ((block.buttons && block.buttons.length > 0) || block.hasButton) ? 'w-full md:max-w-[630px]' : ''}`}>
                    {renderBlockContent(block, (
                      <h2 className={`text-lg font-bold font-sans tracking-tight text-${block.alignment || 'justify'}`} style={{ color: block.textColor }}>{block.content}</h2>
                    ), false)}
                  </div>
                  {renderButtonsPublic(block)}
                </div>
              </div>
            </div>
          );

          if (block.type === 'divider') return (
            <div key={block.id} className={`w-full bg-white`}>
              <div className="max-w-4xl mx-auto px-4">
                <div className={`h-px w-full my-4 bg-gray-200`} />
              </div>
            </div>
          );

          if (block.type === 'image') return (
            <div key={block.id} className={`${bgClass} w-full`}>
              <div className={`max-w-4xl mx-auto p-10`}>
                <div className={block.buttonPosition === 'bottom' ? "flex flex-col gap-6" : "flex flex-col md:flex-row items-stretch md:items-start gap-6 md:gap-10 w-full"}>
                  <div className={`flex-1 min-w-0 ${block.buttonPosition !== 'bottom' && ((block.buttons && block.buttons.length > 0) || block.hasButton) ? 'w-full md:max-w-[630px]' : ''}`}>
                    {renderBlockContent(block, (
                      <div className={`flex flex-col gap-6 items-${block.alignment === 'center' ? 'center' : (block.alignment === 'right' ? 'end' : 'start')}`}>
                        <img src={block.imageUrl} className="max-w-full rounded-2xl apple-shadow border border-white/20" alt="Content" referrerPolicy="no-referrer" />
                        {block.caption && <p className={`text-[12pt] italic font-medium ${block.background === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>{block.caption}</p>}
                      </div>
                    ), false)}
                  </div>
                  {renderButtonsPublic(block)}
                </div>
              </div>
            </div>
          );

          if (block.type === 'text') return (
            <div key={block.id} className={`${bgClass} w-full border-b border-gray-100/30`}>
              <div className="max-w-4xl mx-auto p-10">
                <div className={block.buttonPosition === 'bottom' ? "flex flex-col gap-6" : "flex flex-col md:flex-row items-stretch md:items-start justify-between gap-6 md:gap-10"}>
                  <div className={`flex-1 min-w-0 ${block.buttonPosition !== 'bottom' && ((block.buttons && block.buttons.length > 0) || block.hasButton) ? 'w-full md:max-w-[630px]' : ''}`}>
                    {renderBlockContent(block, renderTextPublic(block), false)}
                  </div>
                  {renderButtonsPublic(block)}
                </div>
              </div>
            </div>
          );
          if (block.type === 'button') return (
            <div key={block.id} className={`${bgClass} w-full`}>
              <div className={`max-w-4xl mx-auto p-[38px] flex justify-${block.alignment === 'center' ? 'center' : (block.alignment === 'right' ? 'end' : 'start')}`}>
                <a href={block.link} target="_blank" rel="noopener noreferrer" className={`sites-button ${getButtonColorClass(block.buttonIcon)}`}>
                  {renderButtonIcon(block.buttonIcon)}
                  <span className={block.buttonIcon ? "hidden md:inline" : ""}>{block.content}</span>
                </a>
              </div>
            </div>
          );

          if (block.type === 'note') return (
            <div key={block.id} className={`${bgClass} w-full border-b border-gray-100/30`}>
              <div className="max-w-4xl mx-auto p-10">
                <div className={block.buttonPosition === 'bottom' ? "flex flex-col gap-6" : "flex flex-col md:flex-row items-stretch md:items-start justify-between gap-6 md:gap-10"}>
                  <div className={`flex-1 min-w-0 ${block.buttonPosition !== 'bottom' && ((block.buttons && block.buttons.length > 0) || block.hasButton) ? 'w-full md:max-w-[630px]' : ''}`}>
                    {renderBlockContent(block, null, false)}
                  </div>
                  {renderButtonsPublic(block)}
                </div>
              </div>
            </div>
          );
          
          if (block.type === 'table' && block.data) return (
            <div key={block.id} className={`${bgClass} w-full py-10`}>
              <div className="max-w-4xl mx-auto px-10">
                <div className={block.buttonPosition === 'bottom' || block.buttonPosition === undefined ? "flex flex-col gap-8" : "flex flex-col md:flex-row items-start justify-between gap-6 md:gap-10"}>
                  <div className={`flex-1 min-w-0 ${block.buttonPosition === 'right' && ((block.buttons && block.buttons.length > 0) || block.hasButton) ? 'w-full md:max-w-[630px]' : ''}`}>
                    {renderBlockContent(block, renderTextPublic(block), false)}
                  </div>
                  {renderButtonsPublic(block)}
                </div>
              </div>
            </div>
          );
          
          return null;
        });
      }
      const safeContent = typeof content === 'string' ? content : JSON.stringify(content);
      return <div dangerouslySetInnerHTML={{ __html: safeContent }} />;
    } catch (e) {
      const safeContent = typeof content === 'string' ? content : JSON.stringify(content);
      return <div dangerouslySetInnerHTML={{ __html: safeContent }} />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col relative overflow-x-hidden">
      <VibrantWallpaper />

      {/* Viewport-level Scroll Progress Bar */}
      {viewingBlog && !editingBlog && (
        <motion.div 
          className={`fixed left-0 right-0 h-[3px] bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-600 origin-left z-[99] transition-all duration-300 ${
            isHeaderVisible ? 'top-[64px]' : 'top-0'
          }`}
          style={{ scaleX: scrollYProgress }}
        />
      )}
      
      {/* Notification Toast */}
      <AnimatePresence>
        {notification && (
          <div className="fixed top-0 left-0 right-0 flex justify-center z-[200] pointer-events-none">
            <motion.div
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.7}
              onDragEnd={(_, info) => {
                if (Math.abs(info.offset.x) > 80) {
                  setSwipeDirection(info.offset.x > 0 ? 1 : -1);
                  setNotification(null);
                }
              }}
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 16, scale: 1 }}
              exit={{ 
                opacity: 0, 
                scale: 0.9,
                y: -10,
                x: swipeDirection * 200,
                transition: { duration: 0.2 } 
              }}
              className={`pointer-events-auto cursor-grab active:cursor-grabbing min-w-[300px] max-w-[90vw] px-6 py-4 rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] backdrop-blur-xl border flex items-center justify-center gap-3 ${
                notification.type === 'success' 
                  ? 'bg-white/90 border-gray-200/50 text-gray-900' 
                  : 'bg-red-500 border-red-400 text-white'
              }`}
            >
            {notification.type === 'success' ? (
              <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center text-white shrink-0 shadow-sm">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            ) : (
              <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-white shrink-0">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
            )}
            <span className="font-semibold text-[15px] tracking-tight">{notification.message}</span>
            <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-8 h-1 rounded-full bg-gray-300/50" />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Header */}
      {!editingBlog && (
        <header className={`apple-glass border-b border-gray-200/50 z-[70] w-full fixed left-0 right-0 transition-all duration-300 shadow-sm ${isHeaderVisible ? 'top-0' : '-top-16'}`} style={{ willChange: 'transform', height: '64px' }}>
          <main className="w-full max-w-4xl mx-auto px-4 sm:px-0 flex items-center justify-between relative h-[64px]">
            <div 
              className="flex items-center justify-between leading-none h-[42px] w-[896px] max-w-full z-[80]"
            >
              <div 
                className="flex items-center gap-3 cursor-pointer group leading-none h-[42px]"
                onClick={() => { 
                  navigate('/');
                }}
              >
                <svg className="w-[42.7px] h-[40px] drop-shadow-sm mt-[2px]" viewBox="0 0 632 592" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="361" y="78" width="247" height="437" fill="white"/>
                  <path d="M0 59L361 2C361 232.019 361 360.981 361 591L0 534V59Z" className="fill-[#1F7144] group-hover:fill-black transition-colors duration-300"/>
                  <rect x="342" y="515" width="285" height="19" rx="9.5" className="fill-[#1F7144] group-hover:fill-black transition-colors duration-300"/>
                  <rect x="342" y="59" width="285" height="19" rx="9.5" className="fill-[#1F7144] group-hover:fill-black transition-colors duration-300"/>
                  <rect x="475" y="116" width="95" height="57" className="fill-[#1F7144] group-hover:fill-black transition-colors duration-300"/>
                  <rect x="475" y="268" width="95" height="57" className="fill-[#1F7144] group-hover:fill-black transition-colors duration-300"/>
                  <rect x="475" y="420" width="95" height="57" className="fill-[#1F7144] group-hover:fill-black transition-colors duration-300"/>
                  <rect x="475" y="344" width="95" height="57" className="fill-[#1F7144] group-hover:fill-black transition-colors duration-300"/>
                  <rect x="475" y="192" width="95" height="57" className="fill-[#1F7144] group-hover:fill-black transition-colors duration-300"/>
                  <path d="M361 116H456V173H361V116Z" className="fill-[#1F7144] group-hover:fill-black transition-colors duration-300"/>
                  <rect x="361" y="420" width="95" height="57" className="fill-[#1F7144] group-hover:fill-black transition-colors duration-300"/>
                  <path d="M608 68.5C608 63.2533 612.253 59 617.5 59C622.747 59 627 63.2533 627 68.5V524.5C627 529.747 622.747 534 617.5 534C612.253 534 608 529.747 608 524.5V68.5Z" className="fill-[#1F7144] group-hover:fill-black transition-colors duration-300"/>
                  <rect x="266" y="173" width="190" height="247" fill="white"/>
                  <ellipse cx="202" cy="360.5" rx="25" ry="28.5" fill="white"/>
                  <ellipse cx="202" cy="232.5" rx="25" ry="28.5" fill="white"/>
                  <path d="M114 282L266 268V325L114 311V282Z" fill="white"/>
                  <path d="M329.234 192V401H289.223V226.505H266V192H329.234Z" className="fill-[#1F7144] group-hover:fill-black transition-colors duration-300"/>
                  <path d="M386.33 192H420.466C444.155 192 456 204.049 456 228.148V364.524C456 388.841 444.155 401 420.466 401H388.009C364.32 401 352.475 388.841 352.475 364.524V337.577H391.367V358.28C391.367 363.757 393.885 366.495 398.921 366.495H409.554C414.403 366.495 416.828 363.757 416.828 358.28V318.517H386.33C362.641 318.517 350.796 306.468 350.796 282.369V228.148C350.796 204.049 362.641 192 386.33 192ZM397.522 286.313H416.828V234.72C416.828 229.243 414.403 226.505 409.554 226.505H397.522C392.486 226.505 389.968 229.243 389.968 234.72V278.097C389.968 281.165 390.527 283.355 391.647 284.67C392.766 285.765 394.724 286.313 397.522 286.313Z" className="fill-[#1F7144] group-hover:fill-black transition-colors duration-300"/>
                </svg>
                {!viewingBlog && (
                  <h1 className="text-xl font-bold tracking-tight text-[#1F7144] group-hover:text-black transition-colors duration-300 hidden sm:block leading-none">teslimolan.com</h1>
                )}
              </div>

              <nav className="flex items-center gap-1 sm:gap-2">
                {viewingBlog && isAuthenticated && (
                  <button 
                    onClick={() => { 
                      navigate(`/edit/${viewingBlog.id}`);
                    }}
                    className="w-[28px] h-[28px] flex items-center justify-center bg-white text-blue-600 rounded-lg border border-gray-200 shadow-sm hover:bg-gray-50 transition-all duration-300 active:scale-95"
                    title="Düzenle"
                  >
                    <Edit3 size={14} />
                  </button>
                )}
                {isAuthenticated && (
                  <div className="relative admin-menu-container">
                    <button 
                      onClick={() => setIsAdminMenuOpen(!isAdminMenuOpen)}
                      className="flex items-center justify-center gap-1 w-[28px] md:w-[98px] h-[28px] bg-blue-50 text-blue-600 rounded-lg text-xs font-semibold border border-blue-100 hover:bg-blue-100 transition-colors shadow-sm mq-640:shadow-none"
                    >
                      <BadgeCheck size={14} className="text-blue-500" />
                      <span className="hidden md:inline">Admin</span>
                      <ChevronDown size={12} className={`hidden md:block transition-transform duration-200 ${isAdminMenuOpen ? 'rotate-180' : ''}`} />
                    </button>
                    
                    <AnimatePresence>
                      {isAdminMenuOpen && (
                        <div
                          className="absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-xl border border-gray-200/50 overflow-hidden z-[100]"
                        >
                          <div className="p-2 space-y-1">
                            <button
                              onClick={() => {
                                navigate('/edit');
                                setIsAdminMenuOpen(false);
                              }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-xl transition-colors text-left"
                            >
                              <Plus size={16} />
                              Blog Üret
                            </button>
                            <div className="h-px bg-gray-100 mx-2 my-1" />
                            <button
                              onClick={() => {
                                handleLogout();
                                setIsAdminMenuOpen(false);
                              }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-xl transition-colors text-left"
                            >
                              <LogOut size={16} />
                                Çıkış Yap
                            </button>
                          </div>
                        </div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </nav>
            </div>

            {viewingBlog && (
              <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center justify-center text-center px-4 overflow-hidden max-w-[160px] xs:max-w-[200px] sm:max-w-[400px] md:max-w-[600px] h-[64px] cursor-default z-10">
                <h2 className="text-lg font-bold font-sans truncate w-full text-gray-900 transition-all duration-300">
                  {viewingBlog.title}
                </h2>
              </div>
            )}
          </main>
        </header>
      )}

      {editingBlog && (
        <>
          <header 
            ref={headerContainerRef}
            className="fixed top-0 left-0 right-0 z-[60] flex flex-col shadow-sm apple-glass border-b border-gray-200/50"
            style={{ 
              willChange: 'transform'
            }}
          >
            {/* Primary Header */}
            <main 
              ref={primaryHeaderRef}
              className="h-16 flex items-center mx-auto max-w-4xl w-full"
              onClick={() => { setActiveBlockId(null); setSelectedCells([]); }}
            >
              <div 
                className="flex items-center justify-between pointer-events-auto px-4 sm:px-0 w-full"
              >
                <div className="flex items-center gap-3">
                  <button
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      setEditingBlog(null); 
                      navigate('/');
                    }}
                    className="group flex items-center justify-center transition-all duration-300 active:scale-95"
                    title="Ana Sayfa"
                  >
                    <svg className="h-10 w-auto drop-shadow-sm mt-[2px]" viewBox="0 0 632 592" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <rect x="361" y="78" width="247" height="437" fill="white"/>
                      <path d="M0 59L361 2C361 232.019 361 360.981 361 591L0 534V59Z" className="fill-[#1F7144] group-hover:fill-black transition-colors duration-300"/>
                      <rect x="342" y="515" width="285" height="19" rx="9.5" className="fill-[#1F7144] group-hover:fill-black transition-colors duration-300"/>
                      <rect x="342" y="59" width="285" height="19" rx="9.5" className="fill-[#1F7144] group-hover:fill-black transition-colors duration-300"/>
                      <rect x="475" y="116" width="95" height="57" className="fill-[#1F7144] group-hover:fill-black transition-colors duration-300"/>
                      <rect x="475" y="268" width="95" height="57" className="fill-[#1F7144] group-hover:fill-black transition-colors duration-300"/>
                      <rect x="475" y="420" width="95" height="57" className="fill-[#1F7144] group-hover:fill-black transition-colors duration-300"/>
                      <rect x="475" y="344" width="95" height="57" className="fill-[#1F7144] group-hover:fill-black transition-colors duration-300"/>
                      <rect x="475" y="192" width="95" height="57" className="fill-[#1F7144] group-hover:fill-black transition-colors duration-300"/>
                      <path d="M361 116H456V173H361V116Z" className="fill-[#1F7144] group-hover:fill-black transition-colors duration-300"/>
                      <rect x="361" y="420" width="95" height="57" className="fill-[#1F7144] group-hover:fill-black transition-colors duration-300"/>
                      <path d="M608 68.5C608 63.2533 612.253 59 617.5 59C622.747 59 627 63.2533 627 68.5V524.5C627 529.747 622.747 534 617.5 534C612.253 534 608 529.747 608 524.5V68.5Z" className="fill-[#1F7144] group-hover:fill-black transition-colors duration-300"/>
                      <rect x="266" y="173" width="190" height="247" fill="white"/>
                      <ellipse cx="202" cy="360.5" rx="25" ry="28.5" fill="white"/>
                      <ellipse cx="202" cy="232.5" rx="25" ry="28.5" fill="white"/>
                      <path d="M114 282L266 268V325L114 311V282Z" fill="white"/>
                      <path d="M329.234 192V401H289.223V226.505H266V192H329.234Z" className="fill-[#1F7144] group-hover:fill-black transition-colors duration-300"/>
                      <path d="M386.33 192H420.466C444.155 192 456 204.049 456 228.148V364.524C456 388.841 444.155 401 420.466 401H388.009C364.32 401 352.475 388.841 352.475 364.524V337.577H391.367V358.28C391.367 363.757 393.885 366.495 398.921 366.495H409.554C414.403 366.495 416.828 363.757 416.828 358.28V318.517H386.33C362.641 318.517 350.796 306.468 350.796 282.369V228.148C350.796 204.049 362.641 192 386.33 192ZM397.522 286.313H416.828V234.72C416.828 229.243 414.403 226.505 409.554 226.505H397.522C392.486 226.505 389.968 229.243 389.968 234.72V278.097C389.968 281.165 390.527 283.355 391.647 284.67C392.766 285.765 394.724 286.313 397.522 286.313Z" className="fill-[#1F7144] group-hover:fill-black transition-colors duration-300"/>
                    </svg>
                  </button>
                    <button 
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      setEditingBlog(null); 
                      navigate('/edit');
                    }}
                    className="group relative transition-all duration-300 hover:opacity-80 active:scale-95"
                    title="Geri Dön"
                  >
                    <AppleIcon icon={ArrowLeft} colorClass="apple-icon-gray" size={14} className="w-7 h-7" />
                  </button>
                </div>

                <div className="flex-1 flex justify-center px-2 sm:px-4 min-w-0">
                  <input 
                    type="text"
                    placeholder="Başlık..."
                    spellCheck={false}
                    className="text-sm font-bold font-sans border border-gray-200/50 rounded-lg focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none bg-white/50 backdrop-blur-sm text-[#1d1d1f] placeholder:text-gray-400 transition-all px-2 w-full max-w-[449px] flex-shrink"
                    style={{ height: '28px' }}
                    value={editingBlog.title}
                    onChange={(e) => setEditingBlog({ ...editingBlog, title: e.target.value })}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>

                <div className="flex items-center gap-1">
                  <div className="flex items-center gap-1">
                    <button 
                      onMouseDown={(e) => { e.preventDefault(); undo(); }} 
                      className={`group relative transition-all duration-300 hover:opacity-80 active:scale-90 ${historyState.index <= 0 ? 'opacity-30 cursor-not-allowed' : ''}`} 
                      disabled={historyState.index <= 0}
                      title="Geri Al"
                    >
                      <AppleIcon icon={Undo} colorClass={historyState.index <= 0 ? "apple-icon-ghost" : "apple-icon-blue"} size={14} className="w-7 h-7" />
                    </button>
                    <button 
                      onMouseDown={(e) => { e.preventDefault(); redo(); }} 
                      className={`group relative transition-all duration-300 hover:opacity-80 active:scale-90 ${historyState.index >= historyState.stack.length - 1 ? 'opacity-30 cursor-not-allowed' : ''}`} 
                      disabled={historyState.index >= historyState.stack.length - 1}
                      title="Yinele"
                    >
                      <AppleIcon icon={Redo} colorClass={historyState.index >= historyState.stack.length - 1 ? "apple-icon-ghost" : "apple-icon-blue"} size={14} className="w-7 h-7" />
                    </button>
                  </div>
                  
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (editingBlog) {
                          // Save current state as draft silently before transitioning
                          const updatedContent = JSON.stringify(blocks);
                          const initialBlog = { ...editingBlog, content: updatedContent, status: editingBlog.status || 'draft' };
                          
                          // Trigger Firebase save with skipNavigate and get final ID
                          const finalId = await saveBlogToFirebase(initialBlog, (initialBlog.status === 'published' ? 'published' : 'draft'), true);
                          
                          const updatedBlog = { ...initialBlog, id: finalId || initialBlog.id };
                          
                          // Set viewingBlog immediately with latest content string string to match types
                          setViewingBlog(updatedBlog);
                          
                          // Update local blogs list cache
                          setBlogs(prev => {
                            const exists = prev.some(b => b.id === updatedBlog.id);
                            if (exists) {
                              return prev.map(b => b.id === updatedBlog.id ? updatedBlog : b);
                            }
                            return [updatedBlog, ...prev];
                          });

                          setEditingBlog(null);
                          // Now manually navigate to the blog view
                          navigate(`/${updatedBlog.id}`);
                        }
                      }}
                      className="group relative transition-all duration-300 hover:opacity-80 active:scale-95"
                      title="Okuma Modu"
                    >
                      <AppleIcon icon={Eye} colorClass="apple-icon-pink" size={14} className="w-7 h-7" /> 
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); saveBlogToFirebase(editingBlog, 'draft'); }}
                      className="group relative transition-all duration-300 hover:opacity-80 active:scale-95"
                      title="Kaydet"
                    >
                      <AppleIcon icon={Save} colorClass="apple-icon-green" size={14} className="w-7 h-7" /> 
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); saveBlogToFirebase(editingBlog, 'published'); }}
                      className="group relative transition-all duration-300 hover:opacity-80 active:scale-95"
                      title="Yayınla"
                    >
                      <AppleIcon icon={Send} colorClass="apple-icon-blue" size={14} className="w-7 h-7" /> 
                    </button>
                  </div>
                </div>
              </div>
            </main>
            
            {/* New Secondary Toolbar - Persistent layout */}
            <div 
              ref={secondaryHeaderRef}
              className="min-h-[48px] flex items-center py-1 pointer-events-auto mx-auto max-w-4xl w-full"
            >
              <div 
                className="flex items-center flex-wrap px-4 sm:px-0 w-full"
              >
                {renderFormattingToolbar()}
              </div>
            </div>
          </header>
        </>
      )}

      <main className={`flex-1 w-full mx-auto ${!editingBlog ? 'mt-16' : ''} ${editingBlog ? 'pt-0 pb-8' : `max-w-4xl px-4 sm:px-0 py-8`}`}>
          {activeTab === 'home' ? (
            <div
              key="home"
              className={viewingBlog ? "space-y-8" : "space-y-0 text-gray-900"}
            >
              {viewingBlog ? (
                <>
                  <div 
                    className={`relative z-10 rounded-xl overflow-hidden bg-white shadow-sm border border-gray-200 max-w-4xl mx-auto`}
                  >
                    <div className="pb-20 bg-transparent">
                      <div className="space-y-0 text-gray-900">
                        {renderBlocks(editingBlog?.id === viewingBlog.id ? blocks : viewingBlog.content)}
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {isLoading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {[...Array(6)].map((_, i) => <BlogSkeleton key={i} />)}
                    </div>
                  ) : publishedBlogs.length === 0 ? (
                    <div className="bg-white border border-dashed border-gray-300 rounded-xl p-12 text-center">
                      <div className="w-16 h-16 flex items-center justify-center mx-auto mb-4">
                        <AppleIcon icon={Eye} colorClass="apple-icon-gray" size={32} className="w-16 h-16" />
                      </div>
                      <h3 className="text-lg font-medium text-gray-900">Henüz yayınlanmış blog yok</h3>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {publishedBlogs.map(blog => (
                        <article 
                          key={blog.id}
                          className="blogger-card overflow-hidden flex flex-col cursor-pointer group hover:border-blue-300 transition-all"
                          onClick={() => navigate(`/${blog.id}`)}
                        >
                          <div className="h-40 bg-gray-100 relative overflow-hidden">
                            <img 
                              src={getBlogDisplayImage(blog)} 
                              alt={blog.title}
                              className="w-full h-full object-cover opacity-90 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500"
                              referrerPolicy="no-referrer"
                            />
                            {isAuthenticated && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/edit/${blog.id}`);
                                }}
                                className="absolute top-3 right-3 w-[28px] h-[28px] flex items-center justify-center bg-white/90 backdrop-blur-sm rounded-lg shadow-sm text-blue-600 hover:bg-blue-50 transition-all active:scale-90 z-10"
                                title="Düzenle"
                              >
                                <Edit3 size={14} />
                              </button>
                            )}
                          </div>
                          <div className="p-5 flex-1 flex flex-col">
                            <h3 className="text-xl font-bold mb-4 line-clamp-2 font-sans group-hover:text-blue-600 transition-colors">{blog.title}</h3>
                            <div className="flex items-center justify-between mt-auto pt-4 border-t border-gray-100">
                              <div className="flex items-center gap-2 text-[11px] font-medium text-gray-400">
                                <Clock size={12} className="text-gray-300" />
                                {new Date(blog.updatedAt).toLocaleDateString('tr-TR')}
                              </div>
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            <div
              key="create"
            >
              {isAuthLoading ? (
                <div className="min-h-[60vh] flex items-center justify-center">
                  <div className="w-12 h-12 border-4 border-[#1F7144]/20 border-t-[#1F7144] rounded-full animate-spin" />
                </div>
              ) : !isAuthenticated ? (
                <Login onLoginSuccess={handleLoginSuccess} />
              ) : editingBlog ? (
                <div 
                  className="flex items-start bg-transparent h-full min-h-screen relative"
                  onClick={() => { setActiveBlockId(null); setSelectedCells([]); }}
                >
                  <VibrantWallpaper />
                  
                  {/* Editor Area */}
                  <div 
                    ref={editorAreaRef}
                    className="flex-1 min-w-0 px-4 md:px-12 pb-12 relative z-10"
                    style={{ 
                      paddingTop: `${totalHeaderHeight + 10}px`,
                      willChange: 'transform'
                    }}
                    onClick={() => { setActiveBlockId(null); setSelectedCells([]); }}
                  >
                    <div 
                      className="bg-white/90 backdrop-blur-sm shadow-2xl border border-white/40 min-h-[600px] w-full max-w-4xl mx-auto flex flex-col relative pt-0 pb-24 rounded-2xl" 
                      onClick={() => { setActiveBlockId(null); setSelectedCells([]); }}
                    >
                      {blocks.length === 0 && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-300 pointer-events-none">
                          <div className="w-16 h-16 border-2 border-dashed border-gray-200 rounded-full flex items-center justify-center mb-4">
                            <Plus size={24} />
                          </div>
                          <p className="text-sm font-medium">Sayfa Boş</p>
                          <p className="text-xs">Üst menüden içerik eklemeye başlayın</p>
                        </div>
                      )}
                      <div className="flex flex-col flex-1 pl-0">
                        {blocks.map((block, index) => {
                          const bgClass = block.background === 'gray' ? 'bg-gray-50 text-gray-900 theme-text-gray' : (block.background === 'accent' ? 'bg-blue-50 text-blue-900 theme-text-accent' : (block.background === 'dark' ? 'bg-gray-900 text-white theme-text-white' : 'bg-white text-gray-900 theme-text-gray'));
                          const isFirst = index === 0;
                          const isLast = index === blocks.length - 1;
                          
                          return (
                              <div 
                                key={block.id}
                                className={`group relative ${activeBlockId === block.id ? 'active-block-context z-[50]' : 'z-[1]'}`}
                                onClick={(e) => { e.stopPropagation(); setActiveBlockId(block.id); setSelectedCells([]); }}
                              >
                              {/* Block Controls moved to Sidebar */}

                              <div className={`relative z-[50] ${activeBlockId === block.id ? 'ring-2 ring-blue-500 shadow-lg' : ''} ${bgClass} ${isFirst ? 'rounded-t-2xl' : ''} ${isLast ? 'rounded-b-2xl' : ''}`}>
                                <div className="max-w-4xl mx-auto p-[38px] relative z-[10]">
                                {block.type === 'hero' && (
                                  <div className="relative h-[300px] flex items-center justify-center overflow-hidden rounded-lg">
                                    <HeroImage src={block.imageUrl!} viewMode="edit" />
                                    <div className="absolute inset-0 bg-black/40" />
                                    <div className="relative z-10 text-center text-white px-4 w-full">
                                      {renderBlockContent(block, (
                                        <ContentEditable 
                                          html={block.content}
                                          onChange={(html) => updateBlock(block.id, { content: html })}
                                          placeholder="Başlık yazın..."
                                          className="text-4xl font-bold focus:outline-none w-full text-center"
                                          onFocus={() => { setActiveBlockId(block.id); setActiveNoteIndex(null); setSelectedCells([]); }}
                                          isBold={isStickyBold}
                                          isItalic={isStickyItalic}
                                          isUnderline={isStickyUnderline}
                                          currentColor={lastSelectedColor}
                                        />
                                      ), true)}
                                    </div>
                                    {editingImageUrl === block.id ? (
                                      <div className="absolute inset-0 bg-black/60 backdrop-blur-md flex flex-col items-center justify-center p-6 z-30 rounded-2xl">
                                        <div className="w-full max-w-sm space-y-4">
                                          <div className="text-white text-sm font-medium mb-1">Görsel URL veya Drive Linki</div>
                                          <input 
                                            type="text"
                                            placeholder="https://..."
                                            className="w-full bg-white/10 text-white border border-white/20 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 ring-white/30"
                                            value={tempImageUrl}
                                            onChange={(e) => setTempImageUrl(e.target.value)}
                                            autoFocus
                                            onKeyDown={(e) => {
                                              if (e.key === 'Enter') {
                                                if (tempImageUrl) updateBlock(block.id, { imageUrl: fixDriveLink(tempImageUrl) });
                                                setEditingImageUrl(null);
                                                setTempImageUrl('');
                                              }
                                            }}
                                          />
                                          <div className="flex gap-3">
                                            <button 
                                              onClick={() => {
                                                if (tempImageUrl) updateBlock(block.id, { imageUrl: fixDriveLink(tempImageUrl) });
                                                setEditingImageUrl(null);
                                                setTempImageUrl('');
                                              }}
                                              className="flex-1 bg-white text-black py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-100 active:scale-95 transition-all"
                                            >
                                              Görseli Ayarla
                                            </button>
                                            <button 
                                              onClick={() => {
                                                setEditingImageUrl(null);
                                                setTempImageUrl('');
                                                const input = document.getElementById(`hero-upload-${block.id}`) as HTMLInputElement;
                                                if (input) input.click();
                                              }}
                                              className="flex-1 bg-white/20 text-white py-2.5 rounded-xl text-sm font-semibold backdrop-blur-sm hover:bg-white/30 transition-all"
                                            >
                                              Dosya Seç
                                            </button>
                                          </div>
                                          <button 
                                            onClick={() => { setEditingImageUrl(null); setTempImageUrl(''); }}
                                            className="w-full text-white/50 text-xs py-1"
                                          >
                                            Vazgeç
                                          </button>
                                        </div>
                                      </div>
                                    ) : (
                                      <button 
                                        onClick={() => {
                                          setEditingImageUrl(block.id);
                                          setTempImageUrl(block.imageUrl.startsWith('data:') ? '' : block.imageUrl);
                                        }}
                                        className="absolute bottom-4 right-4 bg-white/20 hover:bg-white/40 text-white text-[10px] px-2 py-1 rounded backdrop-blur-sm z-20"
                                      >
                                        Resmi Değiştir
                                      </button>
                                    )}
                                    <input 
                                      type="file"
                                      accept="image/*"
                                      className="hidden"
                                      id={`hero-upload-${block.id}`}
                                      onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                          const reader = new FileReader();
                                          reader.onloadend = async () => {
                                            const compressed = await compressImage(reader.result as string);
                                            updateBlock(block.id, { imageUrl: compressed });
                                          };
                                          reader.readAsDataURL(file);
                                        }
                                      }}
                                    />
                                  </div>
                                )}

                                {block.type === 'heading' && (
                                  <div className={block.buttonPosition === 'bottom' ? "flex flex-col gap-4" : "flex items-start justify-between gap-8"}>
                                    <div className={`flex-1 min-w-0 ${block.buttonPosition !== 'bottom' && ((block.buttons && block.buttons.length > 0) || block.hasButton) ? 'max-w-[630px]' : ''}`}>
                                      {renderBlockContent(block, (
                                        <ContentEditable 
                                          html={block.content}
                                          onChange={(html) => updateBlock(block.id, { content: html })}
                                          placeholder="Alt başlık yazın..."
                                          className={`text-lg font-bold focus:outline-none w-full text-${block.alignment || 'justify'}`}
                                          onFocus={() => { setActiveBlockId(block.id); setActiveNoteIndex(null); setSelectedCells([]); }}
                                          isBold={isStickyBold}
                                          isItalic={isStickyItalic}
                                          isUnderline={isStickyUnderline}
                                          currentColor={lastSelectedColor}
                                        />
                                      ), true)}
                                    </div>
                                    {renderButtonsEditor(block)}
                                  </div>
                                )}

                                {block.type === 'divider' && <div className="h-px bg-gray-200 w-full" />}

                                {block.type === 'image' && (
                                  <div className={block.buttonPosition === 'bottom' ? "flex flex-col gap-4" : "flex items-start justify-between gap-8"}>
                                    <div className={`flex-1 min-w-0 ${block.buttonPosition !== 'bottom' && ((block.buttons && block.buttons.length > 0) || block.hasButton) ? 'max-w-[630px]' : ''}`}>
                                      {renderBlockContent(block, (
                                        <div className={`flex flex-col items-${block.alignment === 'center' ? 'center' : (block.alignment === 'right' ? 'end' : 'start')} space-y-[19px]`}>
                                          <div className="relative group/img">
                                            <img src={block.imageUrl} className="max-w-full rounded-lg shadow-sm" alt="Content" referrerPolicy="no-referrer" />
                                            {editingImageUrl === block.id ? (
                                              <div className="absolute inset-0 bg-black/60 backdrop-blur-md flex flex-col items-center justify-center p-4 z-30 rounded-lg">
                                                <div className="w-full max-w-[280px] space-y-3">
                                                  <input 
                                                    type="text"
                                                    placeholder="Görsel URL / Drive Linki"
                                                    className="w-full bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2 text-xs focus:outline-none"
                                                    value={tempImageUrl}
                                                    onChange={(e) => setTempImageUrl(e.target.value)}
                                                    autoFocus
                                                    onKeyDown={(e) => {
                                                      if (e.key === 'Enter') {
                                                        if (tempImageUrl) updateBlock(block.id, { imageUrl: fixDriveLink(tempImageUrl) });
                                                        setEditingImageUrl(null);
                                                        setTempImageUrl('');
                                                      }
                                                    }}
                                                  />
                                                  <div className="flex gap-2">
                                                    <button 
                                                      onClick={() => {
                                                        if (tempImageUrl) updateBlock(block.id, { imageUrl: fixDriveLink(tempImageUrl) });
                                                        setEditingImageUrl(null);
                                                        setTempImageUrl('');
                                                      }}
                                                      className="flex-1 bg-white text-black py-1.5 rounded-lg text-[11px] font-semibold"
                                                    >
                                                      Ayarla
                                                    </button>
                                                    <button 
                                                      onClick={() => {
                                                        setEditingImageUrl(null);
                                                        setTempImageUrl('');
                                                        const input = document.getElementById(`img-upload-${block.id}`) as HTMLInputElement;
                                                        if (input) input.click();
                                                      }}
                                                      className="flex-1 bg-white/20 text-white py-1.5 rounded-lg text-[11px] font-semibold"
                                                    >
                                                      Dosya
                                                    </button>
                                                  </div>
                                                  <button 
                                                    onClick={() => { setEditingImageUrl(null); setTempImageUrl(''); }}
                                                    className="w-full text-white/50 text-[10px]"
                                                  >
                                                    Kapat
                                                  </button>
                                                </div>
                                              </div>
                                            ) : (
                                              <button 
                                                onClick={() => {
                                                  setEditingImageUrl(block.id);
                                                  setTempImageUrl(block.imageUrl.startsWith('data:') ? '' : block.imageUrl);
                                                }}
                                                className="absolute top-2 right-2 bg-black/50 text-white p-1.5 rounded opacity-0 group-hover/img:opacity-100 transition-opacity z-10"
                                              >
                                                <ImageIcon size={14} />
                                              </button>
                                            )}
                                            <input 
                                              type="file"
                                              accept="image/*"
                                              className="hidden"
                                              id={`img-upload-${block.id}`}
                                              onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                if (file) {
                                                  const reader = new FileReader();
                                                  reader.onloadend = async () => {
                                                    const compressed = await compressImage(reader.result as string);
                                                    updateBlock(block.id, { imageUrl: compressed });
                                                  };
                                                  reader.readAsDataURL(file);
                                                }
                                              }}
                                            />
                                          </div>
                                          <input 
                                            type="text"
                                            placeholder="Alt yazı ekle..."
                                            className={`text-[12pt] italic border-none focus:ring-0 p-0 bg-transparent text-center w-full ${block.background === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}
                                            style={{ fontSize: '12pt' }}
                                            value={block.caption || ''}
                                            onChange={(e) => updateBlock(block.id, { caption: e.target.value })}
                                            onFocus={() => { setActiveBlockId(block.id); setActiveNoteIndex(null); setSelectedCells([]); }}
                                          />
                                        </div>
                                      ), true)}
                                    </div>
                                    {renderButtonsEditor(block)}
                                  </div>
                                )}

                                {block.type === 'text' && (
                                  <div className={block.buttonPosition === 'bottom' ? "flex flex-col gap-4" : "flex items-start justify-between gap-8"}>
                                    <div className={`flex-1 min-w-0 ${block.buttonPosition !== 'bottom' && ((block.buttons && block.buttons.length > 0) || block.hasButton) ? 'max-w-[630px]' : ''}`}>
                                      {renderBlockContent(block, renderTextEditor(block), true)}
                                    </div>

                                    {renderButtonsEditor(block)}
                                  </div>
                                )}

                                {block.type === 'table' && block.data && (
                                  <div className={block.buttonPosition === 'bottom' || block.buttonPosition === undefined ? "flex flex-col gap-4" : "flex items-start justify-between gap-8"}>
                                    <div className={`flex-1 min-w-0 ${block.buttonPosition === 'right' && ((block.buttons && block.buttons.length > 0) || block.hasButton) ? 'max-w-[630px]' : ''}`}>
                                      {renderBlockContent(block, renderTextEditor(block), true)}
                                    </div>
                                    {renderButtonsEditor(block)}
                                  </div>
                                )}

                                {block.type === 'button' && (
                                  <div className={`flex justify-${block.alignment === 'center' ? 'center' : (block.alignment === 'right' ? 'end' : 'start')} py-2`}>
                                    <div className="space-y-6 w-full">
                                      <div 
                                        className="flex justify-inherit"
                                        onDoubleClick={(e) => {
                                          e.stopPropagation();
                                          openButtonModal(block.id);
                                        }}
                                      >
                                        <a 
                                          href={block.link} 
                                          className={`sites-button cursor-pointer select-none ${getButtonColorClass(block.buttonIcon)}`}
                                          onClick={(e) => e.preventDefault()}
                                        >
                                          {renderButtonIcon(block.buttonIcon)}
                                          <span className={block.buttonIcon ? "hidden md:inline" : ""}>{block.content}</span>
                                        </a>
                                      </div>
                                      <div className="flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => updateBlock(block.id, { alignment: 'left' })} className={`p-1.5 rounded ${block.alignment === 'left' ? 'bg-gray-200' : 'hover:bg-gray-100'}`}><AlignLeft size={14} /></button>
                                        <button onClick={() => updateBlock(block.id, { alignment: 'center' })} className={`p-1.5 rounded ${block.alignment === 'center' ? 'bg-gray-200' : 'hover:bg-gray-100'}`}><AlignCenter size={14} /></button>
                                        <button onClick={() => updateBlock(block.id, { alignment: 'right' })} className={`p-1.5 rounded ${block.alignment === 'right' ? 'bg-gray-200' : 'hover:bg-gray-100'}`}><AlignRight size={14} /></button>
                                        <div className="w-px h-4 bg-gray-200 mx-1 self-center" />
                                        <button onClick={() => openButtonModal(block.id)} className="text-[10px] font-bold text-blue-600 hover:underline">DÜZENLE</button>
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {block.type === 'note' && (
                                  <div className={block.buttonPosition === 'bottom' ? "flex flex-col gap-4" : "flex items-start justify-between gap-8"}>
                                    <div className={`flex-1 min-w-0 ${block.buttonPosition !== 'bottom' && ((block.buttons && block.buttons.length > 0) || block.hasButton) ? 'max-w-[630px]' : ''}`}>
                                      {renderBlockContent(block, null, true)}
                                      {(!block.notes || block.notes.length === 0) && (
                                        <div className="text-center py-4 text-gray-400 text-sm italic">
                                          Bu blokta henüz not yok. Not eklemek için menüden "Not Ekle"ye tıklayın.
                                        </div>
                                      )}
                                    </div>
                                    {renderButtonsEditor(block)}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                          );
                        })}

                        {blocks.length === 0 && (
                          <div className="text-center py-20 border-2 border-dashed border-gray-200 rounded-xl">
                            <p className="text-gray-400">Henüz içerik yok. Yan taraftan bir blok ekleyin.</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-8">
                  <div className="flex items-center justify-between">
                    <h2 className="text-3xl font-bold font-sans">/edit</h2>
                    <div className="flex items-center gap-4">
                      <button 
                        onClick={createNewDraft}
                        className="blogger-btn-primary flex items-center gap-2 group apple-rainbow-glow hover:shadow-none transition-all duration-300"
                      >
                        <Plus size={20} className="transition-transform duration-300" /> 
                        <span className="transition-all duration-300">Yeni Blog Oluştur</span>
                      </button>
                    </div>
                  </div>

                  {blogs.length === 0 ? (
                    <div className="bg-white/60 backdrop-blur-md border border-dashed border-white/40 rounded-2xl p-12 text-center shadow-lg">
                      <div className="w-16 h-16 bg-white/40 rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner">
                        <Edit3 className="text-gray-400" size={32} />
                      </div>
                      <h3 className="text-lg font-medium text-gray-900">Henüz yazı yok</h3>
                      <p className="text-gray-500 mt-2">Yeni bir blog yazısı oluşturarak başlayın.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-4">
                      {[...blogs].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()).map(blog => (
                        <div 
                          key={blog.id}
                          className="blogger-card p-6 flex items-center justify-between group cursor-pointer bg-white/80 backdrop-blur-xl border border-gray-100/50 hover:bg-white/90 hover:shadow-md transition-all duration-300 rounded-3xl"
                          onClick={() => { navigate(`/edit/${blog.id}`); }}
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-16 h-12 rounded-lg overflow-hidden bg-gray-100 shrink-0 border border-gray-100 shadow-sm">
                              <img 
                                src={getBlogDisplayImage(blog)} 
                                alt="" 
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                            </div>
                            <div className="relative">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const nextStatus = blog.status === 'published' ? 'draft' : 'published';
                                  saveBlogToFirebase(blog, nextStatus, true);
                                }}
                                className={`w-10 h-6 rounded-full transition-colors duration-300 relative ${blog.status === 'published' ? 'bg-[#4cd964]' : 'bg-gray-200'}`}
                              >
                                <div className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform duration-300 shadow-sm ${blog.status === 'published' ? 'translate-x-4' : 'translate-x-0'}`} />
                              </button>
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="font-bold text-lg group-hover:text-[#1F7144] transition-colors">{blog.title}</h3>
                              </div>
                              <p className="text-sm text-gray-500 flex items-center gap-2 mt-1">
                                <Clock size={14} />
                                Son düzenleme: {new Date(blog.updatedAt).toLocaleString('tr-TR')}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={(e) => { 
                                e.stopPropagation(); 
                                e.preventDefault();
                                console.log('Delete button clicked for blog:', blog.id);
                                if (blog.id) deleteBlog(blog.id); 
                              }}
                              className="relative z-10 w-12 h-12 flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-all active:scale-90"
                              title="Sil"
                            >
                              <Trash2 size={20} strokeWidth={2} />
                            </button>
                            <ChevronRight className="text-gray-300" size={24} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
      </main>

      {/* Footer */}
      {!viewingBlog && (
        <footer className="bg-white border-t border-gray-200 py-8 mt-auto">
          <div className="max-w-6xl mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <svg className="w-6 h-6" viewBox="0 0 632 592" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="361" y="78" width="247" height="437" fill="white"/>
              <path d="M0 59L361 2C361 232.019 361 360.981 361 591L0 534V59Z" fill="#1F7144"/>
              <rect x="342" y="515" width="285" height="19" rx="9.5" fill="#1F7144"/>
              <rect x="342" y="59" width="285" height="19" rx="9.5" fill="#1F7144"/>
              <rect x="475" y="116" width="95" height="57" fill="#1F7144"/>
              <rect x="475" y="268" width="95" height="57" fill="#1F7144"/>
              <rect x="475" y="420" width="95" height="57" fill="#1F7144"/>
              <rect x="475" y="344" width="95" height="57" fill="#1F7144"/>
              <rect x="475" y="192" width="95" height="57" fill="#1F7144"/>
              <path d="M361 116H456V173H361V116Z" fill="#1F7144"/>
              <rect x="361" y="420" width="95" height="57" fill="#1F7144"/>
              <path d="M608 68.5C608 63.2533 612.253 59 617.5 59C622.747 59 627 63.2533 627 68.5V524.5C627 529.747 622.747 534 617.5 534C612.253 534 608 529.747 608 524.5V68.5Z" fill="#1F7144"/>
              <rect x="266" y="173" width="190" height="247" fill="white"/>
              <ellipse cx="202" cy="360.5" rx="25" ry="28.5" fill="white"/>
              <ellipse cx="202" cy="232.5" rx="25" ry="28.5" fill="white"/>
              <path d="M114 282L266 268V325L114 311V282Z" fill="white"/>
              <path d="M329.234 192V401H289.223V226.505H266V192H329.234Z" fill="#1F7144"/>
              <path d="M386.33 192H420.466C444.155 192 456 204.049 456 228.148V364.524C456 388.841 444.155 401 420.466 401H388.009C364.32 401 352.475 388.841 352.475 364.524V337.577H391.367V358.28C391.367 363.757 393.885 366.495 398.921 366.495H409.554C414.403 366.495 416.828 363.757 416.828 358.28V318.517H386.33C362.641 318.517 350.796 306.468 350.796 282.369V228.148C350.796 204.049 362.641 192 386.33 192ZM397.522 286.313H416.828V234.72C416.828 229.243 414.403 226.505 409.554 226.505H397.522C392.486 226.505 389.968 229.243 389.968 234.72V278.097C389.968 281.165 390.527 283.355 391.647 284.67C392.766 285.765 394.724 286.313 397.522 286.313Z" fill="#1F7144"/>
            </svg>
            <span className="font-bold text-[#1F7144]">teslimolan.com</span>
          </div>
          <p className="text-sm text-gray-500">© 2026 teslimolan.com Tüm hakları saklıdır.</p>
        </div>
      </footer>
      )}
      {/* Button Edit Modal */}
      {isButtonModalOpen && editingButtonBlockId && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-[200] p-4 backdrop-blur-md">
          <div 
            className="apple-glass rounded-2xl apple-shadow w-full max-w-md overflow-hidden border border-white/40"
          >
            <div className="p-6 border-b border-gray-200/50 flex justify-between items-center">
              <h3 className="text-lg font-bold text-[#1d1d1f]">Butonu Düzenle</h3>
              <button onClick={closeButtonModal} className="text-gray-400 hover:text-[#1d1d1f] transition-colors">
                <Plus size={24} className="rotate-45" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-gray-400 tracking-wider">İkon & Buton Metni</label>
                <div className="flex gap-2">
                  <div className="relative">
                    <button 
                      className={`w-[52px] h-[52px] border border-gray-200 rounded-xl flex items-center justify-center transition-all focus:ring-2 focus:ring-blue-500/50 outline-none ${draftButton.icon ? getButtonColorClass(draftButton.icon) : 'bg-white/30 hover:bg-white/50'}`}
                      onClick={() => setIsIconMenuOpen(!isIconMenuOpen)}
                    >
                      {renderButtonIcon(draftButton.icon) || <Plus size={20} className="text-gray-400" />}
                    </button>
                    {isIconMenuOpen && (
                      <div className="absolute top-full left-0 mt-2 bg-gray-900/90 backdrop-blur-xl border border-gray-700 apple-shadow rounded-2xl p-2 grid grid-cols-3 gap-2 z-50 w-max">
                        <button onClick={() => { setDraftButton({ ...draftButton, icon: '' }); setIsIconMenuOpen(false); }} className="p-2 hover:bg-white/10 rounded flex items-center justify-center" title="İkon Yok">
                          <Minus size={20} className="text-white" />
                        </button>
                        <button onClick={() => { setDraftButton({ ...draftButton, icon: 'copy', text: 'Kodu Kopyala' }); setIsIconMenuOpen(false); }} className="p-2 hover:bg-white/10 rounded flex items-center justify-center" title="Kodu Kopyala">
                          <Copy size={20} className="text-white" />
                        </button>
                        <button onClick={() => { setDraftButton({ ...draftButton, icon: 'table', text: 'Detaylı Tablo' }); setIsIconMenuOpen(false); }} className="p-2 hover:bg-white/10 rounded flex items-center justify-center" title="Detaylı Tablo">
                          <Table size={20} className="text-white" />
                        </button>
                        <button onClick={() => { setDraftButton({ ...draftButton, icon: 'terminal', text: 'Python Runner' }); setIsIconMenuOpen(false); }} className="p-2 hover:bg-white/10 rounded flex items-center justify-center" title="Python Runner">
                          <Terminal size={20} className="text-white" />
                        </button>
                        <button onClick={() => { setDraftButton({ ...draftButton, icon: 'split', text: 'Bölme Aracı' }); setIsIconMenuOpen(false); }} className="p-2 hover:bg-white/10 rounded flex items-center justify-center" title="Bölme Aracı">
                          <SplitSquareHorizontal size={20} className="text-white" />
                        </button>
                      </div>
                    )}
                  </div>
                  <input 
                    type="text"
                    className="flex-1 border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500/50 bg-white/50 transition-all"
                    value={draftButton.text}
                    onChange={(e) => setDraftButton({ ...draftButton, text: e.target.value })}
                    placeholder="Buton üzerinde ne yazsın?"
                    autoFocus
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-gray-400 tracking-wider">Link</label>
                <input 
                  type="text"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500/50 bg-white/50 transition-all"
                  value={draftButton.link}
                  onChange={(e) => setDraftButton({ ...draftButton, link: e.target.value })}
                  placeholder="https://"
                />
              </div>
              {blocks.find(b => b.id === editingButtonBlockId)?.type !== 'button' && (
                <>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase text-gray-400 tracking-wider">Buton Konumu</label>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => setDraftButton({ ...draftButton, position: 'bottom' })}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border transition-all ${draftButton.position === 'bottom' ? 'bg-blue-50 border-blue-200 text-blue-600 font-bold' : 'bg-white/50 border-gray-200 text-gray-500 hover:bg-white'}`}
                      >
                        <PanelBottomClose size={18} />
                        <span>Alt Taraf</span>
                      </button>
                      <button 
                        onClick={() => setDraftButton({ ...draftButton, position: 'right' })}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border transition-all ${draftButton.position === 'right' ? 'bg-blue-50 border-blue-200 text-blue-600 font-bold' : 'bg-white/50 border-gray-200 text-gray-500 hover:bg-white'}`}
                      >
                        <PanelRightClose size={18} />
                        <span>Sağ Taraf</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
            <div className="p-6 bg-gray-50/50 border-t border-gray-200/50 flex justify-between items-center">
              <div>
                {(editingButtonIndex !== null || blocks.find(b => b.id === editingButtonBlockId)?.hasButton) && (
                  <button 
                    onClick={() => {
                      const block = blocks.find(b => b.id === editingButtonBlockId);
                      if (block) {
                        if (editingButtonIndex !== null && block.buttons) {
                          const newButtons = [...block.buttons];
                          newButtons.splice(editingButtonIndex, 1);
                          updateBlock(editingButtonBlockId, { buttons: newButtons });
                        } else if (block.hasButton) {
                          updateBlock(editingButtonBlockId, { hasButton: false, buttonText: '', buttonLink: '' });
                        }
                        closeButtonModal();
                      }
                    }}
                    className="text-red-500 hover:text-red-700 text-sm font-bold uppercase tracking-wider"
                  >
                    Butonu Sil
                  </button>
                )}
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={closeButtonModal}
                  className="px-6 py-2 rounded-xl font-medium text-gray-600 hover:bg-gray-200 transition-colors"
                >
                  İptal
                </button>
                <button 
                  onClick={saveButtonModal}
                  className="px-8 py-2 bg-[#1a73e8] text-white rounded-xl font-medium hover:bg-[#1765cc] transition-colors shadow-md"
                >
                  Kaydet
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Import Data Modal */}
      {openImportDataBlockId && (
        <div 
          className="fixed inset-0 bg-black/30 flex items-center justify-center z-[200] p-4 backdrop-blur-md"
          onClick={(e) => {
            e.stopPropagation();
            setOpenImportDataBlockId(null);
          }}
        >
          <div 
            className="apple-glass rounded-2xl apple-shadow w-full max-w-md overflow-hidden border border-white/40"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-gray-200/50 flex justify-between items-center">
              <h3 className="text-lg font-bold text-[#1d1d1f]">Veri Aktar (Tablo)</h3>
              <button onClick={() => setOpenImportDataBlockId(null)} className="text-gray-400 hover:text-[#1d1d1f] transition-colors">
                <Plus size={24} className="rotate-45" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-gray-400 tracking-wider">EXCEL VEYA GOOGLE SHEETS VERİSİ</label>
                <textarea 
                  className="w-full h-[95px] border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500/50 bg-white/50 transition-all font-mono text-xs"
                  placeholder="Yapıştır"
                  value={importDataText || importDataHtml}
                  onPaste={(e) => {
                    const html = e.clipboardData.getData('text/html');
                    if (html && html.includes('<table')) {
                      setImportDataHtml(html);
                    }
                  } }
                  onChange={(e) => {
                    const val = e.target.value;
                    setImportDataText(val);
                    if (val.includes('<table')) {
                      setImportDataHtml(val);
                    } else if (importDataHtml && !importDataHtml.includes('<table')) {
                      setImportDataHtml('');
                    }
                  }}
                />
              </div>
              <p className="text-xs text-gray-500 italic">
                * Excel veya Google Sheets'ten kopyaladığınız hücreleri buraya yapıştırabilirsiniz.<br/>
                * HTML tablo kodlarını (colspan/rowspan destekli) doğrudan yapıştırabilirsiniz.
              </p>
            </div>
            <div className="p-6 bg-gray-50/50 border-t border-gray-200/50 flex justify-end gap-3">
              <button 
                onClick={() => setOpenImportDataBlockId(null)}
                className="px-6 py-2 rounded-xl font-medium text-gray-600 hover:bg-gray-200 transition-colors"
              >
                İptal
              </button>
              <button 
                onClick={() => handleImportTableData(openImportDataBlockId)}
                className="px-8 py-2 bg-[#1a73e8] text-white rounded-xl font-medium hover:bg-[#1765cc] transition-colors shadow-md"
              >
                Veriyi Aktar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
