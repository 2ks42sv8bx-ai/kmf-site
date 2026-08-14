# De site online zetten

Twee delen. **Deel 1** zet de site vandaag nog online zodat je ze kan tonen —
dat kost tien minuten en je hebt er niets voor nodig behalve een GitHub-account.
**Deel 2** koppelt de agenda aan een spreadsheet, zodat het presidium de site
bijwerkt zonder ooit een bestand aan te raken. Dat kan gerust een week later.

---

# Deel 1 — vandaag online, gratis

We gebruiken **GitHub Pages**. Gratis, geen creditcard, geen limiet die je gaat
raken, en het hoort al bij het account dat je hebt. Je hebt de Student Pack
hiervoor niet nodig — die komt later van pas (zie onderaan).

## 1. Een repository maken

1. Ga naar [github.com/new](https://github.com/new).
2. Naam: `kmf-site` (of wat je wil).
3. Zet hem op **Public**. Pages werkt op een gratis account alleen bij publieke
   repo's — en de site komt toch online.
4. Klik **Create repository**.

## 2. De bestanden erin zetten

Met de webpagina, zonder iets te installeren:

1. Klik op **uploading an existing file**.
2. Sleep de **inhoud** van de sitemap erin — dus `index.html`, `agenda.html`,
   de mappen `css`, `js`, `data`, `fonts`, `img`, en de map `bouw`. Niet de
   omhullende map zelf.
3. Onderaan: **Commit changes**.

> De map `.github` wordt door de browser soms niet meegesleept omdat ze met een
> punt begint. Heb je Deel 2 nodig, voeg dat bestand dan later toe via
> **Add file → Create new file** en typ als naam
> `.github/workflows/site-bouwen.yml`.

Werk je liever met de terminal:

```bash
cd "pad/naar/de/sitemap"
git init -b main
git add .
git commit -m "Eerste versie van de KMF-site"
git remote add origin https://github.com/JOUWNAAM/kmf-site.git
git push -u origin main
```

## 3. Pages aanzetten

1. In je repo: **Settings** → **Pages** (linkerkolom).
2. Bij **Source**: kies **Deploy from a branch**.
3. Branch: **main**, map: **/ (root)**. **Save**.
4. Wacht een minuut en ververs. Bovenaan staat je adres:

   `https://JOUWNAAM.github.io/kmf-site/`

Dat is de link die je kan doorsturen. Klaar.

> Doe je later Deel 2, zet **Source** dan op **GitHub Actions** in plaats van
> **Deploy from a branch**. Anders draait het bouwscript wel, maar publiceert
> GitHub nog altijd de oude bestanden.

## 4. Even nakijken

- Klik alle dertien pagina's aan. Elke pagina hoort zichzelf **niet** in haar
  eigen balk te tonen.
- Zet je telefoon erbij.
- De schakelaar onderaan wisselt tussen licht en donker.

---

# Deel 2 — de agenda uit een spreadsheet

Vanaf hier hoeft niemand van het presidium nog een bestand te openen. Ze zetten
een rij in een gedeelde spreadsheet, en binnen het uur staat de activiteit op
de site.

## Hoe het werkt

```
Google Spreadsheet
        │  elk uur
        ▼
GitHub Actions  ──►  data/agenda.js   (voor het script)
                └►  agenda.html       (als gewone HTML ingebakken)
                     │
                     ▼
                GitHub Pages
```

De agenda wordt **in de HTML gebakken**. Dat betekent dat de site ook werkt
zonder JavaScript, sneller laadt, en blijft staan als Google er even uit ligt.
Werkt JavaScript wel, dan tekent `js/kmf.js` hetzelfde nog eens over — zo klopt
de agenda ook als de gebakken versie een uur oud is.

## 1. De spreadsheet

Maak een spreadsheet met een tabblad dat **`activiteiten`** heet. Eerste rij is
de koptekst — de volgorde van de kolommen maakt niet uit, de namen wel:

| titel | soort | start | einde | tijd | locatie | spreker | tekst | link | beeld |
|---|---|---|---|---|---|---|---|---|---|
| Immanuel Kantus | cantus | 2026-11-19 | | 20:00 | Blandijn | | Onze jaarlijkse cantus. | | |
| Pinten | café-avond | 2026-09-15 | | 21:00 | De Geus | | | | |

Alleen **titel** en **start** moeten ingevuld zijn. De rest mag leeg.

**De datum moet `2026-11-19` zijn** — jaar-maand-dag. Zet die kolom in Google
Sheets op *Opmaak → Getal → Tekst*, anders maakt Sheets er zelf iets als
`19/11/2026` van en leest het script ze niet.

Bij `soort` gebruik je dezelfde woorden als in `soorten` in `data/kmf-data.js`
(lezing, debat, café-avond, cantus, gebakdag…). Daar hangt de kleur aan vast.
Een onbekende soort krijgt gewoon de kleur van de agenda zelf.

Staat er een rij fout, dan verschijnt er **een rode balk op de site** met de
rijnummer erbij. Die is bedoeld voor wie de spreadsheet bijhoudt.

## 2. Een service-account

De spreadsheet blijft privé. Daarvoor is een gewone API-sleutel niet genoeg —
die werkt alleen bij bestanden die voor iedereen leesbaar zijn. Voor een privé
spreadsheet heb je een **service-account** nodig: een soort robotgebruiker met
wie je de sheet deelt.

1. Ga naar [console.cloud.google.com](https://console.cloud.google.com/).
2. Maak bovenaan een nieuw project, bijvoorbeeld `kmf-site`.
3. **APIs & Services → Library** → zoek **Google Sheets API** → **Enable**.
4. **APIs & Services → Credentials** → **Create credentials** →
   **Service account**. Geef hem een naam, bijvoorbeeld `kmf-agenda`, en klik
   door tot het klaar is.
5. Klik het service-account aan → tabblad **Keys** → **Add key** →
   **Create new key** → **JSON**. Er wordt een bestand gedownload. **Dat
   bestand is een sleutel — zet het nooit in de repo.**
6. Open het bestand en zoek het adres bij `"client_email"`. Het ziet eruit als
   `kmf-agenda@kmf-site.iam.gserviceaccount.com`.
7. Ga naar je spreadsheet → **Delen** → plak dat adres → geef **Lezer**-rechten
   → **Verzenden**. (Het vinkje "melding sturen" mag uit.)

## 3. De twee geheimen in GitHub

In je repo: **Settings → Secrets and variables → Actions → New repository
secret**. Maak er twee:

| Naam | Waarde |
|---|---|
| `KMF_SHEET_ID` | het stuk uit het adres van je spreadsheet tussen `/d/` en `/edit` |
| `KMF_SERVICE_ACCOUNT` | de **volledige inhoud** van het JSON-bestand, van `{` tot `}` |

Staat je tabblad anders dan `activiteiten!A1:J500`, zet dan bij het tabblad
**Variables** een `KMF_SHEET_BEREIK` met het juiste bereik.

## 4. Aanzetten

1. Zet **Settings → Pages → Source** op **GitHub Actions**.
2. Ga naar **Actions → Site bouwen en publiceren → Run workflow**.
3. Kijk of hij groen wordt. Zo niet, klik de stap open — de fout staat er
   letterlijk in.

Vanaf nu draait hij elk uur vanzelf, en ook telkens als je iets pusht.

## Het uitproberen zonder spreadsheet

Wil je zien wat het script doet vóór je aan Google begint:

```bash
python3 bouw/haal-agenda.py --test bouw/voorbeeld-agenda.json
```

Dat leest een voorbeeldbestand in plaats van de spreadsheet, schrijft
`data/agenda.js` en bakt de agenda in `agenda.html`. Er zit met opzet één
kapotte rij in het voorbeeld, zodat je ziet wat er dan gebeurt.

---

# Later: wat de Student Pack toevoegt

Voor een prototype heb je niets van dit alles nodig. Maar als de site blijft:

- **Namecheap** geeft je via de Student Pack een jaar gratis een `.me`-domein.
  Wil je liever `kringmoraalenfilosofie.be`, dan koop je dat apart (een euro of
  twintig per jaar bij een Belgische registrar).
- Een eigen domein koppel je aan Pages via **Settings → Pages → Custom domain**.
  Zet daarna **Enforce HTTPS** aan.
- Wil de kring het domein in eigen beheer, zet het dan op een adres van de
  kring en niet op je persoonlijke account — anders verhuist het elk jaar mee
  met wie de site doet.

Blijf gerust bij GitHub Pages. De site is een map met bestanden; er draait geen
server, er is geen database, en er valt dus ook weinig stuk. Dat is precies de
bedoeling: over vijf jaar moet iemand anders dit nog kunnen overnemen.
