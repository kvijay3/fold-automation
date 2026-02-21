import React from 'react';
import { ChevronLeft, ChevronRight, Copy, Check } from 'lucide-react';
import type { SequenceResult, CentroidSweepEntry, RNAfoldSweepEntry } from '../lib/types';

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
          <div className="flex flex-col items-center gap-2 py-10" style={{ color: error ? 'var(--accent-red)' : 'var(--text-muted)' }}>
            <span className="text-xs">
              {error ?? 'No image available'}
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
  const [copied, setCopied] = React.useState(false);

  const fastaContent = `>${result.seq_id}\n${result.sequence}`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(fastaContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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
            <div className="flex items-center justify-between">
              <p className="font-display text-xs" style={{ color: 'var(--text-primary)', fontWeight: '300' }}>
                FASTA Sequence
              </p>
              <button
                onClick={copyToClipboard}
                className="flex items-center gap-2 px-3 py-1.5 transition-all duration-150"
                style={{
                  border: '1px solid var(--border)',
                  background: 'transparent',
                  color: 'var(--text-secondary)',
                }}
              >
                {copied ? (
                  <>
                    <Check size={12} />
                    <span className="text-xs">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy size={12} />
                    <span className="text-xs">Copy</span>
                  </>
                )}
              </button>
            </div>
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
              {fastaContent}
            </div>
          </div>
        )}

        {/* Structure images — 2 column */}
        <div className="grid grid-cols-2 gap-5">
          <ImagePane url={result.colored_img_url} label="MFE Structure" />
          <ImagePane url={result.centroid_img_url} label="Centroid Structure" error={centroidError} />
        </div>

        {/* Dot-plots — 2 column */}
        <div className="grid grid-cols-2 gap-5">
          <div className="flex flex-col gap-3">
            <p className="font-display text-xs" style={{ color: 'var(--text-primary)', fontWeight: '300' }}>
              MFE Dot-Plot
            </p>
            <div className="flex justify-center p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)', minHeight: 200 }}>
              {result.dp_img_url ? (
                <img src={result.dp_img_url} alt="MFE Dot-plot" style={{ maxWidth: 420, width: '100%' }} />
              ) : (
                <div className="flex items-center justify-center" style={{ color: 'var(--text-muted)' }}>
                  <span className="text-xs">
                    {result.img_errors?.find(e => e.includes('MFE dot-plot')) ?? 'No MFE dot-plot available'}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <p className="font-display text-xs" style={{ color: 'var(--text-primary)', fontWeight: '300' }}>
              Centroid Dot-Plot
            </p>
            <div className="flex justify-center p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)', minHeight: 200 }}>
              {result.centroid_dp_img_url ? (
                <img src={result.centroid_dp_img_url} alt="Centroid Dot-plot" style={{ maxWidth: 420, width: '100%' }} />
              ) : (
                <div className="flex items-center justify-center" style={{ color: 'var(--text-muted)' }}>
                  <span className="text-xs">
                    {result.img_errors?.find(e => e.includes('Centroid dot-plot')) ?? 'No centroid dot-plot available'}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Structure strings */}
        <div className="flex flex-col gap-4">
          {result.mfe_structure && <MonoBlock label="MFE Structure" value={result.mfe_structure} />}
          {result.centroid_structure && <MonoBlock label="Centroid Structure" value={result.centroid_structure} />}
        </div>

        {/* CentroidFold gamma sweep table */}
        {result.centroid_sweep && result.centroid_sweep.length > 0 && (
          <div className="flex flex-col gap-3">
            <p className="font-display text-xs" style={{ color: 'var(--text-primary)', fontWeight: '300' }}>
              CENTROIDFOLD — All γ × Engine Combinations (BL · CONTRAfold)
            </p>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.72rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <th style={{ textAlign: 'left', padding: '6px 10px', color: 'var(--text-secondary)', fontWeight: '400', fontFamily: 'var(--font-display)', width: 60 }}>γ</th>
                    <th style={{ textAlign: 'left', padding: '6px 10px', color: 'var(--text-secondary)', fontWeight: '400', fontFamily: 'var(--font-display)', width: 100 }}>Engine</th>
                    <th style={{ textAlign: 'left', padding: '6px 10px', color: 'var(--text-secondary)', fontWeight: '400', fontFamily: 'var(--font-display)' }}>Structure</th>
                    <th style={{ textAlign: 'right', padding: '6px 10px', color: 'var(--text-secondary)', fontWeight: '400', fontFamily: 'var(--font-display)', width: 60 }}>Pairs</th>
                  </tr>
                </thead>
                <tbody>
                  {result.centroid_sweep.map((entry: CentroidSweepEntry, i: number) => {
                    const pairs = entry.structure ? (entry.structure.match(/\(/g) || []).length : 0;
                    return (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'var(--surface)' }}>
                        <td style={{ padding: '5px 10px', color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>{entry.gamma}</td>
                        <td style={{ padding: '5px 10px', color: 'var(--text-secondary)' }}>{entry.engine}</td>
                        <td style={{ padding: '5px 10px', fontFamily: 'JetBrains Mono, monospace', color: entry.error && !entry.structure ? 'var(--accent-red)' : 'var(--text-primary)', wordBreak: 'break-all' }}>
                          {entry.structure ?? entry.error ?? '—'}
                        </td>
                        <td style={{ padding: '5px 10px', textAlign: 'right', color: pairs > 0 ? 'var(--text-primary)' : 'var(--text-muted)', fontFamily: 'var(--font-display)' }}>{pairs}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* RNAfold gamma sweep table */}
        {result.rnafold_sweep && result.rnafold_sweep.length > 0 && (
          <div className="flex flex-col gap-3">
            <p className="font-display text-xs" style={{ color: 'var(--text-primary)', fontWeight: '300' }}>
              RNAFOLD — γ-Centroid Sweep
            </p>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.72rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <th style={{ textAlign: 'left', padding: '6px 10px', color: 'var(--text-secondary)', fontWeight: '400', fontFamily: 'var(--font-display)', width: 60 }}>γ</th>
                    <th style={{ textAlign: 'left', padding: '6px 10px', color: 'var(--text-secondary)', fontWeight: '400', fontFamily: 'var(--font-display)' }}>Structure</th>
                    <th style={{ textAlign: 'right', padding: '6px 10px', color: 'var(--text-secondary)', fontWeight: '400', fontFamily: 'var(--font-display)', width: 60 }}>Pairs</th>
                  </tr>
                </thead>
                <tbody>
                  {result.rnafold_sweep.map((entry: RNAfoldSweepEntry, i: number) => {
                    const pairs = entry.structure ? (entry.structure.match(/\(/g) || []).length : 0;
                    return (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'var(--surface)' }}>
                        <td style={{ padding: '5px 10px', color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>{entry.gamma}</td>
                        <td style={{ padding: '5px 10px', fontFamily: 'JetBrains Mono, monospace', color: entry.error && !entry.structure ? 'var(--accent-red)' : 'var(--text-primary)', wordBreak: 'break-all' }}>
                          {entry.structure ?? entry.error ?? '—'}
                        </td>
                        <td style={{ padding: '5px 10px', textAlign: 'right', color: pairs > 0 ? 'var(--text-primary)' : 'var(--text-muted)', fontFamily: 'var(--font-display)' }}>{pairs}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

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
