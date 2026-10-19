# teslimolan.com — Claude için proje rehberi

Kuran üzerine incelemeler yayınlanan kişisel site. Vite + React 19 + TypeScript, Tailwind CSS v4, Firebase (Auth + Firestore), Vercel üzerinde yayında. Kullanıcıyla Türkçe konuş.

## Çalışma kuralları

- `main` dalına her gönderim Vercel'de canlıya çıkar. Değişiklikleri ayrı dalda yap, Pull Request aç; Vercel her dal için önizleme üretir (`teslimolancom-git-<dal>-antlasmaelcisi.vercel.app`).
- Göndermeden önce: `npx tsc --noEmit` ve `npx vite build` hatasız geçmeli.
- Kodun büyük kısmı `src/App.tsx` içinde (~3800 satır). Global stiller `src/index.css`.

## Tasarım DNA'sı

Tam ve ölçülmüş tasarım profili: `.claude/design-dna.json`. Arayüze bir şey eklemeden veya değiştirmeden önce oku; yeni parçalar mevcut dile birebir uymalı. Özet:

- **Hava:** Apple / macOS Big Sur esintili, sakin, temiz, okunaklı. Süs az.
- **Renk:** Zemin `#f5f5f7` (karanlık `#000`), kart beyaz (karanlık `#1c1c1e`), metin `#1d1d1f`. Birincil mavi `#007aff`, Google mavisi `#1a73e8`. Logo/marka yeşili `#1F7144`. Yeni renk icat etme; bu paletten seç.
- **Yazı:** Arial / sistem fontu. Gövde 14px. Başlıklar kalın + `tracking-tight`. Menü etiketleri 10px, kalın, BÜYÜK HARF, geniş aralık.
- **Ölçüler:** Her boşluk 4px'in katı. Düğme yüksekliği `h-control` (32px). Yarıçap: düğme 8px, menü öğesi 12px, kart/menü 16px.
- **İkonlar:** `lucide-react`, ince kontür, **asla dolu değil**. Araç çubuğunda gri (`gray-500`, karanlıkta `gray-400`), üzerine gelince koyulaşır. Araç çubuğu ikon düğmeleri arka plansız ve kenarlıksızdır.
- **Hareket:** Sadece kısa geçişler: `transition-colors`/`transition-all`, 200–300ms, basınca `active:scale-[0.98]`. Ortam animasyonu (hareketli arka plan, parallax, kayan efektler) **yok**; kullanıcı denedi ve istemedi.
- **Karanlık mod:** Her yeni öğe `isDarkModeActive` ile iki temaya da uyarlanmalı. Karanlıkta gölge yerine soluk kenarlık (`white/10`) kullanılır.
- **Erişilebilirlik:** Sadece ikondan oluşan düğmelere `aria-label` ve `title` ekle.

## Reddedilen denemeler (tekrar önerme)

- Ayarlar dişlisinin üzerine gelince içinin dolması.
- Arka plandaki renk lekelerinin hareket etmesi ve yeni renklerin eklenmesi.

## Yetenekler (`.claude/skills/`)

- `design-dna` — tasarım profilini çıkarır/uygular (zanwei/design-dna).
- `baseline-ui`, `improve-ui`, `fixing-accessibility`, `fixing-metadata`, `fixing-motion-performance`, `create-design-md` — ibelick/ui-skills.

Bu yetenekler genel kurallar içerir; bu dosyadaki ve `.claude/design-dna.json`'daki siteye özel kurallar onlarla çelişirse sitenin kuralları geçerlidir.
