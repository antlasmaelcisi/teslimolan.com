import React from 'react';

const VibrantWallpaper: React.FC = () => {
  return (
    <div className="fixed inset-0 w-full h-full z-[-1] pointer-events-none overflow-hidden bg-[#f5f5f7]">
      {/* Abstract macOS-style vector shapes - Big Sur / Monterey style */}
      <div 
        className="absolute top-[-20%] left-[-10%] w-[120%] h-[120%] opacity-60"
        style={{ 
          background: `
            radial-gradient(circle at 20% 30%, #ff2d55 0%, transparent 50%),
            radial-gradient(circle at 80% 20%, #5856d6 0%, transparent 50%),
            radial-gradient(circle at 50% 80%, #007aff 0%, transparent 50%),
            radial-gradient(circle at 10% 90%, #34c759 0%, transparent 50%),
            radial-gradient(circle at 90% 90%, #ff9500 0%, transparent 50%)
          `,
          filter: 'blur(80px)',
          transform: 'scale(1.2)',
        }}
      />
      
      {/* Dynamic blobs for "vibrancy" - animations removed for speed */}
      <div 
        className="absolute top-[10%] left-[20%] w-[40%] h-[40%] rounded-full blur-[100px] opacity-30"
        style={{ 
          background: 'radial-gradient(circle, #ff375f 0%, transparent 70%)',
        }}
      />
      <div 
        className="absolute bottom-[20%] right-[10%] w-[50%] h-[50%] rounded-full blur-[120px] opacity-25"
        style={{ 
          background: 'radial-gradient(circle, #007aff 0%, transparent 70%)',
        }}
      />
      
      {/* Subtle grain texture */}
      <div className="absolute inset-0 opacity-[0.05] pointer-events-none mix-blend-overlay bg-[url('https://www.transparenttextures.com/patterns/stardust.png')]" />
    </div>
  );
};

export default VibrantWallpaper;
