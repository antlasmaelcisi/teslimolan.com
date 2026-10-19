import React from 'react';

// Cam teması anahtarı: üstte uçları toplu bir korniş, ondan sarkan iki perde.
// Kapalıyken perdeler anahtarın içini örter; açılınca perdeler iki yana toplanıp
// belden bağlanır (klasik perde ikonu gibi) ve anahtar saydam bir pencereye döner.
interface GlassSwitchProps {
  isOn: boolean;
  onToggle: () => void;
}

const EASE = 'cubic-bezier(0.65, 0, 0.35, 1)';
const FABRIC = '#b9aee0';
const FOLD = 'rgba(255,255,255,0.75)';
const ROD = '#7d72ad';

// Kapalı perde: anahtarın yarısını örten, dikey kıvrımlı kumaş (sol perde; sağ perde aynası)
const ClosedDrape = () => (
  <svg viewBox="0 0 38 30" preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
    <path d="M0 0H38V30H0Z" fill={FABRIC} />
    <path
      d="M9 0C10 10 8 20 9 30M19 0C20 10 18 20 19 30M29 0C30 10 28 20 29 30"
      stroke={FOLD}
      strokeWidth="1.2"
      fill="none"
    />
  </svg>
);

// Açık perde: kenara toplanmış, belden bağlı, eteği açılan kumaş (sol perde; sağ perde aynası)
const OpenDrape = () => (
  <svg viewBox="0 0 16 30" preserveAspectRatio="none" className="absolute left-0 top-0 h-full w-[16px]">
    <path d="M0 0H15C13 8 7 14 4 18C7 22 10 26 11 30H0Z" fill={FABRIC} />
    <path
      d="M5 0C4.5 7 3 13 2 18M10 0C8.5 8 5 14 3.5 18M3 19.5C4.5 23 6 27 6.5 30"
      stroke={FOLD}
      strokeWidth="1.1"
      fill="none"
    />
  </svg>
);

const GlassSwitch: React.FC<GlassSwitchProps> = ({ isOn, onToggle }) => {
  const motion = 'motion-reduce:transition-none';
  const t = (extra: React.CSSProperties = {}): React.CSSProperties => ({
    transitionTimingFunction: EASE,
    ...extra,
  });

  // Bir yandaki perde: kapalı kumaş kenara doğru toplanıp kaybolurken bağlı perde belirir
  const drape = (side: 'left' | 'right') => (
    <span
      className={`absolute top-[4px] bottom-0 w-1/2 ${side === 'left' ? 'left-0' : 'right-0 -scale-x-100'}`}
    >
      <span
        className={`absolute inset-0 origin-left transition-[transform,opacity] duration-500 ${motion}`}
        style={t({ transform: isOn ? 'scaleX(0.3)' : 'scaleX(1)', opacity: isOn ? 0 : 1 })}
      >
        <ClosedDrape />
      </span>
      <span
        className={`absolute inset-0 origin-left transition-[transform,opacity] duration-500 ${motion}`}
        style={t({ transform: isOn ? 'scaleX(1)' : 'scaleX(2.2)', opacity: isOn ? 1 : 0 })}
      >
        <OpenDrape />
      </span>
    </span>
  );

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isOn}
      aria-label="Cam teması"
      title="Cam teması"
      onClick={onToggle}
      className="relative w-[76px] h-[34px] shrink-0 rounded-full overflow-hidden ring-1 ring-black/10 shadow-[inset_0_1px_4px_rgba(0,0,0,0.18)] focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
    >
      {drape('left')}
      {drape('right')}

      {/* Korniş: ince çubuk ve uçlarında toplar */}
      <span className="absolute left-[13px] right-[13px] top-[3px] h-[1.5px] rounded-full" style={{ background: ROD }} />
      <span className="absolute left-[10px] top-[2px] w-[4px] h-[4px] rounded-full" style={{ background: ROD }} />
      <span className="absolute right-[10px] top-[2px] w-[4px] h-[4px] rounded-full" style={{ background: ROD }} />

      {/* Topuz: cam küre */}
      <span
        className={`absolute left-[4px] top-[4px] w-[26px] h-[26px] rounded-full transition-transform duration-500 ${motion}`}
        style={t({
          background:
            'radial-gradient(circle at 32% 28%, rgba(255,255,255,0.95) 0 18%, rgba(255,255,255,0.35) 40%, rgba(255,255,255,0.15) 100%)',
          border: '1px solid rgba(255,255,255,0.85)',
          boxShadow: '0 2px 5px rgba(0,0,0,0.22), inset 0 -2px 4px rgba(120,110,170,0.25)',
          backdropFilter: 'blur(4px)',
          transform: isOn ? 'translateX(42px)' : 'translateX(0)',
        })}
      />
    </button>
  );
};

export default GlassSwitch;
