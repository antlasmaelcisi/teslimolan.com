import React from 'react';

// Apple tarzı yumuşak gradyan paletleri. Her palet beş renkli bir katman olur;
// katmanlar sırayla birbirine geçer (bkz. index.css: wallpaper-fade).
const PALETTES: { name: string; colors: [string, string, string, string, string] }[] = [
  // Big Sur: sitenin ilk paleti
  { name: 'Big Sur', colors: ['#ff2d55', '#5856d6', '#007aff', '#34c759', '#ff9500'] },
  // Şafak: şeftali, gül ve leylak
  { name: 'Şafak', colors: ['#ffb199', '#ff6f91', '#ffd6a5', '#c7b8ff', '#ffc3e1'] },
  // Okyanus: gök mavisi, turkuaz ve çivit
  { name: 'Okyanus', colors: ['#64d2ff', '#5e5ce6', '#30b0c7', '#a2f5e8', '#0a84ff'] },
  // Lavanta: mor, pembe ve buz mavisi
  { name: 'Lavanta', colors: ['#bf5af2', '#ff9fd6', '#8e9bff', '#ffd1dc', '#b5e3ff'] },
];

const POSITIONS = ['20% 30%', '80% 20%', '50% 80%', '10% 90%', '90% 90%'];

const gradientFor = (colors: string[]) =>
  colors.map((c, i) => `radial-gradient(circle at ${POSITIONS[i]}, ${c} 0%, transparent 50%)`).join(', ');

// hidden: karanlık temada duvar kâğıdı sökülmez, yalnızca saydamlaşır ve animasyonu durur.
// Bulanık katmanlar bir kez çizilir; gündüze dönüşte sıfırdan kurulmadıkları için geçiş takılmaz.
const VibrantWallpaper: React.FC<{ hidden?: boolean }> = ({ hidden = false }) => {
  return (
    <div
      aria-hidden="true"
      className={`fixed inset-0 w-full h-full z-[-1] pointer-events-none overflow-hidden bg-[var(--theme-bg)] transition-opacity duration-700 motion-reduce:transition-none ${hidden ? 'wallpaper-paused' : ''}`}
      style={{ opacity: hidden ? 0 : 1 }}
    >
      {/* Paletler yavaşça süzülür (wallpaper-drift) ve sırayla birbirine geçer (wallpaper-fade).
          Yalnızca transform ve opacity hareket eder; bulanıklık bir kez çizilir. */}
      <div className="wallpaper-drift absolute top-[-20%] left-[-10%] w-[120%] h-[120%]">
        {PALETTES.map((p, i) => (
          <div
            key={p.name}
            className="wallpaper-layer absolute inset-0"
            style={{
              background: gradientFor(p.colors),
              filter: 'blur(80px)',
              animationDelay: `calc(${i} * var(--wallpaper-step) - var(--wallpaper-step) * 0.4)`,
            }}
          />
        ))}
      </div>

      {/* Subtle grain texture */}
      <div className="absolute inset-0 opacity-[0.05] pointer-events-none mix-blend-overlay bg-[url('https://www.transparenttextures.com/patterns/stardust.png')]" />
    </div>
  );
};

export default VibrantWallpaper;
