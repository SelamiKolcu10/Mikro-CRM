#!/usr/bin/env node
/**
 * Tüm çalışma alanlarında `npm audit` çalıştırır ve SECURITY.md'de gerekçesi
 * yazılı bulguları hariç tutarak sonucu değerlendirir.
 *
 * Neden düz `npm audit --audit-level=high` değil: kabul edilmiş iki bulgu
 * (bkz. ALLOWLIST) her koşuda CI'ı kırardı. Eşiği gevşetmek ise gerçek yeni
 * bir açığı da görünmez yapardı. Bu betik yalnızca ADI GEÇEN advisory'leri
 * susturur — başka her şey eşiğe takılır.
 *
 * Kullanım:  node scripts/audit-check.js
 * Çıkış kodu: 0 = temiz, 1 = allowlist dışı bulgu var
 */
const { execSync } = require('child_process');
const path = require('path');

const ROOT = path.join(__dirname, '..');

// Yalnızca üretim bağımlılıkları taranır (--omit=dev): devDependency zincirinde
// çıkan bir açık yayımlanan artefakta girmez, CI'ı kırması yanıltıcı olur.
const WORKSPACES = ['backend', 'invoice-ocr-service', 'invoice-ocr-v2', 'frontend', 'mobile'];

// Bu eşik ve üstündeki bulgular CI'ı kırar.
const FAIL_AT = ['moderate', 'high', 'critical'];

/**
 * Gerekçeleri repo kökündeki SECURITY.md'de. Buraya bir kayıt eklemek,
 * SECURITY.md'ye de gerekçe yazmadan YAPILMAMALI — aksi halde allowlist
 * sessizce çöplüğe döner.
 */
const ALLOWLIST = {
  'GHSA-qwww-vcr4-c8h2':
    'react-router RSC modu CSRF — uygulama BrowserRouter SPA, RSC kod yolu hiç çalışmıyor; 7.x hattında yamalı sürüm yok',
  'GHSA-w5hq-g745-h8pq':
    'uuid <11.1.1, xcode→@expo/config-plugins zinciri — build-zamanı aracı, yayımlanan pakete girmiyor',
};

/** npm audit advisory URL'sinden GHSA kimliğini çıkarır. */
const ghsaFrom = (url) => (typeof url === 'string' ? (url.match(/GHSA-[\w-]+/) || [])[0] : undefined);

function auditWorkspace(dir) {
  let raw;
  try {
    // Tek parça komut dizesi olarak çalıştırılıyor. Gerekçe: Windows'ta npm bir
    // .cmd sarmalayıcısıdır ve Node 20+ bunu shell olmadan çalıştırmayı
    // engeller; shell'e argüman DİZİSİ vermek ise DEP0190 uyarısı üretir.
    // Komutun tamamı sabit (hiçbir parçası dışarıdan gelmiyor), dolayısıyla
    // burada enjeksiyon yüzeyi yok.
    raw = execSync('npm audit --omit=dev --json', {
      cwd: path.join(ROOT, dir),
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024,
    });
  } catch (err) {
    // Açık bulunduğunda npm sıfırdan farklı kod döner ama JSON'u yine basar.
    raw = err.stdout;
    if (!raw) throw err;
  }

  const report = JSON.parse(raw);
  const vulns = report.vulnerabilities || {};

  /**
   * Bir paketin hangi advisory'lerden etkilendiğini bulur.
   *
   * `via` iki tür kayıt taşır: advisory NESNESİ (kimliği taşıyan asıl kayıt)
   * ya da başka bir paket ADI (string) — "ben şu paket yüzünden etkileniyorum".
   * Dolaylı etkilenen paketlerde yalnız string bulunur, o yüzden kimliği
   * bulmak için zinciri kökene kadar takip etmek gerekir. Örnek:
   *   react-router-dom → via:["react-router"] → via:[{url: .../GHSA-qwww-...}]
   * Aynı düğüme iki kez uğramamak için `seen` tutulur (döngü koruması).
   */
  const advisoriesFor = (pkg, seen = new Set()) => {
    if (seen.has(pkg)) return [];
    seen.add(pkg);
    const entry = vulns[pkg];
    if (!entry) return [];
    const ids = [];
    for (const v of entry.via || []) {
      if (typeof v === 'object') {
        const id = ghsaFrom(v.url);
        if (id) ids.push(id);
      } else {
        ids.push(...advisoriesFor(v, seen));
      }
    }
    return ids;
  };

  const findings = [];

  for (const [pkg, entry] of Object.entries(vulns)) {
    if (!FAIL_AT.includes(entry.severity)) continue;

    const ids = [...new Set(advisoriesFor(pkg))];

    // Kimliği hiç çözülemeyen bir bulguyu sessizce geçmek, allowlist'i
    // yanlışlıkla "her şeyi kabul et"e çevirir — bilinmeyeni bulgu say.
    const allAllowed = ids.length > 0 && ids.every((id) => ALLOWLIST[id]);
    if (allAllowed) continue;

    findings.push({ pkg, severity: entry.severity, ids: ids.length ? ids : ['(kimlik çözülemedi)'] });
  }

  return findings;
}

let failed = 0;
for (const dir of WORKSPACES) {
  const findings = auditWorkspace(dir);
  if (findings.length === 0) {
    console.log(`✓ ${dir}`);
    continue;
  }
  failed += findings.length;
  console.log(`✗ ${dir} — ${findings.length} bulgu`);
  for (const f of findings) {
    console.log(`    [${f.severity}] ${f.pkg}  ${f.ids.join(', ')}`);
  }
}

if (failed > 0) {
  console.log(
    `\n${failed} adet allowlist dışı bulgu var.\n` +
      'Düzeltin; gerçekten sömürülemez olduğuna karar verdiyseniz SECURITY.md\'ye\n' +
      'gerekçesini yazıp scripts/audit-check.js içindeki ALLOWLIST\'e ekleyin.'
  );
  process.exit(1);
}

console.log('\nAllowlist dışı bulgu yok.');
console.log(`Susturulan (bkz. SECURITY.md): ${Object.keys(ALLOWLIST).join(', ')}`);
