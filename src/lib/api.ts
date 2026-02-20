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
  
  // Add files
  for (const file of files) {
    form.append('files', file, file.name);
  }
  
  // Add all parameters as form fields
  form.append('fasta_text', fastaText);
  form.append('gamma', gamma.toString());
  form.append('engine', engine);
  form.append('bp_weight', bpWeight.toString());

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
