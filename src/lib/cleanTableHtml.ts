// Google Sheets'ten yapıştırılan tablo hücrelerindeki gereksiz biçimlendirmeyi temizler.
// Sheets her parçayı "font-size: 10pt; font-style: normal; color: ..." gibi stillerle ayrı ayrı sarar;
// bunların çoğu üst öğeden zaten miras alınan değerlerin tekrarıdır.
// Kural: sadece görünümü değiştirmeyen stiller silinir (renkler, kalın/italik farkları korunur).

const INHERITED_PROPS = ['color', 'font-size', 'font-weight', 'font-style', 'line-height', 'letter-spacing'];

// Hücre dışından bir şey miras alınmıyorsa bu değerler tarayıcının varsayılanıdır
const INITIAL_VALUES: Record<string, string> = {
  'font-weight': '400',
  'font-style': 'normal',
};

const TAG_DEFAULTS: Record<string, Record<string, string>> = {
  b: { 'font-weight': '700' },
  strong: { 'font-weight': '700' },
  i: { 'font-style': 'italic' },
  em: { 'font-style': 'italic' },
};

const normalize = (prop: string, value: string) => {
  const v = value.trim().toLowerCase().replace(/\s+/g, '');
  if (prop === 'font-weight') {
    if (v === 'bold') return '700';
    if (v === 'normal') return '400';
  }
  return v;
};

// Öğenin, hücre içindeki üst öğelerinden miras aldığı değer.
// Bilinmiyorsa (değer hücre dışından gelebilir) undefined döner.
const inheritedValue = (el: Element, prop: string, root: Element): string | undefined => {
  for (let p = el.parentElement; p && p !== root; p = p.parentElement) {
    const styled = (p as HTMLElement).style?.getPropertyValue(prop);
    if (styled) return normalize(prop, styled);
    const tagDefault = TAG_DEFAULTS[p.tagName.toLowerCase()]?.[prop];
    if (tagDefault) return tagDefault;
    // <font color> gibi öznitelikleri karşılaştırmaya çalışma, dokunma
    if (p.tagName.toLowerCase() === 'font' && prop === 'color' && p.hasAttribute('color')) return '\0';
  }
  return INITIAL_VALUES[prop];
};

const isPlainWrapper = (el: Element) =>
  (el.tagName === 'SPAN' || el.tagName === 'FONT') && el.attributes.length === 0;

const toHex = (n: string) => Number(n).toString(16).padStart(2, '0');

// Stili kısa biçimde yeniden yaz: "font-size: 10pt; color: rgb(52, 168, 83);" -> "font-size:10pt;color:#34a853"
const compactStyle = (el: HTMLElement) => {
  const parts: string[] = [];
  for (let i = 0; i < el.style.length; i++) {
    const prop = el.style[i];
    const value = el.style
      .getPropertyValue(prop)
      .replace(/rgb\(\s*(\d+),\s*(\d+),\s*(\d+)\s*\)/g, (_, r, g, b) => `#${toHex(r)}${toHex(g)}${toHex(b)}`);
    const important = el.style.getPropertyPriority(prop) ? '!important' : '';
    parts.push(`${prop}:${value}${important}`);
  }
  if (parts.length) el.setAttribute('style', parts.join(';'));
  else el.removeAttribute('style');
};

// Yan yana duran ve aynı değeri tekrarlayan span'leri (örn. hepsi font-size:10pt) tek bir
// dış span'e sarar, değeri bir kez yazar. Arada metin olan span'lere dokunmaz ki
// aradaki metnin görünümü değişmesin.
const hoistSharedProp = (root: Element, prop: string) => {
  const parents = [root, ...Array.from(root.querySelectorAll('*'))];
  for (const parent of parents) {
    let run: HTMLElement[] = [];
    let runValue = '';
    const flush = () => {
      if (run.length >= 2) {
        const wrapper = parent.ownerDocument!.createElement('span');
        wrapper.style.setProperty(prop, runValue);
        run[0].before(wrapper);
        for (const span of run) {
          wrapper.append(span);
          span.style.removeProperty(prop);
          if (!span.getAttribute('style')?.trim()) span.removeAttribute('style');
          if (isPlainWrapper(span)) span.replaceWith(...Array.from(span.childNodes));
        }
      }
      run = [];
      runValue = '';
    };
    for (const node of Array.from(parent.childNodes)) {
      const value = node instanceof HTMLElement && node.tagName === 'SPAN' && !node.style.getPropertyPriority(prop)
        ? node.style.getPropertyValue(prop)
        : '';
      if (value && (run.length === 0 || value === runValue)) {
        run.push(node as HTMLElement);
        runValue = value;
      } else {
        flush();
        if (value) {
          run.push(node as HTMLElement);
          runValue = value;
        }
      }
    }
    flush();
  }
};

export function cleanTableCellHtml(html: string): string {
  if (!html || typeof DOMParser === 'undefined') return html;

  const doc = new DOMParser().parseFromString(`<div id="__cell">${html}</div>`, 'text/html');
  const root = doc.getElementById('__cell');
  if (!root) return html;

  // 1. Üst öğeden zaten gelen stil tekrarlarını sil (belge sırasıyla: önce üst, sonra alt öğe)
  root.querySelectorAll<HTMLElement>('[style]').forEach(el => {
    for (const prop of INHERITED_PROPS) {
      const value = el.style.getPropertyValue(prop);
      if (!value || el.style.getPropertyPriority(prop)) continue;
      if (normalize(prop, value) === inheritedValue(el, prop, root)) el.style.removeProperty(prop);
    }
    // text-decoration miras alınmaz; span/div üzerindeki "none" hiçbir şeyi değiştirmez
    if ((el.tagName === 'SPAN' || el.tagName === 'DIV') && normalize('text-decoration', el.style.textDecoration) === 'none') {
      el.style.removeProperty('text-decoration');
    }
    // div zaten blok öğedir; vertical-align blok öğelerde etkisizdir;
    // kenar boşluğu/dolgu/kenarlık yoksa width:100% varsayılan genişlikle aynıdır
    if (el.tagName === 'DIV') {
      if (el.style.display === 'block') el.style.removeProperty('display');
      if (!el.style.display) el.style.removeProperty('vertical-align');
      const hasBoxSpacing = Array.from(el.style).some(p => /^(margin|padding|border)/.test(p));
      if (el.style.width === '100%' && !hasBoxSpacing) el.style.removeProperty('width');
    }
    if (!el.getAttribute('style')?.trim()) el.removeAttribute('style');
  });

  // 2. Hiçbir özelliği kalmayan span'leri kaldır, içeriklerini yerinde bırak
  root.querySelectorAll('span, font').forEach(el => {
    if (isPlainWrapper(el)) el.replaceWith(...Array.from(el.childNodes));
  });

  // 3. Aynı stile sahip yan yana span'leri birleştir
  root.querySelectorAll('span').forEach(span => {
    if (!span.isConnected) return;
    let next = span.nextSibling;
    while (
      next instanceof HTMLElement &&
      next.tagName === 'SPAN' &&
      next.attributes.length === span.attributes.length &&
      Array.from(span.attributes).every(attr => next instanceof HTMLElement && next.getAttribute(attr.name) === attr.value)
    ) {
      span.append(...Array.from(next.childNodes));
      next.remove();
      next = span.nextSibling;
    }
  });

  // 4. Ortak boyut/kalınlık/italik değerlerini tek bir dış span'e taşı
  for (const prop of ['font-size', 'font-weight', 'font-style']) hoistSharedProp(root, prop);

  // 5. Stilleri kısa yaz
  root.querySelectorAll<HTMLElement>('[style]').forEach(compactStyle);

  return root.innerHTML;
}
