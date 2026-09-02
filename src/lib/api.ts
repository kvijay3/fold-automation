import type { SequenceResult } from './types';

const ENDPOINT = import.meta.env.VITE_MODAL_ENDPOINT ?? 'http://localhost:8000';

function buildForm(
  files: File[],
  fastaText: string,
  gamma: number,
  engine: string,
  bpWeight: number,
  sweep: boolean = false,
): FormData {
  const form = new FormData();
  for (const file of files) {
    form.append('files', file, file.name);
  }
  form.append('fasta_text', fastaText);
  form.append('gamma', gamma.toString());
  form.append('engine', engine);
  form.append('bp_weight', bpWeight.toString());
  // The 10-gamma x 2-engine sweep is ~20x the work of a single gamma, so it
  // is opt-in. Off by default keeps a 94-sequence run to a few minutes.
  form.append('sweep', String(sweep));
  return form;
}

/**
 * Streaming version — calls onResult for each sequence as it completes.
 * Uses NDJSON (one JSON object per line) so the connection never times out.
 */
export async function predictStructuresStream(
  files: File[],
  fastaText: string = '',
  gamma: number = 4.0,
  engine: string = 'BL',
  bpWeight: number = 2.0,
  sweep: boolean = false,
  onResult: (r: SequenceResult) => void,
  onDone: () => void,
  onError: (msg: string) => void,
): Promise<void> {
  const form = buildForm(files, fastaText, gamma, engine, bpWeight, sweep);

  let res: Response;
  try {
    res = await fetch(`${ENDPOINT}/predict-stream`, { method: 'POST', body: form });
  } catch (e) {
    onError(e instanceof Error ? e.message : String(e));
    return;
  }

  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try { const b = await res.json(); detail = b.detail ?? detail; } catch { /* ignore */ }
    onError(detail);
    return;
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        onResult(JSON.parse(trimmed) as SequenceResult);
      } catch {
        /* skip malformed line */
      }
    }
  }

  // Flush any remaining buffer
  if (buffer.trim()) {
    try { onResult(JSON.parse(buffer.trim()) as SequenceResult); } catch { /* ignore */ }
  }

  onDone();
}

export async function predictStructures(
  files: File[], 
  fastaText: string = '',
  gamma: number = 4.0,
  engine: string = 'BL',
  bpWeight: number = 2.0,
  sweep: boolean = false
): Promise<SequenceResult[]> {
  const form = buildForm(files, fastaText, gamma, engine, bpWeight, sweep);

  const res = await fetch(`${ENDPOINT}/predict`, {
    method: 'POST',
    body: form,
  });

  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      detail = body.detail ?? detail;
    } catch {
      /* ignore parse error */
    }
    throw new Error(detail);
  }

  return res.json() as Promise<SequenceResult[]>;
}
