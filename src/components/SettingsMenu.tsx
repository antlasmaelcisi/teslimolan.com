import React, { memo, startTransition, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Settings } from 'lucide-react';
import ThemeSwitch from './ThemeSwitch';
import GlassSwitch from './GlassSwitch';
import LayoutSwitch from './LayoutSwitch';

export type Theme = 'light' | 'dark' | 'glass';
export type ReadingLayout = 'modern' | 'classic';

// Ayarlar menüsü kendi bileşeninde: menünün açılıp kapanması yalnızca bu bileşeni çizer,
// yazının yüzlerce tablo hücresini yeniden çizdirmez.
// Tema ve yerleşim değişiklikleri önce anahtarlarda anında görünür (yerel durum);
// sayfanın yeniden çizimi düşük öncelikli bir geçiş (startTransition) olarak arkadan gelir,
// böylece anahtar animasyonları takılmaz.
interface SettingsMenuProps {
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
  readingLayout: ReadingLayout;
  onReadingLayoutChange: (layout: ReadingLayout) => void;
  // Okuma ekranında mıyız (karanlık tema yalnızca orada etkin)
  darkAllowed: boolean;
}

// Cam anahtarı (76x34, tam yuvarlak uçlu) biçiminde bir delik: zemin katmanının
// tamamından bu şekil çıkarılır, böylece yalnızca anahtarın arkası saydam kalır.
const PILL_SHAPE = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='76' height='34'%3E%3Crect width='76' height='34' rx='17'/%3E%3C/svg%3E")`;
const pillHoleMask = (x: number, y: number): React.CSSProperties => ({
  WebkitMaskImage: `linear-gradient(#000, #000), ${PILL_SHAPE}`,
  maskImage: `linear-gradient(#000, #000), ${PILL_SHAPE}`,
  WebkitMaskSize: '100% 100%, 76px 34px',
  maskSize: '100% 100%, 76px 34px',
  WebkitMaskPosition: `0 0, ${x}px ${y}px`,
  maskPosition: `0 0, ${x}px ${y}px`,
  WebkitMaskRepeat: 'no-repeat',
  maskRepeat: 'no-repeat',
  WebkitMaskComposite: 'xor',
  maskComposite: 'exclude',
});

const SettingsMenu: React.FC<SettingsMenuProps> = ({ theme, onThemeChange, readingLayout, onReadingLayoutChange, darkAllowed }) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Anahtarların anında tepki vermesi için yerel kopya; sayfa güncellenince eşitlenir
  const [localTheme, setLocalTheme] = useState(theme);
  const [localLayout, setLocalLayout] = useState(readingLayout);
  useEffect(() => setLocalTheme(theme), [theme]);
  useEffect(() => setLocalLayout(readingLayout), [readingLayout]);

  const changeTheme = (next: Theme) => {
    setLocalTheme(next);
    startTransition(() => onThemeChange(next));
  };
  const changeLayout = (next: ReadingLayout) => {
    setLocalLayout(next);
    startTransition(() => onReadingLayoutChange(next));
  };
  // Geceye geçince Cam kapanır (perde kendiliğinden iner); gündüze dönünce
  // Cam kendiliğinden açılmaz, her zaman düz aydınlık temaya dönülür.
  const toggleNight = () => changeTheme(localTheme === 'dark' ? 'light' : 'dark');
  const toggleGlass = () => changeTheme(localTheme === 'glass' ? 'light' : 'glass');

  const isDark = darkAllowed && localTheme === 'dark';

  // Menü dışına tıklanınca kapan
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  // Menü açıkken Cam anahtarının panel zeminindeki konumunu ölç; zeminde o noktaya
  // anahtar biçiminde bir pencere açılır. Menü ölçeklenerek geldiği için ekran
  // koordinatı yerine yerleşim ofsetleri toplanır (dönüşümlerden etkilenmez).
  const menuBgRef = useRef<HTMLDivElement>(null);
  const glassSlotRef = useRef<HTMLDivElement>(null);
  const [glassHole, setGlassHole] = useState<{ x: number; y: number } | null>(null);
  useLayoutEffect(() => {
    if (!open) {
      setGlassHole(null);
      return;
    }
    const measure = () => {
      const panel = menuBgRef.current?.parentElement;
      let el: HTMLElement | null = glassSlotRef.current;
      if (!panel || !el) return;
      let x = 0;
      let y = 0;
      while (el && el !== panel) {
        x += el.offsetLeft;
        y += el.offsetTop;
        el = el.offsetParent as HTMLElement | null;
      }
      setGlassHole({ x, y });
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Yerleşim ve tema ayarları"
        aria-haspopup="true"
        aria-expanded={open}
        title="Yerleşim ve tema ayarları"
        className={`flex items-center justify-center px-1 h-control bg-transparent border-0 transition-colors ${isDark ? (open ? 'text-white' : 'text-gray-400 hover:text-white') : (open ? 'text-gray-900' : 'text-gray-500 hover:text-gray-900')}`}
      >
        {/* Dişli menü açılırken yerinde döner, kapanırken geri döner */}
        <Settings
          size={20}
          className={`transition-transform duration-500 motion-reduce:transition-none ${open ? 'rotate-180' : 'rotate-0'}`}
          style={{ transitionTimingFunction: 'cubic-bezier(0.65, 0, 0.35, 1)' }}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            style={{ transformOrigin: 'top right' }}
            className={`absolute right-0 mt-4 rounded-[22px] rounded-tr-none border shadow-[0_16px_48px_rgba(0,0,0,0.16)] z-[100] ${isDark ? 'border-white/10' : 'border-black/5'}`}
          >
            {/* Dişliyi gösteren dik üçgen kulakçık: dik kenarı panelin sağ kenarının devamı,
                tabanı panelin üst kenarına kaynar (bu yüzden panelin sağ üst köşesi yuvarlak değil) */}
            <svg aria-hidden="true" width="15" height="12" viewBox="0 0 15 12" className="absolute -top-[12px] -right-px">
              <path d="M15 0V12H0Z" fill={isDark ? '#000000' : '#ffffff'} />
              <path
                d="M0.5 11.5L14.5 0.5V12"
                fill="none"
                stroke={isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'}
                strokeWidth="1"
              />
            </svg>
            {/* Panel zemini ayrı bir katman: Cam anahtarının arkasında anahtar biçiminde bir pencere açılır */}
            <div
              ref={menuBgRef}
              aria-hidden="true"
              className={`absolute inset-0 rounded-[21px] rounded-tr-none ${isDark ? 'bg-[#1c1c1e]' : 'bg-white'}`}
              style={glassHole ? pillHoleMask(glassHole.x, glassHole.y) : undefined}
            />
            {/* Anahtarlara basınca menü açık kalır ki animasyonlar görünsün */}
            <div className="relative p-3 space-y-3">
              <section>
                <div className={`px-1 mb-1.5 text-[10px] font-semibold tracking-[0.12em] ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>YERLEŞİM</div>
                <LayoutSwitch value={localLayout} onChange={changeLayout} isDark={isDark} />
              </section>
              <div className={`h-px ${isDark ? 'bg-white/10' : 'bg-gray-100'}`} />
              <section>
                <div className={`px-1 mb-1.5 text-[10px] font-semibold tracking-[0.12em] ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>TEMA</div>
                <div className="flex gap-2">
                  <ThemeSwitch isDark={localTheme === 'dark'} onToggle={toggleNight} />
                  {/* Cam, gündüz temasının açılıp kapanan bir türü; karanlık temada kilitli */}
                  <div ref={glassSlotRef} className="w-[76px] h-[34px]">
                    <GlassSwitch isOn={localTheme === 'glass'} disabled={localTheme === 'dark'} onToggle={toggleGlass} />
                  </div>
                </div>
              </section>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default memo(SettingsMenu);
