export function ColorLegend() {
  return (
    <div className="flex flex-col gap-3">
      {/* MFE Structure */}
      <div className="flex flex-col gap-1.5">
        <p className="font-display text-xs" style={{ color: 'var(--text-primary)', fontWeight: '300' }}>
          MFE Structure
        </p>
        <div
          style={{
            height: '20px',
            width: '100%',
            background: 'linear-gradient(to right, #4A90E2, #E42313)',
            border: '1px solid var(--border)',
          }}
        />
        <div className="flex justify-between">
          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            Unpaired
          </span>
          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            Paired
          </span>
        </div>
      </div>

      {/* Centroid Structure */}
      <div className="flex flex-col gap-1.5">
        <p className="font-display text-xs" style={{ color: 'var(--text-primary)', fontWeight: '300' }}>
          Centroid Structure
        </p>
        <div
          style={{
            height: '20px',
            width: '100%',
            background: 'linear-gradient(to right, #22C55E, #F59E0B)',
            border: '1px solid var(--border)',
          }}
        />
        <div className="flex justify-between">
          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            Unpaired
          </span>
          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            Paired
          </span>
        </div>
      </div>
    </div>
  );
}
