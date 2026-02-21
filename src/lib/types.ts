export interface CentroidSweepEntry {
  gamma: number;
  engine: string;
  structure: string | null;
  img_url: string | null;
  error: string | null;
}

export interface RNAfoldSweepEntry {
  gamma: number;
  structure: string | null;
  error: string | null;
}

export interface SequenceResult {
  fasta_file: string;
  seq_id: string;
  sequence: string | null;
  length: number;
  mfe: number | null;
  mfe_structure: string | null;
  centroid_structure: string | null;
  /** URL to PNG: MFE structure colored blue→red by pair probability */
  colored_img_url: string | null;
  /** URL to PNG: centroid structure colored blue→red by pair probability */
  centroid_img_url: string | null;
  /** URL to PNG: MFE dot-plot probability matrix */
  dp_img_url: string | null;
  /** URL to PNG: centroid dot-plot probability matrix */
  centroid_dp_img_url: string | null;
  centroid_sweep?: CentroidSweepEntry[];
  rnafold_sweep?: RNAfoldSweepEntry[];
  error?: string | null;
  img_errors?: string[];
}
