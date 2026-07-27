/*
 * Temiz başlatma — tek komut. `npm run fresh` bunu çalıştırır.
 *
 * Ne zaman gerekli: SADECE yeni bir paket kurduktan sonra (npm/expo install).
 * O durumda çalışan Metro eski cache'e takılabiliyor; bu script sırayla:
 *   1) 8081'de çalışan Metro'yu durdurur (varsa),
 *   2) Metro/Expo cache'lerini siler,
 *   3) Expo'yu temiz cache ile başlatıp emülatöre gönderir.
 *
 * Gün-içi normal kodlamada BUNA GEREK YOK — `npm run android` bir kez yeter,
 * Fast Refresh gerisini halleder.
 */
const { execSync, spawn } = require('child_process');
const os = require('os');
const fs = require('fs');
const path = require('path');

function killPort(port) {
  try {
    if (process.platform === 'win32') {
      const out = execSync('netstat -ano -p tcp', { encoding: 'utf8' });
      const pids = new Set();
      for (const line of out.split('\n')) {
        if (line.includes(`:${port} `) && /LISTENING/i.test(line)) {
          const pid = line.trim().split(/\s+/).pop();
          if (pid && pid !== '0') pids.add(pid);
        }
      }
      for (const pid of pids) {
        try {
          execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' });
          console.log(`   Metro (PID ${pid}) durduruldu`);
        } catch { /* zaten kapanmış olabilir */ }
      }
      if (pids.size === 0) console.log('   8081 zaten boş');
    } else {
      execSync(`lsof -ti tcp:${port} | xargs -r kill -9`, { stdio: 'ignore' });
    }
  } catch { /* port boşsa netstat/lsof hata verebilir — sorun değil */ }
}

function rmrf(p) {
  try { fs.rmSync(p, { recursive: true, force: true }); } catch { /* yoksa geç */ }
}

const root = path.join(__dirname, '..');

console.log('🧹 Temiz başlatma');
console.log('1) Çalışan Metro durduruluyor (8081)');
killPort(8081);

console.log('2) Cache temizleniyor (.expo, metro-cache, haste-map)');
rmrf(path.join(root, '.expo'));
rmrf(path.join(root, 'node_modules', '.cache'));
try {
  const tmp = os.tmpdir();
  for (const name of fs.readdirSync(tmp)) {
    if (name.startsWith('metro-') || name.startsWith('haste-map-')) {
      rmrf(path.join(tmp, name));
    }
  }
} catch { /* temp okunamazsa geç */ }

console.log('3) Expo başlatılıyor (temiz cache + emülatör)\n');
const child = spawn('npx', ['expo', 'start', '-c', '--android'], {
  stdio: 'inherit',
  shell: true,
  cwd: root,
});
child.on('exit', (code) => process.exit(code ?? 0));
