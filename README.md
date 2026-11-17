# Kaos Arena

**Kaos Arena**, tarayıcıdan oynanan bağımsız, gerçek zamanlı çok oyunculu bir arena savaş oyunudur.

## Oynanış
- **1v1 düello:** 3, 5 veya 7 turluk maç. Her eleme bir tur kazandırır.
- **2v2 takım savaşı:** İki takım, toplam dört oyuncu. Dost ateşi kapalıdır. Seçilen eleme hedefine ulaşan takım kazanır.
- **Herkes tek (4 oyuncu):** Dört oyuncu kendi adına savaşır. İlk 3/5/7 elemeye ulaşan kazanır.
- **Dört silah:** Tabanca, otomatik tüfek, pompalı ve keskin nişancı.
- **Dört güçlendirme:** Sağlık, hız, kalkan ve hasar artışı.
- **Beş arena:** Neon Park, Buz Labirenti, Portal Partisi, Sek Sek ve Son Şans.
- **3D karakterler**, animasyonlar, ses efektleri ve can barları.
- **WebSocket odaları:** Oda kodu paylaşarak arkadaşlarınla oynayabilirsin. Oda kurucu maç ayarlarını belirler.

## Çalıştırma
Node.js 22 veya üzeri gereklidir.

```bash
npm install
npm test
npm start
```

Sunucu varsayılan olarak `http://localhost:3000` üzerinde başlar. Render’da `PORT` otomatik atanır.

## Render yayını
Bu depo bağımsız olarak `kaos-arena` adlı Node web servisine dağıtılır.

- Build: `npm install --omit=dev && npm test && node --check public/game.js && node --check public/arena3d.js`
- Start: `npm start`
- Health check: `/health`
- Region: Frankfurt
- İlgili ayarlar `render.yaml` dosyasında bulunur.

## Telif ve ses
Silah sesi lisansı ve kaynak bağlantıları için [AUDIO_CREDITS.md](AUDIO_CREDITS.md) dosyasına bakın. Diğer kodlar proje kapsamındaki MIT lisans beyanıyla dağıtılır.

**Bu repo bağımsızdır.** Geliştirmeler burada yapılır; başka bir oyunun canlı deposuna bağlı değildir.
