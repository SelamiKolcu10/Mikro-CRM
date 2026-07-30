/**
 * Bildirim + mail hattının uçtan uca doğrulaması VE demo verisi üretimi.
 *
 *   node scripts/verify-notifications-demo.js
 *   (backend :5000 ayakta olmalı)
 *
 * Beş tetikleyicinin hepsini gerçek API çağrılarıyla harekete geçirir ve her
 * adımda bildirimin doğru kişiye ulaştığını DOĞRULAR. Ürettiği kayıtlar
 * silinmez — amaç ekranda görülebilecek somut veri bırakmak. Oluşturulan her
 * şey "[DEMO]" ile etiketlenir, sonradan ayırt edilebilsin.
 *
 * Senaryo:
 *   1. Yönetici bir geliştiriciye görev atar        -> TASK_ASSIGNED    (geliştiriciye)
 *   2. Geliştirici görevi "Yapılıyor" yapar          -> TASK_STATUS_CHANGED (yöneticiye)
 *   3. Yönetici göreve yorum yazar                   -> TASK_COMMENT     (geliştiriciye)
 *   4. Geliştirici yanıt yazar                       -> TASK_COMMENT     (yöneticiye)
 *   5. Müşteri teklifi public bağlantıdan görüntüler -> QUOTE_EVENT      (teklif sahibine)
 *   6. Onay kuyruğundaki bir talep sonuçlandırılır   -> APPROVAL_DECIDED (talep sahibine)
 *
 * Her adımda ayrıca MailLog satırı beklenir (mock modda "Taslak" olarak).
 */
const API = process.env.API_URL || 'http://127.0.0.1:5000/api';
const STAFF_PASSWORD = process.env.STAFF_PASSWORD || 'selami10';

let pass = 0;
let fail = 0;
const created = [];

const req = async (method, path, { token, body } = {}) => {
  const res = await fetch(API + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: res.status, json: await res.json().catch(() => null) };
};

const login = async (email, password) => {
  const r = await req('POST', '/auth/login', { body: { email, password } });
  return r.status === 200 ? r.json.data : null;
};

const notifications = async (token) =>
  (await req('GET', '/notifications?limit=20', { token })).json?.data || [];

/** Bir bildirim, beklenen tür ve metin parçasıyla geldi mi? */
const check = (label, list, type, needle) => {
  const hit = list.find((n) => n.type === type && (!needle || n.message.includes(needle)));
  if (hit) {
    pass++;
    console.log(`  ✅ ${label}`);
    console.log(`     "${hit.message}"`);
  } else {
    fail++;
    console.log(`  ❌ ${label} — ${type} bulunamadı (gelen türler: ${list.map((n) => n.type).join(', ') || 'yok'})`);
  }
  return hit;
};

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const stamp = new Date().toLocaleString('tr-TR');

(async () => {
  console.log('='.repeat(64));
  console.log('BİLDİRİM & MAIL HATTI — DOĞRULAMA VE DEMO VERİSİ');
  console.log('='.repeat(64));

  const admin = await login('admin@microcrm.com', 'admin123');
  if (!admin) {
    console.log('DURDU: admin girişi başarısız. Backend ayakta mı?');
    process.exit(1);
  }

  const mailCfg = (await req('GET', '/mail-logs?limit=1', { token: admin.token })).json?.config;
  console.log(`\nMail hattı: enabled=${mailCfg?.enabled} provider=${mailCfg?.provider}`);
  if (mailCfg?.provider === 'mock') {
    console.log('           (deneme modu — mailler üretilir, GÖNDERİLMEZ)');
  }
  const mailsBefore = (await req('GET', '/mail-logs?limit=1', { token: admin.token })).json?.pagination?.total ?? 0;

  // Görev atanacak geliştirici
  const devs = (await req('GET', '/tasks/assignable-users?department=development', { token: admin.token })).json?.data || [];
  const dev = devs.find((u) => u.email !== 'admin@microcrm.com') || devs[0];
  if (!dev) {
    console.log('DURDU: development departmanında atanabilir kullanıcı yok.');
    process.exit(1);
  }
  const devSession = await login(dev.email, STAFF_PASSWORD);
  if (!devSession) {
    console.log(`DURDU: ${dev.email} girişi başarısız (şifre ${STAFF_PASSWORD} değil mi?).`);
    process.exit(1);
  }
  console.log(`Aktörler: yönetici=admin@microcrm.com  geliştirici=${dev.email}\n`);

  // ---------------------------------------------------------------- 1
  console.log('1) Yönetici geliştiriciye görev atıyor');
  const taskTitle = `[DEMO] Müşteri portalı giriş ekranı mobil uyumu — ${stamp}`;
  const createRes = await req('POST', '/tasks', {
    token: admin.token,
    body: {
      title: taskTitle,
      description:
        'Portal giriş ekranı 480px altında bozuluyor. Form alanları taşıyor, buton ekran dışında kalıyor.',
      department: 'development',
      priority: 'high',
      assignedTo: dev._id,
      deadline: new Date(Date.now() + 5 * 864e5).toISOString(),
    },
  });
  if (createRes.status !== 201) {
    console.log('  ❌ görev oluşturulamadı:', createRes.status, createRes.json?.error);
    process.exit(1);
  }
  const taskId = createRes.json.data._id;
  created.push(`Görev: ${taskTitle}`);
  await wait(800);
  check('Geliştiriciye "yeni görev" bildirimi', await notifications(devSession.token), 'TASK_ASSIGNED', taskTitle);

  // ---------------------------------------------------------------- 2
  console.log('\n2) Geliştirici görevi "Yapılıyor" durumuna alıyor');
  const st = await req('PATCH', `/tasks/${taskId}/status`, {
    token: devSession.token,
    body: { status: 'in_progress' },
  });
  if (st.status !== 200) console.log('  ⚠ durum değiştirilemedi:', st.status, st.json?.error);
  await wait(800);
  check('Yöneticiye "durum değişti" bildirimi', await notifications(admin.token), 'TASK_STATUS_CHANGED', taskTitle);

  // ---------------------------------------------------------------- 3
  console.log('\n3) Yönetici göreve yorum yazıyor');
  await req('POST', `/tasks/${taskId}/comments`, {
    token: admin.token,
    body: { text: 'Tasarım ekibinden 480px kırılım ölçüleri geldi, Figma bağlantısını göreve ekledim.' },
  });
  await wait(800);
  check('Geliştiriciye "yeni yorum" bildirimi', await notifications(devSession.token), 'TASK_COMMENT', taskTitle);

  // ---------------------------------------------------------------- 4
  console.log('\n4) Geliştirici yanıt yazıyor (ters yön)');
  await req('POST', `/tasks/${taskId}/comments`, {
    token: devSession.token,
    body: { text: 'Ölçüleri aldım, bugün içinde ilk düzeltmeyi çıkarıyorum.' },
  });
  await wait(800);
  check('Yöneticiye "yeni yorum" bildirimi', await notifications(admin.token), 'TASK_COMMENT', taskTitle);

  // ---------------------------------------------------------------- 5
  console.log('\n5) Müşteri teklifi public bağlantıdan görüntülüyor');
  const quoteList = (await req('GET', '/quotes?limit=100', { token: admin.token })).json;
  const quoteItems = quoteList?.data?.items || quoteList?.data || [];
  let quote = null;
  for (const q of quoteItems) {
    const d = (await req('GET', `/quotes/${q._id}`, { token: admin.token })).json?.data;
    // 'viewed' olayı YALNIZ status==='sent' ve daha önce görüntülenmemişse tetiklenir.
    if (d?.publicToken && d?.owner && d.status === 'sent' && !d.publicViewedAt) {
      quote = d;
      break;
    }
  }
  if (!quote) {
    console.log('  ⏭ atlandı: "sent" durumunda, henüz görüntülenmemiş teklif yok');
    console.log('     (bu olay her teklifte yalnız BİR kez tetiklenir — tasarım böyle)');
  } else {
    const ownerEmail = quote.owner.email;
    const ownerSession =
      ownerEmail === 'admin@microcrm.com' ? admin : await login(ownerEmail, STAFF_PASSWORD);
    await fetch(`${API}/public/quotes/${quote.publicToken}`);
    await wait(900);
    if (ownerSession) {
      check(
        `Teklif sahibine (${ownerEmail}) "görüntülendi" bildirimi`,
        await notifications(ownerSession.token),
        'QUOTE_EVENT',
        quote.quoteNumber
      );
      created.push(`Teklif görüntülenme kaydı: ${quote.quoteNumber}`);
    } else {
      console.log(`  ⚠ ${ownerEmail} girişi yapılamadı, bildirim okunamadı`);
    }
  }

  // ---------------------------------------------------------------- 6
  console.log('\n6) Onay kuyruğu — talep üretilip sonuçlandırılıyor');
  let pending = (await req('GET', '/approvals?status=pending', { token: admin.token })).json?.data || [];

  // Kuyruk boşsa senaryoyu kendimiz kuruyoruz: rolü yazma yetkisi vermeyen bir
  // kullanıcıya geçici yetki verilir, o kullanıcı müşteri eklemeye çalışır ve
  // istek controller'a gitmeden PendingApproval'a alınır (authorizeOrQueue).
  // İKİ talep üretiyoruz: biri reddedilip bildirim tetiklenecek, diğeri
  // kuyrukta DURACAK ki ekranda görülebilir bir örnek kalsın.
  if (!pending.length) {
    const users = (await req('GET', '/users', { token: admin.token })).json?.data || [];
    // 'support' rolünün müşteri yazma yetkisi YOK — override ile yazdığında kuyruğa düşer.
    const support = users.find((u) => u.role === 'support' && u.status === 'approved');
    const supportSession = support ? await login(support.email, STAFF_PASSWORD) : null;

    if (!supportSession) {
      console.log('  ⏭ kurulum atlandı: uygun "support" kullanıcısı/oturumu bulunamadı');
    } else {
      const grant = await req('POST', '/permission-overrides', {
        token: admin.token,
        body: {
          userId: support._id,
          resource: 'customers',
          action: 'write',
          rationale: '[DEMO] Bildirim akışını göstermek için verildi.',
        },
      });
      if (grant.status >= 400) {
        console.log('  ⚠ yetki verilemedi:', grant.status, grant.json?.error);
      } else {
        created.push(`Geçici yetki: ${support.email} → customers/write`);
        for (const suffix of ['A', 'B']) {
          const r = await req('POST', '/customers', {
            token: supportSession.token,
            body: {
              name: `[DEMO] Onay Akışı Müşterisi ${suffix}`,
              email: `demo.onay.${suffix.toLowerCase()}.${Date.now()}@ornek.com`,
              company: '[DEMO] Örnek Şirket',
              plan: 'starter',
            },
          });
          console.log(`     ${support.email} müşteri ekleme denedi (${suffix}) → HTTP ${r.status}`);
        }
        await wait(500);
        pending = (await req('GET', '/approvals?status=pending', { token: admin.token })).json?.data || [];
        console.log(`     kuyrukta bekleyen talep: ${pending.length}`);
      }
    }
  }

  if (!pending.length) {
    console.log('  ⏭ atlandı: kuyrukta bekleyen talep üretilemedi');
  } else {
    const target = pending[0];
    const rej = await req('PATCH', `/approvals/${target._id}/reject`, {
      token: admin.token,
      body: { reason: '[DEMO] Bildirim akışını göstermek için reddedildi.' },
    });
    await wait(900);
    if (rej.status === 200) {
      created.push(`Onay talebi reddedildi: ${target.resource}/${target.action}`);
      const requesterId = target.requestedBy?._id || target.requestedBy;
      const users = (await req('GET', '/users', { token: admin.token })).json?.data || [];
      const requester = users.find((u) => String(u._id) === String(requesterId));
      const rSession = requester
        ? requester.email === 'admin@microcrm.com'
          ? admin
          : await login(requester.email, STAFF_PASSWORD)
        : null;
      if (rSession) {
        check(
          `Talep sahibine (${requester.email}) "sonuçlandı" bildirimi`,
          await notifications(rSession.token),
          'APPROVAL_DECIDED'
        );
      } else {
        console.log('  ⚠ talep sahibinin oturumu açılamadı, bildirim okunamadı');
      }
    } else {
      console.log('  ⚠ talep reddedilemedi:', rej.status, rej.json?.error);
    }
  }

  // ---------------------------------------------------------------- MailLog
  console.log('\n7) Mail kayıtları');
  const mailAfter = (await req('GET', '/mail-logs?limit=10', { token: admin.token })).json;
  const addedMails = (mailAfter?.pagination?.total ?? 0) - mailsBefore;
  if (addedMails > 0) {
    pass++;
    console.log(`  ✅ ${addedMails} yeni mail kaydı üretildi`);
    console.log(`     durum dağılımı: ${JSON.stringify(mailAfter?.statusCounts)}`);
    for (const m of (mailAfter?.data || []).slice(0, 3)) {
      console.log(`     • ${m.to} — "${m.subject}" [${m.status}]`);
    }
  } else {
    fail++;
    console.log('  ❌ yeni mail kaydı yok');
  }

  // ---------------------------------------------------------------- Özet
  console.log('\n' + '='.repeat(64));
  console.log(`SONUÇ: ${pass} geçti, ${fail} başarısız`);
  console.log('='.repeat(64));
  console.log('\nSistemde bırakılan demo verisi ("[DEMO]" etiketli):');
  for (const c of created) console.log('  • ' + c);
  console.log('\nNerede göreceksin:');
  console.log('  • Çan (sağ üst)      — web ve mobilde okunmamış rozeti');
  console.log('  • Bildirimler        — çana dokun');
  console.log('  • Mail Gönderimleri  — menü > Yönetim (yalnız süper admin)');
  console.log('  • Görevler           — [DEMO] başlıklı görev, yorumlarıyla');
  process.exit(fail > 0 ? 1 : 0);
})();
