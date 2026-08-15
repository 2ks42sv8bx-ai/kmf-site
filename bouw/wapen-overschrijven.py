#!/usr/bin/env python3
"""Schrijft img/kmf-wapen.png over naar js/kmf-wapen.js.

Draai dit één keer nadat je het wapenschild vervangen hebt door een scherpere
versie. Verder hoef je er nooit naar om te kijken.

    python3 bouw/wapen-overschrijven.py

Waarom dit bestaat, staat bovenaan js/kmf-wapen.js.
"""

import base64
import os
import sys

HIER = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.dirname(HIER)
BRON = os.path.join(SITE, "img", "kmf-wapen.png")
DOEL = os.path.join(SITE, "js", "kmf-wapen.js")

KOP = '''/* ==========================================================================
   KMF — het wapenschild, als tekst
   --------------------------------------------------------------------------
   Dit is img/kmf-wapen.png, letterlijk overgeschreven in tekens. Eén regel,
   niet om te lezen.

   Waarom het hier staat: het postergereedschap tekent de poster in een
   <canvas> en bewaart die daarna als PNG. Open je de site rechtstreeks vanaf
   je schijf — dus met een adres dat met file:// begint — dan ziet de browser
   elk ander bestand op die schijf als een vreemde bron. Het wapen wordt dan
   wel getekend, maar de poster kan achteraf niet meer bewaard worden. Deze
   kopie zit in de pagina zelf en telt niet als vreemde bron, dus daarmee lukt
   het altijd.

   Online leest poster.js gewoon img/kmf-wapen.png. Vervang je dat bestand
   door een scherpere versie, dan gebruikt de poster die vanzelf; dit bestand
   blijft enkel de terugval voor wie lokaal werkt. Opnieuw aanmaken:

     python3 bouw/wapen-overschrijven.py

   ========================================================================== */

window.KMF_WAPEN = "data:image/png;base64,'''


def main():
    if not os.path.exists(BRON):
        sys.exit("Niet gevonden: %s" % BRON)

    ruw = open(BRON, "rb").read()
    tekst = base64.b64encode(ruw).decode("ascii")

    with open(DOEL, "w", encoding="utf-8") as f:
        f.write(KOP + tekst + '";\n')

    print("%s (%d kB) overgeschreven naar %s" % (
        os.path.basename(BRON), len(ruw) // 1024 + 1, os.path.relpath(DOEL, SITE)))


if __name__ == "__main__":
    main()
