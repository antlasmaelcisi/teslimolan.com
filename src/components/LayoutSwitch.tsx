import React from 'react';

// Yerleşim seçici: tema anahtarlarıyla aynı yükseklikte, iki bölmeli bir hap.
// Seçili bölmenin altında beyaz bir topuz kayar; bölmelerdeki küçük çizimler
// yerleşimi anlatır: Modern = ayrı kartlar, Klasik = tek parça sayfa.
type Layout = 'modern' | 'classic';

interface LayoutSwitchProps {
  value: Layout;
  onChange: (value: Layout) => void;
  isDark: boolean;
}

const ModernIcon = () => (
  <svg width="26" height="16" viewBox="0 0 26 16" fill="currentColor" aria-hidden="true">
    <rect x="4" y="0.5" width="18" height="4" rx="1.5" />
    <rect x="4" y="6" width="18" height="4" rx="1.5" />
    <rect x="4" y="11.5" width="18" height="4" rx="1.5" />
  </svg>
);

const ClassicIcon = () => (
  <svg width="26" height="16" viewBox="0 0 26 16" fill="none" stroke="currentColor" aria-hidden="true">
    <rect x="4.5" y="1" width="17" height="14" rx="2" strokeWidth="1.5" />
    <path d="M7.5 5.5H18.5M7.5 8.5H18.5M7.5 11.5H15" strokeWidth="1.3" strokeLinecap="round" />
  </svg>
);

const OPTIONS: { value: Layout; label: string; Icon: React.FC }[] = [
  { value: 'modern', label: 'Modern yerleşim', Icon: ModernIcon },
  { value: 'classic', label: 'Klasik yerleşim', Icon: ClassicIcon },
];

const LayoutSwitch: React.FC<LayoutSwitchProps> = ({ value, onChange, isDark }) => (
  <div
    role="radiogroup"
    aria-label="Yerleşim"
    className={`relative w-[160px] h-[34px] rounded-full p-[3px] flex shadow-[inset_0_1px_3px_rgba(0,0,0,0.12)] ${isDark ? 'bg-white/10' : 'bg-gray-100'}`}
  >
    {/* Kayan topuz */}
    <span
      className={`absolute top-[3px] left-[3px] h-[28px] w-[77px] rounded-full shadow-[0_1px_4px_rgba(0,0,0,0.18)] transition-transform duration-300 motion-reduce:transition-none ${isDark ? 'bg-[#3a3a3c]' : 'bg-white'}`}
      style={{
        transform: value === 'classic' ? 'translateX(77px)' : 'translateX(0)',
        transitionTimingFunction: 'cubic-bezier(0.65, 0, 0.35, 1)',
      }}
    />
    {OPTIONS.map(({ value: v, label, Icon }) => {
      const active = value === v;
      return (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={active}
          aria-label={label}
          title={label}
          onClick={() => onChange(v)}
          className={`relative z-10 flex-1 flex items-center justify-center rounded-full transition-colors duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
            active ? (isDark ? 'text-blue-400' : 'text-blue-600') : isDark ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'
          }`}
        >
          <Icon />
        </button>
      );
    })}
  </div>
);

export default LayoutSwitch;
