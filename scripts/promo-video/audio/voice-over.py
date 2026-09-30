"""Synthesize the promo's voice-over lines into ./vo, with Kokoro.

Kokoro-82M (Apache-2.0 weights) runs locally through kokoro-onnx. Download
kokoro-v1.0.onnx and voices-v1.0.bin from the kokoro-onnx release
"model-files-v1.0" into one folder, then run:

    python voice-over.py <model-dir>

Each line is trimmed of its leading and trailing silence, so it starts exactly
where ../timeline.json places it. The committed clips were made this way.
"""
import os
import sys
import tempfile
from pathlib import Path

import espeakng_loader
import numpy as np
import soundfile as sf
from phonemizer.backend.espeak.wrapper import EspeakWrapper

VOICE = "af_heart"
LINES = {  # clip: (text, speed)
    "vo1": ("Fly through the solar system, right in your browser.", 1.08),
    "vo2": ("Watch real eclipses sweep across the Earth.", 1.08),
    "vo3": ("Track every phase of the Moon.", 1.08),
    "vo4": ("What if Jupiter were a star? Find out in sandbox mode.", 1.08),
    # Spoken apart, so the end card gets a beat between the name and the line.
    "vo5a": ("Orbit.", 0.95),
    "vo5b": ("Free to explore.", 1.05),
}


def use_short_espeak_path() -> None:
    """Point espeak-ng at its data through a short relative path.

    espeak-ng keeps the data path in a 160-byte buffer and silently falls back
    to its build machine's path when the real one is longer, as a deep
    virtualenv's is. A link in the (temporary) working directory stays short.
    """
    data = Path(espeakng_loader.get_data_path())
    if len(str(data)) < 150:
        return
    link = Path("espeak-ng-data")
    if not link.exists():
        link.symlink_to(data)
    EspeakWrapper.data_path = property(lambda self: link)


def main(model_dir: str) -> None:
    models = Path(model_dir).resolve()
    out = Path(__file__).resolve().parent / "vo"
    out.mkdir(exist_ok=True)
    os.chdir(tempfile.mkdtemp())
    use_short_espeak_path()
    # Imported only now: constructing Kokoro starts espeak with the path above.
    from kokoro_onnx import Kokoro

    kokoro = Kokoro(str(models / "kokoro-v1.0.onnx"), str(models / "voices-v1.0.bin"))
    for name, (text, speed) in LINES.items():
        samples, rate = kokoro.create(text, voice=VOICE, speed=speed, lang="en-us")
        loud = np.flatnonzero(np.abs(samples) > 0.01)
        start = max(0, loud[0] - int(0.02 * rate))
        end = min(len(samples), loud[-1] + int(0.06 * rate))
        sf.write(out / f"{name}.flac", samples[start:end], rate)
        print(f"{name}: {(end - start) / rate:.2f}s  {text}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit("usage: python voice-over.py <model-dir>")
    main(sys.argv[1])
