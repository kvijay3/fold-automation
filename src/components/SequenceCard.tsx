import type { SequenceResult } from '../lib/types';

interface SequenceCardProps {
  result: SequenceResult;
  index: number;
  onClick: () => void;
}

function inferBadge(r: SequenceResult) {
  const id = r.seq_id.toLowerCase() + r.fasta_file.toLowerCase();
  if (id.includes('hightia')) return { label: 'HighTIA', color: 'var(--high-tia)' };
  if (id.includes('lowtia'))  return { label: 'LowTIA',  color: 'var(--low-tia)'  };
  return null;
}

export function SequenceCard({ result, index, onClick }: SequenceCardProps) {
  const badge = inferBadge(result);

  return (
    <article
      onClick={onClick}
      className="rounded-xl overflow-hidden flex flex-col cursor-pointer group"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        animation: `rise-up 0.35s ease-out ${index * 50}ms both`,
        transition: 'border-color 0.15s, transform 0.15s, box-shadow 0.15s',
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLElement;
        el.style.borderColor = 'rgba(34,211,238,0.35)';
        el.style.transform = 'translateY(-3px)';
        el.style.boxShadow = '0 8px 32px rgba(34,211,238,0.08)';
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLElement;
        el.style.borderColor = 'var(--border)';
        el.style.transform = 'translateY(0)';
        el.style.boxShadow = 'none';
      }}
    >
      {/* ── MFE image ── */}
      <div className="relative w-full flex items-center justify-center" style={{ background: '#060b16', minHeight: 180 }}>
        {result.colored_img_url ? (
          <img
            src={result.colored_img_url}
            alt={`MFE: ${result.seq_id}`}
            className="w-full object-contain"
            style={{ maxHeight: 240 }}
          />
        ) : (
          <div className="flex flex-col items-center gap-1 py-10" style={{ color: 'var(--text-muted)' }}>
            <span className="text-2xl opacity-30">◈</span>
            <span className="text-xs" style={{ fontFamily: 'Figtree, sans-serif' }}>
              {result.error ?? 'No image'}
            </span>
          </div>
        )}
        {/* Cyan left accent */}
        <div
          className="absolute left-0 top-0 bottom-0 w-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150"
          style={{ background: 'var(--accent-cyan)' }}
        />
        {/* "Click to expand" hint */}
        <div
          className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-150 text-xs px-2 py-0.5 rounded"
          style={{
            background: 'rgba(34,211,238,0.15)',
            color: 'var(--accent-cyan)',
            fontFamily: 'Figtree, sans-serif',
            border: '1px solid rgba(34,211,238,0.25)',
          }}
        >
          expand
        </div>
      </div>

      {/* ── Body ── */}
      <div className="p-3 flex flex-col gap-1.5" style={{ borderTop: '1px solid var(--border)' }}>
        {/* Name + badge */}
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="text-sm font-semibold truncate"
            style={{ fontFamily: 'Figtree, sans-serif', color: 'var(--text-primary)' }}
            title={result.seq_id}
          >
            {result.seq_id}
          </span>
          {badge && (
            <span
              className="text-xs px-2 py-0.5 rounded-full font-semibold flex-shrink-0"
              style={{
                background: `${badge.color}22`,
                color: badge.color,
                fontFamily: 'Figtree, sans-serif',
                border: `1px solid ${badge.color}44`,
              }}
            >
              {badge.label}
            </span>
          )}
        </div>

        {/* MFE + length */}
        <div className="flex items-baseline gap-2">
          {result.mfe !== null ? (
            <span className="font-display text-base" style={{ color: 'var(--accent-amber)' }}>
              {result.mfe > 0 ? '+' : ''}{result.mfe} kcal/mol
            </span>
          ) : (
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>MFE N/A</span>
          )}
          <span className="text-xs" style={{ color: 'var(--text-muted)', fontFamily: 'Figtree, sans-serif' }}>
            · {result.length} nt
          </span>
        </div>

        {/* Centroid thumbnail indicator */}
        <div className="flex gap-1 mt-0.5">
          <span
            className="text-xs px-1.5 py-0.5 rounded"
            style={{
              background: result.colored_img_url  ? 'rgba(34,211,238,0.1)'  : 'rgba(255,255,255,0.04)',
              color:      result.colored_img_url  ? 'var(--accent-cyan)'    : 'var(--text-muted)',
              fontFamily: 'Figtree, sans-serif',
              border:     `1px solid ${result.colored_img_url  ? 'rgba(34,211,238,0.2)' : 'var(--border)'}`,
            }}
          >
            MFE
          </span>
          <span
            className="text-xs px-1.5 py-0.5 rounded"
            style={{
              background: result.centroid_img_url ? 'rgba(34,211,238,0.1)'  : 'rgba(255,255,255,0.04)',
              color:      result.centroid_img_url ? 'var(--accent-cyan)'    : 'var(--text-muted)',
              fontFamily: 'Figtree, sans-serif',
              border:     `1px solid ${result.centroid_img_url ? 'rgba(34,211,238,0.2)' : 'var(--border)'}`,
            }}
          >
            Centroid
          </span>
          <span
            className="text-xs px-1.5 py-0.5 rounded"
            style={{
              background: result.dp_img_url ? 'rgba(34,211,238,0.1)'  : 'rgba(255,255,255,0.04)',
              color:      result.dp_img_url ? 'var(--accent-cyan)'    : 'var(--text-muted)',
              fontFamily: 'Figtree, sans-serif',
              border:     `1px solid ${result.dp_img_url ? 'rgba(34,211,238,0.2)' : 'var(--border)'}`,
            }}
          >
            Dot-plot
          </span>
        </div>
      </div>
    </article>
  );
}
