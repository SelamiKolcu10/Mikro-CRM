/**
 * Skeleton yükleme iskeletleri — spinner yerine (tasarım.md §6).
 * widths: her satırın yüzde genişliği; kartlı varyant SkeletonCard.
 */
export const SkeletonLines = ({ widths = ['60%', '85%', '40%'] }) => (
  <>
    {widths.map((w, i) => (
      <div className="skeleton-line" style={{ width: w, marginBottom: i === widths.length - 1 ? 0 : undefined }} key={i} />
    ))}
  </>
);

export const SkeletonCard = ({ widths, style }) => (
  <div className="skeleton-card" style={style}>
    <SkeletonLines widths={widths} />
  </div>
);

/** Dashboard tipi yüzeyler için hazır blok: 4 KPI kartı + geniş panel. */
export const SkeletonDashboard = () => (
  <div>
    <div className="stats-grid">
      {[0, 1, 2, 3].map((i) => (
        <SkeletonCard key={i} widths={['50%', '75%', '35%']} />
      ))}
    </div>
    <SkeletonCard widths={['30%', '100%', '90%', '60%']} style={{ minHeight: 220 }} />
  </div>
);
