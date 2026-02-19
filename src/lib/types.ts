export interface SequenceResult {
  fasta_file: string;
  seq_id: string;
  length: number;
  mfe: number | null;
  mfe_structure: string | null;
  centroid_structure: string | null;
  /** URL to PNG: MFE structure colored blue→red by pair probability */
  colored_img_url: string | null;
  /** URL to PNG: centroid structure colored blue→red by pair probability */
  centroid_img_url: string | null;
  /** URL to PNG: dot-plot probability matrix */
  dp_img_url: string | null;
  error?: string | null;
  img_errors?: string[];
}
