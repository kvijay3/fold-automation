import { useEffect, useState } from 'react';
import { UploadZone } from './components/UploadZone';
import { ColorLegend } from './components/ColorLegend';
import { SequencePage } from './components/SequencePage';
import { predictStructures } from './lib/api';
import type { SequenceResult } from './lib/types';
import { Download, Layers } from 'lucide-react';

function toTSV(results: SequenceResult[]): string {
  const header = [
    'fasta_file', 'seq_id', 'sequence', 'length', 'mfe',
    'mfe_structure', 'centroid_structure', 'error',
  ].join('\t');
  const rows = results.map((r) =>
    [
      r.fasta_file,
      r.seq_id,
      r.sequence ?? '',
      r.length,
      r.mfe ?? '',
      r.mfe_structure ?? '',
      r.centroid_structure ?? '',
      r.error ?? '',
    ].join('\t'),
  );
  return [header, ...rows].join('\n');
}

function downloadTSV(results: SequenceResult[]) {
  const blob = new Blob([toTSV(results)], { type: 'text/tab-separated-values' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'fold-results.tsv';
  a.click();
  URL.revokeObjectURL(url);
}

export default function App() {
  const [files, setFiles]               = useState<File[]>([]);
  const [results, setResults]           = useState<SequenceResult[]>([]);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const handleRun = async () => {
    if (!files.length) return;
    setLoading(true);
    setError(null);
    setResults([]);
    setSelectedIndex(0);
    try {
      const data = await predictStructures(files);
      setResults(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!results.length) return;
      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault();
        setSelectedIndex(i => Math.max(0, i - 1));
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        e.preventDefault();
        setSelectedIndex(i => Math.min(results.length - 1, i + 1));
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [results.length]);

  const hasResults = results.length > 0;
  const current = hasResults ? results[selectedIndex] : null;

  // Summary stats
  const mfes = results.map(r => r.mfe).filter((m): m is number => m !== null);
  const fileNames = [...new Set(results.map(r => r.fasta_file))];

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg)' }}>
      {/* Sidebar */}
      <aside
        className="flex flex-col gap-0 flex-shrink-0 animate-slide-in-left overflow-y-auto"
        style={{
          width: 260,
          background: '#080D1A',
          borderRight: '1px solid var(--border)',
        }}
      >
        {/* Logo */}
        <div
          className="flex items-center gap-2 px-4 py-4"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <span style={{ color: 'var(--accent-cyan)', fontSize: 18 }}>&#9672;</span>
          <span
            className="font-display tracking-widest text-sm"
            style={{ color: 'var(--accent-cyan)' }}
          >
            FOLD AUTOMATION
          </span>
        </div>

        {/* Upload */}
        <div className="py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <p
            className="font-display text-xs tracking-widest px-3 mb-3"
            style={{ color: 'var(--text-muted)' }}
          >
            INPUT
          </p>
          <UploadZone
            files={files}
            onFilesChange={setFiles}
            onRun={handleRun}
            loading={loading}
          />
        </div>

        {/* Color legend */}
        <div className="py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <p
            className="font-display text-xs tracking-widest px-3 mb-1"
            style={{ color: 'var(--text-muted)' }}
          >
            LEGEND
          </p>
          <ColorLegend />
        </div>

        {/* Sequence list */}
        {hasResults && (
          <div className="flex flex-col py-2" style={{ borderBottom: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between px-3 py-2">
              <div className="flex items-center gap-2">
                <Layers size={12} style={{ color: 'var(--text-muted)' }} />
                <span
                  className="font-display text-xs tracking-widest"
                  style={{ color: 'var(--text-muted)' }}
                >
                  SEQUENCES
                </span>
              </div>
              <span
                className="text-xs"
                style={{ color: 'var(--accent-cyan)', fontFamily: 'Figtree, sans-serif' }}
              >
                {results.length}
              </span>
            </div>
            <div className="flex flex-col max-h-[40vh] overflow-y-auto">
              {results.map((r, i) => {
                const isActive = i === selectedIndex;
                return (
                  <button
                    key={`${r.fasta_file}-${r.seq_id}-${i}`}
                    onClick={() => setSelectedIndex(i)}
                    className="flex items-center gap-2 px-3 py-2 text-left transition-colors duration-100"
                    style={{
                      background: isActive ? 'rgba(34,211,238,0.08)' : 'transparent',
                      borderLeft: isActive ? '2px solid var(--accent-cyan)' : '2px solid transparent',
                      color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                    }}
                  >
                    <span
                      className="text-xs truncate flex-1"
                      style={{ fontFamily: 'Figtree, sans-serif' }}
                      title={r.seq_id}
                    >
                      {r.seq_id}
                    </span>
                    {r.mfe !== null && (
                      <span
                        className="text-xs flex-shrink-0"
                        style={{ color: 'var(--accent-amber)', fontFamily: 'JetBrains Mono, monospace', fontSize: 10 }}
                      >
                        {r.mfe}
                      </span>
                    )}
                    {r.error && (
                      <span
                        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                        style={{ background: 'var(--high-tia)' }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Download TSV */}
        {hasResults && (
          <div className="px-3 py-3">
            <button
              onClick={() => downloadTSV(results)}
              className="flex items-center justify-center gap-2 w-full px-3 py-2 rounded-lg text-xs transition-all duration-200"
              style={{
                border: '1px solid var(--border)',
                color: 'var(--text-muted)',
                background: 'transparent',
                fontFamily: 'Figtree, sans-serif',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--accent-cyan)';
                e.currentTarget.style.color = 'var(--accent-cyan)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border)';
                e.currentTarget.style.color = 'var(--text-muted)';
              }}
            >
              <Download size={12} />
              Download TSV
            </button>
          </div>
        )}

        <div className="flex-1" />
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-hidden p-6 flex flex-col">
        {/* Global error */}
        {error && (
          <div
            className="mb-4 px-4 py-3 rounded-lg text-sm flex-shrink-0"
            style={{
              background: 'rgba(244,63,94,0.1)',
              border: '1px solid rgba(244,63,94,0.3)',
              color: 'var(--high-tia)',
              fontFamily: 'Figtree, sans-serif',
            }}
          >
            {error}
          </div>
        )}

        {/* Summary bar */}
        {hasResults && (
          <div
            className="flex items-stretch rounded-xl overflow-hidden animate-fade-down mb-4 flex-shrink-0"
            style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}
          >
            {[
              { label: 'SEQUENCES', value: String(results.length) },
              { label: 'FILES',     value: String(fileNames.length) },
              {
                label: 'MIN MFE',
                value: mfes.length ? `${Math.min(...mfes)} kcal/mol` : '\u2014',
              },
              {
                label: 'MAX MFE',
                value: mfes.length ? `${Math.max(...mfes)} kcal/mol` : '\u2014',
              },
            ].map(({ label, value }, i, arr) => (
              <div
                key={label}
                className="flex-1 flex flex-col items-center justify-center py-3 px-3"
                style={{
                  borderRight: i < arr.length - 1 ? '1px solid var(--border)' : 'none',
                }}
              >
                <span
                  className="text-xs tracking-widest"
                  style={{ color: 'var(--text-muted)', fontFamily: 'Figtree, sans-serif' }}
                >
                  {label}
                </span>
                <span
                  className="font-display text-lg leading-tight mt-0.5"
                  style={{ color: 'var(--accent-cyan)' }}
                >
                  {value}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            <div
              className="text-6xl animate-pulse-slow"
              style={{ color: 'var(--accent-cyan)', opacity: 0.6 }}
            >
              &#9672;
            </div>
            <p
              className="text-sm animate-fade-down"
              style={{ color: 'var(--text-muted)', fontFamily: 'Figtree, sans-serif' }}
            >
              Processing {files.length} file{files.length !== 1 ? 's' : ''}&hellip;
            </p>
          </div>
        )}

        {/* Full-page sequence view */}
        {!loading && current && (
          <SequencePage
            result={current}
            index={selectedIndex}
            total={results.length}
            onPrev={() => setSelectedIndex(i => Math.max(0, i - 1))}
            onNext={() => setSelectedIndex(i => Math.min(results.length - 1, i + 1))}
          />
        )}

        {/* Empty state */}
        {!loading && !hasResults && !error && (
          <div className="flex flex-col items-center justify-center h-full gap-6 select-none">
            <div
              className="text-8xl animate-pulse-slow"
              style={{ color: 'var(--accent-cyan)', opacity: 0.8 }}
            >
              &#9672;
            </div>
            <div className="text-center">
              <p
                className="font-display text-4xl tracking-widest"
                style={{ color: 'var(--text-primary)' }}
              >
                DROP FASTA FILES
              </p>
              <p
                className="text-base mt-2"
                style={{ color: 'var(--text-muted)', fontFamily: 'Figtree, sans-serif' }}
              >
                Upload sequences in the sidebar, then run the pipeline
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
