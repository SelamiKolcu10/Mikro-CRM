/**
 * Erişim kontrolü — geçici yetki matrisinin mobil tanımları.
 *
 * İKİ AYRI LİSTE var, karıştırmayın:
 *
 *  • ACTIVE_PERMISSIONS — backend'in gerçekten uyguladığı yetkiler.
 *    backend/config/permissions.js OVERRIDABLE_RESOURCES (['customers',
 *    'feedbacks']) × action ['write','delete'] ile birebir. Buraya bir satır
 *    eklemek TEK BAŞINA işe yaramaz: backend'de OVERRIDABLE_RESOURCES'a da
 *    eklenmeli, yoksa POST /permission-overrides 422 "Geçersiz kaynak" döner.
 *
 *  • PLANNED_PERMISSIONS — henüz backend'de KARŞILIĞI OLMAYAN, tasarımda
 *    yerini görmek için duran satırlar. Ekranda kapalı ve "Yakında" etiketli
 *    gösterilir; hiçbir istek atmaz. Backend tarafı kodlandıkça buradan
 *    ACTIVE_PERMISSIONS'a taşınır.
 */

// Backend'in bu çağrı noktalarında kabul ettiği statik roller — bkz.
// routes/customerRoutes.js ve feedbackRoutes.js authorizeOrQueue çağrıları.
// Rolü zaten yetkiliyse kutu işaretli ve kapalı gelir ("Rolünden geliyor"):
// verilecek/geri alınacak bir şey yoktur.
const STATIC_GRANT = {
  customers: {
    write: ['super_admin', 'staff'],
    delete: ['super_admin', 'staff'],
  },
  feedbacks: {
    write: ['super_admin', 'staff'],
    delete: ['super_admin', 'staff'],
  },
};

export const ACTIVE_PERMISSIONS = [
  { resource: 'customers', action: 'write', label: 'Müşteriler', actionLabel: 'Ekle/Düzenle' },
  { resource: 'customers', action: 'delete', label: 'Müşteriler', actionLabel: 'Sil' },
  { resource: 'feedbacks', action: 'write', label: 'Geri Bildirimler', actionLabel: 'Ekle/Düzenle' },
  { resource: 'feedbacks', action: 'delete', label: 'Geri Bildirimler', actionLabel: 'Sil' },
];

// Görsel taslak — backend'de henüz yok (yukarıdaki nota bakın).
export const PLANNED_PERMISSIONS = [
  { key: 'invoices-read', label: 'Faturalar', actionLabel: 'Görüntüle' },
  { key: 'invoices-analyze', label: 'Fatura Analizi', actionLabel: 'Rapor/Özet' },
  { key: 'quotes-write', label: 'Teklifler', actionLabel: 'Ekle/Düzenle' },
  { key: 'quotes-delete', label: 'Teklifler', actionLabel: 'Sil' },
  { key: 'deals-write', label: 'Fırsatlar', actionLabel: 'Ekle/Düzenle' },
  { key: 'deals-delete', label: 'Fırsatlar', actionLabel: 'Sil' },
  { key: 'tasks-write', label: 'Görevler', actionLabel: 'Ekle/Düzenle' },
  { key: 'catalog-write', label: 'Ürün Kataloğu', actionLabel: 'Ekle/Düzenle' },
  { key: 'projects-read', label: 'Projeler', actionLabel: 'Görüntüle' },
  { key: 'spending-read', label: 'Genel Harcama', actionLabel: 'Görüntüle' },
];

export const hasStaticGrant = (role, resource, action) =>
  !!STATIC_GRANT[resource]?.[action]?.includes(role);

// Yetki verme/geri alma — backend PERMISSIONS.permissionOverrides.write.
export const canGrantPermissions = (user) => user?.role === 'super_admin';
