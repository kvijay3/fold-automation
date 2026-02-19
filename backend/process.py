"""
process.py — Modal backend worker for RNA structure prediction.

Adapted from process_single.py to:
  - Accept FASTA content as a string (not a file path)
  - Return base64-encoded PNG images instead of file paths
  - Use the ViennaRNA Python API (RNA module) exclusively — no subprocess calls
"""

import base64
import re
import subprocess
import tempfile
from pathlib import Path


# ---------------------------------------------------------------------------
# FASTA parsing
# ---------------------------------------------------------------------------

def parse_fasta(content: str) -> list[tuple[str, str]]:
    """Return list of (header, sequence) tuples from a FASTA string."""
    sequences: list[tuple[str, str]] = []
    current_header: str | None = None
    current_seq: list[str] = []

    for raw in content.splitlines():
        line = raw.strip()
        if not line:
            continue
        if line.startswith(">"):
            if current_header is not None:
                sequences.append((current_header, "".join(current_seq)))
            current_header = line[1:].strip()
            current_seq = []
        else:
            current_seq.append(line.upper())

    if current_header is not None:
        sequences.append((current_header, "".join(current_seq)))

    return sequences


def safe_filename(seq_id: str) -> str:
    """Convert a sequence ID to a filesystem-safe string."""
    return re.sub(r"[^\w.-]", "_", seq_id).strip("_")


# ---------------------------------------------------------------------------
# PS → PNG → base64
# ---------------------------------------------------------------------------

def ps_to_png_b64(ps_content: bytes) -> str | None:
    """
    Convert PostScript bytes to base64-encoded PNG using Ghostscript.
    Works entirely in memory via temp files.
    """
    with tempfile.TemporaryDirectory() as tmp:
        ps_path = Path(tmp) / "input.ps"
        png_path = Path(tmp) / "output.png"
        ps_path.write_bytes(ps_content)

        try:
            result = subprocess.run(
                [
                    "gs", "-dBATCH", "-dNOPAUSE", "-dQUIET",
                    "-sDEVICE=png16m", "-r150",
                    f"-sOutputFile={png_path}",
                    str(ps_path),
                ],
                capture_output=True,
                timeout=60,
            )
            if result.returncode == 0 and png_path.exists():
                return base64.b64encode(png_path.read_bytes()).decode()
        except (FileNotFoundError, subprocess.TimeoutExpired):
            pass
    return None


# ---------------------------------------------------------------------------
# Main fold function
# ---------------------------------------------------------------------------

def fold_sequence(seq_id: str, sequence: str, fasta_filename: str = "") -> dict:
    """
    Fold one RNA sequence using ViennaRNA Python API.

    Returns a dict matching the SequenceResult interface:
        fasta_file        : str
        seq_id            : str
        length            : int
        mfe               : float
        mfe_structure     : str
        centroid_structure: str
        colored_img_b64   : str   — nucleotides colored blue→red by pair probability
        dp_img_b64        : str   — dot-plot probability matrix
        error             : str | None
    """
    try:
        import RNA  # ViennaRNA Python bindings — available in Modal image
    except ImportError:
        return {
            "fasta_file": fasta_filename,
            "seq_id": seq_id,
            "length": len(sequence),
            "mfe": None,
            "mfe_structure": None,
            "centroid_structure": None,
            "colored_img_b64": None,
            "dp_img_b64": None,
            "error": "ViennaRNA Python bindings not available",
        }

    try:
        n = len(sequence)
        sid = safe_filename(seq_id)

        # --- MFE fold ---
        fc = RNA.fold_compound(sequence)
        (mfe_structure, mfe) = fc.mfe()

        # --- Partition function + bpp ---
        fc.exp_params_rescale(mfe)
        fc.pf()
        bppm = fc.bpp()  # 1-based, upper-triangular

        # --- Centroid structure ---
        centroid_result = fc.centroid()
        if isinstance(centroid_result, tuple):
            centroid_structure = centroid_result[0]
        else:
            centroid_structure = centroid_result

        # --- Per-nucleotide pairing probability ---
        pair_prob = [0.0] * (n + 1)
        for i in range(1, n + 1):
            for j in range(i + 1, n + 1):
                p = bppm[i][j]
                pair_prob[i] += p
                pair_prob[j] += p
        pair_prob = [min(1.0, p) for p in pair_prob]

        # --- Confidence-colored structure PS (HSB: blue=unpaired → red=paired) ---
        pre_annotations = ""
        for i in range(1, n + 1):
            p = pair_prob[i]
            hue = (1.0 - p) * 0.667  # blue (0.667) → red (0.0)
            pre_annotations += f"{hue:.4f} 0.9 0.9 sethsbcolor {i} cmark\n"

        with tempfile.TemporaryDirectory() as tmp:
            colored_ps_path = str(Path(tmp) / f"{sid}_colored.ps")
            RNA.PS_rna_plot_a(sequence, mfe_structure, colored_ps_path, pre_annotations, "")
            colored_ps = Path(colored_ps_path)
            colored_img_b64 = (
                ps_to_png_b64(colored_ps.read_bytes()) if colored_ps.exists() else None
            )

        # --- Dot-plot PS ---
        with tempfile.TemporaryDirectory() as tmp:
            dp_ps_path = str(Path(tmp) / f"{sid}_dp.ps")
            fc.plot_dp_PS(dp_ps_path)
            dp_ps = Path(dp_ps_path)
            dp_img_b64 = (
                ps_to_png_b64(dp_ps.read_bytes()) if dp_ps.exists() else None
            )

        return {
            "fasta_file": fasta_filename,
            "seq_id": seq_id,
            "length": n,
            "mfe": round(float(mfe), 2),
            "mfe_structure": mfe_structure,
            "centroid_structure": centroid_structure,
            "colored_img_b64": colored_img_b64,
            "dp_img_b64": dp_img_b64,
            "error": None,
        }

    except Exception as exc:
        return {
            "fasta_file": fasta_filename,
            "seq_id": seq_id,
            "length": len(sequence),
            "mfe": None,
            "mfe_structure": None,
            "centroid_structure": None,
            "colored_img_b64": None,
            "dp_img_b64": None,
            "error": str(exc),
        }
