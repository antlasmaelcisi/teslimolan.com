import React from 'react';

/*
 * Yumuşak, yavaş hareket eden renk lekeleri.
 * Her leke tek bir bulanık katman; sadece transform ve opacity
 * animasyonu yapıldığı için tarayıcı bunları ekran kartında taşır,
 * sayfayı yeniden çizmez. Hareketi azalt tercihi açık olan
 * kullanıcılarda animasyon tamamen durur (index.css).
 */
const blobs: Array<{
  color: string;
  className: string;
  anim: string;
}> = [
  // Eski paletten
  { color: '#ff2d55', className: 'top-[-10%] left-[-5%] w-[55%] h-[55%]', anim: 'wp-drift-a 38s' },
  { color: '#5856d6', className: 'top-[-15%] right-[-10%] w-[55%] h-[55%]', anim: 'wp-drift-b 44s' },
  { color: '#007aff', className: 'bottom-[-15%] left-[25%] w-[60%] h-[60%]', anim: 'wp-drift-c 50s' },
  { color: '#34c759', className: 'bottom-[-10%] left-[-15%] w-[45%] h-[45%]', anim: 'wp-drift-b 46s' },
  { color: '#ff9500', className: 'bottom-[-15%] right-[-10%] w-[45%] h-[45%]', anim: 'wp-drift-a 42s' },
  // Yeni renkler: sırayla belirip kayboluyor
  { color: '#30d5c8', className: 'top-[20%] left-[30%] w-[40%] h-[40%]', anim: 'wp-drift-c 36s, wp-fade 24s' },
  { color: '#ffcc00', className: 'top-[45%] right-[15%] w-[35%] h-[35%]', anim: 'wp-drift-a 40s, wp-fade 28s 8s' },
  { color: '#bf5af2', className: 'top-[5%] left-[40%] w-[38%] h-[38%]', anim: 'wp-drift-b 48s, wp-fade 32s 16s' },
];

const VibrantWallpaper: React.FC = () => {
  return (
    <div className="fixed inset-0 w-full h-full z-[-1] pointer-events-none overflow-hidden bg-[var(--theme-bg)]">
      <div className="absolute inset-0 opacity-60">
        {blobs.map((b, i) => (
          <div
            key={i}
            className={`wp-blob absolute rounded-full ${b.className}`}
            style={{
              background: `radial-gradient(circle, ${b.color} 0%, transparent 70%)`,
              animation: b.anim.split(', ').map(a => `${a} ease-in-out infinite alternate`).join(', '),
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
