export default function Loading() {
  return (
    <div style={{ display: 'flex', height: '100%' }}>
      {/* Athlete list panel */}
      <div style={{ width: 320, borderRight: '1px solid var(--border-default)', padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        <Bone width="60%" height={11} style={{ marginBottom: 16 }} />
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 12px', borderRadius: 'var(--radius-md)',
            }}
          >
            <Bone width={32} height={32} style={{ borderRadius: 'var(--radius-full)', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <Bone width="65%" height={13} style={{ marginBottom: 5 }} />
              <Bone width="40%" height={10} />
            </div>
          </div>
        ))}
      </div>

      {/* Detail panel */}
      <div style={{ flex: 1, padding: '36px 40px' }}>
        <Bone width={180} height={28} style={{ marginBottom: 8 }} />
        <Bone width={100} height={13} style={{ marginBottom: 32 }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 32 }}>
          {[0,1,2].map((i) => (
            <div key={i} className="glass" style={{ borderRadius: 'var(--radius-lg)', padding: '16px 18px' }}>
              <Bone width={40} height={24} style={{ marginBottom: 8 }} />
              <Bone width="70%" height={11} />
            </div>
          ))}
        </div>
        <Bone width={80} height={11} style={{ marginBottom: 12 }} />
        {[0,1,2].map((i) => (
          <div key={i} className="glass" style={{ borderRadius: 'var(--radius-md)', padding: '14px 16px', marginBottom: 8 }}>
            <Bone width="80%" height={13} style={{ marginBottom: 6 }} />
            <Bone width="50%" height={11} />
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
