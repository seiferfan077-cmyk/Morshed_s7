#!/usr/bin/env python3
"""Prepare an app-friendly data envelope from the verbatim Tanzil XML source.

The Arabic surah names, ayah text, and optional bismillah values are copied
without rewriting. The source XML remains preserved separately in assets/quran.
"""
from __future__ import annotations

import json
import argparse
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets/quran/tanzil-quran-uthmani.xml"
OUTPUT = ROOT / "src/data/quran-uthmani.json"

SOURCE_NOTICE = (
    "Tanzil Quran Text (Uthmani, Version 1.1)\n"
    "Copyright (C) 2007-2026 Tanzil Project\n"
    "License: Creative Commons Attribution 3.0\n\n"
    "This copy of the Quran text is carefully produced, highly verified and "
    "continuously monitored by a group of specialists at Tanzil Project.\n\n"
    "TERMS OF USE:\n"
    "- Permission is granted to copy and distribute verbatim copies of this "
    "text, but CHANGING IT IS NOT ALLOWED.\n"
    "- This Quran text can be used in any website or application, provided "
    "that its source (Tanzil Project) is clearly indicated, and a link is made "
    "to tanzil.net to enable users to keep track of changes.\n"
    "- This copyright notice shall be included in all verbatim copies of the "
    "text, and shall be reproduced appropriately in all files derived from or "
    "containing substantial portion of this text.\n"
    "Please check updates at: http://tanzil.net/updates/"
)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true", help="verify the generated data matches the preserved Tanzil XML")
    args = parser.parse_args()
    root = ET.parse(SOURCE).getroot()
    if root.tag != "quran":
        raise ValueError(f"Unexpected source root element: {root.tag}")

    surahs = []
    total_ayahs = 0
    for surah_element in root.findall("sura"):
        surah_index = int(surah_element.attrib["index"])
        verses = []
        for aya_element in surah_element.findall("aya"):
            verse = {
                "index": int(aya_element.attrib["index"]),
                "text": aya_element.attrib["text"],
            }
            if "bismillah" in aya_element.attrib:
                verse["bismillah"] = aya_element.attrib["bismillah"]
            verses.append(verse)
        if not verses or [verse["index"] for verse in verses] != list(range(1, len(verses) + 1)):
            raise ValueError(f"Invalid ayah sequence in surah {surah_index}")
        surahs.append({
            "index": surah_index,
            "name": surah_element.attrib["name"],
            "verses": verses,
        })
        total_ayahs += len(verses)

    if len(surahs) != 114 or total_ayahs != 6236:
        raise ValueError(f"Unexpected Quran counts: {len(surahs)} surahs, {total_ayahs} ayahs")
    if [surah["index"] for surah in surahs] != list(range(1, 115)):
        raise ValueError("Surah numbering is incomplete or out of order")

    payload = {
        "source": {
            "title": "Tanzil Quran Text (Uthmani, Version 1.1)",
            "copyright": "Copyright (C) 2007-2026 Tanzil Project",
            "license": "Creative Commons Attribution 3.0",
            "url": "https://tanzil.net/",
            "downloadUrl": "https://tanzil.net/download/",
            "updatesUrl": "https://tanzil.net/updates/",
            "notice": SOURCE_NOTICE,
        },
        "surahs": surahs,
    }
    if args.check:
        current = json.loads(OUTPUT.read_text(encoding="utf-8"))
        if current != payload:
            raise ValueError("Generated Quran data differs from the preserved Tanzil XML source")
        print(f"Verified {OUTPUT.relative_to(ROOT)} against source: {len(surahs)} surahs, {total_ayahs} ayahs")
    else:
        OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"Wrote {OUTPUT.relative_to(ROOT)}: {len(surahs)} surahs, {total_ayahs} ayahs")


if __name__ == "__main__":
    main()
