import type { SequenceResult } from './types';

const ENDPOINT = import.meta.env.VITE_MODAL_ENDPOINT ?? 'http://localhost:8000';

export async function predictStructures(files: File[]): Promise<SequenceResult[]> {
  const form = new FormData();
  for (const file of files) {
    form.append('files', file, file.name);
  }

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
