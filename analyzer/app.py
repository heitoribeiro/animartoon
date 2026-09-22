import json
import os
import re
import subprocess
import tempfile
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

app = FastAPI(title="Animartoon Analyzer", version="0.1.0")

allowed_origins = [
    "https://heitoribeiro.github.io",
    "http://localhost:5173",
    "http://localhost:8000",
]
extra = [x.strip() for x in os.getenv("CORS_ORIGINS", "").split(",") if x.strip()]
allowed_origins.extend(extra)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

SCENE_RE = re.compile(r"pts_time:([0-9.]+)")

@app.get("/health")
def health():
    return {"ok": True, "service": "animartoon-analyzer", "version": "0.1.0"}

def ffprobe_duration(path: str) -> float:
    cmd = [
        "ffprobe", "-v", "error",
        "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1",
        path,
    ]
    out = subprocess.check_output(cmd, text=True, timeout=30).strip()
    return float(out)

def detect_scene_cuts(path: str, threshold: float) -> list[float]:
    # FFmpeg scene score based detector. showinfo writes pts_time to stderr.
    vf = f"select='gt(scene,{threshold})',showinfo"
    cmd = [
        "ffmpeg", "-hide_banner", "-nostats", "-i", path,
        "-vf", vf,
        "-an", "-f", "null", "-"
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True, timeout=900)
    stderr = proc.stderr or ""
    cuts = []
    for line in stderr.splitlines():
        if "showinfo" not in line or "pts_time:" not in line:
            continue
        m = SCENE_RE.search(line)
        if m:
            try:
                t = float(m.group(1))
                if t > 0:
                    cuts.append(round(t, 3))
            except ValueError:
                pass
    # Deduplicate neighboring duplicate timestamps.
    unique = []
    for t in sorted(cuts):
        if not unique or abs(t - unique[-1]) > 0.08:
            unique.append(t)
    return unique

def alpha_suffix(n: int) -> str:
    s = ""
    n += 1
    while n > 0:
        n -= 1
        s = chr(65 + (n % 26)) + s
        n //= 26
    return s

def build_scenes(cuts: list[float], duration: float, max_duration: float, split_long: bool):
    points = [0.0] + [t for t in cuts if 0 < t < duration]
    points = sorted(set(points))
    scenes = []
    technical = 0
    visual_index = 0

    for i, start in enumerate(points):
        end = points[i + 1] if i + 1 < len(points) else duration
        if end - start < 0.25:
            continue
        visual_index += 1
        length = end - start
        count = 1
        if split_long and max_duration > 0:
            import math
            count = max(1, math.ceil(length / max_duration))
        for part in range(count):
            a = start + length * part / count
            b = start + length * (part + 1) / count
            base = f"C{visual_index:03d}"
            suffix = alpha_suffix(part) if count > 1 else ""
            if count > 1:
                technical += 1
            scenes.append({
                "id": base + suffix,
                "start": round(a, 3),
                "end": round(b, 3),
                "title": f"Cena detectada {visual_index:03d}" + (f" • parte {suffix}" if suffix else ""),
                "type": "A revisar",
                "characters": [],
                "location": "",
                "dialogue": "",
                "image": "pending",
                "animation": "pending",
                "approved": False,
                "detected": True,
                "sourceGroup": base,
            })
    return scenes, technical

@app.post("/analyze-upload")
async def analyze_upload(
    file: UploadFile = File(...),
    threshold: float = Form(0.35),
    max_duration: float = Form(10.0),
    split_long: bool = Form(True),
):
    if threshold < 0.05 or threshold > 0.95:
        raise HTTPException(status_code=400, detail="threshold must be between 0.05 and 0.95")
    if max_duration < 1 or max_duration > 60:
        raise HTTPException(status_code=400, detail="max_duration must be between 1 and 60")

    suffix = Path(file.filename or "video.mp4").suffix or ".mp4"
    with tempfile.TemporaryDirectory(prefix="animartoon_") as td:
        path = os.path.join(td, "input" + suffix)
        total = 0
        try:
            with open(path, "wb") as out:
                while True:
                    chunk = await file.read(1024 * 1024)
                    if not chunk:
                        break
                    total += len(chunk)
                    if total > 500 * 1024 * 1024:
                        raise HTTPException(status_code=413, detail="Arquivo acima de 500 MB")
                    out.write(chunk)

            duration = ffprobe_duration(path)
            cuts = detect_scene_cuts(path, threshold)
            scenes, technical = build_scenes(cuts, duration, max_duration, split_long)
            return {
                "ok": True,
                "filename": file.filename,
                "duration": round(duration, 3),
                "threshold": threshold,
                "visualCuts": len(cuts),
                "technicalSplits": technical,
                "sceneCount": len(scenes),
                "cuts": cuts,
                "scenes": scenes,
            }
        except subprocess.TimeoutExpired:
            raise HTTPException(status_code=504, detail="Tempo limite excedido durante a análise")
        except subprocess.CalledProcessError as e:
            raise HTTPException(status_code=422, detail="FFmpeg/FFprobe não conseguiu processar o arquivo")
        finally:
            await file.close()

@app.exception_handler(Exception)
async def unhandled(request, exc):
    return JSONResponse(status_code=500, content={"ok": False, "detail": str(exc)})
