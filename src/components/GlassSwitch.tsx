import React from 'react';

// Cam teması anahtarı: kapalıyken anahtarın içi perdeyle örtülü; açılınca perdeler
// iki yana toplanır ve anahtar saydam bir pencereye döner. Topuz cam bir küredir.
interface GlassSwitchProps {
  isOn: boolean;
  onToggle: () => void;
}

const EASE = 'cubic-bezier(0.65, 0, 0.35, 1)';
// Perde kumaşı: dikey kıvrımlar
const FABRIC = 'repeating-linear-gradient(90deg, #d9d2f2 0px, #c4bae6 3px, #d9d2f2 6px)';

const GlassSwitch: React.FC<GlassSwitchProps> = ({ isOn, onToggle }) => {
  const motion = 'motion-reduce:transition-none';

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
      {/* Sol perde */}
      <span
        className={`absolute inset-y-0 left-0 w-1/2 origin-left transition-transform duration-500 ${motion}`}
        style={{
          background: FABRIC,
          boxShadow: 'inset -3px 0 4px rgba(0,0,0,0.12)',
          transform: isOn ? 'scaleX(0.16)' : 'scaleX(1)',
          transitionTimingFunction: EASE,
        }}
      />
      {/* Sağ perde */}
      <span
        className={`absolute inset-y-0 right-0 w-1/2 origin-right transition-transform duration-500 ${motion}`}
        style={{
          background: FABRIC,
          boxShadow: 'inset 3px 0 4px rgba(0,0,0,0.12)',
          transform: isOn ? 'scaleX(0.16)' : 'scaleX(1)',
          transitionTimingFunction: EASE,
        }}
      />

      {/* Topuz: cam küre */}
      <span
        className={`absolute left-[4px] top-[4px] w-[26px] h-[26px] rounded-full transition-transform duration-500 ${motion}`}
        style={{
          background:
            'radial-gradient(circle at 32% 28%, rgba(255,255,255,0.95) 0 18%, rgba(255,255,255,0.35) 40%, rgba(255,255,255,0.15) 100%)',
          border: '1px solid rgba(255,255,255,0.85)',
          boxShadow: '0 2px 5px rgba(0,0,0,0.22), inset 0 -2px 4px rgba(120,110,170,0.25)',
          backdropFilter: 'blur(4px)',
          transform: isOn ? 'translateX(42px)' : 'translateX(0)',
          transitionTimingFunction: EASE,
        }}
      />
    </button>
  );
};

export default GlassSwitch;
