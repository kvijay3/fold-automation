"""
process.py — Modal backend worker for RNA structure prediction.

Returns PNG bytes for both images; main.py handles storage and URL generation.
"""

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
# PS → PNG bytes via Ghostscript
# ---------------------------------------------------------------------------

def ps_to_png_bytes(ps_content: bytes) -> bytes | None:
    """Convert PostScript bytes → PNG bytes using Ghostscript."""
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
                return png_path.read_bytes()
        except (FileNotFoundError, subprocess.TimeoutExpired):
            pass
    return None


# ---------------------------------------------------------------------------
# Main fold function
# ---------------------------------------------------------------------------

def fold_sequence(seq_id: str, sequence: str, fasta_filename: str = "") -> dict:
    """
    Fold one RNA sequence using ViennaRNA.

    Returns:
        fasta_file            : str
        seq_id                : str
        length                : int
        mfe                   : float | None
        mfe_structure         : str | None
        centroid_structure    : str | None
        colored_img_bytes     : bytes | None  — MFE structure colored by bpp
        centroid_img_bytes    : bytes | None  — centroid structure colored by bpp
        dp_img_bytes          : bytes | None  — dot-plot probability matrix
        error                 : str | None
    """
    try:
        import RNA
    except ImportError:
        return _error(fasta_filename, seq_id, sequence, "ViennaRNA not available")

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
        centroid_structure = centroid_result[0] if isinstance(centroid_result, tuple) else centroid_result

        # --- Per-nucleotide pairing probability ---
        pair_prob = [0.0] * (n + 1)
        for i in range(1, n + 1):
            for j in range(i + 1, n + 1):
                p = bppm[i][j]
                pair_prob[i] += p
                pair_prob[j] += p
        pair_prob = [min(1.0, p) for p in pair_prob]

        # --- Confidence-colored structure PNG ---
        pre_annotations = ""
        for i in range(1, n + 1):
            hue = (1.0 - pair_prob[i]) * 0.667  # blue (unpaired) → red (paired)
            pre_annotations += f"{hue:.4f} 0.9 0.9 sethsbcolor {i} cmark\n"

        colored_img_bytes: bytes | None = None
        with tempfile.TemporaryDirectory() as tmp:
            colored_ps_path = Path(tmp) / f"{sid}_colored.ps"
            RNA.PS_rna_plot_a(sequence, mfe_structure, str(colored_ps_path), pre_annotations, "")
            if colored_ps_path.exists():
                colored_img_bytes = ps_to_png_bytes(colored_ps_path.read_bytes())

        # --- Centroid structure PNG (same bpp coloring, different topology) ---
        centroid_img_bytes: bytes | None = None
        if centroid_structure:
            with tempfile.TemporaryDirectory() as tmp:
                centroid_ps_path = Path(tmp) / f"{sid}_centroid.ps"
                RNA.PS_rna_plot_a(sequence, centroid_structure, str(centroid_ps_path), pre_annotations, "")
                if centroid_ps_path.exists():
                    centroid_img_bytes = ps_to_png_bytes(centroid_ps_path.read_bytes())

        # --- Dot-plot PNG via RNAfold -p subprocess ---
        # fc.plot_dp_PS() is not available in ViennaRNA 2.7; use CLI instead.
        # The ViennaRNA PyPI package ships the RNAfold binary on Linux.
        dp_img_bytes: bytes | None = None
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            input_fa = tmp_path / f"{sid}.fa"
            input_fa.write_text(f">{sid}\n{sequence}\n")
            try:
                subprocess.run(
                    ["RNAfold", "-p", str(input_fa)],
                    cwd=str(tmp_path),
                    capture_output=True,
                    timeout=300,
                )
                dp_ps = tmp_path / f"{sid}_dp.ps"
                if dp_ps.exists():
                    dp_img_bytes = ps_to_png_bytes(dp_ps.read_bytes())
            except (FileNotFoundError, subprocess.TimeoutExpired):
                pass

        return {
            "fasta_file": fasta_filename,
            "seq_id": seq_id,
            "length": n,
            "mfe": round(float(mfe), 2),
            "mfe_structure": mfe_structure,
            "centroid_structure": centroid_structure,
            "colored_img_bytes": colored_img_bytes,
            "centroid_img_bytes": centroid_img_bytes,
            "dp_img_bytes": dp_img_bytes,
            "error": None,
        }

    except Exception as exc:
        return _error(fasta_filename, seq_id, sequence, str(exc))


def _error(fasta_file: str, seq_id: str, sequence: str, msg: str) -> dict:
    return {
        "fasta_file": fasta_file,
        "seq_id": seq_id,
        "length": len(sequence),
        "mfe": None,
        "mfe_structure": None,
        "centroid_structure": None,
        "colored_img_bytes": None,
        "centroid_img_bytes": None,
        "dp_img_bytes": None,
        "error": msg,
    }
