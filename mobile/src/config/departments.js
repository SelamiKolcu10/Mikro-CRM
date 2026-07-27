// Departman listesi tek kaynak — backend/config/permissions.js DEPARTMENTS ile
// senkron. Hem Formlar (atama) hem Görevler bunu kullanır; iki ayrı kopya
// tutulmasın diye buraya çıkarıldı.
export const DEPARTMENTS = ['development', 'design', 'hr', 'marketing'];

export const DEPARTMENT_LABEL = {
  development: 'Geliştirme',
  design: 'Tasarım',
  hr: 'İnsan Kaynakları',
  marketing: 'Pazarlama',
};

export const DEPARTMENT_OPTIONS = DEPARTMENTS.map((d) => ({
  value: d,
  label: DEPARTMENT_LABEL[d],
}));
