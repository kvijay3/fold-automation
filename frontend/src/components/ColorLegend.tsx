export function ColorLegend() {
  return (
    <div className="px-3 py-3">
      <p
        className="font-display text-xs tracking-widest mb-2"
        style={{ color: 'var(--text-muted)' }}
      >
        BASE-PAIR CONFIDENCE
      </p>
      <div
        className="h-3 w-full rounded-full"
        style={{
          background:
            'linear-gradient(to right, #2563EB, #06B6D4, #10B981, #FBBF24, #EF4444)',
        }}
      />
      <div className="flex justify-between mt-1">
        <span className="text-xs" style={{ color: 'var(--text-muted)', fontFamily: 'Figtree, sans-serif' }}>
          Unpaired
        </span>
        <span className="text-xs" style={{ color: 'var(--text-muted)', fontFamily: 'Figtree, sans-serif' }}>
          Paired
        </span>
      </div>
    </div>
  );
}
