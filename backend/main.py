"""
main.py — Modal app + FastAPI for RNA structure prediction.

Deploy:  modal deploy backend/main.py
Dev:     modal serve backend/main.py

Images are stored in a Modal Volume and served via GET /images/{filename}.
"""

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
    .add_local_file(
        Path(__file__).parent / "process.py",
        "/root/process.py",
    )
)

# Persistent volume — images stay here across deployments
images_vol = modal.Volume.from_name("fold-images", create_if_missing=True)
IMAGES_DIR = Path("/images")

app = modal.App("fold-automation", image=image)


# ---------------------------------------------------------------------------
# ASGI app (FastAPI)
# ---------------------------------------------------------------------------

@app.function(timeout=600, volumes={IMAGES_DIR: images_vol})
@modal.asgi_app()
def web():
    from fastapi import FastAPI, File, HTTPException, Request, UploadFile
    from fastapi.middleware.cors import CORSMiddleware
    from fastapi.responses import Response

    from process import fold_sequence, parse_fasta

    api = FastAPI(title="fold-automation", version="1.0.0")

    api.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ── helpers ──────────────────────────────────────────────

    def save_image(png_bytes: bytes) -> str:
        """Save PNG bytes to the volume, return the filename (UUID)."""
        filename = f"{uuid.uuid4().hex}.png"
        (IMAGES_DIR / filename).write_bytes(png_bytes)
        images_vol.commit()
        return filename

    def make_url(request: Request, filename: str) -> str:
        base = str(request.base_url).rstrip("/")
        return f"{base}/images/{filename}"

    # ── routes ───────────────────────────────────────────────

    @api.get("/health")
    async def health():
        return {"status": "ok"}

    @api.get("/images/{filename}")
    async def get_image(filename: str):
        """Serve a stored PNG from the volume."""
        path = IMAGES_DIR / filename
        images_vol.reload()
        if not path.exists():
            raise HTTPException(status_code=404, detail="Image not found")
        return Response(content=path.read_bytes(), media_type="image/png")

    @api.post("/predict")
    async def predict(request: Request, files: list[UploadFile] = File(...)):
        """
        Accept one or more FASTA files, fold every sequence.
        Images are saved to the volume; URLs are returned in the response.
        """
        if not files:
            raise HTTPException(status_code=400, detail="No files uploaded")

        results = []
        for upload in files:
            try:
                raw = await upload.read()
                content = raw.decode("utf-8", errors="replace")
            except Exception as exc:
                results.append(_file_error(upload.filename, str(exc)))
                continue

            seqs = parse_fasta(content)
            if not seqs:
                results.append(_file_error(upload.filename, "No sequences found in file"))
                continue

            for seq_id, sequence in seqs:
                r = fold_sequence(seq_id, sequence, upload.filename)

                # Store images in volume, replace bytes with URLs
                colored_url = None
                dp_url = None

                colored_bytes = r.pop("colored_img_bytes", None)
                dp_bytes = r.pop("dp_img_bytes", None)

                if colored_bytes:
                    colored_url = make_url(request, save_image(colored_bytes))
                if dp_bytes:
                    dp_url = make_url(request, save_image(dp_bytes))

                r["colored_img_url"] = colored_url
                r["dp_img_url"] = dp_url
                results.append(r)

        return results

    return api


def _file_error(filename: str, msg: str) -> dict:
    return {
        "fasta_file": filename,
        "seq_id": "—",
        "length": 0,
        "mfe": None,
        "mfe_structure": None,
        "centroid_structure": None,
        "colored_img_url": None,
        "dp_img_url": None,
        "error": msg,
    }
