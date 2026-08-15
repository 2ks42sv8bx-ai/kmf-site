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


def stempel(komende):
    """Een kort kenmerk van wat er gebakken is.

    js/kmf.js rekent hetzelfde uit. Komen de twee overeen, dan weet het script
    dat de gebakken versie nog klopt en laat het ze staan — anders zou het bij
    elk bezoek hetzelfde nog eens tekenen, en dat zie je knipperen.
    """
    ruw = ";".join("%s|%s|%s" % (a["titel"], a["start"], a.get("tijd", ""))
                   for a in komende)
    h = 5381
    for teken in ruw:
        h = ((h * 33) ^ ord(teken)) & 0xFFFFFFFF
    return format(h, "x")


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

    return '<ul class="lijst" data-stempel="%s">%s</ul>' % (stempel(komende), "".join(rijen))


def bak_hero(komende, soorten):
    if not komende:
        return ('<div class="inhoud" data-stempel="%s">'
                '<p>Geen activiteiten gepland</p>'
                '<h2 class="titel">Tot binnenkort</h2></div>') % stempel([])

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

    # Het langste woord bepaalt hoe groot de titel kan worden. Die maat geven we
    # meteen mee, zodat de titel al bij het eerste tekenen ongeveer klopt. Zonder
    # dit staat ze eerst klein en springt ze op zodra het script gerekend heeft.
    langste = max((len(w) for w in a["titel"].split()), default=1)

    return ('<div class="inhoud" data-stempel="%s">'
            '<h2 class="titel" style="--tekens: %d">%s</h2>'
            '<div class="gegevens">%s</div>'
            "</div>") % (stempel(komende[:1]), langste, woorden.strip(), rijg(stukken))


def bak_index(navigatie, links):
    """De grote gekleurde lijst op de startpagina."""
    groepen = []
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
            items.append('<a href="%s"%s>%s</a>' % (e(adres), extra, naam))
        if items:
            naam = ('<span class="buiten-beeld">%s</span>' % e(groep["naam"])
                    if groep.get("naam") else "")
            groepen.append('<div class="groep %s">%s%s</div>'
                           % (e(groep.get("thema", "")), naam, "".join(items)))
    return '<div class="lijstjes">%s</div>' % "".join(groepen)


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
            # Verborgen naam: de groepen zijn op het scherm alleen aan kleur en
            # tussenruimte te herkennen. Een schermlezer hoort ze hier wel.
            naam = ('<span class="buiten-beeld">%s</span>' % e(groep["naam"])
                    if groep.get("naam") else "")
            groepen.append('<div class="groep %s">%s%s</div>'
                           % (e(groep.get("thema", "")), naam, "".join(items)))

    return "".join(groepen)


MARKER = re.compile(r"(<!-- gebakken:start -->).*?(<!-- gebakken:einde -->)", re.S)


# Het deelvoorbeeld staat in de <head> en heeft daarom een eigen merkteken.
# Zou het hetzelfde merkteken dragen als de rest, dan verschoof het de telling
# van bak_navigatie en bak_agenda hieronder — en stond de agenda ineens in de
# navigatiebalk.
DEELMARKER = re.compile(r"(<!-- deelvoorbeeld:start -->).*?(<!-- deelvoorbeeld:einde -->)", re.S)

DEELBEELD = "img/deelbeeld.png"
KRINGNAAM = "Kring Moraal en Filosofie"


def bak_deelvoorbeeld(tekst, bestand, links, heeft_beeld):
    """Zet de regels waarmee een gedeelde link zichzelf voorstelt.

    Deel je een pagina in een groepsgesprek of op Facebook, dan haalt die app
    de pagina zelf op en maakt er een kaartje van: titel, een zin uitleg, een
    beeld. Zonder deze regels blijft er een kaal adres staan, en dat leest in
    een groep als een dode link.

    Alles wordt afgeleid van de <title> en de omschrijving die al bovenaan de
    pagina staan. Je typt dus nergens twee keer hetzelfde: pas je de titel van
    een pagina aan, dan verandert het kaartje mee.
    """
    adres = (links.get("site") or "").strip().rstrip("/")
    if not adres:
        # Wis wat er stond. Haal je het adres weg, dan moeten de regels ook weg;
        # anders bleef een oud adres in de pagina staan en verwezen gedeelde
        # links naar een site die daar niet meer is.
        return DEELMARKER.sub(lambda m: m.group(1) + m.group(2), tekst, count=1)

    # Beide worden eerst teruggelezen naar gewone tekst en daarna opnieuw
    # ontsmet. De titel staat in de pagina als tekst, de omschrijving staat er
    # al ontsmet in een attribuut — zonder die tussenstap zou een & in de ene
    # goed uitkomen en in de andere als &amp;amp; op het kaartje belanden.
    m = re.search(r"<title>(.*?)</title>", tekst, re.S)
    titel = html.unescape(m.group(1).strip()) if m else KRINGNAAM
    m = re.search(r'<meta name="description" content="(.*?)">', tekst, re.S)
    omschrijving = html.unescape(m.group(1).strip()) if m else ""

    # "Agenda" alleen zegt in een groepsgesprek niets. De naam van de kring
    # erbij, tenzij die er al in staat — dan zou hij er twee keer staan.
    if KRINGNAAM.lower() not in titel.lower():
        titel = "%s — %s" % (titel, KRINGNAAM)

    url = adres + "/" + ("" if bestand == "index.html" else bestand)

    regels = [
        '<link rel="canonical" href="%s">' % e(url),
        '<meta property="og:type" content="website">',
        '<meta property="og:site_name" content="%s">' % e(KRINGNAAM),
        '<meta property="og:locale" content="nl_BE">',
        '<meta property="og:url" content="%s">' % e(url),
        '<meta property="og:title" content="%s">' % e(titel),
    ]
    if omschrijving:
        regels.append('<meta property="og:description" content="%s">' % e(omschrijving))

    if heeft_beeld:
        regels += [
            '<meta property="og:image" content="%s">' % e(adres + "/" + DEELBEELD),
            '<meta property="og:image:width" content="1200">',
            '<meta property="og:image:height" content="630">',
            '<meta property="og:image:alt" content="%s">' % e(KRINGNAAM),
            '<meta name="twitter:card" content="summary_large_image">',
        ]
    else:
        # Geen beeld: dan een klein kaartje in plaats van een breed. Een breed
        # kaartje zonder beeld laat een grijs gat achter.
        regels.append('<meta name="twitter:card" content="summary">')

    nieuw = "\n" + "\n".join(regels) + "\n"
    return DEELMARKER.sub(lambda m: m.group(1) + nieuw + m.group(2), tekst, count=1)


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


# Dezelfde vorm als bouwPaginaLijst in js/kmf.js. Staat het daar anders, dan
# ziet de bezoeker de pagina veranderen zodra het script draait.
LIJSTEN = {
    "presidium": {"gegevens": ["functie"], "titel": "naam", "tekst": "tekst"},
    "boeken":    {"gegevens": ["vak", "prijs"], "titel": "titel", "onder": "auteur", "tekst": "tekst"},
    "merch":     {"gegevens": ["prijs"], "titel": "naam", "tekst": "tekst"},
    "sponsors":  {"gegevens": [], "titel": "naam", "tekst": "tekst", "link": "link"},
    "vstn":      {"gegevens": ["datum"], "titel": "titel", "tekst": "tekst", "link": "link"},
    "lichtung":  {"gegevens": ["datum", "auteur"], "titel": "titel", "tekst": "tekst", "link": "link"},
}

# Vaste volgorde, zodat het kenmerk in Python en in JavaScript hetzelfde is.
STEMPELVELDEN = ["naam", "titel", "functie", "datum", "prijs", "auteur",
                 "vak", "link", "beeld", "tekst"]


def stempel_nav(navigatie, deze_pagina):
    """Kenmerk van de balk: alle namen plus de pagina waar we op staan.

    js/kmf.js rekent hetzelfde uit en laat de gebakken balk staan als het
    klopt. Zonder dat zou het script de balk bij elk bezoek weggooien en
    opnieuw opbouwen — en dan opnieuw moeten passen, met een ander resultaat
    naargelang het lettertype al binnen was.
    """
    delen = [deze_pagina]
    for groep in navigatie:
        delen.append(groep.get("thema", ""))
        for item in groep.get("items", []):
            delen.append(item.get("naam", ""))
    ruw = "|".join(delen)
    h = 5381
    for teken in ruw:
        h = ((h * 33) ^ ord(teken)) & 0xFFFFFFFF
    return format(h, "x")


def stempel_lijst(rijen):
    ruw = ";".join("|".join(str(r.get(v, "") or "") for v in STEMPELVELDEN)
                   for r in rijen)
    h = 5381
    for teken in ruw:
        h = ((h * 33) ^ ord(teken)) & 0xFFFFFFFF
    return format(h, "x")


def bak_invulblok(stempel_waarde):
    return ('<div class="invullen rij" data-stempel="%s">'
            '<p>WIP</p></div>') % stempel_waarde


def bak_paginalijst(soort, rijen):
    vorm = LIJSTEN[soort]
    merk = stempel_lijst(rijen)
    if not rijen:
        return bak_invulblok(merk)

    stukken = []
    for r in rijen:
        marge = [('<span class="%s">%s</span>' % (v, e(r[v])))
                 for v in vorm["gegevens"] if r.get(v)]

        titel = e(r.get(vorm["titel"], ""))
        if vorm.get("link") and r.get(vorm["link"]):
            titel = ('<a href="%s" target="_blank" rel="noopener">%s</a>'
                     % (e(r[vorm["link"]]), titel))

        maat = ['<h2 class="titel">%s</h2>' % titel]
        for veld in ("onder", "tekst"):
            naam = vorm.get(veld)
            if naam and r.get(naam):
                maat.append('<p class="tekst">%s</p>' % e(r[naam]))

        stukken.append('<li class="item rij">%s<div class="maat">%s</div></li>'
                       % ('<div class="marge">%s</div>' % rijg(marge) if marge else "",
                          "".join(maat)))

    return '<ul class="lijst" data-stempel="%s">%s</ul>' % (merk, "".join(stukken))


def bak_fotos(fotos):
    merk = stempel_lijst(fotos)
    if not fotos:
        return bak_invulblok(merk)
    kieken = []
    for f in fotos:
        beeld = ('<img class="beeldplek beeld" src="%s" alt="" loading="lazy">' % e(f["beeld"])
                 if f.get("beeld")
                 else '<div class="beeldplek"><span>Beeld</span></div>')
        bij = ('<figcaption>%s</figcaption>' % e(f["bijschrift"])
               if f.get("bijschrift") else "")
        kieken.append('<figure class="kiek">%s%s</figure>' % (beeld, bij))
    return ('<div class="rooster rij" data-stempel="%s">%s</div>' % (merk, "".join(kieken)))


def lees_lijst_uit_databestand(sleutel):
    """Een van de lijsten (presidium, boeken, ...) uit data/kmf-data.js."""
    pad = os.path.join(SITE, "data", "kmf-data.js")
    with open(pad, encoding="utf-8") as f:
        bron = verwijder_commentaar(f.read())

    i = bron.find(sleutel + ":")
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
    return json.loads(stuk)


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

    heeft_deelbeeld = os.path.exists(os.path.join(SITE, DEELBEELD))
    if not (links.get("site") or "").strip():
        print("Geen adres in kmf-data.js (links.site) — geen deelvoorbeeld. "
              "Een gedeelde link toont dan enkel het kale adres.")
    elif not heeft_deelbeeld:
        print("Geen %s — het deelvoorbeeld krijgt titel en tekst, maar geen beeld. "
              "Maak er een met poster.html, formaat Deelbeeld." % DEELBEELD)

    paginas = [f for f in sorted(os.listdir(SITE)) if f.endswith(".html")]
    for bestand in paginas:
        pad = os.path.join(SITE, bestand)
        with open(pad, encoding="utf-8") as f:
            tekst = f.read()
        origineel = tekst

        # Enkel op de pagina's die een merkteken dragen. Het gereedschap en het
        # stijlblad horen niet gedeeld te worden en hebben er dus geen.
        tekst = bak_deelvoorbeeld(tekst, bestand, links, heeft_deelbeeld)

        is_start = bestand == "index.html"
        nav = bak_navigatie(navigatie, links, bestand, is_start)

        # De startpagina heeft geen balk maar de grote index; die blijft door
        # js/kmf.js opgebouwd worden, want zonder kleur en zonder klikken is
        # een gebakken versie daar weinig waard.
        # De balk krijgt haar kenmerk op de nav zelf; de merktekens zitten
        # erbinnen, dus daar kan het attribuut niet staan.
        merk_nav = stempel_nav(navigatie, bestand)
        tekst = re.sub(r'<nav class="(nav|index rij)"([^>]*?)(\s*data-stempel="[^"]*")?>',
                       lambda m: '<nav class="%s"%s data-stempel="%s">'
                                 % (m.group(1), m.group(2), merk_nav),
                       tekst, count=1)

        if is_start:
            # Op de startpagina: eerst de hero, dan de grote index.
            tekst = zet_marker(tekst, 0, bak_hero(komende, soorten))

            # De kleur van de hero hangt aan een attribuut op de sectie zelf,
            # niet aan iets binnen de merktekens. Dat moet het bouwscript dus
            # apart zetten — anders valt de hero terug op het jaaraccent.
            groep = groep_van_soort(komende[0].get("soort"), soorten) if komende else ""
            tekst = re.sub(r'<section class="hero"[^>]*?(\s*data-groep="[^"]*")?>',
                           '<section class="hero" data-kmf="hero" data-groep="%s" '
                           'aria-label="Eerstvolgende activiteit">' % groep,
                           tekst, count=1)
            tekst = zet_marker(tekst, 1, bak_index(navigatie, links))
        else:
            tekst = zet_marker(tekst, 0, nav)
            if bestand == "agenda.html":
                tekst = zet_marker(tekst, 1, bak_agenda(komende, soorten))
            else:
                # De andere pagina's: hun lijst, of het WIP-blok als die leeg is.
                soort = None
                for sleutel in list(LIJSTEN) + ["fotos"]:
                    if 'data-kmf="%s"' % sleutel in tekst:
                        soort = sleutel
                        break
                if soort == "fotos":
                    tekst = zet_marker(tekst, 1, bak_fotos(lees_lijst_uit_databestand("fotos")))
                elif soort:
                    tekst = zet_marker(tekst, 1,
                                       bak_paginalijst(soort, lees_lijst_uit_databestand(soort)))
                elif 'data-kmf="tekst"' in tekst:
                    # Tekstpagina die nog geschreven moet worden.
                    tekst = zet_marker(tekst, 1,
                                       '<div class="invullen"><p>WIP</p></div>')

        if tekst != origineel:
            with open(pad, "w", encoding="utf-8") as f:
                f.write(tekst)

    print("%d activiteiten, %d problemen, %d pagina's nagekeken."
          % (len(activiteiten), len(problemen), len(paginas)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
