export interface SequenceResult {
  fasta_file: string;
  seq_id: string;
  length: number;
  mfe: number | null;
  mfe_structure: string | null;
  centroid_structure: string | null;
  /** Base64-encoded PNG: nucleotides colored blue→red by pair probability */
  colored_img_b64: string | null;
  /** Base64-encoded PNG: dot-plot probability matrix */
  dp_img_b64: string | null;
  error?: string | null;
}
