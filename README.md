# teslimolan.com

[teslimolan.com](https://teslimolan.com) sitesinin kaynak kodu. React + Vite ile yazılmış bir blog uygulamasıdır. Yazılar Firebase Firestore'da tutulur ve `/admin` panelinden düzenlenir. Site Vercel üzerinde yayınlanır.

## Yerelde çalıştırma

**Gereksinim:** Node.js

1. Bağımlılıkları kurun: `npm install`
2. Geliştirme sunucusunu başlatın: `npm run dev`
3. Tarayıcıda `http://localhost:3000` adresini açın.

## Yapı

- `src/App.tsx`: Okuyucu sayfaları ve admin editörü
- `src/lib/firebase.ts`: Firebase bağlantısı, giriş ve yazı kaydetme işlemleri
- `src/lib/cleanTableHtml.ts`: Google Sheets'ten yapıştırılan tablolardaki gereksiz biçimlendirmeyi temizler
- `api/render.ts`: Vercel fonksiyonu. Her sayfa isteğinde yazının başlığını, açıklamasını ve görselini HTML'e ekler (Google ve sosyal medya önizlemeleri için).
- `api/sitemap.ts`: Vercel fonksiyonu. Yayınlanmış yazılardan `/sitemap.xml` site haritasını oluşturur
- `firestore.rules`: Veritabanı güvenlik kuralları
