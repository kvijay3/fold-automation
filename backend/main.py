"""
main.py — Modal app + FastAPI for RNA structure prediction.

Deploy:  modal deploy backend/main.py
Dev:     modal serve backend/main.py

Images are stored in a Modal Volume and served via GET /images/{filename}.
"""

import re
import subprocess
import tempfile
import uuid
from pathlib import Path

import modal

# ---------------------------------------------------------------------------
# Modal image + volume
# ---------------------------------------------------------------------------

image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("ghostscript")
    .pip_install(
        "ViennaRNA",
        "fastapi",
        "python-multipart",
    )
)

# Persistent volume — images stay here across deployments
images_vol = modal.Volume.from_name("fold-images", create_if_missing=True)
IMAGES_DIR = Path("/images")

app = modal.App("fold-automation", image=image)


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
    return re.sub(r"[^\w.-]", "_", seq_id).strip("_")


# ---------------------------------------------------------------------------
# PS → PNG bytes via Ghostscript
# ---------------------------------------------------------------------------

def ps_to_png_bytes(ps_content: bytes) -> bytes | None:
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
# Fold one sequence
# ---------------------------------------------------------------------------

def fold_sequence(seq_id: str, sequence: str, fasta_filename: str = "") -> dict:
    try:
        import RNA
    except ImportError:
        return _fold_error(fasta_filename, seq_id, sequence, "ViennaRNA not available")

    try:
        n = len(sequence)
        sid = safe_filename(seq_id)

        # MFE fold
        fc = RNA.fold_compound(sequence)
        (mfe_structure, mfe) = fc.mfe()
        mfe_structure = str(mfe_structure).strip()

        # Partition function + bpp
        fc.exp_params_rescale(mfe)
        fc.pf()
        bppm = fc.bpp()  # 1-based, upper-triangular

        # Centroid structure
        centroid_result = fc.centroid()
        raw_centroid = centroid_result[0] if isinstance(centroid_result, tuple) else centroid_result
        centroid_structure = str(raw_centroid).strip() if raw_centroid else None

        # Per-nucleotide pairing probability
        pair_prob = [0.0] * (n + 1)
        for i in range(1, n + 1):
            for j in range(i + 1, n + 1):
                p = bppm[i][j]
                pair_prob[i] += p
                pair_prob[j] += p
        pair_prob = [min(1.0, p) for p in pair_prob]

        # HSB color annotations: blue (unpaired) → red (paired)
        pre_annotations = ""
        for i in range(1, n + 1):
            hue = (1.0 - pair_prob[i]) * 0.667
            pre_annotations += f"{hue:.4f} 0.9 0.9 sethsbcolor {i} cmark\n"

        # MFE structure image
        colored_img_bytes: bytes | None = None
        with tempfile.TemporaryDirectory() as tmp:
            ps_path = Path(tmp) / f"{sid}_mfe.ps"
            RNA.PS_rna_plot_a(sequence, mfe_structure, str(ps_path), pre_annotations, "")
            if ps_path.exists():
                colored_img_bytes = ps_to_png_bytes(ps_path.read_bytes())

        # Centroid structure image (same bpp coloring, different topology)
        centroid_img_bytes: bytes | None = None
        if centroid_structure:
            with tempfile.TemporaryDirectory() as tmp:
                ps_path = Path(tmp) / f"{sid}_centroid.ps"
                RNA.PS_rna_plot_a(sequence, centroid_structure, str(ps_path), pre_annotations, "")
                if ps_path.exists():
                    centroid_img_bytes = ps_to_png_bytes(ps_path.read_bytes())

        # Dot-plot via RNAfold -p subprocess (fc.plot_dp_PS absent in ViennaRNA 2.7)
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
        return _fold_error(fasta_filename, seq_id, sequence, str(exc))


def _fold_error(fasta_file: str, seq_id: str, sequence: str, msg: str) -> dict:
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


# ---------------------------------------------------------------------------
# ASGI app (FastAPI)
# ---------------------------------------------------------------------------

@app.function(timeout=600, volumes={IMAGES_DIR: images_vol})
@modal.asgi_app()
def web():
    from fastapi import FastAPI, File, HTTPException, Request, UploadFile
    from fastapi.middleware.cors import CORSMiddleware
    from fastapi.responses import Response

    api = FastAPI(title="fold-automation", version="1.0.0")

    api.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    def save_image(png_bytes: bytes) -> str:
        filename = f"{uuid.uuid4().hex}.png"
        (IMAGES_DIR / filename).write_bytes(png_bytes)
        images_vol.commit()
        return filename

    def make_url(request: Request, filename: str) -> str:
        return f"{str(request.base_url).rstrip('/')}/images/{filename}"

    @api.get("/health")
    async def health():
        return {"status": "ok"}

    @api.get("/images/{filename}")
    async def get_image(filename: str):
        path = IMAGES_DIR / filename
        images_vol.reload()
        if not path.exists():
            raise HTTPException(status_code=404, detail="Image not found")
        return Response(content=path.read_bytes(), media_type="image/png")

    @api.post("/predict")
    async def predict(request: Request, files: list[UploadFile] = File(...)):
        if not files:
            raise HTTPException(status_code=400, detail="No files uploaded")

        results = []
        for upload in files:
            try:
                content = (await upload.read()).decode("utf-8", errors="replace")
            except Exception as exc:
                results.append(_api_error(upload.filename, str(exc)))
                continue

            seqs = parse_fasta(content)
            if not seqs:
                results.append(_api_error(upload.filename, "No sequences found in file"))
                continue

            for seq_id, sequence in seqs:
                r = fold_sequence(seq_id, sequence, upload.filename)

                colored_bytes  = r.pop("colored_img_bytes", None)
                centroid_bytes = r.pop("centroid_img_bytes", None)
                dp_bytes       = r.pop("dp_img_bytes", None)

                r["colored_img_url"]  = make_url(request, save_image(colored_bytes))  if colored_bytes  else None
                r["centroid_img_url"] = make_url(request, save_image(centroid_bytes)) if centroid_bytes else None
                r["dp_img_url"]       = make_url(request, save_image(dp_bytes))       if dp_bytes       else None
                results.append(r)

        return results

    return api


def _api_error(filename: str, msg: str) -> dict:
    return {
        "fasta_file": filename,
        "seq_id": "—",
        "length": 0,
        "mfe": None,
        "mfe_structure": None,
        "centroid_structure": None,
        "colored_img_url": None,
        "centroid_img_url": None,
        "dp_img_url": None,
        "error": msg,
    }
