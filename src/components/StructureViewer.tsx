import { useState, useEffect, useMemo } from 'react';
import { parseDotBracket, type ParsedStructure } from '../lib/dotbracket';

const DR_LEN = 36;

interface TsvRow {
  name: string;
  sequence: string;
  gamma: number;
  is_best: boolean;
  structure: string;
  ea: number;
  ea_norm: number;
  energy: number;
  num_pairs: number;
  paired_positions: number;
  unpaired_positions: number;
  max_posterior: number;
  mean_posterior: number;
}

interface GroupedEntry {
  name: string;
  sequence: string;
  gammaRows: Map<number, TsvRow>;
}

const GAMMAS = [0.03125,0.0625,0.125,0.25,0.5,1,2,4,6,8,16,32,64,128,256,512,1024];

function parseTsv(text: string): TsvRow[] {
  const lines = text.trim().split('\n');
  const headers = lines[0].split('\t');
  return lines.slice(1).map(line => {
    const cols = line.split('\t');
    const get = (col: string) => cols[headers.indexOf(col)] ?? '';
    return {
      name:               get('name'),
      sequence:           get('sequence'),
      gamma:              parseFloat(get('gamma')),
      is_best:            get('is_best') === 'true',
      structure:          get('structure'),
      ea:                 parseFloat(get('ea')),
      ea_norm:            parseFloat(get('ea_norm')),
      energy:             parseFloat(get('energy')),
      num_pairs:          parseInt(get('num_pairs')),
      paired_positions:   parseInt(get('paired_positions')),
      unpaired_positions: parseInt(get('unpaired_positions')),
      max_posterior:      parseFloat(get('max_posterior')),
      mean_posterior:     parseFloat(get('mean_posterior')),
    };
  });
}

function groupByName(rows: TsvRow[]): GroupedEntry[] {
  const map = new Map<string, GroupedEntry>();
  for (const row of rows) {
    if (!map.has(row.name)) {
      map.set(row.name, { name: row.name, sequence: row.sequence, gammaRows: new Map() });
    }
    map.get(row.name)!.gammaRows.set(row.gamma, row);
  }
  return Array.from(map.values());
}

// ── Dot-bracket rendering ─────────────────────────────────────────────────────
function DotBracketViz({ db, sequence }: { db: string; sequence: string }) {
  const CHARS_PER_ROW = 60;
  const rows: { seq: string; str: string; start: number }[] = [];
  for (let i = 0; i < db.length; i += CHARS_PER_ROW) {
    rows.push({
      seq: sequence.slice(i, i + CHARS_PER_ROW),
      str: db.slice(i, i + CHARS_PER_ROW),
      start: i,
    });
  }

  function charColor(ch: string, pos: number): string {
    if (pos < DR_LEN) return '#7A7A7A';  // conserved region: grey
    if (ch === '(') return '#2563EB';    // paired open: blue
    if (ch === ')') return '#2563EB';    // paired close: blue
    return '#E42313';                    // unpaired: red
  }
  function ntColor(nt: string, pos: number): string {
    if (pos < DR_LEN) return '#B0B0B0';
    const c: Record<string,string> = { A:'#22C55E', U:'#E42313', G:'#F59E0B', C:'#2563EB' };
    return c[nt] ?? '#0D0D0D';
  }

  return (
    <div className="flex flex-col gap-1"
      style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, lineHeight: 1.6 }}
    >
      {rows.map(({ seq, str, start }) => (
        <div key={start} className="flex flex-col gap-0">
          {/* position ruler */}
          <div style={{ color: '#D0D0D0', fontSize: 9, letterSpacing: '0.05em' }}>
            {String(start + 1).padEnd(4)}{' '.repeat(Math.max(0, seq.length - String(start + 1).length))}
          </div>
          {/* sequence */}
          <div>
            {seq.split('').map((nt, k) => (
              <span key={k} style={{ color: ntColor(nt, start + k) }}>{nt}</span>
            ))}
          </div>
          {/* structure */}
          <div>
            {str.split('').map((ch, k) => (
              <span key={k} style={{ color: charColor(ch, start + k) }}>{ch}</span>
            ))}
          </div>
        </div>
      ))}
      {/* legend */}
      <div className="flex gap-4 mt-2" style={{ fontSize: 10, color: '#7A7A7A' }}>
        <span><span style={{ color: '#B0B0B0' }}>■</span> Conserved DR (1–36)</span>
        <span><span style={{ color: '#2563EB' }}>■</span> Paired</span>
        <span><span style={{ color: '#E42313' }}>■</span> Unpaired guide</span>
      </div>
    </div>
  );
}

// ── Structure element badges ──────────────────────────────────────────────────
function Pill({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="flex flex-col gap-1 px-3 py-2"
      style={{ border: '1px solid var(--border)', background: 'var(--surface)', minWidth: 80 }}
    >
      <span style={{ fontSize: 9, color: 'var(--text-secondary)', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
        {label}
      </span>
      <span className="font-display"
        style={{ fontSize: 18, fontWeight: 300, color: color ?? 'var(--text-primary)', letterSpacing: '-0.5px' }}
      >
        {value}
      </span>
    </div>
  );
}

function StatBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between" style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
        <span>{label}</span>
        <span style={{ color: 'var(--text-primary)' }}>{(value * 100).toFixed(1)}%</span>
      </div>
      <div style={{ height: 4, background: 'var(--border)', borderRadius: 2 }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 2, transition: 'width 0.3s ease' }} />
      </div>
    </div>
  );
}

// ── Main detail panel ─────────────────────────────────────────────────────────
function DetailPanel({ row, parsed }: { row: TsvRow; parsed: ParsedStructure }) {
  const guideSeq = row.sequence.slice(DR_LEN);
  const drSeq    = row.sequence.slice(0, DR_LEN);

  const loopSizes = parsed.hairpins.map(h => h.size);
  const avgLoopSize = loopSizes.length ? (loopSizes.reduce((a,b) => a+b,0) / loopSizes.length).toFixed(1) : '—';
  const maxLoopSize = loopSizes.length ? Math.max(...loopSizes) : 0;

  return (
    <div className="flex flex-col gap-6 h-full overflow-y-auto pb-6">

      {/* Key metrics row */}
      <div className="flex flex-wrap gap-2">
        <Pill label="Base Pairs"    value={parsed.numPairs} />
        <Pill label="% Paired"      value={(parsed.pctPaired * 100).toFixed(1) + '%'} />
        <Pill label="Energy"        value={row.energy.toFixed(2)} color={row.energy < 0 ? '#22C55E' : '#E42313'} />
        <Pill label="Max Post."     value={parsed.numPairs > 0 ? row.max_posterior.toFixed(3) : '—'} />
        <Pill label="DR Pairs"      value={parsed.drPairs} />
        <Pill label="Guide Access." value={(parsed.guideUnpairedFrac * 100).toFixed(1) + '%'}
          color={parsed.guideUnpairedFrac >= 0.7 ? '#22C55E' : parsed.guideUnpairedFrac >= 0.5 ? '#F59E0B' : '#E42313'} />
        <Pill label="Cross Pairs"   value={parsed.crossPairs.length}
          color={parsed.crossPairs.length === 0 ? '#22C55E' : '#E42313'} />
      </div>

      {/* Accessibility bars */}
      <div className="flex flex-col gap-3 p-4" style={{ border: '1px solid var(--border)' }}>
        <p className="font-display text-xs" style={{ color: 'var(--text-secondary)', letterSpacing: '1px' }}>
          CAS13 ACCESSIBILITY
        </p>
        <StatBar label="Guide region unpaired" value={parsed.guideUnpairedFrac} max={1} color="#22C55E" />
        <StatBar label="DR region paired" value={parsed.drPairs / 18} max={1} color="#2563EB" />
        {parsed.crossPairs.length > 0 && (
          <div className="text-xs px-3 py-2 mt-1"
            style={{ background: 'rgba(228,35,19,0.05)', border: '1px solid var(--accent-red)', color: 'var(--accent-red)' }}
          >
            ⚠ {parsed.crossPairs.length} cross-pair{parsed.crossPairs.length > 1 ? 's' : ''} between DR and guide region
            {' — '}{parsed.crossPairs.map(p => `(${p.i+1},${p.j+1})`).join(', ')}
          </div>
        )}
      </div>

      {/* Loop inventory */}
      <div className="flex flex-col gap-3 p-4" style={{ border: '1px solid var(--border)' }}>
        <p className="font-display text-xs" style={{ color: 'var(--text-secondary)', letterSpacing: '1px' }}>
          LOOP INVENTORY
        </p>
        <div className="flex flex-wrap gap-2">
          <Pill label="Stems"          value={parsed.stems.length} />
          <Pill label="Hairpin Loops"  value={parsed.hairpins.length} />
          <Pill label="Internal Loops" value={parsed.internalLoops.length} />
          <Pill label="Bulges"         value={parsed.bulges.length} />
          <Pill label="Multiloops"     value={parsed.multiloops.length} />
          <Pill label="Avg Loop Size"  value={avgLoopSize} />
          <Pill label="Max Loop Size"  value={maxLoopSize || '—'} />
        </div>

        {parsed.hairpins.length > 0 && (
          <div className="flex flex-col gap-1 mt-2">
            <p style={{ fontSize: 10, color: 'var(--text-secondary)' }}>Hairpin loops</p>
            <div className="flex flex-wrap gap-1">
              {parsed.hairpins.map((h, i) => (
                <span key={i} className="px-2 py-0.5 text-xs"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-primary)',
                    fontFamily: 'JetBrains Mono, monospace' }}
                >
                  pos {h.enclosedBy![0]+1}–{h.enclosedBy![1]+1} · {h.size} nt
                </span>
              ))}
            </div>
          </div>
        )}

        {parsed.internalLoops.length > 0 && (
          <div className="flex flex-col gap-1 mt-1">
            <p style={{ fontSize: 10, color: 'var(--text-secondary)' }}>Internal loops</p>
            <div className="flex flex-wrap gap-1">
              {parsed.internalLoops.map((l, i) => (
                <span key={i} className="px-2 py-0.5 text-xs"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-primary)',
                    fontFamily: 'JetBrains Mono, monospace' }}
                >
                  pos {l.enclosedBy![0]+1}–{l.enclosedBy![1]+1} · {l.size} nt
                </span>
              ))}
            </div>
          </div>
        )}

        {parsed.bulges.length > 0 && (
          <div className="flex flex-col gap-1 mt-1">
            <p style={{ fontSize: 10, color: 'var(--text-secondary)' }}>Bulges</p>
            <div className="flex flex-wrap gap-1">
              {parsed.bulges.map((b, i) => (
                <span key={i} className="px-2 py-0.5 text-xs"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-primary)',
                    fontFamily: 'JetBrains Mono, monospace' }}
                >
                  pos {b.enclosedBy![0]+1}–{b.enclosedBy![1]+1} · {b.size} nt
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Dot-bracket visualization */}
      <div className="flex flex-col gap-3 p-4" style={{ border: '1px solid var(--border)' }}>
        <p className="font-display text-xs" style={{ color: 'var(--text-secondary)', letterSpacing: '1px' }}>
          DOT-BRACKET STRUCTURE
        </p>
        <DotBracketViz db={row.structure} sequence={row.sequence} />
      </div>

      {/* Raw strings */}
      <div className="flex flex-col gap-2">
        <p className="font-display text-xs" style={{ color: 'var(--text-secondary)', letterSpacing: '1px' }}>
          RAW STRINGS
        </p>
        {[
          { label: 'Full sequence', val: row.sequence },
          { label: `DR (1–${DR_LEN})`, val: drSeq },
          { label: `Guide (${DR_LEN+1}–${row.sequence.length})`, val: guideSeq },
          { label: 'Structure', val: row.structure },
        ].map(({ label, val }) => (
          <div key={label} className="flex flex-col gap-1">
            <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{label}</span>
            <span className="text-xs px-3 py-2 break-all"
              style={{ fontFamily: 'JetBrains Mono, monospace', background: 'var(--surface)',
                border: '1px solid var(--border)', color: 'var(--text-primary)', lineHeight: 1.6 }}
            >
              {val}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export function StructureViewer() {
  const [highRows, setHighRows] = useState<TsvRow[]>([]);
  const [lowRows,  setLowRows]  = useState<TsvRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [gamma, setGamma]       = useState<number>(1);
  const [group, setGroup]       = useState<'High TIA' | 'Low TIA'>('High TIA');
  const [selectedName, setSelectedName] = useState<string | null>(null);

  // Load TSV files from public folder
  useEffect(() => {
    async function loadTsvs() {
      try {
        const [hRes, lRes] = await Promise.all([
          fetch('/HighTIA_seqs_export.tsv'),
          fetch('/LowTIA_seqs_export.tsv'),
        ]);
        if (!hRes.ok || !lRes.ok) throw new Error('Could not load TSV files from /public');
        const [hText, lText] = await Promise.all([hRes.text(), lRes.text()]);
        setHighRows(parseTsv(hText));
        setLowRows(parseTsv(lText));
      } catch (e: unknown) {
        setLoadError(e instanceof Error ? e.message : String(e));
      }
    }
    loadTsvs();
  }, []);

  const activeRows = group === 'High TIA' ? highRows : lowRows;
  const grouped    = useMemo(() => groupByName(activeRows), [activeRows]);

  const atGamma: { entry: GroupedEntry; row: TsvRow }[] = useMemo(() =>
    grouped
      .map(e => ({ entry: e, row: e.gammaRows.get(gamma)! }))
      .filter(x => x.row != null),
    [grouped, gamma]
  );

  // Auto-select first on group/gamma change
  useEffect(() => {
    if (atGamma.length > 0) setSelectedName(atGamma[0].entry.name);
  }, [group, gamma]);

  const selected = atGamma.find(x => x.entry.name === selectedName);
  const parsed   = useMemo(
    () => selected ? parseDotBracket(selected.row.structure) : null,
    [selected]
  );

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <div className="px-6 py-4 text-sm"
          style={{ background: 'rgba(228,35,19,0.05)', border: '1px solid var(--accent-red)', color: 'var(--accent-red)', maxWidth: 480 }}
        >
          <p className="font-display mb-1" style={{ fontWeight: 300 }}>Could not load TSV data</p>
          <p>{loadError}</p>
          <p className="mt-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
            Copy <code>HighTIA_seqs_export.tsv</code> and <code>LowTIA_seqs_export.tsv</code> into{' '}
            <code>fold-automation/public/</code> then restart the dev server.
          </p>
        </div>
      </div>
    );
  }

  if (!highRows.length) {
    return (
      <div className="flex items-center justify-center h-full">
        <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Loading TSV data…</p>
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden">

      {/* ── Left panel: sequence list ─────────────────────────────────────── */}
      <aside className="flex flex-col flex-shrink-0 overflow-hidden"
        style={{ width: 260, borderRight: '1px solid var(--border)', padding: '24px 0' }}
      >
        {/* Group toggle */}
        <div className="flex mx-4 mb-4" style={{ border: '1px solid var(--border)' }}>
          {(['High TIA', 'Low TIA'] as const).map(g => (
            <button key={g} onClick={() => setGroup(g)}
              className="flex-1 py-2 text-xs font-display transition-all"
              style={{
                background: group === g ? 'var(--text-primary)' : 'transparent',
                color: group === g ? 'var(--bg)' : 'var(--text-secondary)',
                fontWeight: 300,
                letterSpacing: '0.5px',
              }}
            >
              {g}
            </button>
          ))}
        </div>

        {/* Gamma selector */}
        <div className="flex flex-col gap-1 px-4 mb-4">
          <div className="flex justify-between items-center">
            <span style={{ fontSize: 10, color: 'var(--text-secondary)', letterSpacing: '1px' }}>GAMMA</span>
            <span className="font-display" style={{ fontSize: 12, color: 'var(--text-primary)' }}>γ = {gamma}</span>
          </div>
          <select value={gamma}
            onChange={e => setGamma(parseFloat(e.target.value))}
            className="w-full px-3 py-1.5 text-xs"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
          >
            {GAMMAS.map(g => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </div>

        {/* Sequence list */}
        <div className="flex flex-col gap-0 overflow-y-auto flex-1 px-2">
          {atGamma.map(({ entry, row }) => {
            const p = parseDotBracket(row.structure);
            const isActive = entry.name === selectedName;
            const guideOk = p.guideUnpairedFrac >= 0.7;
            return (
              <button key={entry.name} onClick={() => setSelectedName(entry.name)}
                className="flex flex-col gap-0.5 px-3 py-2.5 text-left transition-all"
                style={{
                  borderLeft: isActive ? '2px solid var(--accent-red)' : '2px solid transparent',
                  background: isActive ? 'var(--surface)' : 'transparent',
                }}
              >
                <span className="text-xs truncate w-full"
                  style={{ color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: isActive ? 500 : 400 }}
                  title={entry.name}
                >
                  {entry.name}
                </span>
                <div className="flex items-center gap-2">
                  <span style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
                    {p.numPairs} bp · {(p.pctPaired*100).toFixed(0)}% paired
                  </span>
                  <span style={{
                    fontSize: 8, fontWeight: 500, letterSpacing: '0.3px',
                    color: guideOk ? '#22C55E' : p.guideUnpairedFrac >= 0.5 ? '#F59E0B' : '#E42313',
                  }}>
                    {(p.guideUnpairedFrac*100).toFixed(0)}% acc
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer count */}
        <div className="px-4 pt-3 mt-2" style={{ borderTop: '1px solid var(--border)' }}>
          <p style={{ fontSize: 10, color: 'var(--text-muted)' }}>{atGamma.length} sequences at γ={gamma}</p>
        </div>
      </aside>

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-hidden flex flex-col" style={{ padding: '28px 36px' }}>
        {selected && parsed ? (
          <>
            {/* Header */}
            <div className="flex items-center justify-between mb-6 flex-shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <h2 className="font-display truncate"
                  style={{ fontSize: 22, fontWeight: 300, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}
                  title={selected.entry.name}
                >
                  {selected.entry.name}
                </h2>
                <span className="text-xs px-2 py-0.5 flex-shrink-0"
                  style={{
                    background: group === 'High TIA' ? 'rgba(34,197,94,0.08)' : 'rgba(228,35,19,0.08)',
                    color: group === 'High TIA' ? '#22C55E' : '#E42313',
                    border: `1px solid ${group === 'High TIA' ? '#22C55E' : '#E42313'}`,
                  }}
                >
                  {group}
                </span>
                <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
                  γ = {gamma} · {selected.row.sequence.length} nt
                </span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                {selected.row.is_best && (
                  <span className="text-xs px-2 py-0.5"
                    style={{ border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
                  >
                    BEST γ
                  </span>
                )}
                <span className="font-display text-xs" style={{ color: 'var(--text-secondary)' }}>
                  energy: {selected.row.energy > 0 ? '+' : ''}{selected.row.energy.toFixed(2)} kcal/mol
                </span>
              </div>
            </div>

            <DetailPanel row={selected.row} parsed={parsed} />
          </>
        ) : (
          <div className="flex items-center justify-center h-full">
            <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Select a sequence from the panel</p>
          </div>
        )}
      </main>
    </div>
  );
}
