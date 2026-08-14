#!/usr/bin/env python3
"""
KMF — de agenda uit de spreadsheet halen en in de site zetten.

Dit script draait niet op de site zelf. Het draait op GitHub, elk uur, en doet
drie dingen:

  1. het leest het tabblad "activiteiten" uit de gedeelde spreadsheet
  2. het schrijft die activiteiten weg in data/agenda.js
  3. het bakt de navigatie, de hero en de agenda als gewone HTML in de pagina's

Die derde stap is er zodat de site ook werkt zonder JavaScript: wie de pagina
opent, krijgt de agenda meteen te zien, ook als het script niet laadt. Werkt
JavaScript wél, dan tekent js/kmf.js hetzelfde nog eens over — dat is geen
verspilling maar een vangnet: staat de gebakken versie een uur achter, dan
corrigeert de browser dat zelf.

LOKAAL UITPROBEREN, zonder spreadsheet:

    python3 bouw/haal-agenda.py --test bouw/voorbeeld-agenda.json

MET DE ECHTE SPREADSHEET (zo draait het op GitHub):

    KMF_SHEET_ID=...  KMF_SERVICE_ACCOUNT="$(cat sleutel.json)"  python3 bouw/haal-agenda.py
"""

import argparse
import datetime
import html
import json
import os
import re
import sys

HIER = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.dirname(HIER)

# De kolommen die het script uit de spreadsheet leest. De volgorde in het
# tabblad maakt niet uit — er wordt op de koptekst gezocht. Alleen "titel" en
# "start" moeten ingevuld zijn.
KOLOMMEN = ["titel", "soort", "start", "einde", "tijd", "locatie",
            "spreker", "tekst", "link", "beeld"]

SOORTEN_MET_SPREKER = ("lezing", "debat")


# ---------------------------------------------------------------- de bron ---

def lees_uit_spreadsheet():
    """Haalt het tabblad op met een service-account. Zie HOSTEN.md."""
    from google.oauth2 import service_account
    from googleapiclient.discovery import build

    sheet_id = os.environ["KMF_SHEET_ID"]
    bereik = os.environ.get("KMF_SHEET_BEREIK", "activiteiten!A1:J500")
    sleutel = json.loads(os.environ["KMF_SERVICE_ACCOUNT"])

    gegevens = service_account.Credentials.from_service_account_info(
        sleutel, scopes=["https://www.googleapis.com/auth/spreadsheets.readonly"])

    dienst = build("sheets", "v4", credentials=gegevens, cache_discovery=False)
    antwoord = dienst.spreadsheets().values().get(
        spreadsheetId=sheet_id, range=bereik).execute()
    return antwoord.get("values", [])


def lees_uit_testbestand(pad):
    with open(pad, encoding="utf-8") as f:
        return json.load(f)


def naar_activiteiten(rijen):
    """Eerste rij is de koptekst; de rest zijn activiteiten."""
    if not rijen:
        return [], ["De spreadsheet is leeg."]

    kop = [str(c).strip().lower() for c in rijen[0]]
    plaats = {naam: kop.index(naam) for naam in KOLOMMEN if naam in kop}

    ontbreekt = [n for n in ("titel", "start") if n not in plaats]
    if ontbreekt:
        return [], ["De spreadsheet mist de kolom(men): " + ", ".join(ontbreekt) +
                    ". Zet ze in de eerste rij."]

    activiteiten, problemen = [], []

    for nr, rij in enumerate(rijen[1:], start=2):
        def veld(naam):
            i = plaats.get(naam)
            if i is None or i >= len(rij):
                return ""
            return str(rij[i]).strip()

        titel = veld("titel")
        start = veld("start")

        if not titel and not start:
            continue                      # lege regel onderaan het tabblad
        if not titel:
            problemen.append("Rij %d heeft geen titel." % nr)
            continue
        if not lees_datum(start):
            problemen.append('Rij %d ("%s") heeft een onleesbare datum: "%s". '
                             "Schrijf ze als 2026-11-19." % (nr, titel, start))
            continue

        einde = veld("einde")
        if einde and not lees_datum(einde):
            problemen.append('Rij %d ("%s") heeft een onleesbare einddatum: "%s".'
                             % (nr, titel, einde))
            einde = ""

        activiteit = {"titel": titel, "start": start}
        for naam in ("soort", "tijd", "locatie", "spreker", "tekst", "link", "beeld"):
            if veld(naam):
                activiteit[naam] = veld(naam)
        if einde:
            activiteit["einde"] = einde

        activiteiten.append(activiteit)

    activiteiten.sort(key=lambda a: a["start"])
    return activiteiten, problemen


def lees_datum(tekst):
    if not re.match(r"^\d{4}-\d{2}-\d{2}$", str(tekst or "").strip()):
        return None
    try:
        return datetime.date.fromisoformat(tekst.strip())
    except ValueError:
        return None


# ------------------------------------------------------------ data/agenda.js ---

def schrijf_agenda_js(activiteiten, problemen):
    pad = os.path.join(SITE, "data", "agenda.js")
    inhoud = (
        "/* ==========================================================================\n"
        "   AUTOMATISCH GEGENEREERD — NIET MET DE HAND AANPASSEN\n"
        "   --------------------------------------------------------------------------\n"
        "   Dit bestand wordt elk uur opnieuw geschreven uit de gedeelde spreadsheet.\n"
        "   Wijzigingen die je hier typt, zijn bij de volgende ronde weer weg.\n"
        "   Pas de spreadsheet aan; zie HOSTEN.md.\n\n"
        "   Laatst bijgewerkt: " + datetime.datetime.now(datetime.timezone.utc)
        .strftime("%Y-%m-%d %H:%M") + " UTC\n"
        "   ========================================================================== */\n\n"
        "window.KMF_AGENDA = " + json.dumps(activiteiten, ensure_ascii=False, indent=2) + ";\n\n"
        "/* Rijen die niet klopten. De site toont ze in een rode balk, zodat wie de\n"
        "   spreadsheet bijhoudt meteen ziet dat er iets scheelt. */\n"
        "window.KMF_AGENDA_FOUTEN = " + json.dumps(problemen, ensure_ascii=False, indent=2) + ";\n"
    )
    with open(pad, "w", encoding="utf-8") as f:
        f.write(inhoud)
    return pad


# --------------------------------------------------------------- het bakken ---

def e(tekst):
    return html.escape(str(tekst or ""), quote=True)


def toon_datum(d):
    return "%02d.%02d.%s" % (d.day, d.month, str(d.year)[2:])


def toon_periode(start, einde):
    if not einde or einde == start:
        return toon_datum(start)
    return "%02d.%02d — %s" % (start.day, start.month, toon_datum(einde))


def status_van(start, tijd):
    """Vandaag / Vanavond / Morgen / dagnaam — zoals js/kmf.js het doet."""
    vandaag = datetime.date.today()
    verschil = (start - vandaag).days
    if verschil < 0:
        return ""
    if verschil == 0:
        uur = int(tijd[:2]) if tijd[:2].isdigit() else 99
        return "Vandaag" if uur < 17 else "Vanavond"
    if verschil == 1:
        return "Morgen"
    iso = start.isoweekday()
    tot_zondag = 7 - vandaag.isoweekday()
    if verschil <= tot_zondag:
        return ["Maandag", "Dinsdag", "Woensdag", "Donderdag",
                "Vrijdag", "Zaterdag", "Zondag"][iso - 1]
    return ""


def groep_van_soort(soort, tabel):
    return tabel.get(str(soort or "").strip().lower(), "doen")


def rijg(delen):
    """Achter elkaar, zonder scheidingsteken — de tussenruimte doet het werk."""
    return "".join(delen)


def vlakbij(status):
    return status in ("Vandaag", "Vanavond", "Morgen")


def bak_agenda(komende, soorten):
    if not komende:
        return ('<p class="leeg">Er staat nog niets gepland.</p>')

    rijen = []
    for a in komende:
        start = lees_datum(a["start"])
        einde = lees_datum(a.get("einde", "")) if a.get("einde") else None
        soort = a.get("soort", "")
        groep = groep_van_soort(soort, soorten)

        boven = []
        status = status_van(start, a.get("tijd", ""))
        if status:
            boven.append('<span class="status">%s</span>' % e(status))
        # Staat er "Vandaag" of "Morgen", dan zegt de datum niets meer.
        if not vlakbij(status):
            boven.append('<span class="datum">%s</span>' % e(toon_periode(start, einde)))
        if a.get("tijd"):
            boven.append('<span class="uur">%s</span>' % e(a["tijd"]))

        onder = []
        if a.get("locatie"):
            onder.append('<span class="plaats">%s</span>' % e(a["locatie"]))
        if a.get("spreker") and soort.lower() in SOORTEN_MET_SPREKER:
            onder.append('<span class="spreker">%s</span>' % e(a["spreker"]))
        if soort and soort.strip().lower() != a["titel"].strip().lower():
            onder.append('<span class="soort">%s</span>' % e(soort))

        titel = e(a["titel"])
        if a.get("link"):
            titel = '<a href="%s" rel="noopener">%s</a>' % (e(a["link"]), titel)

        stuk = ['<li class="item rij thema-%s">' % e(groep),
                '<div class="marge">%s</div>' % rijg(boven),
                '<div class="maat">',
                '<h3 class="titel">%s</h3>' % titel]
        if onder:
            stuk.append('<p class="details">%s</p>' % rijg(onder))
        if a.get("tekst"):
            stuk.append('<p class="tekst">%s</p>' % e(a["tekst"]))
        stuk.append("</div></li>")
        rijen.append("".join(stuk))

    return '<ul class="lijst">%s</ul>' % "".join(rijen)


def bak_hero(komende, soorten):
    if not komende:
        return ('<div class="inhoud"><p class="label">Geen activiteiten gepland</p>'
                '<h2 class="titel">Tot binnenkort</h2></div>')

    a = komende[0]
    start = lees_datum(a["start"])
    einde = lees_datum(a.get("einde", "")) if a.get("einde") else None
    soort = a.get("soort", "")

    status = status_van(start, a.get("tijd", ""))
    stukken = []
    if status:
        stukken.append('<span class="soort">%s</span>' % e(status))
    if not vlakbij(status):
        stukken.append('<span>%s</span>' % e(toon_periode(start, einde)))
    if a.get("tijd"):
        stukken.append('<span>%s</span>' % e(a["tijd"]))
    if a.get("locatie"):
        stukken.append('<span>%s</span>' % e(a["locatie"]))
    if soort and soort.strip().lower() != a["titel"].strip().lower():
        stukken.append('<span>%s</span>' % e(soort))

    woorden = "".join('<span class="woord">%s</span> ' % e(w)
                      for w in a["titel"].split())

    return ('<div class="inhoud">'
            '<p class="label">Eerstvolgende activiteit</p>'
            '<h2 class="titel">%s</h2>'
            '<div class="gegevens label">%s</div>'
            "</div>") % (woorden.strip(), rijg(stukken))


def bak_navigatie(navigatie, links, deze_pagina, is_start):
    groepen = []
    if not is_start:
        groepen.append('<div class="groep"><a href="index.html">Startpagina</a></div>')

    for groep in navigatie:
        items = []
        for item in groep.get("items", []):
            naam = e(item["naam"])
            adres = item.get("pagina")
            extra = ""
            if not adres and item.get("link"):
                adres = links.get(item["link"], item["link"])
                extra = ' target="_blank" rel="noopener"'
            if not adres:
                items.append('<span class="stub" title="Nog niet gebouwd">%s</span>' % naam)
                continue
            klasse = ' class="hier"' if item.get("pagina") == deze_pagina else ""
            items.append('<a href="%s"%s%s>%s</a>' % (e(adres), extra, klasse, naam))
        if items:
            groepen.append('<div class="groep %s">%s</div>'
                           % (e(groep.get("thema", "")), "".join(items)))

    return "".join(groepen)


MARKER = re.compile(r"(<!-- gebakken:start -->).*?(<!-- gebakken:einde -->)", re.S)


def zet_marker(tekst, welke, nieuw):
    """Vervangt het `welke`-de merkteken in de pagina, geteld vanaf nul.

    Op agenda.html staan er twee: eerst de balk, dan de agenda zelf. Vervang je
    op aantal in plaats van op plaats, dan overschrijft de tweede oproep ook de
    eerste — en dan staat de agenda in de navigatiebalk.
    """
    teller = {"n": -1}

    def vervang(m):
        teller["n"] += 1
        if teller["n"] == welke:
            return m.group(1) + nieuw + m.group(2)
        return m.group(0)

    return MARKER.sub(vervang, tekst)


# ---------------------------------------------------------------- de data ---

def verwijder_commentaar(bron):
    """Haalt // en /* */ weg, maar laat wat tússen aanhalingstekens staat met rust.

    Met een simpele regex op // sneuvelt elke https://-adres in het bestand.
    Daarom lopen we er teken voor teken door en houden we bij of we in een
    string zitten.
    """
    uit = []
    i, n = 0, len(bron)
    in_string = None

    while i < n:
        c = bron[i]

        if in_string:
            uit.append(c)
            if c == "\\" and i + 1 < n:
                uit.append(bron[i + 1])
                i += 2
                continue
            if c == in_string:
                in_string = None
            i += 1
            continue

        if c in "\"'":
            in_string = c
            uit.append(c)
            i += 1
            continue

        if c == "/" and i + 1 < n and bron[i + 1] == "/":
            while i < n and bron[i] != "\n":
                i += 1
            continue

        if c == "/" and i + 1 < n and bron[i + 1] == "*":
            einde = bron.find("*/", i + 2)
            i = n if einde < 0 else einde + 2
            continue

        uit.append(c)
        i += 1

    return "".join(uit)


def lees_activiteiten_uit_databestand():
    """De activiteiten zoals ze in data/kmf-data.js staan."""
    pad = os.path.join(SITE, "data", "kmf-data.js")
    with open(pad, encoding="utf-8") as f:
        bron = verwijder_commentaar(f.read())

    i = bron.find("activiteiten:")
    if i < 0:
        return []
    i = bron.index("[", i)
    diepte, j = 0, i
    while j < len(bron):
        if bron[j] == "[":
            diepte += 1
        elif bron[j] == "]":
            diepte -= 1
            if diepte == 0:
                break
        j += 1

    stuk = bron[i:j + 1]
    stuk = re.sub(r"(\{|,)\s*([A-Za-z_][\w-]*)\s*:", r'\1"\2":', stuk)
    stuk = re.sub(r",(\s*[\]}])", r"\1", stuk)
    lijst = json.loads(stuk)
    lijst.sort(key=lambda a: a.get("start", ""))
    return lijst


def lees_kmf_data():
    """Haalt navigatie, links en soorten uit data/kmf-data.js.

    Dat bestand is JavaScript, geen JSON — met commentaar en aanhalingstekens
    die JSON niet toelaat. We knippen er de drie stukken uit die we nodig
    hebben in plaats van te doen alsof het JSON is.
    """
    pad = os.path.join(SITE, "data", "kmf-data.js")
    with open(pad, encoding="utf-8") as f:
        bron = f.read()

    bron = verwijder_commentaar(bron)

    def blok(naam, open_teken, sluit_teken):
        i = bron.find(naam + ":")
        if i < 0:
            return None
        i = bron.index(open_teken, i)
        diepte, j = 0, i
        while j < len(bron):
            if bron[j] == open_teken:
                diepte += 1
            elif bron[j] == sluit_teken:
                diepte -= 1
                if diepte == 0:
                    return bron[i:j + 1]
            j += 1
        return None

    def naar_json(stuk):
        stuk = re.sub(r"(\{|,)\s*([A-Za-z_][\w-]*)\s*:", r'\1"\2":', stuk)
        stuk = re.sub(r",(\s*[\]}])", r"\1", stuk)
        return json.loads(stuk)

    return (naar_json(blok("navigatie", "[", "]") or "[]"),
            naar_json(blok("links", "{", "}") or "{}"),
            naar_json(blok("soorten", "{", "}") or "{}"))


# ------------------------------------------------------------------ main ---

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--test", help="lees uit een JSON-bestand in plaats van de spreadsheet")
    args = p.parse_args()

    if args.test:
        activiteiten, problemen = naar_activiteiten(lees_uit_testbestand(args.test))
        schrijf_js = True
    elif os.environ.get("KMF_SHEET_ID"):
        activiteiten, problemen = naar_activiteiten(lees_uit_spreadsheet())
        schrijf_js = True
    else:
        # Geen spreadsheet ingesteld: bak dan gewoon wat er in data/kmf-data.js
        # staat. Zo kan je het bouwscript ook lokaal draaien, zonder Google.
        activiteiten, problemen = lees_activiteiten_uit_databestand(), []
        schrijf_js = False
        print("Geen KMF_SHEET_ID — de activiteiten komen uit data/kmf-data.js.")

    for fout in problemen:
        print("LET OP:", fout, file=sys.stderr)

    if schrijf_js:
        schrijf_agenda_js(activiteiten, problemen)

    navigatie, links, soorten = lees_kmf_data()

    vandaag = datetime.date.today()
    komende = [a for a in activiteiten
               if (lees_datum(a.get("einde") or a["start"]) or vandaag) >= vandaag]

    paginas = [f for f in sorted(os.listdir(SITE)) if f.endswith(".html")]
    for bestand in paginas:
        pad = os.path.join(SITE, bestand)
        with open(pad, encoding="utf-8") as f:
            tekst = f.read()
        origineel = tekst

        is_start = bestand == "index.html"
        nav = bak_navigatie(navigatie, links, bestand, is_start)

        # De startpagina heeft geen balk maar de grote index; die blijft door
        # js/kmf.js opgebouwd worden, want zonder kleur en zonder klikken is
        # een gebakken versie daar weinig waard.
        if is_start:
            # Op de startpagina is het enige merkteken de hero.
            tekst = zet_marker(tekst, 0, bak_hero(komende, soorten))
        else:
            tekst = zet_marker(tekst, 0, nav)
            if bestand == "agenda.html":
                tekst = zet_marker(tekst, 1, bak_agenda(komende, soorten))

        if tekst != origineel:
            with open(pad, "w", encoding="utf-8") as f:
                f.write(tekst)

    print("%d activiteiten, %d problemen, %d pagina's nagekeken."
          % (len(activiteiten), len(problemen), len(paginas)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
