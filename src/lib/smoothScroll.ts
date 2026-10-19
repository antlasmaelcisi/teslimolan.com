import Lenis from 'lenis';
import 'lenis/dist/lenis.css';

/*
 * Lenis ile akıcı kaydırma.
 * - Sadece fare tekerleği / dokunmatik yüzey kaydırmasını yumuşatır;
 *   telefonlarda dokunarak kaydırma tarayıcının kendi davranışında kalır.
 * - "Hareketi azalt" ayarı açık olanlarda hiç başlatılmaz.
 * - Düzenleyici alanlarda (contenteditable) ve kendi içinde kayan
 *   kutularda (data-lenis-prevent) devre dışı kalır.
 */
export function startSmoothScroll(): Lenis | null {
  if (typeof window === 'undefined') return null;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return null;

  return new Lenis({
    autoRaf: true,
    lerp: 0.1,
    smoothWheel: true,
    anchors: true,
    prevent: (node) =>
      !!node.closest?.('[contenteditable="true"], [data-lenis-prevent], textarea, select'),
  });
}
