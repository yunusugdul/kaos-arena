# Kaos Arena — Zırhlı Birlikler

## Başlatma ve menü müziği düzeltmesi

SAVAŞI BAŞLAT artık 3D sahnenin hazırlanmasını bekler ve doğrudan geri sayımı açar. İkinci bir hazır olma onayı yoktur; eski 2D emoji sahnesi yükleme sırasında gösterilmez. Yükleme başarısızsa menüde tekrar deneme mesajı verilir.

Menü düğmeleri ve form yazıları kalınlaştırılmıştır. Gönderilen müzik `public/audio/menu-music.mp3` içinde yereldir. Tarayıcının ilk kullanıcı etkileşiminden sonra menüde çalar, maç başlayınca durur ve menüye dönünce yeniden çalar. SES düğmesi menü müziğini de kontrol eder.

## Akıcı 3D menü sürümü

- Ana menü, referanstaki asılı tabela düzeninden esinlenen gerçek zamanlı 3D karargâh sahnesidir. OYNA maç ayarlarını açar; SES, REHBER ve YAPIM düğmeleri çalışır.
- Menü, tüm oyun haritasını ve oyun çizicisini hazırlamadan ilk görüntüsünü verir. Oyun sırasında menü çizimi durur.
- Sabit çevre parçaları ve zırhın birlikte hareket eden parçaları birleştirilir. Bir karakterin çizilen parça sayısı 110'dan 31'e düşmüştür. Eklem ve silah tutuş kontrolleri korunur.
- Oyun çizimi ekranın requestAnimationFrame sıklığını takip eder; 60 FPS sınırı eklenmemiştir. Gölgeler 30 Hz güncellenir. Çizim süresi yüksekse çözünürlük kademeli ayarlanır.
- 1280×720 yerel tarayıcı testinde hareket ve ateş sırasında yaklaşık 144 FPS görülmüştür. Ölçülen çizim çağrıları önceki sürümde yaklaşık 580, yeni sürümde 117–160; çizim süresi yaklaşık 5,3 ms yerine 1,4–2,6 ms olmuştur. İlk menü görüntüsü yaklaşık 0,65 saniyede sunulmuştur. Bunlar ölçülen örneklerdir; farklı cihaz ve çözünürlükler aynı sonucu garanti etmez.

Three.js optimizasyon kaynağı: https://threejs.org/manual/pages/optimize-lots-of-objects.html

## Açılış

Node.js 22 veya üzeri gereklidir. RAR içeriğini bir klasöre çıkartıp BASLAT.bat dosyasını çalıştırın. Tarayıcı açılır; 3300 portu doluysa boş bir port seçilir. Konsol penceresini oyun boyunca açık tutun.

## Bu sürüm

- Referans görsellerdeki mavi-turuncu ve kırmızı-beyaz zırhlardan esinlenen, özgün ve eklemli 3D karakter geometrisi.
- İki el için ayrı silah tutuş noktaları ve iki kemikli kol çözümü. Nişan, koşma, geri tepme ve şarjör değişimi sırasında eller tutuş noktalarını takip eder.
- Şarjör hareketi ve doldurma süresine uyarlanan yerel şarjör sesi.
- Mavi ve kırmızı taraflar için iki ayrı yerel silah kaydı. Çevrimiçi konuklar da taraflara göre doğru sesleri duyar.
- Dört silah için farklı namlu çıkış mesafesi; mermiler namlu yüksekliğinde görünür.
- Küçük göstergeler, tam ekran arena, mevcut haritalar, çarpışmalar ve oda sistemi.

Karakterler referans resimlerin birebir 3D taraması değildir. Renk, kask, vizör, zırh ve silah tasarımı bu resimler esas alınarak geometri ile oluşturulmuştur. Eski Soldier.glb dosyası kaynak paketinde tutulur; bu sürümde görünen karakterler armored-marine.js tarafından oluşturulur.

## Kontroller

WASD: hareket · Fare: nişan · Sol tık: ateş · Space: atıl · E: kalkan · R: şarjör · Enter: sohbet

## Geliştirme ve yayın

npm install
npm test
npm start

Render için render.yaml kullanılabilir. Bu arşivin hazırlanması GitHub veya canlı yayını otomatik güncellemez.

## Kaynaklar

Three.js: https://github.com/mrdoob/three.js
IK örneği: https://threejs.org/examples/webgl_animation_skinning_ik.html
Malzemeler: https://threejs.org/docs/pages/MeshPhysicalMaterial.html
Ses kaynakları: AUDIO_CREDITS.md
