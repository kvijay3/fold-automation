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
    .apt_install(
        "ghostscript",
        "cmake",
        "build-essential",
        "libboost-all-dev",
        "git",
        "pkg-config",
        "wget",
    )
    # Install ViennaRNA from source to get development libraries for CentroidFold
    .run_commands(
        # Download and install ViennaRNA from source
        "wget -q https://www.tbi.univie.ac.at/RNA/download/sourcecode/2_6_x/ViennaRNA-2.6.4.tar.gz -O /tmp/vienna.tar.gz",
        "cd /tmp && tar -xzf vienna.tar.gz",
        "cd /tmp/ViennaRNA-2.6.4 && ./configure --without-perl --without-python && make -j4 && make install",
        "ldconfig",
        "rm -rf /tmp/ViennaRNA-2.6.4 /tmp/vienna.tar.gz",
    )
    .pip_install(
        "ViennaRNA",  # Python bindings
        "fastapi",
        "python-multipart",
    )
    .run_commands(
        # Clone CentroidFold from GitHub
        "git clone https://github.com/satoken/centroid-rna-package.git /tmp/centroid",
        # Build CentroidFold with cmake (now RNAlib2 will be found)
        "cd /tmp/centroid && mkdir build && cd build && cmake .. && make",
        # Install binaries to /usr/local/bin (they're in src/ subdirectory)
        "cp /tmp/centroid/build/src/centroid_fold /usr/local/bin/",
        "cp /tmp/centroid/build/src/centroid_alifold /usr/local/bin/ || true",
        "cp /tmp/centroid/build/src/centroid_homfold /usr/local/bin/ || true",
        # Cleanup build directory
        "rm -rf /tmp/centroid",
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

def ps_to_png_bytes(ps_content: bytes) -> tuple[bytes | None, str | None]:
    """Convert PS/EPS bytes to PNG bytes. Returns (png_bytes, error_msg)."""
    with tempfile.TemporaryDirectory() as tmp:
        ps_path = Path(tmp) / "input.ps"
        png_path = Path(tmp) / "output.png"
        ps_path.write_bytes(ps_content)
        try:
            result = subprocess.run(
                [
                    "gs", "-dBATCH", "-dNOPAUSE", "-dQUIET",
                    "-sDEVICE=png16m", "-r150",
                    "-sPAPERSIZE=a2",        # large page avoids cropping
                    f"-sOutputFile={png_path}",
                    str(ps_path),
                ],
                capture_output=True,
                timeout=60,
            )
            if result.returncode == 0 and png_path.exists():
                return png_path.read_bytes(), None
            stderr = result.stderr.decode("utf-8", errors="replace")[:300]
            return None, f"GS rc={result.returncode}: {stderr}"
        except FileNotFoundError:
            return None, "Ghostscript (gs) not found"
        except subprocess.TimeoutExpired:
            return None, "Ghostscript timed out"


# ---------------------------------------------------------------------------
# CentroidFold C++ binary wrapper
# ---------------------------------------------------------------------------

def _run_centroidfold(sequence: str, gamma: float = 6.0, engine: str = "BL", bp_weight: float = 2.0) -> str:
    """
    Run CentroidFold C++ binary to compute centroid structure.
    
    Uses the official CentroidFold implementation from:
    https://github.com/satoken/centroid-rna-package
    
    Args:
        sequence: RNA sequence
        gamma: Gamma parameter for centroid calculation (default 6.0)
        engine: Inference engine - "BL" (McCaskill), "CONTRAfold", "RNAfold" (default "BL")
        bp_weight: Weight of base pairs (default 2.0)
        
    Returns:
        Centroid structure in dot-bracket notation
        
    Raises:
        RuntimeError: If centroid_fold binary fails or output cannot be parsed
    """
    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        input_fa = tmp_path / "input.fa"
        input_fa.write_text(f">seq\n{sequence}\n")
        
        # Build command with parameters
        cmd = ["centroid_fold", "-g", str(gamma)]
        
        # Add engine parameter
        if engine == "CONTRAfold":
            cmd.extend(["--engine", "CONTRAfold"])
        elif engine == "RNAfold":
            cmd.extend(["--engine", "RNAfold"])
        # BL (McCaskill) is default, no flag needed
        
        # Add base pair weight if not default
        if bp_weight != 2.0:
            cmd.extend(["--bp-weight", str(bp_weight)])
        
        cmd.append(str(input_fa))
        
        try:
            result = subprocess.run(
                cmd,
                cwd=str(tmp_path),
                capture_output=True,
                text=True,
                timeout=300,
            )
        except FileNotFoundError:
            raise RuntimeError("centroid_fold binary not found - ensure CentroidFold is installed")
        except subprocess.TimeoutExpired:
            raise RuntimeError("centroid_fold timed out (> 300s)")
        
        if result.returncode != 0:
            stderr = result.stderr.strip()[:200]
            raise RuntimeError(f"centroid_fold failed (rc={result.returncode}): {stderr}")
        
        # Parse CentroidFold output format:
        # Line 1: >seq
        # Line 2: SEQUENCE
        # Line 3: structure (energy)
        lines = [line.strip() for line in result.stdout.splitlines() if line.strip()]
        
        for line in lines:
            # Look for structure line (contains parentheses/dots and energy in parentheses)
            if line and not line.startswith('>') and ('(' in line or '.' in line):
                # Extract structure before energy annotation
                # Format: "..(((...))).. (energy)" or "..(((...))).. energy"
                parts = line.split()
                if parts:
                    structure = parts[0]
                    # Validate it's a structure (only contains valid characters)
                    if all(c in '().[]{}' for c in structure):
                        return structure
        
        raise RuntimeError(f"Could not parse centroid_fold output: {result.stdout[:200]}")


# ---------------------------------------------------------------------------
# Gamma-centroid estimator (Python fallback - kept for reference/debugging)
# ---------------------------------------------------------------------------

def _gamma_centroid_python(bppm, n: int, gamma: float = 1.0) -> str:
    """
    Compute gamma-centroid structure using dynamic programming.
    
    The gamma-centroid minimizes the expected gain:
        E_γ = Σ(1 - P(i,j)) for paired (i,j) + γ × Σ P(i,j) for unpaired i
    
    This matches the CentroidFold algorithm from http://rtools.cbrc.jp/centroidfold/
    
    Args:
        bppm: Base-pair probability matrix (1-indexed, upper-triangular)
        n: Sequence length
        gamma: Weight parameter (default 1.0, CentroidFold typically uses 1-6)
    
    Returns:
        Dot-bracket structure string
    """
    # Compute per-position pairing probability: p[i] = Σ_j P(i,j)
    p = [0.0] * (n + 1)
    for i in range(1, n + 1):
        for j in range(1, n + 1):
            if i < j:
                p[i] += bppm[i][j]
                p[j] += bppm[i][j]
    
    # Dynamic programming: gain[i][j] = max expected gain for subsequence i..j
    gain = [[0.0] * (n + 2) for _ in range(n + 2)]
    trace = [[None] * (n + 2) for _ in range(n + 2)]
    
    # Fill DP table
    for length in range(1, n + 1):
        for i in range(1, n - length + 2):
            j = i + length - 1
            if j > n:
                continue
            
            # Option 1: i unpaired
            gain_i_unpaired = gamma * p[i] + gain[i + 1][j]
            gain[i][j] = gain_i_unpaired
            trace[i][j] = ('unpair_i',)
            
            # Option 2: j unpaired (only if i < j)
            if i < j:
                gain_j_unpaired = gamma * p[j] + gain[i][j - 1]
                if gain_j_unpaired > gain[i][j]:
                    gain[i][j] = gain_j_unpaired
                    trace[i][j] = ('unpair_j',)
            
            # Option 3: pair (i, k) for some k in (i+1, j]
            for k in range(i + 1, j + 1):
                if k - i < 4:  # minimum hairpin loop of 3
                    continue
                # Gain from pairing (i,k)
                pair_gain = bppm[i][k] + gain[i + 1][k - 1] + gain[k + 1][j]
                if pair_gain > gain[i][j]:
                    gain[i][j] = pair_gain
                    trace[i][j] = ('pair', k)
    
    # Traceback to build structure
    structure = ['.'] * n
    
    def traceback(i: int, j: int):
        if i > j or i < 1 or j > n:
            return
        if trace[i][j] is None:
            return
        
        action = trace[i][j]
        if action[0] == 'unpair_i':
            traceback(i + 1, j)
        elif action[0] == 'unpair_j':
            traceback(i, j - 1)
        elif action[0] == 'pair':
            k = action[1]
            structure[i - 1] = '('
            structure[k - 1] = ')'
            traceback(i + 1, k - 1)
            traceback(k + 1, j)
    
    traceback(1, n)
    return ''.join(structure)


GAMMA_VALUES = [0.5, 1, 2, 4, 6, 8, 16, 32, 64, 128]
# All three CentroidFold inference engines
CENTROID_ENGINES = ["BL", "CONTRAfold", "RNAfold"]


def gamma_sweep(sequence: str, fc) -> dict:
    """
    Run ALL gamma × engine combinations using the CentroidFold C++ binary.

    Engines:
      BL         — McCaskill partition function (ViennaRNA)
      CONTRAfold — CONTRAfold probabilistic model
      RNAfold    — RNAfold-based base-pair probabilities

    10 gammas × 3 engines = 30 combinations total.
    Always uses bp_weight=2.0 (CentroidFold default), independent of UI.

    Returns a dict:
      centroid_sweep: list of {gamma, engine, structure, error}
      rnafold_sweep:  empty list (kept for API compatibility)
    """
    centroid_sweep = []
    for g in GAMMA_VALUES:
        for eng in CENTROID_ENGINES:
            try:
                struct = _run_centroidfold(sequence, gamma=g, engine=eng, bp_weight=2.0)
                centroid_sweep.append({"gamma": g, "engine": eng, "structure": struct, "error": None})
            except RuntimeError as e:
                centroid_sweep.append({"gamma": g, "engine": eng, "structure": None, "error": str(e)})

    return {"centroid_sweep": centroid_sweep, "rnafold_sweep": []}


# ---------------------------------------------------------------------------
# Fold one sequence
# ---------------------------------------------------------------------------

def fold_sequence(seq_id: str, sequence: str, fasta_filename: str = "", gamma: float = 1.0, engine: str = "BL", bp_weight: float = 2.0) -> dict:
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
        mfe_structure = ''.join(c for c in str(mfe_structure) if c in '().')

        # Partition function + bpp
        fc.exp_params_rescale(mfe)
        fc.pf()
        bppm = fc.bpp()  # 1-based, upper-triangular

        # Centroid — use CentroidFold C++ binary (matches CentroidFold web server)
        # gamma=6.0 is the default used by CentroidFold web server
        try:
            centroid_structure = _run_centroidfold(sequence, gamma=gamma, engine=engine, bp_weight=bp_weight)
        except RuntimeError as e:
            # Fallback to Python implementation if C++ binary fails
            centroid_structure = _gamma_centroid_python(bppm, n, gamma=gamma)

        # Per-nucleotide pairing probability (used for colouring)
        pair_prob = [0.0] * (n + 1)
        for i in range(1, n + 1):
            for j in range(i + 1, n + 1):
                p = bppm[i][j]
                pair_prob[i] += p
                pair_prob[j] += p
        pair_prob = [min(1.0, p) for p in pair_prob]

        # ── MFE colour annotations ──
        # Blue (hue 0.667, unpaired) → Red (hue 0, paired) by pair probability
        mfe_annotations = ""
        for i in range(1, n + 1):
            hue = (1.0 - pair_prob[i]) * 0.667
            mfe_annotations += f"{hue:.4f} 0.9 0.9 sethsbcolor {i} cmark\n"

        # ── Centroid colour annotations ──
        # Green (hue 0.333, unpaired) → Orange (hue 0.083, paired) by pair
        # probability.  Visually distinct from the MFE blue→red scheme.
        centroid_annotations = ""
        for i in range(1, n + 1):
            hue = 0.333 - pair_prob[i] * 0.250
            centroid_annotations += f"{hue:.4f} 0.85 0.9 sethsbcolor {i} cmark\n"

        # ── MFE structure image (via ViennaRNA Python API) ──
        colored_img_bytes: bytes | None = None
        colored_img_error: str | None = None
        try:
            with tempfile.TemporaryDirectory() as tmp:
                ps_path = Path(tmp) / f"{sid}_mfe.ps"
                ret = RNA.PS_rna_plot_a(sequence, mfe_structure, str(ps_path), mfe_annotations, "")
                if ps_path.exists() and ps_path.stat().st_size > 0:
                    colored_img_bytes, gs_err = ps_to_png_bytes(ps_path.read_bytes())
                    if gs_err:
                        colored_img_error = f"MFE GS: {gs_err}"
                else:
                    colored_img_error = f"PS_rna_plot_a returned {ret}, no MFE ps file"
        except Exception as e:
            colored_img_error = f"MFE image: {e}"

        # ── Centroid structure image (via ViennaRNA Python API) ──
        centroid_img_bytes: bytes | None = None
        centroid_img_error: str | None = None
        if centroid_structure:
            # Check if structure has any base pairs
            has_pairs = set(centroid_structure) != {'.'}
            if not has_pairs:
                centroid_img_error = f"Centroid structure has no base pairs (all dots): {centroid_structure[:50]}..."
            
            # Try to generate image anyway for debugging
            try:
                with tempfile.TemporaryDirectory() as tmp:
                    ps_path = Path(tmp) / f"{sid}_centroid.ps"
                    ret = RNA.PS_rna_plot_a(
                        sequence, centroid_structure, str(ps_path),
                        centroid_annotations, "",
                    )
                    if ps_path.exists() and ps_path.stat().st_size > 0:
                        centroid_img_bytes, gs_err = ps_to_png_bytes(ps_path.read_bytes())
                        if gs_err:
                            centroid_img_error = f"Centroid GS: {gs_err}"
                        elif not has_pairs:
                            # Clear error if image was generated successfully
                            centroid_img_error = None
                    else:
                        centroid_img_error = f"PS_rna_plot_a returned {ret}, PS file not created"
            except Exception as e:
                centroid_img_error = f"Centroid image error: {str(e)}"
        else:
            centroid_img_error = "No centroid structure returned from CentroidFold"

        # ── MFE Dot-plot via ViennaRNA Python API ──
        dp_img_bytes: bytes | None = None
        dp_img_error: str | None = None
        try:
            with tempfile.TemporaryDirectory() as tmp:
                dp_ps = Path(tmp) / f"{sid}_mfe_dp.ps"
                # Convert bppm to plist format for PS_dot_plot_list
                # plist is a list of tuples: [(i, j, prob, type), ...]
                plist = []
                for i in range(1, n + 1):
                    for j in range(i + 1, n + 1):
                        p = bppm[i][j]
                        if p > 1e-5:  # Only include significant probabilities
                            plist.append((i, j, p * p, 0))  # square prob for visual scaling
                
                RNA.PS_dot_plot_list(sequence, str(dp_ps), plist, mfe_structure, "")
                if dp_ps.exists() and dp_ps.stat().st_size > 0:
                    dp_img_bytes, gs_err = ps_to_png_bytes(dp_ps.read_bytes())
                    if gs_err:
                        dp_img_error = f"MFE dot-plot GS: {gs_err}"
                else:
                    dp_img_error = "MFE dot-plot PS file not generated"
        except Exception as e:
            dp_img_error = f"MFE dot-plot: {e}"

        # ── Centroid Dot-plot via ViennaRNA Python API ──
        centroid_dp_img_bytes: bytes | None = None
        centroid_dp_img_error: str | None = None
        if centroid_structure and set(centroid_structure) != {'.'}:
            try:
                with tempfile.TemporaryDirectory() as tmp:
                    dp_ps = Path(tmp) / f"{sid}_centroid_dp.ps"
                    plist = []
                    for i in range(1, n + 1):
                        for j in range(i + 1, n + 1):
                            p = bppm[i][j]
                            if p > 1e-5:
                                plist.append((i, j, p * p, 0))
                    RNA.PS_dot_plot_list(sequence, str(dp_ps), plist, centroid_structure, "")
                    if dp_ps.exists() and dp_ps.stat().st_size > 0:
                        centroid_dp_img_bytes, gs_err = ps_to_png_bytes(dp_ps.read_bytes())
                        if gs_err:
                            centroid_dp_img_error = f"Centroid dot-plot GS: {gs_err}"
                    else:
                        centroid_dp_img_error = "Centroid dot-plot PS file not generated"
            except Exception as e:
                centroid_dp_img_error = f"Centroid dot-plot: {e}"
        else:
            centroid_dp_img_error = "No centroid structure (all unpaired)"

        # ── Gamma sweep: all gamma × engine combinations ──
        sweep = gamma_sweep(sequence, fc)

        return {
            "fasta_file": fasta_filename,
            "seq_id": seq_id,
            "sequence": sequence,
            "length": n,
            "mfe": round(float(mfe), 2),
            "mfe_structure": mfe_structure,
            "centroid_structure": centroid_structure,
            "colored_img_bytes": colored_img_bytes,
            "centroid_img_bytes": centroid_img_bytes,
            "dp_img_bytes": dp_img_bytes,
            "centroid_dp_img_bytes": centroid_dp_img_bytes,
            "centroid_sweep": sweep["centroid_sweep"],
            "rnafold_sweep": sweep["rnafold_sweep"],
            "error": None,
            "img_errors": [e for e in [colored_img_error, centroid_img_error, dp_img_error, centroid_dp_img_error] if e],
        }

    except Exception as exc:
        return _fold_error(fasta_filename, seq_id, sequence, str(exc))


def _fold_error(fasta_file: str, seq_id: str, sequence: str, msg: str) -> dict:
    return {
        "fasta_file": fasta_file,
        "seq_id": seq_id,
        "sequence": sequence,
        "length": len(sequence),
        "mfe": None,
        "mfe_structure": None,
        "centroid_structure": None,
        "colored_img_bytes": None,
        "centroid_img_bytes": None,
        "dp_img_bytes": None,
        "error": msg,
        "img_errors": [],
    }


# ---------------------------------------------------------------------------
# ASGI app (FastAPI)
# ---------------------------------------------------------------------------

@app.function(timeout=600, volumes={IMAGES_DIR: images_vol})
@modal.asgi_app()
def web():
    from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
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

    @api.post("/debug-fold")
    async def debug_fold(request: Request, files: list[UploadFile] = File(...)):
        """Return raw fold results with detailed diagnostics (no images)."""
        results = []
        for upload in files:
            content = (await upload.read()).decode("utf-8", errors="replace")
            seqs = parse_fasta(content)
            for seq_id, sequence in seqs[:1]:  # first sequence only
                try:
                    import RNA
                    n = len(sequence)
                    fc = RNA.fold_compound(sequence)
                    (mfe_structure, mfe) = fc.mfe()
                    mfe_structure = ''.join(c for c in str(mfe_structure) if c in '().')
                    fc.exp_params_rescale(mfe)
                    fc.pf()
                    bppm = fc.bpp()
                    try:
                        centroid_structure = _run_centroidfold(sequence, gamma=1.0, engine="BL", bp_weight=2.0)
                    except RuntimeError:
                        centroid_structure = _gamma_centroid_python(bppm, n, gamma=1.0)
                    centroid_is_dots = set(centroid_structure) == {'.'}

                    fc_centroid_raw = None
                    try:
                        cr = fc.centroid()
                        fc_centroid_raw = str(cr[0]) if isinstance(cr, (tuple, list)) else str(cr)
                    except Exception as e:
                        fc_centroid_raw = f"ERROR: {e}"

                    results.append({
                        "seq_id": seq_id,
                        "length": n,
                        "mfe": round(float(mfe), 2),
                        "mfe_structure_len": len(mfe_structure),
                        "centroid_structure_len": len(centroid_structure),
                        "centroid_is_all_dots": centroid_is_dots,
                        "centroid_preview": centroid_structure[:80],
                        "fc_centroid_raw": fc_centroid_raw,
                        "mfe_structure_preview": mfe_structure[:80],
                    })
                except Exception as e:
                    results.append({"seq_id": seq_id, "error": str(e)})
        return results

    @api.post("/predict")
    async def predict(
        request: Request,
        files: list[UploadFile] = File(default=[]),
        fasta_text: str = Form(default=""),
        gamma: float = Form(default=6.0),
        engine: str = Form(default="BL"),
        bp_weight: float = Form(default=2.0),
    ):
        """
        Predict RNA secondary structures.
        
        Args:
            files: FASTA files to process (optional)
            fasta_text: Direct FASTA text input (optional)
            gamma: Gamma parameter for centroid structure (default 6.0, range 1-10)
                   Higher values favor more base pairs. CentroidFold web server uses 6.0.
            engine: Inference engine - "BL" (McCaskill), "CONTRAfold", "RNAfold" (default "BL")
            bp_weight: Weight of base pairs (default 2.0)
        """
        if not files and not fasta_text:
            raise HTTPException(status_code=400, detail="No files or FASTA text provided")

        results = []
        
        # Process direct FASTA text input
        if fasta_text:
            seqs = parse_fasta(fasta_text)
            if not seqs:
                results.append(_api_error("text_input", "No sequences found in FASTA text"))
            else:
                for seq_id, sequence in seqs:
                    r = fold_sequence(seq_id, sequence, "text_input", gamma=gamma, engine=engine, bp_weight=bp_weight)
                    
                    colored_bytes     = r.pop("colored_img_bytes", None)
                    centroid_bytes    = r.pop("centroid_img_bytes", None)
                    dp_bytes          = r.pop("dp_img_bytes", None)
                    centroid_dp_bytes = r.pop("centroid_dp_img_bytes", None)

                    r["colored_img_url"]     = make_url(request, save_image(colored_bytes))     if colored_bytes     else None
                    r["centroid_img_url"]    = make_url(request, save_image(centroid_bytes))    if centroid_bytes    else None
                    r["dp_img_url"]          = make_url(request, save_image(dp_bytes))          if dp_bytes          else None
                    r["centroid_dp_img_url"] = make_url(request, save_image(centroid_dp_bytes)) if centroid_dp_bytes else None
                    results.append(r)
        
        # Process uploaded files
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
                r = fold_sequence(seq_id, sequence, upload.filename, gamma=gamma, engine=engine, bp_weight=bp_weight)

                colored_bytes     = r.pop("colored_img_bytes", None)
                centroid_bytes    = r.pop("centroid_img_bytes", None)
                dp_bytes          = r.pop("dp_img_bytes", None)
                centroid_dp_bytes = r.pop("centroid_dp_img_bytes", None)

                r["colored_img_url"]     = make_url(request, save_image(colored_bytes))     if colored_bytes     else None
                r["centroid_img_url"]    = make_url(request, save_image(centroid_bytes))    if centroid_bytes    else None
                r["dp_img_url"]          = make_url(request, save_image(dp_bytes))          if dp_bytes          else None
                r["centroid_dp_img_url"] = make_url(request, save_image(centroid_dp_bytes)) if centroid_dp_bytes else None
                # keep img_errors from fold_sequence; already in r
                results.append(r)

        return results

    return api


def _api_error(filename: str, msg: str) -> dict:
    return {
        "fasta_file": filename,
        "seq_id": "—",
        "sequence": None,
        "length": 0,
        "mfe": None,
        "mfe_structure": None,
        "centroid_structure": None,
        "colored_img_url": None,
        "centroid_img_url": None,
        "dp_img_url": None,
        "centroid_dp_img_url": None,
        "error": msg,
        "img_errors": [],
    }
