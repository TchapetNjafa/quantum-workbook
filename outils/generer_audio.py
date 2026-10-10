#!/usr/bin/env python3
"""Génère les résumés audio des chapitres à partir de leur transcription.

Source unique : le bloc <div class="transcript"> de chaque page de chapitre,
en français (chapitres/N-*.html → assets/audio/chN.mp3) et en anglais
(en/chapters/N-*.html → assets/audio/en/chN.mp3).
Modifier le texte dans la page, puis relancer ce script : l'audio suit.

Dépendances : edge-tts (pip install edge-tts) et ffmpeg.
Usage : python3 outils/generer_audio.py [--lang fr|en|tout] [numéro_de_chapitre ...]
        (par défaut : les deux langues, tous les chapitres)
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
LANGUES = {
    "fr": {
        "voix": "fr-FR-DeniseNeural", "pages": "chapitres", "sortie": "assets/audio",
        "chapitre": "Chapitre",
        "titres": {
            "1": "États quantiques", "2": "Mesure et opérateurs", "3": "Dynamique quantique",
            "4": "Systèmes à plusieurs qubits et intrication", "5": "Fonction d'état et espace continu",
            "6": "L'oscillateur harmonique quantique",
        },
    },
    "en": {
        "voix": "en-GB-SoniaNeural", "pages": "en/chapters", "sortie": "assets/audio/en",
        "chapitre": "Chapter",
        "titres": {
            "1": "Quantum states", "2": "Measurement and operators", "3": "Quantum dynamics",
            "4": "Multi-qubit systems and entanglement", "5": "Wave function and continuous space",
            "6": "The quantum harmonic oscillator",
        },
    },
}


def transcription(page: Path) -> str:
    """Texte brut de la transcription (paragraphes séparés par une ligne vide)."""
    source = page.read_text(encoding="utf-8")
    bloc = re.search(r'<div class="transcript">(.*?)</div>', source, re.S)
    if not bloc:
        raise SystemExit(f"Aucune transcription dans {page}")
    paragraphes = re.findall(r"<p>(.*?)</p>", bloc.group(1), re.S)
    return "\n\n".join(html.unescape(re.sub(r"<[^>]+>", "", p)).strip() for p in paragraphes)


async def synthese(texte: str, sortie: Path, voix: str) -> None:
    with tempfile.TemporaryDirectory() as tmp:
        brut = Path(tmp) / "brut.mp3"
        await edge_tts.Communicate(texte, voix, rate="-4%").save(str(brut))
        # mono, volume normalisé, 48 kb/s : léger pour les connexions mobiles
        subprocess.run(
            ["ffmpeg", "-y", "-loglevel", "error", "-i", str(brut),
             "-af", "loudnorm=I=-18:TP=-1.5", "-ac", "1", "-b:a", "48k", str(sortie)],
            check=True,
        )


def main() -> None:
    args = sys.argv[1:]
    langues = list(LANGUES)
    if "--lang" in args:
        i = args.index("--lang")
        choix = args[i + 1]
        langues = list(LANGUES) if choix == "tout" else [choix]
        del args[i:i + 2]
    voulus = set(args) or {"1", "2", "3", "4", "5", "6"}
    for code in langues:
        conf = LANGUES[code]
        (RACINE / conf["sortie"]).mkdir(parents=True, exist_ok=True)
        for page in sorted((RACINE / conf["pages"]).glob("[1-6]-*.html")):
            n = page.name[0]
            if n not in voulus:
                continue
            texte = f"{conf['chapitre']} {n}. {conf['titres'][n]}.\n\n" + transcription(page)
            sortie = RACINE / conf["sortie"] / f"ch{n}.mp3"
            asyncio.run(synthese(texte, sortie, conf["voix"]))
            print(f"{sortie.relative_to(RACINE)} ({len(texte.split())} mots)")


if __name__ == "__main__":
    main()
