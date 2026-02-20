import { useEffect, useState } from 'react';
import { UploadZone } from './components/UploadZone';
import { ColorLegend } from './components/ColorLegend';
import { SequencePage } from './components/SequencePage';
import { predictStructures } from './lib/api';
import type { SequenceResult } from './lib/types';
import { Download } from 'lucide-react';

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
  const [fastaText, setFastaText]       = useState('');
  const [results, setResults]           = useState<SequenceResult[]>([]);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [gamma, setGamma]               = useState(6.0);
  const [engine, setEngine]             = useState('BL');
  const [bpWeight, setBpWeight]         = useState(2.0);

  const handleRun = async () => {
    if (!files.length && !fastaText.trim()) return;
    setLoading(true);
    setError(null);
    setResults([]);
    setSelectedIndex(0);
    try {
      const data = await predictStructures(files, fastaText, gamma, engine, bpWeight);
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
        className="flex flex-col flex-shrink-0 overflow-y-auto"
        style={{
          width: 280,
          background: 'var(--bg)',
          borderRight: '1px solid var(--border)',
          padding: '40px 24px',
          justifyContent: 'space-between',
        }}
      >
        <div className="flex flex-col gap-8">
          {/* Logo */}
          <div className="flex flex-col gap-3">
            <div
              style={{
                width: 32,
                height: 32,
                background: 'var(--accent-red)',
              }}
            />
            <span
              className="font-display text-lg"
              style={{ color: 'var(--text-primary)', letterSpacing: '0.5px' }}
            >
              RNA FOLD
            </span>
          </div>

          {/* Upload */}
          <div className="flex flex-col gap-3">
            <p
              className="font-display text-xs"
              style={{ color: 'var(--text-secondary)', letterSpacing: '1px' }}
            >
              UPLOAD FILES
            </p>
            <UploadZone
              files={files}
              onFilesChange={setFiles}
              fastaText={fastaText}
              onFastaTextChange={setFastaText}
              onRun={handleRun}
              loading={loading}
            />
          </div>

          {/* CentroidFold Parameters */}
          <div className="flex flex-col gap-3">
            <p
              className="font-display text-xs"
              style={{ color: 'var(--text-secondary)', letterSpacing: '1px' }}
            >
              CENTROID PARAMETERS
            </p>
            
            {/* Gamma */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>Gamma</span>
                <span className="font-display text-xs" style={{ color: 'var(--text-primary)' }}>
                  {gamma.toFixed(1)}
                </span>
              </div>
              <input
                type="range"
                min="1"
                max="10"
                step="0.5"
                value={gamma}
                onChange={(e) => setGamma(parseFloat(e.target.value))}
                className="w-full"
                style={{ accentColor: 'var(--accent-red)' }}
              />
            </div>

            {/* Inference Engine */}
            <div className="flex flex-col gap-2">
              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>Inference Engine</span>
              <select
                value={engine}
                onChange={(e) => setEngine(e.target.value)}
                className="w-full px-3 py-2 text-xs"
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-primary)',
                }}
              >
                <option value="BL">McCaskill (BL)</option>
                <option value="CONTRAfold">CONTRAfold</option>
                <option value="RNAfold">RNAfold</option>
              </select>
            </div>

            {/* Base Pair Weight */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>Base Pair Weight</span>
                <span className="font-display text-xs" style={{ color: 'var(--text-primary)' }}>
                  {bpWeight.toFixed(1)}
                </span>
              </div>
              <input
                type="range"
                min="1"
                max="4"
                step="0.1"
                value={bpWeight}
                onChange={(e) => setBpWeight(parseFloat(e.target.value))}
                className="w-full"
                style={{ accentColor: 'var(--accent-red)' }}
              />
            </div>
          </div>

          {/* Color legend */}
          <div className="flex flex-col gap-3">
            <p
              className="font-display text-xs"
              style={{ color: 'var(--text-secondary)', letterSpacing: '1px' }}
            >
              COLOR LEGEND
            </p>
            <ColorLegend />
          </div>

          {/* Sequence list */}
          {hasResults && (
            <div className="flex flex-col gap-2">
              <p
                className="font-display text-xs"
                style={{ color: 'var(--text-secondary)', letterSpacing: '1px' }}
              >
                SEQUENCES
              </p>
              <div className="flex flex-col gap-2 max-h-[40vh] overflow-y-auto">
                {results.map((r, i) => {
                  const isActive = i === selectedIndex;
                  return (
                    <button
                      key={`${r.fasta_file}-${r.seq_id}-${i}`}
                      onClick={() => setSelectedIndex(i)}
                      className="flex items-center gap-2 px-3 py-2 text-left transition-all duration-150"
                      style={{
                        background: isActive ? 'var(--surface)' : 'transparent',
                        borderLeft: isActive ? '2px solid var(--accent-red)' : '2px solid var(--border)',
                        color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                      }}
                    >
                      <span
                        className="text-xs truncate flex-1"
                        title={r.seq_id}
                      >
                        {r.seq_id}
                      </span>
                      {r.mfe !== null && (
                        <span
                          className="font-display text-xs flex-shrink-0"
                          style={{ color: isActive ? 'var(--accent-red)' : 'var(--text-secondary)' }}
                        >
                          {r.mfe}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="flex flex-col gap-2">
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            ViennaRNA + CentroidFold
          </p>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-hidden flex flex-col" style={{ padding: '48px' }}>
        {/* Global error */}
        {error && (
          <div
            className="mb-6 px-4 py-3 text-sm flex-shrink-0"
            style={{
              background: 'rgba(228,35,19,0.05)',
              border: '1px solid var(--accent-red)',
              color: 'var(--accent-red)',
            }}
          >
            {error}
          </div>
        )}

        {/* Header */}
        <div className="flex items-end justify-between mb-12 flex-shrink-0">
          <div className="flex flex-col gap-2">
            <h1
              className="font-display"
              style={{
                fontSize: '40px',
                fontWeight: '300',
                color: 'var(--text-primary)',
                letterSpacing: '-1px',
              }}
            >
              RNA Structure Prediction
            </h1>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Analyze secondary structures using MFE and centroid algorithms
            </p>
          </div>
          {hasResults && (
            <button
              onClick={() => downloadTSV(results)}
              className="flex items-center gap-2 px-4 py-2 transition-all duration-150"
              style={{
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
                background: 'transparent',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--accent-red)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border)';
              }}
            >
              <Download size={14} />
              <span className="font-display text-xs">Export TSV</span>
            </button>
          )}
        </div>

        {/* Metrics */}
        {hasResults && (
          <div className="flex gap-6 mb-12 flex-shrink-0">
            {[
              { label: 'Sequences', value: String(results.length) },
              { label: 'Files Processed', value: String(fileNames.length) },
              { label: 'Min MFE', value: mfes.length ? `${Math.min(...mfes)}` : '—' },
              { label: 'Max MFE', value: mfes.length ? `${Math.max(...mfes)}` : '—' },
            ].map(({ label, value }) => (
              <div
                key={label}
                className="flex-1 flex flex-col gap-2"
                style={{
                  border: '1px solid var(--border)',
                  padding: '28px',
                }}
              >
                <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  {label}
                </span>
                <span
                  className="font-display"
                  style={{
                    fontSize: '36px',
                    fontWeight: '100',
                    color: 'var(--text-primary)',
                    letterSpacing: '-1px',
                  }}
                >
                  {value}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex-1 flex flex-col items-center justify-center gap-6">
            <div
              className="animate-pulse-slow"
              style={{
                width: 80,
                height: 80,
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span style={{ fontSize: '32px', color: 'var(--text-placeholder)' }}>↑</span>
            </div>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Processing {files.length} file{files.length !== 1 ? 's' : ''}...
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
          <div className="flex flex-col items-center justify-center h-full gap-6">
            <div
              className="animate-pulse-slow"
              style={{
                width: 80,
                height: 80,
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span style={{ fontSize: '32px', color: 'var(--text-placeholder)' }}>↑</span>
            </div>
            <div className="text-center">
              <p
                className="font-display text-2xl"
                style={{ color: 'var(--text-primary)', fontWeight: '300' }}
              >
                No Results Yet
              </p>
              <p className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>
                Upload FASTA files to begin RNA structure analysis
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
