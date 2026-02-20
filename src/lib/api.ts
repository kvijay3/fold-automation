import type { SequenceResult } from './types';

const ENDPOINT = import.meta.env.VITE_MODAL_ENDPOINT ?? 'http://localhost:8000';

export async function predictStructures(files: File[], gamma: number = 6.0): Promise<SequenceResult[]> {
  const form = new FormData();
  for (const file of files) {
    form.append('files', file, file.name);
  }

  const url = new URL(`${ENDPOINT}/predict`);
  url.searchParams.set('gamma', gamma.toString());

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
