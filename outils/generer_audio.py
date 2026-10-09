#!/usr/bin/env python3
"""Génère les résumés audio des chapitres à partir de leur transcription.

Source unique : le bloc <div class="transcript"> de chaque page chapitres/N-*.html.
Modifier le texte dans la page, puis relancer ce script : l'audio suit.

Dépendances : edge-tts (pip install edge-tts) et ffmpeg.
Usage : python3 outils/generer_audio.py [numéro_de_chapitre ...]
"""
import asyncio
import html
import re
import subprocess
import sys
import tempfile
from pathlib import Path

import edge_tts

RACINE = Path(__file__).resolve().parent.parent
VOIX = "fr-FR-DeniseNeural"
TITRES = {
    "1": "États quantiques", "2": "Mesure et opérateurs", "3": "Dynamique quantique",
    "4": "Systèmes à plusieurs qubits et intrication", "5": "Fonction d'état et espace continu",
    "6": "L'oscillateur harmonique quantique",
}


def transcription(page: Path) -> str:
    """Texte brut de la transcription (paragraphes séparés par une ligne vide)."""
    source = page.read_text(encoding="utf-8")
    bloc = re.search(r'<div class="transcript">(.*?)</div>', source, re.S)
    if not bloc:
        raise SystemExit(f"Aucune transcription dans {page}")
    paragraphes = re.findall(r"<p>(.*?)</p>", bloc.group(1), re.S)
    return "\n\n".join(html.unescape(re.sub(r"<[^>]+>", "", p)).strip() for p in paragraphes)


async def synthese(texte: str, sortie: Path) -> None:
    with tempfile.TemporaryDirectory() as tmp:
        brut = Path(tmp) / "brut.mp3"
        await edge_tts.Communicate(texte, VOIX, rate="-4%").save(str(brut))
        # mono, volume normalisé, 48 kb/s : léger pour les connexions mobiles
        subprocess.run(
            ["ffmpeg", "-y", "-loglevel", "error", "-i", str(brut),
             "-af", "loudnorm=I=-18:TP=-1.5", "-ac", "1", "-b:a", "48k", str(sortie)],
            check=True,
        )


def main() -> None:
    voulus = set(sys.argv[1:]) or set(TITRES)
    (RACINE / "assets/audio").mkdir(parents=True, exist_ok=True)
    for page in sorted((RACINE / "chapitres").glob("[1-6]-*.html")):
        n = page.name[0]
        if n not in voulus:
            continue
        texte = f"Chapitre {n}. {TITRES[n]}.\n\n" + transcription(page)
        sortie = RACINE / f"assets/audio/ch{n}.mp3"
        asyncio.run(synthese(texte, sortie))
        print(f"{sortie.relative_to(RACINE)} ({len(texte.split())} mots)")


if __name__ == "__main__":
    main()
