/*
 * Emülatör kurtarma — tek komut. `npm run emu` bunu çalıştırır.
 *
 * Ne zaman gerekli: emülatör "açılmıyor" gibi göründüğünde. Genelde açılmamış
 * değildir — Android Studio onu gömülü pencere modunda (-qt-hide-window)
 * başlatır, tool window bağlanamazsa süreç arka planda görünmez şekilde çalışır
 * ve orada donar. Donan süreç `hardware-qemu.ini.lock` / `multiinstance.lock`
 * dosyalarını geride bırakır, o kilitler de bir SONRAKİ açılışı bloke eder.
 * Sorunun kendini tekrar etmesinin sebebi bu zincir.
 *
 * Script sırayla:
 *   1) donmuş emulator/qemu süreçlerini öldürür,
 *   2) AVD'nin kalıntı .lock dosyalarını siler,
 *   3) adb sunucusunu yeniden başlatır,
 *   4) emülatörü GÖRÜNÜR pencereyle ve -no-snapshot-load ile açar
 *      (bozuk quick-boot snapshot'ını atlayıp temiz boot yapar),
 *   5) boot tamamlanana kadar bekler.
 *
 * Kullanım: npm run emu           → ilk AVD'yi açar
 *           npm run emu Pixel_7_2 → adı verilen AVD'yi açar
 */
const { execSync, execFileSync, spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const SDK =
  process.env.ANDROID_HOME ||
  process.env.ANDROID_SDK_ROOT ||
  path.join(os.homedir(), 'AppData', 'Local', 'Android', 'Sdk');

const exe = (p) => (process.platform === 'win32' ? `${p}.exe` : p);
const ADB = path.join(SDK, 'platform-tools', exe('adb'));
const EMULATOR = path.join(SDK, 'emulator', exe('emulator'));
const AVD_HOME = path.join(os.homedir(), '.android', 'avd');

if (!fs.existsSync(EMULATOR)) {
  console.error(`✗ Emülatör bulunamadı: ${EMULATOR}`);
  console.error('  ANDROID_HOME doğru mu? Android Studio SDK kurulu mu?');
  process.exit(1);
}

const adb = (args, opts = {}) =>
  execFileSync(ADB, args, { encoding: 'utf8', stdio: 'pipe', ...opts });

// AVD seçimi EN BAŞTA doğrulanır — aşağıdaki adımlar çalışan emülatörü
// kapatıyor, geçersiz bir isim yüzünden onu boşuna öldürmeyelim.
const avds = execFileSync(EMULATOR, ['-list-avds'], { encoding: 'utf8' })
  .split('\n')
  .map((s) => s.trim())
  .filter(Boolean);

if (avds.length === 0) {
  console.error("✗ Hiç AVD yok. Android Studio → Device Manager'dan bir cihaz oluştur.");
  process.exit(1);
}

const wanted = process.argv[2];
if (wanted && !avds.includes(wanted)) {
  console.error(`✗ "${wanted}" adlı AVD yok. Mevcutlar: ${avds.join(', ')}`);
  process.exit(1);
}
const avd = wanted || avds[0];

console.log('🔧 Emülatör kurtarma\n');

// 1) Donmuş süreçleri öldür ------------------------------------------------
console.log('1) Çalışan emülatör süreçleri durduruluyor');
const PROCS = ['qemu-system-x86_64', 'qemu-system-aarch64', 'emulator'];
let killed = 0;
for (const name of PROCS) {
  try {
    if (process.platform === 'win32') {
      // taskkill hedef bulamazsa 128 ile çıkar — o yüzden stdio yutuluyor.
      execSync(`taskkill /IM ${name}.exe /F`, { stdio: 'ignore' });
    } else {
      execSync(`pkill -f ${name}`, { stdio: 'ignore' });
    }
    console.log(`   ${name} durduruldu`);
    killed++;
  } catch {
    /* çalışmıyordu — normal */
  }
}
if (killed === 0) console.log('   Çalışan emülatör yoktu');

// 2) Kalıntı kilitleri sil -------------------------------------------------
// NOT: kilitler emülatör AÇIKKEN de var olur ve normaldir; sorun ölü süreçten
// geriye kalmalarıdır. 1. adımda süreçleri öldürdüğümüz için buradakiler
// tanım gereği kalıntıdır.
console.log('2) Kalıntı kilit dosyaları temizleniyor');
let removed = 0;
try {
  for (const entry of fs.readdirSync(AVD_HOME)) {
    if (!entry.endsWith('.avd')) continue;
    const dir = path.join(AVD_HOME, entry);
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith('.lock')) continue;
      // .lock'lar dizin de olabiliyor (multiinstance.lock) — recursive gerek.
      fs.rmSync(path.join(dir, f), { recursive: true, force: true });
      console.log(`   ${entry}/${f}`);
      removed++;
    }
  }
} catch (e) {
  console.log(`   AVD klasörü okunamadı (${e.code}) — atlanıyor`);
}
if (removed === 0) console.log('   Kalıntı kilit yoktu');

// 3) adb'yi yeniden başlat -------------------------------------------------
console.log('3) adb sunucusu yeniden başlatılıyor');
try {
  adb(['kill-server']);
  adb(['start-server']);
} catch {
  console.log('   adb yeniden başlatılamadı — devam ediliyor');
}

// 4) Görünür pencereyle aç -------------------------------------------------
console.log(`4) "${avd}" açılıyor (görünür pencere, temiz boot)`);
// detached + ignore: emülatör bu script'ten uzun yaşamalı, script bitince
// onunla birlikte ölmemeli.
const child = spawn(EMULATOR, ['-avd', avd, '-no-snapshot-load'], {
  detached: true,
  stdio: 'ignore',
});
child.unref();

// 5) Boot'u bekle ----------------------------------------------------------
console.log('5) Boot bekleniyor (~30-60 sn)');
const DEADLINE = Date.now() + 180_000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  while (Date.now() < DEADLINE) {
    await sleep(3000);
    try {
      // Cihaz "device" olmadan (offline'ken) getprop hata verir — catch'e düşer.
      if (adb(['shell', 'getprop', 'sys.boot_completed']).trim() === '1') {
        const model = adb(['shell', 'getprop', 'ro.product.model']).trim();
        const rel = adb(['shell', 'getprop', 'ro.build.version.release']).trim();
        console.log(`\n✓ Hazır — ${model} (Android ${rel})`);
        console.log('  Uygulamayı göndermek için: npm run android');
        return;
      }
    } catch {
      /* henüz offline — beklemeye devam */
    }
    process.stdout.write('.');
  }
  console.error('\n\n✗ 3 dakikada boot etmedi.');
  console.error('  Donanım hızlandırmayı kontrol et:');
  console.error(`  "${EMULATOR}" -accel-check`);
  process.exit(1);
})();
