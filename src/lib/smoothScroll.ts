import Lenis from 'lenis';
import Snap from 'lenis/snap';
import 'lenis/dist/lenis.css';

/*
 * Lenis ile akıcı kaydırma.
 * - Sadece fare tekerleği / dokunmatik yüzey kaydırmasını yumuşatır;
 *   telefonlarda dokunarak kaydırma tarayıcının kendi davranışında kalır.
 * - "Hareketi azalt" ayarı açık olanlarda hiç başlatılmaz.
 * - Düzenleyici alanlarda (contenteditable) ve kendi içinde kayan
 *   kutularda (data-lenis-prevent) devre dışı kalır.
 */
let lenis: Lenis | null = null;

export function startSmoothScroll(): Lenis | null {
  if (typeof window === 'undefined') return null;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return null;

  lenis = new Lenis({
    autoRaf: true,
    lerp: 0.1,
    smoothWheel: true,
    anchors: true,
    prevent: (node) =>
      !!node.closest?.('[contenteditable="true"], [data-lenis-prevent], textarea, select'),
  });
  return lenis;
}

/*
 * Blok hizalama: kaydırma durduğunda, yakındaysa, iki blok arasındaki
 * boşluğun tam ortası sabit üst barın hemen altına gelecek şekilde
 * yumuşakça yerine oturur. Uzaktaysa hiçbir şey yapmaz ("meyil").
 *
 * container: blokları doğrudan çocuk olarak içeren eleman.
 * Dönen fonksiyon hizalamayı kaldırır.
 */
const HEADER_HEIGHT = 64;

export function attachBlockSnap(container: HTMLElement): () => void {
  if (!lenis) return () => {};
  const instance = lenis;

  const snap = new Snap(instance, {
    type: 'proximity',
    distanceThreshold: '12%',
    debounce: 250,
    duration: 0.6,
    easing: (t) => 1 - Math.pow(1 - t, 3),
  });

  let removers: Array<() => void> = [];

  const compute = () => {
    removers.forEach((r) => r());
    removers = [];
    const blocks = Array.from(container.children) as HTMLElement[];
    const scrollY = instance.scroll;
    for (let i = 1; i < blocks.length; i++) {
      const prevBottom = blocks[i - 1].getBoundingClientRect().bottom;
      const top = blocks[i].getBoundingClientRect().top;
      const gapMiddle = (prevBottom + top) / 2 + scrollY;
      const value = Math.round(gapMiddle - HEADER_HEIGHT);
      if (value > 0) removers.push(snap.add(value));
    }
  };

  compute();
  const ro = new ResizeObserver(() => compute());
  ro.observe(container);
  Array.from(container.children).forEach((c) => ro.observe(c));

  return () => {
    ro.disconnect();
    removers.forEach((r) => r());
    snap.destroy();
  };
}
