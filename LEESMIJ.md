# KMF-website — handleiding voor het presidium

Deze site heeft geen inlogscherm, geen database en geen installatie. Alles wat
op de site staat, staat in één bestand: **`data/kmf-data.js`**. Open het in een
teksteditor, pas het aan, bewaar het, en herlaad de pagina.

Je hebt geen HTML of CSS nodig. Je hoeft niets te installeren.

---

## Een activiteit toevoegen

Open `data/kmf-data.js`. Onderaan staat de lijst `activiteiten`. Kopieer een
bestaand blok, plak het erbij, en pas de gegevens aan:

```js
{
  titel:    "Naam van de activiteit",   // VERPLICHT
  soort:    "lezing",                   // lezing, debat, café-avond, cantus, …
  start:    "2026-11-19",               // VERPLICHT — jaar-maand-dag
  einde:    "",                         // enkel bij meerdaagse activiteiten
  tijd:     "20:00",
  locatie:  "Blandijn",
  spreker:  "",                         // enkel bij lezingen en debatten
  tekst:    "Eén of twee zinnen uitleg.",
  voetnoot: "",                         // verschijnt klein onder de tekst
  link:     "",                         // bv. een Facebook-evenement
  beeld:    ""                          // pad naar een foto, bv. img/kantus.jpg
},
```

Alleen `titel` en `start` zijn verplicht. Al de rest mag je leeg laten — wat je
niet invult, verdwijnt gewoon uit de opmaak. De volgorde in het bestand maakt
niet uit; de site sorteert zelf op datum.

De site zet niets twee keer neer. Noem je een activiteit "Café-avond" en geef
je haar ook `soort: "café-avond"`, dan laat de agenda die soort gewoon weg — hij
staat al in de titel. En bij een herhaling verschijnen `tekst` en `voetnoot`
alleen bij de eerstvolgende keer, niet bij alle zes de café-avonden eronder.

**De datum moet jaar-maand-dag zijn, met streepjes.** `"2026-11-19"` is goed.
`"19/11/2026"` en `"19-11-2026"` zijn fout.

## Iets dat elke week of om de twee weken terugkomt

Zet het één keer in het bestand, met een herhaling erbij:

```js
herhaling:     "tweewekelijks",   // of "wekelijks" of "maandelijks"
herhaling_tot: "2026-12-15"
```

Dat ene blok wordt dan vanzelf een hele reeks losse data in de agenda. De
café-avond van oktober tot december staat zo met vier regels in het bestand in
plaats van zes keer volledig uitgeschreven.

## Voorbije activiteiten hoef je niet te wissen

De site toont enkel wat nog moet komen. Alles wat voorbij is, verdwijnt vanzelf
uit de agenda — je hoeft niets op te kuisen. Eén keer per jaar de oude blokken
wissen om het bestand overzichtelijk te houden volstaat.

## Als je een fout maakt

Dan verschijnt er bovenaan de pagina een **rode balk** die zegt wélke activiteit
fout staat en wát eraan scheelt. Bijvoorbeeld:

> "Immanuel Kantus" heeft een onleesbare `start`: `19/11/2026`. Schrijf de datum
> als jaar-maand-dag, bijvoorbeeld `2026-11-19`.

De site verbergt je fout dus nooit stilzwijgend. Zie je de balk niet, dan is er
niets mis.

---

## Het accent van het academiejaar

Elk jaar krijgt de site één eigen kleur. Die staat bovenaan in
**`css/kmf.css`**, en je wijzigt er drie regels — verder niets:

```css
--accent:      #ED778F;   /* vlakken en grote letters      */
--accent-diep: #B93A57;   /* kleine tekst en links         */
--accent-zacht:#F9D8DE;   /* achtergrond bij aanwijzen     */
```

Twee sets die al klaarstaan, beide van het wapenschild van de kring:

| | vlak | tekst | zacht |
|---|---|---|---|
| wapenroze | `#ED778F` | `#B93A57` | `#F9D8DE` |
| wapenblauw | `#2496D4` | `#1B6E9E` | `#DCEEF9` |

Wil je een eigen kleur, hou dan deze regel aan: `--accent` mag licht zijn, want
daar staat zwarte tekst op. `--accent-diep` wordt gebruikt voor kleine tekst op
een witte achtergrond, en moet dus donker genoeg zijn om te lezen — mik op een
contrast van minstens 4,5 tegen wit.

## De kleuren van de index

De startpagina noemt de thema's niet bij naam. De kleur doet dat werk, net als
op de startpagina van KASK: alles wat bij hetzelfde thema hoort, heeft dezelfde
kleur, en de tussenruimte scheidt de groepen.

| thema | wat erin zit | licht | donker |
|---|---|---|---|
| wat we doen | agenda, foto's, VSTN | `#B93A57` | `#ED778F` |
| voor je studie | samenvattingen, boeken | `#147E2D` | `#1DB240` |
| meedoen | lid worden, merch | `#6E7112` | `#9CA01A` |
| wie we zijn | over ons, presidium, alumni, statuten, sponsors | `#1D71B1` | `#4CA1E2` |
| hulp en contact | mentaal welzijn, contact | `#A034DE` | `#C27EEA` |

Het zijn vijf tinten die op de kleurencirkel exact 72° uit elkaar liggen. Het
roze en het blauw van het wapenschild staan 144° van elkaar, dus vallen ze
allebei precies op dat raster; de andere drie volgen er vanzelf uit. Alle vijf
zijn daarna op dezelfde leesbaarheid gezet — ongeveer 5,2 tegen wit en 6,6
tegen zwart — zodat geen enkel thema zwaarder weegt dan een ander. Dat is ook
waarom het geel eerder olijfgroen uitvalt: lichter haalt het de leesdrempel op
wit niet.

**Deze vijf blijven staan**, ook als het jaaraccent hierboven verandert. Een
wegwijzer die elk jaar van kleur verschiet, is geen wegwijzer meer. Het accent
van het academiejaar kleurt de balk bovenaan en de agenda; deze vijf kleuren de
weg naar de andere pagina's.

Een link die vet staat, werkt al; een link in dezelfde kleur maar niet vet is
een pagina die nog gebouwd moet worden.

## De navigatiebalk

De balk staat op **één plek**: `navigatie` in `data/kmf-data.js`. Elke pagina
bouwt haar eigen balk daaruit op en laat automatisch haar eigen naam weg — je
staat er immers al op.

Wil je een bestemming toevoegen, verplaatsen of hernoemen, dan doe je dat daar,
en het verandert meteen op alle pagina's tegelijk. Vroeger stond de balk met de
hand in elk bestand overgetypt; toen heette het tijdschrift op de ene pagina
VSTN en op de andere "Van stof tot nadenken". Dat kan nu niet meer.

De balk blijft op één regel. Hoeveel ruimte er tussen de woorden staat, wordt
uitgerekend: eerst krijgt elk woord zijn eigen breedte, en wat er overblijft
wordt over de gaten verdeeld — een gat tussen twee groepen krijgt ruim twee
keer zoveel als een gat binnen een groep, zodat je de vijf groepen blijft zien
zonder dat er een kopje bij hoeft. Past het écht niet meer, op een smalle
telefoon, dan breekt ze alsnog netjes af over meerdere regels.

## Een pagina toevoegen

1. Kopieer een bestaande pagina, bijvoorbeeld `boeken.html`.
2. Pas `<title>` en de `<h1>` aan.
3. Zet een regel bij in `navigatie` in `data/kmf-data.js`:
   `{ naam: "Archief", pagina: "archief.html" }`

Meer is het niet. De balk, de kleur van het thema en het weglaten van de pagina
uit haar eigen balk gebeuren vanzelf.

## De lijsten van de andere pagina's

Presidium, boeken, merch, sponsors, VSTN, Lichtung en de foto's werken net als
de agenda: het zijn lijstjes onderaan `data/kmf-data.js`. Boven elke lijst staat
één regel commentaar met de velden die je kan invullen.

Zolang een lijst leeg is, zegt de pagina zelf dat ze nog ingevuld moet worden —
met de naam van de lijst erbij. Zet je er een blok in, dan bouwt de pagina
zichzelf op, in dezelfde vorm als de agenda.

Is er nog geen foto bij een blok, dan komt er een vlak in de kleur van het jaar
te staan. De bladspiegel klopt dan al voor de foto's er zijn.

## Kleur betekent overal hetzelfde

De vijf groepen van de navigatie hebben elk een kleur. Een activiteit hoort ook
altijd bij één van die groepen — een lezing is iets anders dan een cantus. In
`soorten` in `data/kmf-data.js` staat welke soort bij welke groep hoort:

```js
soorten: {
  "lezing":     "studie",     // groen, net als samenvattingen en boeken
  "café-avond": "meedoen",    // olijf, net als lid worden en merch
  "cantus":     "meedoen",
  ...
}
```

Daardoor betekent een kleur op de hele site hetzelfde: groen is studie, of dat
nu een boek is of een debat. Staat een soort er niet bij, dan krijgt hij de
kleur van "wat we doen" — de groep waar de agenda zelf onder valt. Voeg je een
nieuwe soort toe, zet hem er dan ook bij.

Het gekleurde vlak bovenaan de startpagina neemt de kleur over van de groep
waar de eerstvolgende activiteit bij hoort: staat er een lezing te wachten, dan
is het vlak groen. In lichte modus staat daar witte tekst op — dat haalt bij
alle vijf de kleuren ruim de leesbaarheidsdrempel. In donkere modus valt het
vlak weg en staat de titel er in het roze van het wapenschild — de kleur van de
kring zelf.

Een activiteit in de agenda leest van boven naar beneden: wanneer het is, wat
het is, en dan waar en met wie. Datum en uur staan boven de titel, plaats,
spreker en soort eronder.

## Licht en donker

Onderaan elke pagina staat een schakelaar. Standaard volgt de site de instelling
van je toestel; klik je hem aan, dan kies je zelf en onthoudt de site dat.

De keuze wordt heel vroeg toegepast, met een klein script bovenaan elke pagina —
anders zie je bij het laden eerst de verkeerde kleur oplichten. Zonder
JavaScript verschijnt de schakelaar niet, en volgt de site gewoon het toestel.

## De zetting

De site gebruikt drie lettermaten voor de inhoud, en die groeien alle drie mee
met de breedte van het scherm:

| | telefoon | breed scherm | waarvoor |
|---|---|---|---|
| klein | 13 px | 16 px | gegevens, noten, navigatie, voettekst |
| tekst | 16 px | 22 px | lopende tekst |
| groot | 22 px | 44 px | indexlinks en titels van activiteiten |

Omdat ze alle drie dezelfde curve volgen, blijft de verhouding tussen een titel
en zijn gegevens overal gelijk — op een telefoon en op een breed scherm ziet de
pagina er even dicht uit. De rangorde komt van gewicht en witruimte, niet van
grote sprongen in korpsgrootte. Dat is de Zwitserse school.

De titel van de eerstvolgende activiteit bovenaan de startpagina is de enige
uitzondering: die wordt per activiteit uitgerekend zodat hij de breedte precies
vult.

Wil je iets aanpassen, doe het dan in de ladder bovenaan `css/kmf.css`.

---

## De startpagina

De startpagina heeft geen titelbalk en geen navigatiebalk. Ze begint meteen met
de **eerstvolgende activiteit** over de volle breedte — dat is altijd gewoon
wat als eerste komt, je hoeft daar niets voor in te stellen — en daaronder staat
de index: de links naar de rest van de site, onder elkaar en per thema
gekleurd. De volledige agenda staat op `agenda.html`, het verhaal van de kring
op `over.html`.

Alle drie de pagina's zijn hetzelfde ding: één kolom tegen de linkerrand, met
haarlijnen die van rand tot rand lopen. Een activiteit in de agenda leest van
boven naar beneden — nummer en gegevens, dan de titel, dan de tekst, dan de
noot — en de titels staan er even groot als de links op de startpagina.

De titel van die eerstvolgende activiteit wordt automatisch zo groot gezet als
hij kan zonder uit de kolom te lopen. Een korte titel vult dus de hele breedte,
een lange loopt over twee of drie regels en wordt wat kleiner. Je hoeft daar
niets aan te rekenen.

## Foto's

De balk bovenaan de startpagina toont de eerstvolgende activiteit. Zet je bij
die activiteit een `beeld`, dan komt de foto over de volle breedte te staan met
de titel eroverheen. Zet je er geen, dan blijft het gekleurde vlak staan met
diezelfde titel erop.

Beide zijn even goed. De site is er niet op gebouwd dat er altijd een foto is —
zo blijft ze er ook verzorgd uitzien in de weken dat niemand er een genomen
heeft.

Foto's zet je in de map `img`, en je verwijst ernaar als `img/naam.jpg`.

---

## Waar wat staat

| bestand | wat het is |
|---|---|
| `data/kmf-data.js` | **alle inhoud.** Het enige bestand dat je normaal aanpast. |
| `css/kmf.css` | de vormgeving. Bovenaan staat het accent van het jaar. |
| `js/kmf.js` | bouwt de agenda op uit het databestand. Hier hoef je niets aan te doen. |
| `index.html` | de startpagina |
| `agenda.html` | de agendapagina |
| de tien andere `.html` | foto's, boeken, VSTN, Lichtung, merch, presidium, sponsors, lid worden, welzijn, contact |
| `over.html` | "Over ons": wie de kring is, sinds 1985 |
| `fonts/` | het lettertype (Inter), meegeleverd zodat de site ook zonder internet werkt |
| `img/` | het wapenschild en de foto's |

## De site online zetten

Alle bestanden samen in een map zetten volstaat — er is geen bouwstap. De map
werkt op eender welke statische hosting (GitHub Pages, Netlify, de webruimte van
de faculteit) en werkt ook gewoon door `index.html` te dubbelklikken.

Eén technisch weetje voor wie later verder bouwt: de inhoud zit in een `.js`-
bestand en niet in een `.json`-bestand, omdat een browser een lokaal
JSON-bestand weigert in te lezen wanneer je de pagina rechtstreeks van je schijf
opent. Staat de site eenmaal online, dan kan het even goed JSON worden — dat is
een wijziging van twee regels in `js/kmf.js`.
