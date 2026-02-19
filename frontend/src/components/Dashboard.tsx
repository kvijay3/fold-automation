import type { SequenceResult } from '../lib/types';
import { SequenceCard } from './SequenceCard';
import { Download } from 'lucide-react';

interface DashboardProps {
  results: SequenceResult[];
  cols: 2 | 3 | 4;
}

function toTSV(results: SequenceResult[]): string {
  const header = [
    'fasta_file', 'seq_id', 'length', 'mfe',
    'mfe_structure', 'centroid_structure', 'error',
  ].join('\t');
  const rows = results.map((r) =>
    [
      r.fasta_file,
      r.seq_id,
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

export function Dashboard({ results, cols }: DashboardProps) {
  const mfes = results.map((r) => r.mfe).filter((m): m is number => m !== null);
  const files = [...new Set(results.map((r) => r.fasta_file))];

  const colClass = {
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
  }[cols];

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* ── Summary bar ── */}
      <div
        className="flex items-stretch rounded-xl overflow-hidden animate-fade-down"
        style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}
      >
        {[
          { label: 'SEQUENCES', value: String(results.length) },
          { label: 'FILES',     value: String(files.length) },
          {
            label: 'MIN MFE',
            value: mfes.length ? `${Math.min(...mfes)} kcal/mol` : '—',
          },
          {
            label: 'MAX MFE',
            value: mfes.length ? `${Math.max(...mfes)} kcal/mol` : '—',
          },
        ].map(({ label, value }, i, arr) => (
          <div
            key={label}
            className="flex-1 flex flex-col items-center justify-center py-4 px-3"
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
              className="font-display text-xl leading-tight mt-0.5"
              style={{ color: 'var(--accent-cyan)' }}
            >
              {value}
            </span>
          </div>
        ))}
      </div>

      {/* ── Card grid ── */}
      <div className={`grid ${colClass} gap-4`}>
        {results.map((r, i) => (
          <SequenceCard key={`${r.fasta_file}-${r.seq_id}-${i}`} result={r} index={i} />
        ))}
      </div>

      {/* ── Download TSV ── */}
      <div className="flex justify-end pb-4">
        <button
          onClick={() => downloadTSV(results)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-body transition-all duration-200"
          style={{
            border: '1px solid var(--border)',
            color: 'var(--text-muted)',
            background: 'transparent',
          }}
          onMouseEnter={(e) => {
            const el = e.currentTarget;
            el.style.borderColor = 'var(--accent-cyan)';
            el.style.color = 'var(--accent-cyan)';
          }}
          onMouseLeave={(e) => {
            const el = e.currentTarget;
            el.style.borderColor = 'var(--border)';
            el.style.color = 'var(--text-muted)';
          }}
        >
          <Download size={14} />
          Download TSV
        </button>
      </div>
    </div>
  );
}
