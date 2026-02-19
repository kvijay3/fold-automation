import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { SequenceResult } from '../lib/types';

interface SequenceCardProps {
  result: SequenceResult;
  index: number;
}

function inferBadge(result: SequenceResult): { label: string; color: string } | null {
  const id = result.seq_id.toLowerCase() + result.fasta_file.toLowerCase();
  if (id.includes('hightia')) return { label: 'HighTIA', color: 'var(--high-tia)' };
  if (id.includes('lowtia'))  return { label: 'LowTIA',  color: 'var(--low-tia)'  };
  return null;
}

export function SequenceCard({ result, index }: SequenceCardProps) {
  const [dpOpen, setDpOpen] = useState(false);
  const badge = inferBadge(result);

  const cardStyle: React.CSSProperties = {
    animationDelay: `${index * 50}ms`,
    animationFillMode: 'both',
  };

  return (
    <article
      className="rounded-xl overflow-hidden flex flex-col transition-all duration-200 group animate-rise-up"
      style={{
        ...cardStyle,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        animation: `rise-up 0.35s ease-out ${index * 50}ms both`,
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = 'rgba(34,211,238,0.25)';
        (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)';
        (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
      }}
    >
      {/* ── Colored structure image ── */}
      <div
        className="relative w-full flex items-center justify-center"
        style={{ background: '#060b16', minHeight: 180 }}
      >
        {result.colored_img_url ? (
          <img
            src={result.colored_img_url}
            alt={`RNA structure: ${result.seq_id}`}
            className="w-full object-contain"
            style={{ maxHeight: 260 }}
          />
        ) : (
          <div
            className="flex flex-col items-center gap-2 py-10"
            style={{ color: 'var(--text-muted)' }}
          >
            <span className="text-2xl opacity-40">◈</span>
            <span className="text-xs font-body">{result.error ?? 'No image'}</span>
          </div>
        )}
        {/* Cyan left-border accent on hover */}
        <div
          className="absolute left-0 top-0 bottom-0 w-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
          style={{ background: 'var(--accent-cyan)' }}
        />
      </div>

      {/* ── Card body ── */}
      <div className="p-3 flex flex-col gap-2">
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
        <div className="flex items-baseline gap-3">
          {result.mfe !== null ? (
            <span
              className="font-display text-lg"
              style={{ color: 'var(--accent-amber)' }}
            >
              {result.mfe > 0 ? '+' : ''}{result.mfe} kcal/mol
            </span>
          ) : (
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>MFE unavailable</span>
          )}
          <span className="text-xs" style={{ color: 'var(--text-muted)', fontFamily: 'Figtree, sans-serif' }}>
            · {result.length} nt
          </span>
        </div>

        {/* MFE structure */}
        {result.mfe_structure && (
          <StructurePill label="MFE" structure={result.mfe_structure} />
        )}

        {/* Centroid structure */}
        {result.centroid_structure && (
          <StructurePill label="Centroid" structure={result.centroid_structure} />
        )}

        {/* Error */}
        {result.error && (
          <p
            className="text-xs px-2 py-1 rounded"
            style={{
              background: 'rgba(244,63,94,0.1)',
              color: 'var(--high-tia)',
              fontFamily: 'Figtree, sans-serif',
            }}
          >
            {result.error}
          </p>
        )}

        {/* Collapsible dot-plot */}
        {result.dp_img_url && (
          <div>
            <button
              onClick={() => setDpOpen(!dpOpen)}
              className="flex items-center gap-1 text-xs transition-colors"
              style={{
                color: 'var(--text-muted)',
                fontFamily: 'Figtree, sans-serif',
              }}
              onMouseEnter={(e) => ((e.target as HTMLElement).style.color = 'var(--accent-cyan)')}
              onMouseLeave={(e) => ((e.target as HTMLElement).style.color = 'var(--text-muted)')}
            >
              {dpOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              Dot-plot
            </button>
            {dpOpen && (
              <img
                src={result.dp_img_url}
                alt="Dot-plot"
                className="w-full mt-2 rounded"
                style={{ background: '#060b16' }}
              />
            )}
          </div>
        )}
      </div>
    </article>
  );
}

function StructurePill({ label, structure }: { label: string; structure: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span
        className="text-xs"
        style={{ color: 'var(--text-muted)', fontFamily: 'Figtree, sans-serif' }}
      >
        {label}
      </span>
      <span
        className="text-xs px-2 py-1 rounded break-all"
        style={{
          background: '#1e2d44',
          color: 'var(--text-primary)',
          fontFamily: 'JetBrains Mono, monospace',
          lineHeight: 1.6,
        }}
      >
        {structure}
      </span>
    </div>
  );
}
