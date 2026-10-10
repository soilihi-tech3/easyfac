import React from 'react';

export function Skeleton({ width = '100%', height = 20, borderRadius = 6, style = {} }) {
  return (
    <div
      className="skeleton-bar"
      style={{
        width,
        height,
        borderRadius,
        ...style
      }}
    />
  );
}

export function TableSkeleton({ rows = 5, cols = 6 }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, rIdx) => (
        <tr key={rIdx}>
          {Array.from({ length: cols }).map((_, cIdx) => (
            <td key={cIdx} style={{ padding: '16px 20px' }}>
              <Skeleton height={16} width={cIdx === 0 ? '70%' : cIdx === cols - 1 ? '40%' : '55%'} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export function CardSkeleton({ count = 3 }) {
  return (
    <>
      {Array.from({ length: count }).map((_, idx) => (
        <div key={idx} className="card" style={{ padding: 20, minHeight: 180, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <Skeleton width={44} height={44} borderRadius={12} />
              <div>
                <Skeleton width={120} height={16} style={{ marginBottom: 6 }} />
                <Skeleton width={80} height={12} />
              </div>
            </div>
            <Skeleton width={32} height={32} borderRadius={8} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginTop: 20 }}>
            <Skeleton height={46} borderRadius={10} />
            <Skeleton height={46} borderRadius={10} />
            <Skeleton height={46} borderRadius={10} />
          </div>
        </div>
      ))}
    </>
  );
}

export function KpiSkeleton({ count = 3 }) {
  return (
    <div className={`kpi-grid cols-${count}`} style={{ marginBottom: 24 }}>
      {Array.from({ length: count }).map((_, idx) => (
        <div key={idx} className="kpi-card" style={{ opacity: 0.8 }}>
          <Skeleton width={42} height={42} borderRadius={12} />
          <div className="kpi-info" style={{ flex: 1 }}>
            <Skeleton width={110} height={22} style={{ marginBottom: 6 }} />
            <Skeleton width={80} height={12} />
          </div>
        </div>
      ))}
    </div>
  );
}
