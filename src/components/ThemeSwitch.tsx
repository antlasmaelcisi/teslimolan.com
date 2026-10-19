import React from 'react';

// Gündüz/gece anahtarı: gündüz mavi gök, bulutlar ve güneş; gece koyu gök, yıldızlar ve ay.
// Geceye geçerken güneş sağa doğru batar, ardından ay aşağıdan doğar; gündüze dönerken tersi olur.
interface ThemeSwitchProps {
  isDark: boolean;
  onToggle: () => void;
}

const EASE = 'cubic-bezier(0.65, 0, 0.35, 1)';
const RISE_DELAY = 260; // ms: batan gök cismi kaybolurken diğeri doğmaya başlar

const STARS: { x: number; y: number; s: number }[] = [
  { x: 10, y: 7, s: 3 },
  { x: 22, y: 18, s: 2 },
  { x: 14, y: 25, s: 2 },
  { x: 31, y: 9, s: 2 },
  { x: 36, y: 22, s: 3 },
  { x: 44, y: 13, s: 2 },
];

const ThemeSwitch: React.FC<ThemeSwitchProps> = ({ isDark, onToggle }) => {
  const sunDelay = isDark ? 0 : RISE_DELAY;
  const moonDelay = isDark ? RISE_DELAY : 0;
  const motion = 'motion-reduce:transition-none';

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label="Karanlık tema"
      onClick={onToggle}
      className="relative w-[76px] h-[34px] shrink-0 rounded-full overflow-hidden shadow-[inset_0_2px_6px_rgba(0,0,0,0.35)] ring-1 ring-black/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
    >
      {/* Gündüz göğü: güneşin çevresinde halkalar */}
      <span
        className={`absolute inset-0 transition-opacity duration-700 ${motion} ${isDark ? 'opacity-0' : 'opacity-100'}`}
        style={{
          background:
            'radial-gradient(circle at 17px 17px, rgba(255,255,255,0.28) 0 19px, rgba(255,255,255,0.16) 19px 27px, rgba(255,255,255,0.08) 27px 35px, transparent 35px), linear-gradient(180deg, #5aa9f8 0%, #2f80ed 100%)',
        }}
      />
      {/* Gece göğü: ayın çevresinde halkalar */}
      <span
        className={`absolute inset-0 transition-opacity duration-700 ${motion} ${isDark ? 'opacity-100' : 'opacity-0'}`}
        style={{
          background:
            'radial-gradient(circle at 59px 17px, rgba(255,255,255,0.10) 0 19px, rgba(255,255,255,0.06) 19px 27px, rgba(255,255,255,0.03) 27px 35px, transparent 35px), linear-gradient(180deg, #2b3140 0%, #151821 100%)',
        }}
      />

      {/* Yıldızlar: gece belirir */}
      {STARS.map((st, i) => (
        <span
          key={i}
          className={`absolute rounded-full bg-white transition-opacity duration-500 ${motion} ${isDark ? 'opacity-90' : 'opacity-0'}`}
          style={{ left: st.x, top: st.y, width: st.s, height: st.s, transitionDelay: `${isDark ? RISE_DELAY + i * 60 : 0}ms` }}
        />
      ))}

      {/* Bulutlar: gece aşağı iner ve kaybolur */}
      <span
        className={`absolute inset-0 transition-[transform,opacity] duration-500 ${motion} ${isDark ? 'opacity-0 translate-y-3' : 'opacity-100 translate-y-0'}`}
      >
        <span className="absolute rounded-full bg-white/60" style={{ width: 22, height: 22, left: 40, top: 20 }} />
        <span className="absolute rounded-full bg-white/60" style={{ width: 18, height: 18, left: 58, top: 12 }} />
        <span className="absolute rounded-full bg-white" style={{ width: 20, height: 20, left: 30, top: 25 }} />
        <span className="absolute rounded-full bg-white" style={{ width: 24, height: 24, left: 47, top: 23 }} />
        <span className="absolute rounded-full bg-white" style={{ width: 18, height: 18, left: 64, top: 21 }} />
      </span>

      {/* Güneş: soldan sağa doğru ufkun altına batar */}
      <span
        className={`absolute left-[4px] top-[4px] w-[26px] h-[26px] rounded-full transition-transform duration-500 ${motion}`}
        style={{
          background: 'radial-gradient(circle at 35% 35%, #ffe680 0%, #f5c518 60%, #e0a800 100%)',
          boxShadow: '0 2px 4px rgba(0,0,0,0.25), inset -2px -3px 4px rgba(0,0,0,0.12)',
          transform: isDark ? 'translate(20px, 36px)' : 'translate(0, 0)',
          transitionTimingFunction: EASE,
          transitionDelay: `${sunDelay}ms`,
        }}
      />

      {/* Ay: sağda aşağıdan doğar */}
      <span
        className={`absolute right-[4px] top-[4px] w-[26px] h-[26px] rounded-full transition-transform duration-500 ${motion}`}
        style={{
          background: 'radial-gradient(circle at 35% 35%, #f2f2f2 0%, #d4d4d4 70%, #b8b8b8 100%)',
          boxShadow: '0 2px 4px rgba(0,0,0,0.35), inset -2px -3px 4px rgba(0,0,0,0.15)',
          transform: isDark ? 'translate(0, 0)' : 'translate(-20px, 36px)',
          transitionTimingFunction: EASE,
          transitionDelay: `${moonDelay}ms`,
        }}
      >
        {/* Ay kraterleri */}
        <span className="absolute rounded-full bg-[#a9a9a9]" style={{ width: 8, height: 8, left: 6, top: 12 }} />
        <span className="absolute rounded-full bg-[#a9a9a9]" style={{ width: 5, height: 5, left: 15, top: 5 }} />
        <span className="absolute rounded-full bg-[#a9a9a9]" style={{ width: 6, height: 6, left: 16, top: 15 }} />
      </span>
    </button>
  );
};

export default ThemeSwitch;
