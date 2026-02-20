import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { SequenceResult } from '../lib/types';

interface SequencePageProps {
  result: SequenceResult;
  index: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
}

function inferBadge(r: SequenceResult) {
  const id = r.seq_id.toLowerCase() + r.fasta_file.toLowerCase();
  if (id.includes('hightia')) return { label: 'HighTIA', color: 'var(--high-tia)' };
  if (id.includes('lowtia'))  return { label: 'LowTIA',  color: 'var(--low-tia)'  };
  return null;
}

function ImagePane({ url, label, error }: { url: string | null; label: string; error?: string }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="font-display text-xs" style={{ color: 'var(--text-primary)', fontWeight: '300' }}>
        {label}
      </p>
      <div className="flex items-center justify-center" style={{ background: 'var(--surface)', border: '1px solid var(--border)', minHeight: 200 }}>
        {url ? (
          <img src={url} alt={label} className="w-full object-contain" style={{ maxHeight: 400 }} />
        ) : (
          <div className="flex flex-col items-center gap-2 py-10" style={{ color: 'var(--text-muted)' }}>
            <span className="text-xs">
              {error ?? 'Structure Visualization'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function MonoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="font-display text-xs" style={{ color: 'var(--text-primary)', fontWeight: '300' }}>
        {label}
      </span>
      <span
        className="text-xs px-4 py-3 break-all"
        style={{
          background: 'var(--surface)',
          color: 'var(--text-primary)',
          fontFamily: 'JetBrains Mono, monospace',
          lineHeight: 1.7,
          border: '1px solid var(--border)',
        }}
      >
        {value}
      </span>
    </div>
  );
}

export function SequencePage({ result, index, total, onPrev, onNext }: SequencePageProps) {
  const badge = inferBadge(result);
  const centroidError = result.img_errors?.find(e => e.startsWith('Centroid'));

  return (
    <div className="flex flex-col gap-6 h-full">
      {/* Header */}
      <div
        className="flex items-center justify-between px-7 py-5 flex-shrink-0"
        style={{ border: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span
            className="font-display truncate"
            style={{ color: 'var(--text-primary)', fontSize: 14, fontWeight: '300' }}
            title={result.seq_id}
          >
            {result.seq_id}
          </span>
          {badge && (
            <span
              className="text-xs px-2 py-0.5 flex-shrink-0"
              style={{
                background: `${badge.color}15`,
                color: badge.color,
                border: `1px solid ${badge.color}`,
              }}
            >
              {badge.label}
            </span>
          )}
        </div>
        <div className="flex items-center gap-4 flex-shrink-0 ml-4">
          {result.mfe !== null && (
            <div className="flex items-center gap-2">
              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>MFE:</span>
              <span className="font-display" style={{ color: 'var(--text-primary)', fontSize: 14, fontWeight: '300' }}>
                {result.mfe > 0 ? '+' : ''}{result.mfe}
              </span>
              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>kcal/mol</span>
            </div>
          )}
          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            Length: {result.length} nt
          </span>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-6 pb-4">
        {/* FASTA sequence */}
        {result.sequence && (
          <div className="flex flex-col gap-2">
            <p className="font-display text-xs" style={{ color: 'var(--text-primary)', fontWeight: '300' }}>
              RNA Sequence
            </p>
            <div
              className="text-xs px-4 py-4 overflow-auto"
              style={{
                background: 'var(--surface)',
                color: 'var(--text-primary)',
                fontFamily: 'JetBrains Mono, monospace',
                lineHeight: 1.8,
                border: '1px solid var(--border)',
                maxHeight: 200,
                wordBreak: 'break-all',
                whiteSpace: 'pre-wrap',
              }}
            >
              {result.sequence}
            </div>
          </div>
        )}

        {/* Structure images — 2 column */}
        <div className="grid grid-cols-2 gap-5">
          <ImagePane url={result.colored_img_url} label="MFE Structure" />
          <ImagePane url={result.centroid_img_url} label="Centroid Structure" error={centroidError} />
        </div>

        {/* Dot-plot */}
        {result.dp_img_url && (
          <div className="flex flex-col gap-3">
            <p className="font-display text-xs" style={{ color: 'var(--text-primary)', fontWeight: '300' }}>
              Base Pair Probability
            </p>
            <div className="flex justify-center p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <img src={result.dp_img_url} alt="Dot-plot" style={{ maxWidth: 420, width: '100%' }} />
            </div>
          </div>
        )}

        {/* Structure strings */}
        <div className="flex flex-col gap-4">
          {result.mfe_structure && <MonoBlock label="MFE Structure" value={result.mfe_structure} />}
          {result.centroid_structure && <MonoBlock label="Centroid Structure" value={result.centroid_structure} />}
        </div>

        {/* Image errors */}
        {result.img_errors && result.img_errors.length > 0 && (
          <div className="flex flex-col gap-1 p-3" style={{ background: 'rgba(228,35,19,0.05)', border: '1px solid var(--accent-red)' }}>
            <p className="text-xs font-display" style={{ color: 'var(--accent-red)', fontWeight: '300' }}>Image Errors</p>
            {result.img_errors.map((e, i) => (
              <p key={i} className="text-xs font-mono" style={{ color: 'var(--accent-red)' }}>{e}</p>
            ))}
          </div>
        )}

        {/* General error */}
        {result.error && (
          <div className="p-3" style={{ background: 'rgba(228,35,19,0.05)', border: '1px solid var(--accent-red)' }}>
            <p className="text-xs" style={{ color: 'var(--accent-red)' }}>{result.error}</p>
          </div>
        )}

        {/* Prev / Next navigation */}
        <div className="flex items-center justify-between pt-2">
          <button
            onClick={onPrev}
            disabled={index === 0}
            className="flex items-center gap-2 px-5 py-2.5 font-display text-xs transition-all duration-150"
            style={{
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
              background: 'transparent',
              opacity: index === 0 ? 0.4 : 1,
              cursor: index === 0 ? 'default' : 'pointer',
            }}
          >
            <ChevronLeft size={14} />
            Previous
          </button>
          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            {index + 1} of {total}
          </span>
          <button
            onClick={onNext}
            disabled={index === total - 1}
            className="flex items-center gap-2 px-5 py-2.5 font-display text-xs transition-all duration-150"
            style={{
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
              background: 'transparent',
              opacity: index === total - 1 ? 0.4 : 1,
              cursor: index === total - 1 ? 'default' : 'pointer',
            }}
          >
            Next
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
