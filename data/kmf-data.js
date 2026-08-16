/* ==========================================================================
   KMF — ALLE INHOUD VAN DE SITE STAAT IN DIT BESTAND
   --------------------------------------------------------------------------
   Dit is het enige bestand dat je moet aanpassen om de website bij te werken.
   Je hebt geen HTML of CSS nodig. Open het in een teksteditor, pas aan,
   bewaar, en herlaad de pagina in je browser.

   EEN ACTIVITEIT TOEVOEGEN — kopieer dit blok in de lijst hieronder:

     {
       titel:    "Naam van de activiteit",   // VERPLICHT
       soort:    "lezing",                   // lezing, debat, café-avond,
                                             // cantus, gebakdag, fuif, weekend
       start:    "2026-11-19",               // VERPLICHT — jaar-maand-dag
       einde:    "",                         // enkel bij meerdaagse activiteiten
       tijd:     "20:00",
       locatie:  "Blandijn",
       spreker:  "",                         // enkel bij lezingen en debatten
       tekst:    "Eén of twee zinnen uitleg.",
       voetnoot: "",                         // verschijnt klein onder de lijn
       link:     "",                         // bv. een Facebook-evenement
       beeld:    ""                          // pad naar een foto, bv. img/kantus.jpg
     },

   LET OP — de datum moet altijd jaar-maand-dag zijn, met streepjes:
   "2026-11-19" is goed, "19/11/2026" en "19-11-2026" zijn fout. Zet je iets
   fout, dan verschijnt er bovenaan de pagina een rode balk die zegt wát er
   fout is. De pagina verbergt je fout dus nooit stilzwijgend.

   VOORBIJE ACTIVITEITEN MAG JE LATEN STAAN. De site toont enkel wat nog
   moet komen; alles wat voorbij is verdwijnt vanzelf uit de lijst. Je hoeft
   dus niets op te kuisen — één keer per jaar de oude blokken wissen volstaat.
   ========================================================================== */

window.KMF = {

  /* Vaste links. De samenvattingen zitten in één gedeelde drive-map. */
  links: {
    samenvattingen: "https://drive.google.com/drive/folders/16hUQhapamzTnRD4Cw-j5PD0drMP-Fzbo",
    instagram:      "https://www.instagram.com/kmf.gent/",
    facebook:       "https://www.facebook.com/kringmoraalfilosofie",
    wikipedia:      "https://nl.wikipedia.org/wiki/Kring_Moraal_en_Filosofie",
    mail:           "kringmoraalenfilosofie@gmail.com",

    /* Het adres waar de site staat, zonder schuine streep op het einde —
       bijvoorbeeld "https://kmfgent.github.io/website".

       Dit is nodig voor het deelvoorbeeld. Deel je een link in een WhatsApp-
       groep of op Facebook, dan gaat die app zelf de pagina ophalen om er een
       kaartje van te maken met titel, tekst en beeld. Voor dat beeld heeft ze
       een volledig adres nodig: zij weet niet waar de site staat.

       Zolang dit leeg blijft, laat het bouwscript het deelvoorbeeld gewoon
       achterwege. Er gaat niets stuk; een gedeelde link toont dan alleen het
       kale adres, zoals nu. */
    site:           "https://2ks42sv8bx-ai.github.io/kmf-site"
  },

  /* ------------------------------------------------------------------------
     DE NAVIGATIE
     Dit is de enige plek waar de menubalk staat. Elke pagina bouwt haar eigen
     balk hieruit op en laat automatisch haar eigen naam weg — je staat er
     immers al op. Voeg je hier een regel toe, dan verschijnt die meteen op
     alle pagina's tegelijk.

     Vijf groepen, elk met een eigen kleur (zie css/kmf.css). Een regel met
     `pagina` wordt een link; een regel met `link` verwijst naar buiten; een
     regel met geen van beide staat er grijs bij als "nog niet gebouwd".
     ------------------------------------------------------------------------ */
  navigatie: [
    { thema: "doen", naam: "Wat we doen", items: [
      { naam: "Agenda",         pagina: "agenda.html" },
      { naam: "Foto's",         pagina: "fotos.html" }
    ]},
    { thema: "studie", naam: "Voor je studie", items: [
      { naam: "Samenvattingen", link: "samenvattingen" },   /* uit `links` hierboven */
      { naam: "Boeken",         pagina: "boeken.html" },
      { naam: "VSTN",           pagina: "vstn.html" },
      { naam: "Lichtung",       pagina: "lichtung.html" }
    ]},
    { thema: "meedoen", naam: "Meedoen", items: [
      { naam: "Lid worden",     pagina: "lid-worden.html" },
      { naam: "Merch",          pagina: "merch.html" }
    ]},
    { thema: "wij", naam: "Wie we zijn", items: [
      { naam: "Over ons",       pagina: "over.html" },
      { naam: "Presidium",      pagina: "presidium.html" },
      { naam: "Sponsors",       pagina: "sponsors.html" }
    ]},
    { thema: "hulp", naam: "Hulp en contact", items: [
      { naam: "Mentaal welzijn", pagina: "welzijn.html" },
      { naam: "Contact",         pagina: "contact.html" }
    ]}
  ],

  /* ------------------------------------------------------------------------
     WELKE SOORT ACTIVITEIT HOORT BIJ WELKE GROEP
     De vijf groepen van de navigatie hebben elk een kleur. Een activiteit
     hoort ook altijd bij één van die groepen — een lezing is iets anders dan
     een cantus. Door ze hier aan elkaar te koppelen, betekent een kleur op de
     hele site hetzelfde: groen is studie, of dat nu een boek is of een debat.

     Staat een soort hier niet bij, dan krijgt hij de kleur van "wat we doen",
     de groep waar de agenda zelf onder valt.
     ------------------------------------------------------------------------ */
  soorten: {
    /* Sociale activiteiten — de groep waar de agenda zelf onder valt. */
    "café-avond":       "doen",
    "cafe-avond":       "doen",
    "cantus":           "doen",
    "fuif":             "doen",
    "weekend":          "doen",
    "uitstap":          "doen",

    /* Alles waar je iets van opsteekt. */
    "lezing":           "studie",
    "debat":            "studie",
    "workshop":         "studie",
    "seminar":          "studie",
    "colloquium":       "studie",
    "boekvoorstelling": "studie",
    "leesgroep":        "studie",

    /* Meedoen met de kring. */
    "lid":              "meedoen",
    "lidworden":        "meedoen",
    "gebakdag":         "meedoen",

    /* De kring zelf. */
    "bestuur":          "wij",
    "presidium":        "wij",
    "alumni":           "wij",
    "statuten":         "wij",
    "ledenvergadering": "wij",
    "verkiezingen":     "wij",

    /* Zorg en contact. */
    "welzijn":          "hulp",
    "mentaal":          "hulp",
    "contact":          "hulp"
  },

  /* ------------------------------------------------------------------------
     DE LIJSTEN VAN DE ANDERE PAGINA'S
     Ze werken alle zes net als de agenda: zolang een lijst leeg is, zegt de
     pagina dat ze nog ingevuld moet worden. Zodra je er een blok in zet,
     bouwt de pagina zichzelf op. Je hoeft geen HTML aan te raken.
     ------------------------------------------------------------------------ */

  /* { naam:"Jan Janssens", functie:"Praeses", mail:"", beeld:"" } */
  presidium: [],

  /* { titel:"Naam van het boek", auteur:"", vak:"", prijs:"€12", tekst:"" } */
  boeken: [],

  /* { naam:"Trui", prijs:"€25", tekst:"", beeld:"" } */
  merch: [],

  /* { naam:"Naam van de sponsor", link:"https://…", beeld:"" } */
  sponsors: [],

  /* { titel:"Nummer 12 — herfst 2026", datum:"2026-11-01", link:"", tekst:"" } */
  vstn: [],

  /* { titel:"Titel van de bijdrage", datum:"2026-10-01", auteur:"", tekst:"", link:"" } */
  lichtung: [],

  /* { beeld:"img/kantus-2026.jpg", bijschrift:"Immanuel Kantus", datum:"2026-11-19" } */
  fotos: [],

  /* ------------------------------------------------------------------------
     DE ACTIVITEITEN
     Volgorde maakt niet uit — de site sorteert zelf op datum.
     ------------------------------------------------------------------------ */
  activiteiten: [

    {
      titel:    "Bestaat Gent eigenlijk wel?",
      soort:    "colloquium",
      start:    "2026-08-17",
      tijd:     "18:00",
      locatie:  "De geus",
    },
     
    {
      titel:   "Kantiaanse grabbel",
      soort:   "lezing",
      start:   "2026-08-15",
      tijd:    "19:00",
      locatie: "Jan Broeckx",
      spreker: "Bert",
    },

    {
      titel:   "Daoistisch gejank",
      soort:   "debat",
      start:   "2026-11-05",
      tijd:    "19:30",
      locatie: "Franz Cumont",
      spreker: "Johannes",    
    },

    {
      titel:   "Wittgenstein en wiskunde",
      soort:   "lezing",
      start:   "2026-12-05",
      tijd:    "19:00",
      locatie: "Suzanne Lilar",
      spreker: "Jan",
    }
  ]
};
