/*
 * Tüm projeyi tek komutla başlatır: backend, web frontend, emülatör (boot
 * gerekiyorsa), mobil Metro. `npm run start:all` ile çalıştırılır.
 *
 * Emülatör boot'u önce senkron bekler (mobile/scripts/fix-emulator.js),
 * çünkü Metro emülatör hazır olmadan `expo start --android` çağrılırsa
 * cihaz bulamaz. Diğer üçü (backend, frontend, metro) paralel başlar.
 *
 * EXPO_OFFLINE burada process.env üzerinden veriliyor (child_process env
 * seçeneğiyle) — PowerShell/bash fark etmeden çalışsın diye shell'e özgü
 * `VAR=1 cmd` sözdizimine gerek kalmıyor.
 */
const { spawn, spawnSync } = require('child_process');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const MOBILE = path.join(ROOT, 'mobile');

function run(label, cmd, args, cwd, extraEnv) {
  const child = spawn(cmd, args, {
    cwd,
    shell: true,
    env: { ...process.env, ...extraEnv },
    stdio: 'pipe',
  });
  const prefix = `[${label}]`;
  child.stdout.on('data', (d) =>
    d
      .toString()
      .split('\n')
      .filter(Boolean)
      .forEach((line) => console.log(prefix, line))
  );
  child.stderr.on('data', (d) =>
    d
      .toString()
      .split('\n')
      .filter(Boolean)
      .forEach((line) => console.error(prefix, line))
  );
  child.on('exit', (code) => console.log(prefix, `exited (${code})`));
  return child;
}

console.log('→ Emülatör boot kontrol ediliyor (gerekirse cold boot, ~30-60sn sürebilir)...');
const emu = spawnSync('npm', ['run', 'emu'], { cwd: MOBILE, shell: true, stdio: 'inherit' });
if (emu.status !== 0) {
  console.error('✗ Emülatör başlatılamadı, mobil adımı atlanıyor. Backend/frontend yine de başlıyor.');
}

run('backend', 'npm', ['run', 'dev'], path.join(ROOT, 'backend'));
run('frontend', 'npm', ['run', 'dev'], path.join(ROOT, 'frontend'));
if (emu.status === 0) {
  run('mobile', 'npm', ['run', 'android'], MOBILE, { EXPO_OFFLINE: '1' });
}

console.log('\nHepsi başlatıldı → web: http://localhost:5173  |  backend: :5000  |  mobil: emülatörde açılıyor');
console.log('Durdurmak için bu terminali kapat / Ctrl+C.\n');
