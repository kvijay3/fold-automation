import type { SequenceResult } from './types';

const ENDPOINT = import.meta.env.VITE_MODAL_ENDPOINT ?? 'http://localhost:8000';

export async function predictStructures(
  files: File[], 
  fastaText: string = '',
  gamma: number = 6.0,
  engine: string = 'BL',
  bpWeight: number = 2.0
): Promise<SequenceResult[]> {
  const form = new FormData();
  for (const file of files) {
    form.append('files', file, file.name);
  }
  
  // Add FASTA text if provided
  if (fastaText.trim()) {
    form.append('fasta_text', fastaText);
  }

  const url = new URL(`${ENDPOINT}/predict`);
  url.searchParams.set('gamma', gamma.toString());
  url.searchParams.set('engine', engine);
  url.searchParams.set('bp_weight', bpWeight.toString());

  const res = await fetch(url.toString(), {
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
