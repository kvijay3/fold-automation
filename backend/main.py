"""
main.py — Modal app + FastAPI for RNA structure prediction.

Deploy:  modal deploy backend/main.py
Dev:     modal serve backend/main.py
"""

from pathlib import Path

import modal

# ---------------------------------------------------------------------------
# Modal image: Debian + Ghostscript + ViennaRNA + FastAPI
# process.py is bundled into the image so it is importable at runtime.
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

app = modal.App("fold-automation", image=image)


# ---------------------------------------------------------------------------
# ASGI app (FastAPI)
# ---------------------------------------------------------------------------

@app.function(timeout=600)
@modal.asgi_app()
def web():
    from fastapi import FastAPI, File, HTTPException, UploadFile
    from fastapi.middleware.cors import CORSMiddleware

    from process import fold_sequence, parse_fasta

    api = FastAPI(title="fold-automation", version="1.0.0")

    api.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @api.get("/health")
    async def health():
        return {"status": "ok"}

    @api.post("/predict")
    async def predict(files: list[UploadFile] = File(...)):
        """
        Accept one or more FASTA files, fold every sequence, return results.

        Response: list of SequenceResult objects (one per sequence).
        """
        if not files:
            raise HTTPException(status_code=400, detail="No files uploaded")

        results = []
        for upload in files:
            try:
                raw = await upload.read()
                content = raw.decode("utf-8", errors="replace")
            except Exception as exc:
                results.append({
                    "fasta_file": upload.filename,
                    "seq_id": "—",
                    "length": 0,
                    "mfe": None,
                    "mfe_structure": None,
                    "centroid_structure": None,
                    "colored_img_b64": None,
                    "dp_img_b64": None,
                    "error": f"Could not read file: {exc}",
                })
                continue

            seqs = parse_fasta(content)
            if not seqs:
                results.append({
                    "fasta_file": upload.filename,
                    "seq_id": "—",
                    "length": 0,
                    "mfe": None,
                    "mfe_structure": None,
                    "centroid_structure": None,
                    "colored_img_b64": None,
                    "dp_img_b64": None,
                    "error": "No sequences found in file",
                })
                continue

            for seq_id, sequence in seqs:
                result = fold_sequence(seq_id, sequence, upload.filename)
                results.append(result)

        return results

    return api
