import { useState } from 'react';
import { UploadZone } from './components/UploadZone';
import { Dashboard } from './components/Dashboard';
import { ColorLegend } from './components/ColorLegend';
import { SequenceDetail } from './components/SequenceDetail';
import { predictStructures } from './lib/api';
import type { SequenceResult } from './lib/types';
import { Layers } from 'lucide-react';

type GridCols = 2 | 3 | 4;

function SkeletonGrid({ cols, n }: { cols: GridCols; n: number }) {
  const colClass = {
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
  }[cols];

  return (
    <div className={`grid ${colClass} gap-4`}>
      {Array.from({ length: n }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl overflow-hidden"
          style={{ border: '1px solid var(--border)' }}
        >
          <div className="skeleton w-full" style={{ height: 200 }} />
          <div className="p-3 flex flex-col gap-2" style={{ background: 'var(--surface)' }}>
            <div className="skeleton h-4 w-3/4 rounded" />
            <div className="skeleton h-4 w-1/2 rounded" />
            <div className="skeleton h-8 w-full rounded" />
            <div className="skeleton h-8 w-full rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function App() {
  const [files, setFiles]           = useState<File[]>([]);
  const [results, setResults]       = useState<SequenceResult[]>([]);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [cols, setCols]             = useState<GridCols>(3);
  const [selected, setSelected]     = useState<SequenceResult | null>(null);

  const handleRun = async () => {
    if (!files.length) return;
    setLoading(true);
    setError(null);
    setResults([]);
    try {
      const data = await predictStructures(files);
      setResults(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const hasResults = results.length > 0;

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg)' }}>
      {/* ── Sidebar ── */}
      <aside
        className="flex flex-col gap-0 flex-shrink-0 animate-slide-in-left overflow-y-auto"
        style={{
          width: 240,
          background: '#080D1A',
          borderRight: '1px solid var(--border)',
        }}
      >
        {/* Logo */}
        <div
          className="flex items-center gap-2 px-4 py-4"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <span style={{ color: 'var(--accent-cyan)', fontSize: 18 }}>◈</span>
          <span
            className="font-display tracking-widest text-sm"
            style={{ color: 'var(--accent-cyan)' }}
          >
            RNA STRUCTURE LAB
          </span>
        </div>

        {/* Sequence count badge */}
        {hasResults && (
          <div
            className="flex items-center gap-2 px-4 py-2"
            style={{ borderBottom: '1px solid var(--border)' }}
          >
            <Layers size={12} style={{ color: 'var(--text-muted)' }} />
            <span
              className="text-xs"
              style={{ color: 'var(--text-muted)', fontFamily: 'Figtree, sans-serif' }}
            >
              {results.length} sequence{results.length !== 1 ? 's' : ''}
            </span>
          </div>
        )}

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

        {/* Settings */}
        <div className="py-4 px-3" style={{ borderBottom: '1px solid var(--border)' }}>
          <p
            className="font-display text-xs tracking-widest mb-3"
            style={{ color: 'var(--text-muted)' }}
          >
            SETTINGS
          </p>
          <label
            className="text-xs mb-1 block"
            style={{ color: 'var(--text-muted)', fontFamily: 'Figtree, sans-serif' }}
          >
            Grid columns
          </label>
          <div className="flex gap-1">
            {([2, 3, 4] as GridCols[]).map((n) => (
              <button
                key={n}
                onClick={() => setCols(n)}
                className="flex-1 py-1.5 rounded text-xs font-body transition-all duration-150"
                style={{
                  background: cols === n ? 'rgba(34,211,238,0.15)' : 'transparent',
                  border: `1px solid ${cols === n ? 'var(--accent-cyan)' : 'var(--border)'}`,
                  color: cols === n ? 'var(--accent-cyan)' : 'var(--text-muted)',
                }}
              >
                {n}
              </button>
            ))}
          </div>
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

        <div className="flex-1" />
      </aside>

      {/* ── Main ── */}
      <main className="flex-1 overflow-y-auto p-6">
        {/* Global error */}
        {error && (
          <div
            className="mb-4 px-4 py-3 rounded-lg text-sm"
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

        {/* Loading */}
        {loading && (
          <div className="flex flex-col gap-4">
            <p
              className="text-sm animate-fade-down"
              style={{ color: 'var(--text-muted)', fontFamily: 'Figtree, sans-serif' }}
            >
              Processing {files.length} file{files.length !== 1 ? 's' : ''}…
            </p>
            <SkeletonGrid cols={cols} n={6} />
          </div>
        )}

        {/* Results */}
        {!loading && hasResults && (
          <Dashboard results={results} cols={cols} onCardClick={setSelected} />
        )}

        {/* Empty state */}
        {!loading && !hasResults && !error && (
          <div className="flex flex-col items-center justify-center h-full gap-6 select-none">
            <div
              className="text-8xl animate-pulse-slow"
              style={{ color: 'var(--accent-cyan)', opacity: 0.8 }}
            >
              ◈
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

      {/* Detail overlay */}
      {selected && (
        <SequenceDetail result={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
