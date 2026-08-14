/* ==========================================================================
   KMF — opbouw van de pagina's
   --------------------------------------------------------------------------
   Hier hoef je niets aan te wijzigen. Alle inhoud staat in data/kmf-data.js.

   Wat dit bestand doet, in volgorde:
     1. elke activiteit nakijken, en fouten bovenaan de pagina tonen
     2. herhalingen uitrekenen (één café-avond wordt een heel semester)
     3. alles wat voorbij is weglaten
     4. sorteren op datum
     5. de hero en de agenda opbouwen
   ========================================================================== */

(function () {
	"use strict";

	var SOORTEN_MET_SPREKER = ["lezing", "debat"];
	var HERHALINGEN = { wekelijks: 7, tweewekelijks: 14, maandelijks: null };

	/* ---------------------------------------------------------------- datum */

	// "2026-11-19" -> Date op middernacht lokale tijd. Bewust niet new Date(s):
	// die leest een kale datumstring als UTC en schuift hem een dag op.
	function leesDatum(s) {
		var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || "").trim());
		if (!m) return null;
		var jaar = +m[1], maand = +m[2], dag = +m[3];
		var d = new Date(jaar, maand - 1, dag);
		if (d.getFullYear() !== jaar || d.getMonth() !== maand - 1 || d.getDate() !== dag) {
			return null; // bv. 2026-02-31
		}
		return d;
	}

	function vandaag() {
		var n = new Date();
		return new Date(n.getFullYear(), n.getMonth(), n.getDate());
	}

	// 19.11.26 — de puntnotatie van KASK, korter dan die van Opera en
	// leesbaarder in een smalle marge.
	function toonDatum(d) {
		var p = function (n) { return String(n).padStart(2, "0"); };
		return p(d.getDate()) + "." + p(d.getMonth() + 1) + "." + String(d.getFullYear()).slice(2);
	}

	// Meerdaags: 17.11 — 21.11.26, met het jaartal enkel achteraan.
	function toonPeriode(start, einde) {
		if (!einde || einde.getTime() === start.getTime()) return toonDatum(start);
		var p = function (n) { return String(n).padStart(2, "0"); };
		return p(start.getDate()) + "." + p(start.getMonth() + 1) + " — " + toonDatum(einde);
	}

	// Berekent de status in Sentence Case: Vandaag / Vanavond / Morgen / dag van de week.
	// Vanaf de volgende kalenderweek: geen status.
	function heroStatus(start, tijd) {
		var v = vandaag();
		var diff = Math.round((start - v) / (1000 * 60 * 60 * 24));
		if (diff < 0) return "";

		if (diff === 0) {
			var uur = parseInt(tijd, 10);
			return (!isNaN(uur) && uur < 17) ? "Vandaag" : "Vanavond";
		}
		if (diff === 1) return "Morgen";

		// Huidige kalenderweek loopt t.e.m. zondag (Ma=1 ... Zo=7)
		var isoDag = v.getDay() === 0 ? 7 : v.getDay();
		var dagenTotZondag = 7 - isoDag;

		if (diff <= dagenTotZondag) {
			var dagen = ["Zondag", "Maandag", "Dinsdag", "Woensdag", "Donderdag", "Vrijdag", "Zaterdag"];
			return dagen[start.getDay()];
		}

		return "";
	}

	/* ------------------------------------------------------------ nakijken */

	function keurNa(lijst) {
		var fouten = [];
		if (!Array.isArray(lijst)) {
			fouten.push("De lijst <code>activiteiten</code> ontbreekt in data/kmf-data.js.");
			return fouten;
		}

		lijst.forEach(function (a, i) {
			var naam = a && a.titel ? '"' + a.titel + '"' : "de activiteit op plaats " + (i + 1);

			if (!a || typeof a !== "object") {
				fouten.push("Plaats " + (i + 1) + " in de lijst is geen activiteit.");
				return;
			}
			if (!a.titel) {
				fouten.push("De activiteit op plaats " + (i + 1) + " heeft geen <code>titel</code>.");
			}
			if (!a.start) {
				fouten.push(naam + " heeft geen <code>start</code>.");
			} else if (!leesDatum(a.start)) {
				fouten.push(naam + " heeft een onleesbare <code>start</code>: <code>" + a.start +
					"</code>. Schrijf de datum als jaar-maand-dag, bijvoorbeeld <code>2026-11-19</code>.");
			}
			if (a.einde && !leesDatum(a.einde)) {
				fouten.push(naam + " heeft een onleesbare <code>einde</code>: <code>" + a.einde + "</code>.");
			}
			if (a.einde && leesDatum(a.einde) && leesDatum(a.start) &&
				leesDatum(a.einde) < leesDatum(a.start)) {
				fouten.push(naam + " eindigt vóór ze begint.");
			}
			if (a.herhaling) {
				if (!(a.herhaling in HERHALINGEN)) {
					fouten.push(naam + " heeft een onbekende <code>herhaling</code>: <code>" + a.herhaling +
						"</code>. Kies uit wekelijks, tweewekelijks of maandelijks.");
				} else if (!a.herhaling_tot) {
					fouten.push(naam + " herhaalt zich maar heeft geen <code>herhaling_tot</code>, " +
						"dus weet de site niet wanneer ze moet stoppen.");
				} else if (!leesDatum(a.herhaling_tot)) {
					fouten.push(naam + " heeft een onleesbare <code>herhaling_tot</code>: <code>" +
						a.herhaling_tot + "</code>.");
				}
			}
		});

		return fouten;
	}

	function toonFouten(fouten) {
		var balk = document.createElement("div");
		balk.className = "fouten";
		balk.setAttribute("role", "alert");
		balk.innerHTML =
			"<p>Er staat iets fout in <code>data/kmf-data.js</code> — de agenda is daardoor onvolledig.</p><ul>" +
			fouten.map(function (f) { return "<li>" + f + "</li>"; }).join("") + "</ul>";
		document.body.insertBefore(balk, document.body.firstChild);
	}

	/* --------------------------------------------------------- uitrekenen */

	// Eén blok met herhaling wordt een reeks losse data. Zo staat de
	// tweewekelijkse café-avond één keer in het bestand, en toch elke keer
	// apart in de agenda.
	function rolUit(a) {
		if (!a.titel) return [];
		var start = leesDatum(a.start);
		if (!start) return [];
		var einde = a.einde ? leesDatum(a.einde) : null;
		return [maakGeval(a, start, einde)];
	}

	function maakGeval(a, start, einde) {
		return {
			titel: a.titel,
			soort: a.soort || "",
			spreker: a.spreker || "",
			tijd: a.tijd || "",
			locatie: a.locatie || "",
			tekst: a.tekst || "",
			voetnoot: a.voetnoot || "",
			link: a.link || "",
			beeld: a.beeld || "",
			start: start,
			einde: einde
		};
	}

	function komendeActiviteiten(lijst) {
		var grens = vandaag();
		var alles = [];

		(lijst || []).forEach(function (a) {
			rolUit(a).forEach(function (g) { alles.push(g); });
		});

		var komende = alles
			// Voorbij is voorbij. Oude blokken mogen in het bestand blijven
			// staan; ze verdwijnen hier vanzelf.
			.filter(function (g) { return (g.einde || g.start) >= grens; })
			.sort(function (x, y) { return x.start - y.start; });

		// Wie al eens voorbijkwam, krijgt geen tweede keer dezelfde uitleg.
		// Dit gebeurt ná het filteren, zodat de eerste die nog moet komen de
		// tekst draagt — ook als de echte eerste van de reeks al voorbij is.
		var gezien = {};
		komende.forEach(function (g) {
			var sleutel = g.titel.toLowerCase();
			g.herhaald = gezien[sleutel] === true;
			gezien[sleutel] = true;
		});

		return komende;
	}

	/* ------------------------------------------------------------ opbouwen */

	function el(tag, klasse, tekst) {
		var n = document.createElement(tag);
		if (klasse) n.className = klasse;
		if (tekst != null) n.textContent = tekst;
		return n;
	}

	// Boven de titel staat alleen wanneer het is. Waar het is, wie er spreekt en
	// wat voor soort activiteit het is, staat eronder — die bovenregel bleef
	// anders maar aangroeien tot je ze niet meer in één oogopslag las.
	function bouwMarge(g) {
		var marge = el("div", "marge");
		var status = heroStatus(g.start, g.tijd);

		if (status) marge.appendChild(el("span", "status", status));
		// Staat er "Vandaag" of "Morgen", dan zegt de datum niets meer. Bij een
		// dagnaam verderop in de week blijft ze wel staan: "Zaterdag" alleen
		// laat je nog altijd zoeken welke zaterdag.
		if (!vlakbij(status)) {
			marge.appendChild(el("span", "datum", toonPeriode(g.start, g.einde)));
		}
		if (g.tijd) marge.appendChild(el("span", "uur", g.tijd));

		return marge;
	}

	function vlakbij(status) {
		return status === "Vandaag" || status === "Vanavond" || status === "Morgen";
	}

	// Onder de titel: plaats, spreker, soort.
	function bouwDetails(g) {
		var delen = [];
		if (g.locatie) delen.push(el("span", "plaats", g.locatie));
		if (g.spreker && SOORTEN_MET_SPREKER.indexOf(g.soort) !== -1) {
			delen.push(el("span", "spreker", g.spreker));
		}
		// Staat de soort al in de titel — "Café-avond" met soort "café-avond" —
		// dan zwijgen we erover. Twee keer hetzelfde woord zegt niets extra.
		if (g.soort && !zelfdeWoord(g.soort, g.titel)) {
			delen.push(el("span", "soort", g.soort));
		}
		if (!delen.length) return null;

		var regel = el("p", "details");
		delen.forEach(function (deel) { regel.appendChild(deel); });
		return regel;
	}

	// Elke soort activiteit hoort bij een van de vijf groepen uit de navigatie.
	// Zo betekent een kleur overal hetzelfde: groen is studie, of het nu een
	// boek is of een debat. Onbekende soorten vallen terug op de groep waar de
	// agenda zelf onder valt.
	function groepVanSoort(soort) {
		var tabel = (window.KMF && window.KMF.soorten) || {};
		return tabel[String(soort || "").trim().toLowerCase()] || "doen";
	}

	function zelfdeWoord(a, b) {
		return String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
	}

	// Eén rij van het raster: gegevens | titel | tekst.
	function bouwItem(g) {
		var li = el("li", "item rij thema-" + groepVanSoort(g.soort));

		li.appendChild(bouwMarge(g));

		var maat = el("div", "maat");
		var titel = el("h3", "titel");

		if (g.link) {
			var a = el("a", null, g.titel);
			a.href = g.link;
			a.rel = "noopener";
			titel.appendChild(a);
		} else {
			titel.textContent = g.titel;
		}
		maat.appendChild(titel);

		var details = bouwDetails(g);
		if (details) maat.appendChild(details);

		// Bij een herhaling staat de uitleg alleen bij de eerste keer. De
		// café-avond van december is dezelfde als die van oktober; die tekst
		// zes keer onder elkaar herhalen voegt niets toe.
		if (g.tekst && !g.herhaald) maat.appendChild(el("p", "tekst", g.tekst));

		if (g.link) {
			var verder = el("a", "verder");
			verder.href = g.link;
			verder.rel = "noopener";
			verder.appendChild(el("span", "tekstje", "meer"));
			verder.appendChild(el("span", "pijl", "→"));
			maat.appendChild(verder);
		}

		li.appendChild(maat);

		return li;
	}

	function bouwLijst(doel, gevallen) {
		if (!doel) return;
		doel.innerHTML = "";

		if (!gevallen.length) {
			doel.appendChild(el("p", "leeg",
				"Er staat nog niets gepland. Voeg een activiteit toe in data/kmf-data.js."));
			return;
		}

		var ul = el("ul", "lijst");
		gevallen.forEach(function (g) { ul.appendChild(bouwItem(g)); });
		doel.appendChild(ul);
	}

	// De titel wordt zo groot gezet als hij kan zonder uit de kolom te lopen.
	// Daarom staat er geen vaste korpsgrootte in de CSS: een korte titel als
	// "Café-avond" vult de breedte, een lange loopt over meer regels en wordt
	// vanzelf kleiner. We zoeken de grootste maat waarbij niets uitsteekt.
	function pasTitelIn(titel) {
		var MIN = 28, MAX = 220, MAX_LIJNEN = 3;

		var breedte = titel.clientWidth;
		if (!breedte) return;

		titel.style.fontSize = MAX + "px";
		// Steekt het langste woord uit, dan is de maat sowieso te groot.
		var past = function (px) {
			titel.style.fontSize = px + "px";
			return titel.scrollWidth <= titel.clientWidth + 1 &&
				titel.scrollHeight <= px * MAX_LIJNEN + 1;
		};

		var laag = MIN, hoog = MAX;
		if (past(MAX)) { laag = MAX; }
		else {
			// Twintig halveringen brengen ons op minder dan een pixel nauwkeurig.
			for (var i = 0; i < 20; i++) {
				var midden = (laag + hoog) / 2;
				if (past(midden)) laag = midden; else hoog = midden;
			}
		}
		titel.style.fontSize = Math.floor(laag) + "px";
	}

	// Meten heeft pas zin als de letter binnen is: met de terugvalletter erin
	// komt er een andere breedte uit en staat de titel achteraf te klein.
	function pasHeroIn() {
		var titel = document.querySelector('.hero .titel');
		if (titel) pasTitelIn(titel);
	}

	function volgHeroMaat() {
		if (document.fonts && document.fonts.ready) {
			document.fonts.ready.then(pasHeroIn);
		}
		pasHeroIn();

		var wacht;
		window.addEventListener("resize", function () {
			clearTimeout(wacht);
			wacht = setTimeout(pasHeroIn, 150);
		});
	}

	// Is er een foto, dan komt die eronder; is er geen, dan blijft het
	// accentvlak staan en verandert er verder niets aan de zetting.
	function themaVanSoort(soort) {
		var s = String(soort || "").trim().toLowerCase();
		var kaart = {
			"cafe-avond": "doen",
			"caf\u00e9-avond": "doen",
			"cantus": "doen",
			"fuif": "doen",
			"weekend": "doen",
			"uitstap": "doen",
			"workshop": "studie",
			"lezing": "studie",
			"debat": "studie",
			"seminar": "studie",
			"colloquium": "studie",
			"lid": "meedoen",
			"lidworden": "meedoen",
			"bestuur": "wij",
			"presidium": "wij",
			"alumni": "wij",
			"statuten": "wij",
			"welzijn": "hulp",
			"mentaal": "hulp",
			"contact": "hulp"
		};
		return kaart[s] || "";
	}

	function bouwHero(doel, g) {
		if (!doel) return;
		doel.innerHTML = "";
		doel.dataset.thema = g && g.soort ? themaVanSoort(g.soort) : "";

		var inhoud = el("div", "inhoud");

		if (!g) {
			inhoud.appendChild(el("h2", "titel", "Tot binnenkort"));
			var leegGegevens = el("div", "gegevens label");
			leegGegevens.appendChild(el("span", null, "Geen activiteiten gepland"));
			inhoud.appendChild(leegGegevens);
			doel.appendChild(inhoud);
			return;
		}

		if (g.beeld) {
			doel.classList.add("met-beeld");
			var img = el("img", "beeld");
			img.src = g.beeld;
			img.alt = "";
			doel.appendChild(img);
		}

		// Elk woord apart, zodat er nooit middenin een woord wordt afgebroken.
		// Anders valt "Café-avond" uiteen in "Café -" en "avond", met een
		// bengelend streepje op het einde van de regel.
		var titel = el("h2", "titel");
		g.titel.split(/\s+/).forEach(function (woord, i) {
			if (i) titel.appendChild(document.createTextNode(" "));
			titel.appendChild(el("span", "woord", woord));
		});
		inhoud.appendChild(titel);

		var gegevens = el("div", "gegevens label");
		var status = heroStatus(g.start, g.tijd);
		if (status) {
			gegevens.appendChild(el("span", "soort", status));
		}
		if (!vlakbij(status)) {
			gegevens.appendChild(el("span", null, toonPeriode(g.start, g.einde)));
		}
		if (g.tijd) gegevens.appendChild(el("span", null, g.tijd));
		if (g.locatie) gegevens.appendChild(el("span", null, g.locatie));
		if (g.soort && !zelfdeWoord(g.soort, g.titel)) {
			gegevens.appendChild(el("span", "soort", g.soort));
		}
		doel.setAttribute("data-groep", groepVanSoort(g.soort));
		inhoud.appendChild(gegevens);

		doel.appendChild(inhoud);
	}

	/* ----------------------------------------------------------------- start */

	// Het databestand wordt hier ingeladen, en niet met een <script> in de
	// HTML. Reden: browsers houden zo'n bestand hardnekkig in hun cache, en
	// dan zie je na het bewaren van je wijziging gewoon de oude agenda staan.
	// Door er een tijdstempel achter te plakken is het telkens een nieuw adres
	// en krijg je altijd wat je net getypt hebt. Dit werkt ook wanneer je de
	// pagina rechtstreeks vanaf je schijf opent.
	function laadData(klaar) {
		if (window.KMF) return klaar();

		// Eerste poging met tijdstempel. Lukt dat niet — sommige browsers doen
		// moeilijk over een vraagteken achter een bestand op de harde schijf —
		// dan gewoon nog eens zonder.
		var mislukt = function () {
			toonFouten(["Het bestand <code>data/kmf-data.js</code> kon niet geladen worden. " +
				"Staat het nog in de map <code>data</code>?"]);
		};

		haalScript("data/kmf-data.js?t=" + Date.now(), function () { haalAgenda(klaar); }, function () {
			haalScript("data/kmf-data.js", function () { haalAgenda(klaar); }, mislukt);
		});
	}

	// De agenda komt uit de spreadsheet en wordt elk uur door GitHub in
	// data/agenda.js gezet. Bestaat dat bestand niet — bijvoorbeeld omdat je
	// lokaal aan het werken bent — dan valt de site terug op de activiteiten
	// die in data/kmf-data.js staan.
	function haalAgenda(klaar) {
		haalScript("data/agenda.js?t=" + Date.now(), klaar, function () { klaar(); });
	}

	function haalScript(bron, gelukt, mislukt) {
		var s = document.createElement("script");
		s.src = bron;
		s.onload = function () { window.KMF ? gelukt() : mislukt(); };
		s.onerror = mislukt;
		document.head.appendChild(s);
	}

	/* --------------------------------------------------------- de navigatie */

	// Welke pagina staat er open? Zonder bestandsnaam in het adres is dat de
	// startpagina — zo werkt zowel kmf.be/ als kmf.be/index.html.
	function huidigePagina() {
		var pad = location.pathname.split("/").pop();
		return pad === "" ? "index.html" : pad;
	}

	// De balk wordt hier gebouwd en niet in elke pagina apart overgetypt. Dat
	// scheelt niet alleen werk: toen ze nog met de hand in elk bestand stond,
	// heette het tijdschrift op de ene pagina VSTN en op de andere "Van stof
	// tot nadenken". Eén lijst, dus dat kan niet meer.
	function bouwNavigatie(data) {
		var doelen = document.querySelectorAll('nav.nav, nav.index');
		if (!doelen.length) return;

		var hier = huidigePagina();
		var groepen = data.navigatie || [];

		doelen.forEach(function (nav) {
			var index = nav.classList.contains("index");
			nav.innerHTML = "";

			var houder = nav;
			if (index) {
				houder = el("div", "lijstjes");
				nav.appendChild(houder);
			} else {
				// Op elke andere pagina staat de weg terug vooraan.
				var terug = el("div", "groep");
				terug.appendChild(maakNavLink({ naam: "Startpagina", pagina: "index.html" }, data));
				houder.appendChild(terug);
			}

			groepen.forEach(function (groep) {
				var items = groep.items || [];
				if (!items.length) return;

				var vak = el("div", "groep " + (groep.thema || ""));
				items.forEach(function (item) {
					var link = maakNavLink(item, data);
					// De pagina waar je op staat, komt niet in haar eigen balk —
					// maar ze blijft wel in de opbouw staan, want de balk wordt
					// op de volledige lijst opgemeten. Deed hij dat niet, dan
					// kreeg elke pagina andere gaten en verschoof de balk bij
					// elke klik.
					if (item.pagina === hier) link.classList.add("hier");
					vak.appendChild(link);
				});
				houder.appendChild(vak);
			});
		});
	}

	// De balk moet één regel blijven. Vaste gaten kunnen dat niet garanderen —
	// hoeveel plaats er over is, hangt af van hoe breed de woorden zelf zijn.
	// Dus meten we: eerst wat alle items samen innemen, dan verdelen we de rest
	// over de gaten. Een gat tussen twee groepen krijgt RUIMER keer zoveel als
	// een gat binnen een groep, zodat de vijf groepen zichtbaar blijven.
	var RUIMER = 2.4;
	var GAT_MIN = 7;      // px — krapper wordt onleesbaar
	var GAT_MAX = 22;
	var MAAT_MIN = 10.5;  // px — kleiner zetten we de balk niet

	function pasNavIn() {
		var nav = document.querySelector("nav.nav");
		if (!nav) return;

		var groepen = [].slice.call(nav.querySelectorAll(".groep"));
		var items = [].slice.call(nav.querySelectorAll("a, .stub"));
		if (!groepen.length || !items.length) return;

		nav.classList.remove("een-regel");
		nav.style.removeProperty("--nav-maat");

		// Meet altijd met álle bestemmingen zichtbaar, ook die van deze pagina.
		// Zo krijgt elke pagina exact dezelfde gaten en dezelfde lettermaat.
		nav.classList.add("meten");
		nav.querySelectorAll(".groep").forEach(function (g) { g.classList.remove("leeg"); });

		var stijl = getComputedStyle(nav);
		var beschikbaar = nav.clientWidth
			- parseFloat(stijl.paddingLeft) - parseFloat(stijl.paddingRight);

		var nBinnen = items.length - groepen.length;   // gaten binnen de groepen
		var nTussen = groepen.length - 1;              // gaten tussen de groepen

		function breedteVanItems() {
			var som = 0;
			for (var i = 0; i < items.length; i++) som += items[i].getBoundingClientRect().width;
			return som;
		}

		function krapstNodig() {
			return breedteVanItems() + (nBinnen + nTussen * RUIMER) * GAT_MIN;
		}

		// Past het niet met de krapste gaten, dan de letter stap voor stap
		// kleiner zetten tot het wel past.
		var maat = parseFloat(getComputedStyle(items[0]).fontSize);
		while (maat > MAAT_MIN && krapstNodig() > beschikbaar) {
			maat -= 0.5;
			nav.style.setProperty("--nav-maat", maat + "px");
		}

		// Nog altijd te breed — dertien bestemmingen op een smalle telefoon —
		// dan liever afbreken dan tekst die van het scherm loopt. En als ze
		// tóch over meerdere regels gaat, hoeft ze ook niet klein meer te zijn:
		// de letter gaat terug naar zijn gewone maat.
		if (krapstNodig() > beschikbaar) {
			// Blijft afbreken, met gewone gaten en op gewone grootte.
			nav.style.removeProperty("--nav-maat");
			nav.style.setProperty("--gat-binnen", "0.7rem");
			nav.style.setProperty("--gat-tussen", "1.65rem");
			verbergHuidige(nav);
			return;
		}

		nav.classList.add("een-regel");

		var over = beschikbaar - breedteVanItems();
		var eenheid = over / (nBinnen + nTussen * RUIMER);
		var binnen = Math.max(GAT_MIN, Math.min(GAT_MAX, eenheid));

		nav.style.setProperty("--gat-binnen", binnen + "px");
		nav.style.setProperty("--gat-tussen", (binnen * RUIMER) + "px");

		verbergHuidige(nav);
	}

	// Meten is gebeurd: haal de huidige pagina uit beeld, en verberg een groep
	// die daardoor niets meer over heeft.
	function verbergHuidige(nav) {
		nav.classList.remove("meten");
		nav.querySelectorAll(".groep").forEach(function (groep) {
			var zichtbaar = [].slice.call(groep.children).filter(function (k) {
				return !k.classList.contains("hier");
			});
			if (!zichtbaar.length) groep.classList.add("leeg");
		});
	}

	function volgNavMaat() {
		if (document.fonts && document.fonts.ready) document.fonts.ready.then(pasNavIn);
		pasNavIn();

		var wacht;
		window.addEventListener("resize", function () {
			clearTimeout(wacht);
			wacht = setTimeout(pasNavIn, 120);
		});
	}

	function maakNavLink(item, data) {
		var adres = item.pagina;
		if (!adres && item.link) adres = (data.links || {})[item.link] || item.link;

		if (!adres) {
			var stuk = el("span", "stub", item.naam);
			stuk.title = "Nog niet gebouwd";
			return stuk;
		}

		var a = el("a", null, item.naam);
		a.href = adres;
		if (!item.pagina) { a.target = "_blank"; a.rel = "noopener"; }
		return a;
	}

	/* ------------------------------------------------------ licht en donker */

	// De site volgt standaard de instelling van je toestel. Deze schakelaar
	// laat je zelf kiezen en onthoudt dat. Hij wordt hier gebouwd en staat niet
	// in de HTML: zonder JavaScript zou hij toch niets doen, en dan hoort hij
	// er ook niet te staan.
	function bouwThemaKnop() {
		var voet = document.querySelector(".voet .links");
		if (!voet || voet.querySelector(".thema-knop")) return;

		var knop = el("button", "thema-knop label");
		knop.type = "button";

		function huidig() {
			var gekozen = document.documentElement.getAttribute("data-thema");
			if (gekozen) return gekozen;
			return window.matchMedia("(prefers-color-scheme: dark)").matches ? "donker" : "licht";
		}

		function toon() {
			var straks = huidig() === "donker" ? "licht" : "donker";
			// Op de knop staat waar je naartoe gaat, niet waar je bent.
			knop.textContent = straks === "donker" ? "Donkere modus" : "Lichte modus";
			knop.setAttribute("aria-label", "Schakel naar " + knop.textContent.toLowerCase());
		}

		knop.addEventListener("click", function () {
			var straks = huidig() === "donker" ? "licht" : "donker";
			document.documentElement.setAttribute("data-thema", straks);
			try { localStorage.setItem("kmf-thema", straks); } catch (e) {}
			toon();
		});

		// Heb je nog niets gekozen en verzet je je toestel, dan volgt de site mee.
		window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", toon);

		toon();
		voet.appendChild(knop);
	}

	/* ------------------------------------------------- de andere pagina's */

	// Alle lijstpagina's lezen als de agenda: nummer, gegevensregel, grote
	// titel, tekst. Wat er per soort in de gegevensregel hoort, staat hier.
	var LIJSTEN = {
		presidium: { gegevens: ["functie"], titel: "naam", tekst: "tekst", mail: "mail", beeld: "beeld" },
		boeken:    { gegevens: ["vak", "prijs"], titel: "titel", tekst: "tekst", onder: "auteur" },
		merch:     { gegevens: ["prijs"], titel: "naam", tekst: "tekst", beeld: "beeld" },
		sponsors:  { gegevens: [], titel: "naam", tekst: "tekst", link: "link", beeld: "beeld" },
		vstn:      { gegevens: ["datum"], titel: "titel", tekst: "tekst", link: "link" },
		lichtung:  { gegevens: ["datum", "auteur"], titel: "titel", tekst: "tekst", link: "link" }
	};

	function bouwPaginaLijst(doel, soort, rijen) {
		var vorm = LIJSTEN[soort];
		if (!doel || !vorm) return;

		doel.innerHTML = "";

		if (!rijen || !rijen.length) {
			doel.appendChild(maakInvulblok(soort));
			return;
		}

		var ul = el("ul", "lijst");

		// Precies dezelfde rij als in de agenda: gegevens boven, dan de titel,
		// dan de tekst. Zo is elke pagina van de site uit hetzelfde blok gemaakt.
		rijen.forEach(function (rij) {
			var li = el("li", "item rij");

			var marge = el("div", "marge");
			vorm.gegevens.forEach(function (veld) {
				if (rij[veld]) marge.appendChild(el("span", veld, rij[veld]));
			});
			if (marge.childNodes.length) li.appendChild(marge);

			if (vorm.beeld) li.appendChild(maakBeeld(rij[vorm.beeld]));

			var maat = el("div", "maat");

			var titel = el("h2", "titel");
			var adres = vorm.link && rij[vorm.link];
			if (adres) {
				var a = el("a", null, rij[vorm.titel]);
				a.href = adres; a.rel = "noopener"; a.target = "_blank";
				titel.appendChild(a);
			} else {
				titel.textContent = rij[vorm.titel] || "";
			}
			maat.appendChild(titel);

			if (vorm.onder && rij[vorm.onder]) maat.appendChild(el("p", "tekst", rij[vorm.onder]));
			if (vorm.tekst && rij[vorm.tekst]) maat.appendChild(el("p", "tekst", rij[vorm.tekst]));

			if (vorm.mail && rij[vorm.mail]) {
				var m = el("a", "verder");
				m.href = "mailto:" + rij[vorm.mail];
				m.appendChild(el("span", "tekstje", rij[vorm.mail]));
				maat.appendChild(m);
			}

			li.appendChild(maat);
			ul.appendChild(li);
		});

		doel.appendChild(ul);
	}

	// Zolang er geen foto is, staat er een vlak in de kleur van het thema. Zo
	// zie je waar een beeld komt zonder dat de pagina er stuk uitziet.
	function maakBeeld(bron) {
		if (!bron) {
			var vlak = el("div", "beeldplek");
			vlak.appendChild(el("span", "label", "Beeld"));
			return vlak;
		}
		var img = el("img", "beeldplek beeld");
		img.src = bron;
		img.alt = "";
		img.loading = "lazy";
		return img;
	}

	function bouwFotos(doel, fotos) {
		if (!doel) return;
		doel.innerHTML = "";

		if (!fotos || !fotos.length) {
			doel.appendChild(maakInvulblok("fotos"));
			return;
		}

		var rooster = el("div", "rooster");
		fotos.forEach(function (f) {
			var fig = el("figure", "kiek");
			fig.appendChild(maakBeeld(f.beeld));
			if (f.bijschrift) fig.appendChild(el("figcaption", "label", f.bijschrift));
			rooster.appendChild(fig);
		});
		doel.appendChild(rooster);
	}

	// Een pagina die nog geschreven moet worden, zegt dat met één woord.
	function maakInvulblok(sleutel, eigenLijn) {
		var blok = el("div", "invullen" + (eigenLijn === false ? "" : " rij"));
		blok.appendChild(el("p", "label", "WIP"));
		return blok;
	}

	function bouwTekstblok(doel) {
		if (!doel || doel.textContent.trim() !== "") return;
		doel.appendChild(maakInvulblok(doel.getAttribute("data-kmf-bestand") || "deze pagina", false));
	}

	/* ----------------------------------------------------------------- start */

	function start() {
		var data = window.KMF;

		if (!data) {
			toonFouten(["Het bestand <code>data/kmf-data.js</code> is geladen, maar bevat geen " +
				"<code>window.KMF</code>. Is de eerste regel per ongeluk gewist?"]);
			return;
		}

		bouwNavigatie(data);
		bouwThemaKnop();

		var uitSpreadsheet = Array.isArray(window.KMF_AGENDA);
		var lijst = uitSpreadsheet ? window.KMF_AGENDA : data.activiteiten;

		var fouten = (window.KMF_AGENDA_FOUTEN || []).slice();
		fouten = fouten.concat(keurNa(lijst));
		if (fouten.length) toonFouten(fouten);

		var komende = komendeActiviteiten(lijst);

		bouwHero(document.querySelector('[data-kmf="hero"]'), komende[0]);
		bouwLijst(document.querySelector('[data-kmf="agenda"]'), komende);

		Object.keys(LIJSTEN).forEach(function (soort) {
			bouwPaginaLijst(document.querySelector('[data-kmf="' + soort + '"]'), soort, data[soort]);
		});
		bouwFotos(document.querySelector('[data-kmf="fotos"]'), data.fotos);

		document.querySelectorAll('[data-kmf="tekst"]').forEach(bouwTekstblok);

		volgHeroMaat();
		volgNavMaat();
	}

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", function () { laadData(start); });
	} else {
		laadData(start);
	}
})();
