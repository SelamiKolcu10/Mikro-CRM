# Mobil Geliştirme — Başlatma Rehberi

cd C:\Users\selam\Desktop\Micro-CRM\mobile
$env:EXPO_OFFLINE = "1"
npm run android


Micro-CRM mobil uygulaması (`mobile/`, Expo SDK 57 + React Native).
Her geliştirme oturumunda **3 şey açık olmalı**: emülatör, backend, Metro.

```
MongoDB → backend (5000) → Metro/Expo (8081) → Expo Go (emülatör)
                                                 ↑ backend'e 10.0.2.2:5000 ile bağlanır
```

Biri eksikse uygulama açılmaz veya veri gelmez.

---

## Her oturumda: 3 adım

### 1) Emülatör (Android Studio)

Android Studio'yu aç → **⋮ / More Actions → Virtual Device Manager** → `Pixel_7` yanındaki **▶**

Emülatör açıldıktan sonra Android Studio'yu **kapatabilirsin**. Studio sadece emülatörü ve SDK'yı sağlıyor; kod VS Code'da yazılıyor.

**Gerçekten hazır mı?** Pencerenin açılmış olması yetmez, şunu kontrol et:

```powershell
adb devices
```

| Çıktı | Anlamı |
|---|---|
| `emulator-5554   device` | ✅ hazır, devam et |
| `emulator-5554   offline` | ⏳ hâlâ açılıyor |
| 2 dakika sonra hâlâ `offline` | ❌ takılmış → aşağıdaki **Cold Boot**'a bak |

`adb` komutu bulunamazsa tam yolu kullan:
```powershell
& "$env:USERPROFILE\AppData\Local\Android\Sdk\platform-tools\adb.exe" devices
```

### 2) Backend (ayrı terminal, açık kalacak)

```powershell
cd C:\Users\selam\Desktop\Micro-CRM\backend
npm run dev
```

Port **5000**. Sadece "Gelen Faturalar" (OCR) ekranıyla uğraşacaksan ek olarak:

```powershell
cd C:\Users\selam\Desktop\Micro-CRM\invoice-ocr-v2
npm run dev
```

Port **5002**.

### 3) Metro / Expo (ayrı terminal, açık kalacak)

```powershell
cd C:\Users\selam\Desktop\Micro-CRM\mobile
npm run android
```

Bu komut Metro'yu başlatır, emülatörde Expo Go'yu açar ve uygulamayı yükler.
Şunu görürsen her şey yolunda:

```
› Opening exp://<IP>:8081 on Pixel_7
Android Bundled 1858ms index.js (1621 modules)
```

---

## Giriş bilgileri

| Kullanıcı | Şifre |
|---|---|
| `admin@microcrm.com` | `admin123` |
| diğer personel | `selami10` |
| portal müşterileri | `12345678` |

---

## Geliştirme döngüsü

Üç terminal açık kaldığı sürece:

**`mobile/src/**` altında dosyayı kaydet → emülatör kendini anında günceller** (Fast Refresh).

Yeniden başlatmaya gerek yok. Yeniden başlatman gereken tek durum: **paket kurulumu** (aşağıya bak).

Emülatörde kullanışlı kısayollar:
- `R` `R` (arka arkaya iki kez) → uygulamayı yeniden yükle
- `Ctrl + M` → geliştirici menüsü

---

## Kapatırken

Emülatörü **pencerenin X'i ile kapat.** Süreci zorla öldürme, emülatör açıkken PC'yi kapatma.

> Temiz olmayan kapanış, bir sonraki açılışta emülatörün takılmasına sebep oluyor (aşağıdaki Cold Boot bölümü).

---

## Sorun giderme

### Emülatör açılmıyor / `adb devices` sürekli `offline`

**Çözüm — tek komut:**

```powershell
cd C:\Users\selam\Desktop\Micro-CRM\mobile
npm run emu
```

Takılı süreçleri kapatır, kalıntı kilitleri siler, adb'yi yeniler ve emülatörü temiz boot ile açar. Başka bir AVD için: `npm run emu Pixel_7_2`.

**2 dakika kuralı:** `adb devices` 2 dakika içinde `device` demiyorsa bekleme, komutu çalıştır.

**Neden oluyor?** İki sebep üst üste biniyor:

1. **Görünmez emülatör.** Android Studio emülatörü `-qt-hide-window` ile, yani "Running Devices" panelinin içine gömülü açıyor. O panel bağlanamazsa emülatör arka planda **penceresiz** çalışır ve orada takılır. Sen "açılmadı" sanırsın, aslında ayaktadır. Belirti: `adb devices` uzun süre `offline`, qemu süreci ~350 MB RAM'de sabit (sağlıklı bir emülatör ~5 GB kullanır).

2. **Kalıntı kilitler.** Takılan süreç `hardware-qemu.ini.lock` ve `multiinstance.lock` dosyalarını geride bırakır; bunlar bir **sonraki** açılışı da bloke eder. Sorunun kendini tekrar etmesinin sebebi bu zincir.

Kalıcı önlem: **Settings → Tools → Emulator → "Launch in the Running Devices tool window"** işaretini kaldır. Emülatör bundan sonra kendi ayrı penceresinde açılır.

> `.lock` dosyaları emülatör **çalışırken** de vardır ve normaldir — sorun yalnızca ölü süreçten kalanlarıdır.

### Uygulama açılıyor ama veri gelmiyor / giriş yapılamıyor

Backend çalışmıyordur. Kontrol:
```powershell
netstat -ano | findstr ":5000"
```
Boşsa 2. adımı çalıştır.

### "Module not found" / paket kurulumundan sonra garip hatalar

```powershell
cd C:\Users\selam\Desktop\Micro-CRM\mobile
npm run fresh
```

**Her `npm install`'dan sonra bunu çalıştır.**

### Metro açık ama emülatörde uygulama gelmedi / "Packager is not running"

Emülatör Metro'ya ulaşamıyordur. Hangi adresin çalıştığı oturuma göre değişiyor (bazen LAN IP, bazen `10.0.2.2`), o yüzden **adrese hiç güvenme** — `adb reverse` ile emülatörün kendi `127.0.0.1`'ini host'un 8081'ine bağla, bu her koşulda çalışır:

```powershell
$adb = "$env:USERPROFILE\AppData\Local\Android\Sdk\platform-tools\adb.exe"
& $adb reverse tcp:8081 tcp:8081
& $adb shell am force-stop host.exp.exponent
& $adb shell am start -a android.intent.action.VIEW -d "exp://127.0.0.1:8081" host.exp.exponent
```

Metro log'unda `Android Bundled ... ms` satırını görürsen yüklenmiştir.

> `adb reverse` emülatör her yeniden başladığında sıfırlanır — cold boot sonrası tekrar ver.

### Expo başlarken `AbortError: This operation was aborted` ile düşüyor

Expo CLI, Expo Go'nun sürümünü kontrol etmek için Expo sunucusuna çıkıyor; senin ağın bu CDN'i boğduğu için istek zaman aşımına uğrayıp başlatmayı komple düşürüyor. Kontrolü atla:

```powershell
$env:EXPO_OFFLINE = "1"
npm run android
```

Expo Go emülatörde zaten kurulu olduğu için bu kontrolün sana faydası yok. `npm run fresh` de aynı sebeple düşerse önce `$env:EXPO_OFFLINE = "1"` ver.

---

## Faydalı komutlar

```powershell
# bağlı cihazlar
adb devices

# hangi AVD'ler var
& "$env:USERPROFILE\AppData\Local\Android\Sdk\emulator\emulator.exe" -list-avds

# emülatör açılışını bitirdi mi (1 = evet)
adb shell getprop sys.boot_completed

# Expo Go kurulu mu
adb shell pm list packages | findstr exponent

# hangi portlar dinliyor
netstat -ano | findstr ":5000 :8081 :5002"
```

---

## Notlar

- İki AVD var: **`Pixel_7`** (kullanılan, Expo Go kurulu) ve `Pixel_7_2`.
- Emülatör PC'ye `localhost` ile ulaşamaz; `10.0.2.2` emülatörün host makineye açılan özel adresidir. Ayar: [mobile/src/config/apiUrls.js](mobile/src/config/apiUrls.js)
- Gerçek telefonda Expo Go ile denemek istersen `EXPO_PUBLIC_API_URL` ortam değişkenini PC'nin LAN IP'sine ayarla.
- Kod düzeni ve mimari notlar: [mobile/AGENTS.md](mobile/AGENTS.md)
