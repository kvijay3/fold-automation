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
    <div className="flex flex-col" style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
      <div
        className="px-3 py-2 font-display tracking-widest text-xs"
        style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}
      >
        {label}
      </div>
      <div className="flex-1 flex items-center justify-center" style={{ background: '#060b16', minHeight: 200 }}>
        {url ? (
          <img src={url} alt={label} className="w-full object-contain" style={{ maxHeight: 400 }} />
        ) : (
          <div className="flex flex-col items-center gap-2 py-10" style={{ color: 'var(--text-muted)' }}>
            <span className="text-2xl opacity-30">&#9672;</span>
            <span className="text-xs" style={{ fontFamily: 'Figtree, sans-serif' }}>
              {error ?? 'Not available'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function MonoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs tracking-widest font-display" style={{ color: 'var(--text-muted)' }}>
        {label}
      </span>
      <span
        className="text-xs px-3 py-2 rounded break-all"
        style={{
          background: '#0d1a2e',
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
        className="flex items-center justify-between px-6 py-4 rounded-xl flex-shrink-0"
        style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span style={{ color: 'var(--accent-cyan)' }}>&#9672;</span>
          <span
            className="font-semibold truncate"
            style={{ fontFamily: 'Figtree, sans-serif', color: 'var(--text-primary)', fontSize: 16 }}
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
                border: `1px solid ${badge.color}44`,
                fontFamily: 'Figtree, sans-serif',
              }}
            >
              {badge.label}
            </span>
          )}
        </div>
        <div className="flex items-center gap-4 flex-shrink-0 ml-4">
          {result.mfe !== null && (
            <span className="font-display text-lg" style={{ color: 'var(--accent-amber)' }}>
              {result.mfe > 0 ? '+' : ''}{result.mfe} kcal/mol
            </span>
          )}
          <span className="text-xs" style={{ color: 'var(--text-muted)', fontFamily: 'Figtree, sans-serif' }}>
            {result.length} nt &middot; {result.fasta_file}
          </span>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-6 pb-4">
        {/* FASTA sequence */}
        {result.sequence && (
          <div
            className="flex flex-col gap-1 p-4 rounded-lg"
            style={{ border: '1px solid var(--border)', background: 'rgba(255,255,255,0.015)' }}
          >
            <p className="font-display tracking-widest text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
              FASTA SEQUENCE
            </p>
            <div
              className="text-xs px-3 py-3 rounded overflow-auto"
              style={{
                background: '#0d1a2e',
                color: 'var(--accent-cyan)',
                fontFamily: 'JetBrains Mono, monospace',
                lineHeight: 1.8,
                border: '1px solid var(--border)',
                maxHeight: 200,
                wordBreak: 'break-all',
                whiteSpace: 'pre-wrap',
              }}
            >
              &gt;{result.seq_id}{'\n'}{result.sequence}
            </div>
          </div>
        )}

        {/* Structure images — 2 column */}
        <div className="grid grid-cols-2 gap-4">
          <ImagePane url={result.colored_img_url} label="MFE STRUCTURE" />
          <ImagePane url={result.centroid_img_url} label="CENTROID STRUCTURE" error={centroidError} />
        </div>

        {/* Dot-plot */}
        {result.dp_img_url && (
          <div className="flex flex-col" style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
            <div
              className="px-3 py-2 font-display tracking-widest text-xs"
              style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}
            >
              DOT-PLOT &middot; BASE PAIR PROBABILITY MATRIX
            </div>
            <div className="flex justify-center p-4" style={{ background: '#060b16' }}>
              <img src={result.dp_img_url} alt="Dot-plot" style={{ maxWidth: 420, width: '100%' }} />
            </div>
          </div>
        )}

        {/* Structure strings */}
        <div
          className="flex flex-col gap-4 p-4 rounded-lg"
          style={{ border: '1px solid var(--border)', background: 'rgba(255,255,255,0.015)' }}
        >
          <p className="font-display tracking-widest text-xs" style={{ color: 'var(--text-muted)' }}>
            STRUCTURE STRINGS
          </p>
          {result.mfe_structure && <MonoBlock label="MFE" value={result.mfe_structure} />}
          {result.centroid_structure && <MonoBlock label="CENTROID" value={result.centroid_structure} />}
        </div>

        {/* Image errors */}
        {result.img_errors && result.img_errors.length > 0 && (
          <div className="flex flex-col gap-1 p-3 rounded-lg" style={{ background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.2)' }}>
            <p className="text-xs font-display tracking-widest" style={{ color: 'var(--high-tia)' }}>IMAGE ERRORS</p>
            {result.img_errors.map((e, i) => (
              <p key={i} className="text-xs" style={{ color: 'var(--high-tia)', fontFamily: 'JetBrains Mono, monospace' }}>{e}</p>
            ))}
          </div>
        )}

        {/* General error */}
        {result.error && (
          <div className="p-3 rounded-lg" style={{ background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.2)' }}>
            <p className="text-xs" style={{ color: 'var(--high-tia)', fontFamily: 'Figtree, sans-serif' }}>{result.error}</p>
          </div>
        )}

        {/* Prev / Next navigation */}
        <div className="flex items-center justify-between pt-2">
          <button
            onClick={onPrev}
            disabled={index === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-all duration-200"
            style={{
              border: '1px solid var(--border)',
              color: index === 0 ? 'var(--text-muted)' : 'var(--accent-cyan)',
              background: 'transparent',
              opacity: index === 0 ? 0.4 : 1,
              cursor: index === 0 ? 'default' : 'pointer',
              fontFamily: 'Figtree, sans-serif',
            }}
          >
            <ChevronLeft size={14} />
            Previous
          </button>
          <span className="text-xs" style={{ color: 'var(--text-muted)', fontFamily: 'Figtree, sans-serif' }}>
            {index + 1} / {total}
          </span>
          <button
            onClick={onNext}
            disabled={index === total - 1}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-all duration-200"
            style={{
              border: '1px solid var(--border)',
              color: index === total - 1 ? 'var(--text-muted)' : 'var(--accent-cyan)',
              background: 'transparent',
              opacity: index === total - 1 ? 0.4 : 1,
              cursor: index === total - 1 ? 'default' : 'pointer',
              fontFamily: 'Figtree, sans-serif',
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
