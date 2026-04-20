export default function Loading() {
  return (
    <div style={{ padding: '36px 40px', maxWidth: 960, margin: '0 auto' }}>
      {/* Header skeleton */}
      <div style={{ marginBottom: 36 }}>
        <Bone width={60} height={11} style={{ marginBottom: 10 }} />
        <Bone width={220} height={30} />
      </div>

      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 14, marginBottom: 36 }}>
        {[0,1,2,3].map((i) => (
          <div key={i} className="glass" style={{ borderRadius: 'var(--radius-lg)', padding: '18px 20px' }}>
            <Bone width={48} height={32} style={{ marginBottom: 10 }} />
            <Bone width={90} height={11} />
          </div>
        ))}
      </div>

      {/* Two columns */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {[0,1].map((col) => (
          <div key={col}>
            <Bone width={120} height={11} style={{ marginBottom: 14 }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[0,1,2].map((row) => (
                <div key={row} className="glass" style={{ borderRadius: 'var(--radius-md)', padding: '12px 14px', display: 'flex', gap: 12, alignItems: 'center' }}>
                  <Bone width={36} height={36} style={{ borderRadius: 'var(--radius-sm)', flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <Bone width="70%" height={13} style={{ marginBottom: 6 }} />
                    <Bone width="50%" height={11} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Bone({ width, height, style }: { width: number | string; height: number; style?: React.CSSProperties }) {
  return (
    <div
      className="skeleton"
      style={{
        width,
        height,
        borderRadius: 'var(--radius-sm)',
        background: 'var(--surface-2)',
        ...style,
      }}
    />
  );
}
