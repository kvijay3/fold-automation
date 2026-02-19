import { useEffect } from 'react';
import { X } from 'lucide-react';
import type { SequenceResult } from '../lib/types';

interface SequenceDetailProps {
  result: SequenceResult;
  onClose: () => void;
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
          <img src={url} alt={label} className="w-full object-contain" style={{ maxHeight: 340 }} />
        ) : (
          <div className="flex flex-col items-center gap-2 py-10" style={{ color: 'var(--text-muted)' }}>
            <span className="text-2xl opacity-30">◈</span>
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

export function SequenceDetail({ result, onClose }: SequenceDetailProps) {
  const badge = inferBadge(result);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const centroidError = result.img_errors?.find(e => e.startsWith('Centroid'));

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-end"
      style={{ background: 'rgba(5,8,16,0.85)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Panel */}
      <div
        className="flex flex-col overflow-hidden"
        style={{
          width: 'min(860px, 95vw)',
          background: 'var(--surface)',
          borderLeft: '1px solid var(--border)',
          animation: 'slide-in-right 0.25s ease-out both',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--border)', background: '#080D1A' }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <span style={{ color: 'var(--accent-cyan)' }}>◈</span>
            <span
              className="font-semibold truncate"
              style={{ fontFamily: 'Figtree, sans-serif', color: 'var(--text-primary)', fontSize: 15 }}
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
            {/* Meta chips */}
            <div className="flex items-center gap-3">
              {result.mfe !== null && (
                <span className="font-display text-lg" style={{ color: 'var(--accent-amber)' }}>
                  {result.mfe > 0 ? '+' : ''}{result.mfe} kcal/mol
                </span>
              )}
              <span className="text-xs" style={{ color: 'var(--text-muted)', fontFamily: 'Figtree, sans-serif' }}>
                {result.length} nt · {result.fasta_file}
              </span>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded transition-colors flex-shrink-0"
              style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent-cyan)'; (e.currentTarget as HTMLElement).style.color = 'var(--accent-cyan)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">

          {/* Structure images */}
          <div className="grid grid-cols-2 gap-4">
            <ImagePane url={result.colored_img_url} label="MFE STRUCTURE" />
            <ImagePane
              url={result.centroid_img_url}
              label="CENTROID STRUCTURE"
              error={centroidError}
            />
          </div>

          {/* Dot-plot */}
          {result.dp_img_url && (
            <div className="flex flex-col" style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
              <div
                className="px-3 py-2 font-display tracking-widest text-xs"
                style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}
              >
                DOT-PLOT · BASE PAIR PROBABILITY MATRIX
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
            {result.mfe_structure && (
              <MonoBlock label="MFE" value={result.mfe_structure} />
            )}
            {result.centroid_structure && (
              <MonoBlock label="CENTROID" value={result.centroid_structure} />
            )}
          </div>

          {/* Debug: image errors */}
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
        </div>
      </div>
    </div>
  );
}
