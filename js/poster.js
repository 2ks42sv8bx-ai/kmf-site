/* ==========================================================================
   KMF — het postergereedschap
   --------------------------------------------------------------------------
   Een poster is de hero van de startpagina, op posterformaat. Dat is de hele
   gedachte: een vlak in de kleur van de groep óf een beeld over de volle
   plaat, de titel zo groot als hij kan, en daaronder de gegevens in kleine
   kapitalen. Dezelfde letter, dezelfde kleuren, dezelfde datumnotatie als de
   agenda — er komt geen tweede vormtaal bij.

   Wat hier gebeurt, in volgorde:
     1. de gegevens ophalen (uit de agenda, of wat je zelf typt)
     2. de bladspiegel uitrekenen: eerst de gegevensregel onderaan, dan het
        wapen ernaast, en met wat er overblijft de grootste titel die past
     3. tekenen — beeld, sluier, titel, gegevens, wapen
     4. hetzelfde nog eens, maar dan op ware grootte, en bewaren als PNG

   Alle maten staan in eenheden van een plaat die duizend breed is. Het
   voorbeeld op het scherm en het bestand dat je bewaart worden op precies
   dezelfde manier getekend, alleen op een andere schaal. Wat je ziet is dus
   wat je krijgt.
   ========================================================================== */

(function () {
	"use strict";

	/* -------------------------------------------------------------- formaten */

	var FORMATEN = [
		{ sleutel: "post",    naam: "Instagram-post",    breedte: 1080, hoogte: 1080 },
		{ sleutel: "verhaal", naam: "Instagram-verhaal", breedte: 1080, hoogte: 1920 },
		// Het beeld dat verschijnt wanneer iemand een link naar de site deelt in
		// een groepsgesprek of op Facebook. 1200 bij 630 is wat die apps zelf
		// vragen; toevallig bijna precies de verhouding van de hero, waardoor
		// hier niets aan de zetting hoeft te veranderen. Bewaren onder
		// img/deelbeeld.png — het bouwscript pikt hem daar op.
		{ sleutel: "deelbeeld", naam: "Deelbeeld",      breedte: 1200, hoogte: 630 },
		// A3 op 300 punten per duim: 297 bij 420 mm. Dat is een plaat van
		// zeventien miljoen beeldpunten — bewaren duurt daar een paar tellen.
		{ sleutel: "affiche", naam: "Affiche A3",        breedte: 3508, hoogte: 4961 }
	];

	// De breedte waarin gerekend wordt. Elke maat hieronder is een duizendste
	// van de plaatbreedte, welk formaat je ook kiest.
	var REF = 1000;

	var LETTER = "'Inter', 'Helvetica Neue', Helvetica, Arial, sans-serif";

	/* ---------------------------------------------------------- de maatvoering
	   Weinig maten, net als op de site. De rand is vier procent van de breedte
	   — bijna tegen de kant, zoals de hele site tegen de linkerkant plakt. Op
	   een A3 is dat twaalf millimeter; genoeg om niet weggesneden te worden. */

	var RAND = 40;          // afstand tot de rand van de plaat
	// Tussen de titel en de gegevens eronder. Ruimer dan in de hero: daar zit je
	// er met je neus bovenop, een affiche wordt van een paar meter gelezen en de
	// staart van een g mag dan niet in de gegevensregel hangen.
	var GAT = 54;
	var WAPEN_H = 76;       // hoogte van het schild
	var GEGEVENS = 27;      // korpsgrootte van de gegevensregel
	var GEGEVENS_GAT = 44;  // tussen twee gegevens — geen scheidingsteken
	var GEGEVENS_REGEL = 1.45;
	var TITEL_MIN = 34;
	var TITEL_MAX = 300;

	/* ------------------------------------------------------------------ staat */

	var staat = {
		formaat: "post",
		titel: "",
		datum: "",
		tijd: "",
		locatie: "",
		spreker: "",
		soort: "",
		toon: { datum: true, tijd: true, locatie: true, spreker: true, soort: true, wapen: true },
		beeld: null,
		zoom: 1,
		panX: 0,
		panY: 0
	};

	var komende = [];
	var wapen = null;

	var doek, ctx;

	/* ------------------------------------------------------------- gereedschap */

	function el(tag, klasse, tekst) {
		var n = document.createElement(tag);
		if (klasse) n.className = klasse;
		if (tekst != null) n.textContent = tekst;
		return n;
	}

	function hulp() { return window.KMF_HULP || {}; }

	// De kleur van de groep zoals ze op papier terechtkomt. Bewust niet
	// --thema-*: die wordt in de donkere modus opgehaald, en dan zou een poster
	// die je 's avonds maakt lichter uitvallen dan een die je 's ochtends maakt.
	function papierkleur(groep) {
		var stijl = getComputedStyle(document.documentElement);
		var kleur = stijl.getPropertyValue("--papier-" + groep).trim();
		return kleur || stijl.getPropertyValue("--papier-doen").trim() || "#B93A57";
	}

	function groepNu() {
		var f = hulp().groepVanSoort;
		return f ? f(staat.soort) : "doen";
	}

	// Staat er een echte datum, dan zetten we ze zoals de agenda dat doet:
	// 19.11.26. Staat er iets anders — "elke twee weken", "onder voorbehoud" —
	// dan drukken we gewoon af wat je getypt hebt.
	function datumTekst() {
		var ruw = staat.datum.trim();
		if (!ruw) return "";
		var d = hulp().leesDatum ? hulp().leesDatum(ruw) : null;
		return d ? hulp().toonDatum(d) : ruw;
	}

	function formaatNu() {
		for (var i = 0; i < FORMATEN.length; i++) {
			if (FORMATEN[i].sleutel === staat.formaat) return FORMATEN[i];
		}
		return FORMATEN[0];
	}

	/* --------------------------------------------------------------- tekenen */

	// De gegevens die op de poster komen, in de volgorde van de agenda: wanneer,
	// hoe laat, waar, wie, en wat voor soort. Wat je uitvinkt of leeg laat, laat
	// gewoon een plek weg — er blijft geen scheidingsteken achter.
	//
	// De status van de hero ("Vanavond", "Morgen") staat er bewust niet bij. Een
	// poster hangt er dagen op voor hij gelezen wordt; "vanavond" zou dan al
	// twee weken niet meer kloppen.
	function gegevensLijst() {
		var uit = [];
		if (staat.toon.datum && datumTekst()) uit.push(datumTekst());
		if (staat.toon.tijd && staat.tijd.trim()) uit.push(staat.tijd.trim());
		if (staat.toon.locatie && staat.locatie.trim()) uit.push(staat.locatie.trim());
		if (staat.toon.spreker && staat.spreker.trim()) uit.push(staat.spreker.trim());
		if (staat.toon.soort && staat.soort.trim()) uit.push(staat.soort.trim());
		return uit.map(function (s) { return s.toUpperCase(); });
	}

	// Zet de letterinstelling. letterSpacing kent niet elke browser; waar hij
	// hem niet kent valt hij vanzelf weg en wordt de titel een haartje breder.
	// Dat is geen ramp: er wordt gemeten mét dezelfde instelling, dus de titel
	// past hoe dan ook.
	function zetLetter(c, gewicht, maat, spatie) {
		c.font = gewicht + " " + maat + "px " + LETTER;
		try { c.letterSpacing = spatie; } catch (e) {}
	}

	// Greedy: woorden aanschuiven tot de regel vol is. Past één woord op zichzelf
	// al niet, dan is de maat te groot en geven we op — zo breekt er nooit iets
	// middenin een woord af, net als in de hero.
	function breekWoorden(c, woorden, maxB) {
		var regels = [], huidige = "";
		for (var i = 0; i < woorden.length; i++) {
			if (c.measureText(woorden[i]).width > maxB) return null;
			var poging = huidige ? huidige + " " + woorden[i] : woorden[i];
			if (c.measureText(poging).width <= maxB) {
				huidige = poging;
			} else {
				regels.push(huidige);
				huidige = woorden[i];
			}
		}
		if (huidige) regels.push(huidige);
		return regels;
	}

	// Hetzelfde, maar voor losse gegevens met een vast gat ertussen.
	function breekDelen(c, delen, maxB) {
		var regels = [], huidige = [], breed = 0;
		delen.forEach(function (d) {
			var w = c.measureText(d).width;
			var erbij = huidige.length ? GEGEVENS_GAT + w : w;
			if (huidige.length && breed + erbij > maxB) {
				regels.push(huidige);
				huidige = [d];
				breed = w;
			} else {
				huidige.push(d);
				breed += erbij;
			}
		});
		if (huidige.length) regels.push(huidige);
		return regels;
	}

	// Waar het beeld terechtkomt. Het vult altijd de hele plaat; wat er buiten
	// valt is wat je met slepen en zoomen kiest.
	function beeldkader(W, H) {
		var b = staat.beeld;
		var dek = Math.max(W / b.naturalWidth, H / b.naturalHeight);
		var s = dek * staat.zoom;
		var bw = b.naturalWidth * s, bh = b.naturalHeight * s;
		return {
			breedte: bw,
			hoogte: bh,
			speling: { x: Math.max(0, (bw - W) / 2), y: Math.max(0, (bh - H) / 2) }
		};
	}

	function teken(c, plaatB, plaatH) {
		var k = plaatB / REF;
		var W = REF, H = plaatH / k;

		// Eén uitzondering op de rand, en ze komt niet van de vormgeving maar van
		// Instagram: over de onderste strook van een verhaal legt de app haar
		// eigen knoppen. Tekst die daar staat is in de app niet te lezen. Dertien
		// procent van de hoogte is wat Instagram zelf als veilige zone opgeeft.
		var randOnder = formaatNu().sleutel === "verhaal" ? H * 0.13 : RAND;

		c.save();
		c.setTransform(k, 0, 0, k, 0, 0);

		/* ---------------------------------------------------------- ondergrond */

		if (staat.beeld) {
			c.fillStyle = "#000";
			c.fillRect(0, 0, W, H);
			var kader = beeldkader(W, H);
			var px = Math.max(-kader.speling.x, Math.min(kader.speling.x, staat.panX));
			var py = Math.max(-kader.speling.y, Math.min(kader.speling.y, staat.panY));
			c.drawImage(staat.beeld,
				(W - kader.breedte) / 2 + px,
				(H - kader.hoogte) / 2 + py,
				kader.breedte, kader.hoogte);
		} else {
			c.fillStyle = papierkleur(groepNu());
			c.fillRect(0, 0, W, H);
		}

		/* ------------------------------------------------------- de onderregel
		   Eerst uitrekenen wat er onderaan staat, want dat bepaalt hoeveel
		   ruimte de titel erboven overhoudt. */

		var wapenB = 0, wapenH = 0;
		if (staat.toon.wapen && wapen && wapen.naturalWidth) {
			wapenH = WAPEN_H;
			wapenB = WAPEN_H * (wapen.naturalWidth / wapen.naturalHeight);
		}

		var delen = gegevensLijst();
		var regelsGegevens = [];
		var gegevensH = 0;

		if (delen.length) {
			zetLetter(c, 500, GEGEVENS, "0.07em");
			var ruimte = W - 2 * RAND - (wapenB ? wapenB + GAT : 0);
			regelsGegevens = breekDelen(c, delen, ruimte);
			// Kapitalen hebben geen staarten: de hoogte van het blok is de
			// bovenkant van de bovenste letter tot de onderlijn van de onderste.
			gegevensH = (regelsGegevens.length - 1) * GEGEVENS * GEGEVENS_REGEL + GEGEVENS * 0.73;
		}

		var blokH = Math.max(gegevensH, wapenH);
		var titelOnder = H - randOnder - (blokH ? blokH + GAT : 0);

		/* -------------------------------------------------------------- titel
		   De grootste maat waarbij de titel binnen de kolom blijft én binnen de
		   hoogte die overblijft. Dezelfde zoektocht als in de hero, maar hier
		   telt ook de hoogte mee: een poster is smal en hoog, en een titel van
		   vier regels mag het beeld niet helemaal opeten.

		   Een staande plaat krijgt vier regels, een vierkante drie. */

		var woorden = staat.titel.trim().split(/\s+/).filter(Boolean);
		var maxLijnen = (H / W > 1.2) ? 4 : 3;
		var titelBreedte = W - 2 * RAND;
		var beschikbaar = titelOnder - RAND;
		var gekozen = null;

		function probeer(px) {
			zetLetter(c, 700, px, "-0.03em");
			var r = breekWoorden(c, woorden, titelBreedte);
			if (!r || r.length > maxLijnen) return null;
			var boven = c.measureText(r[0]).actualBoundingBoxAscent || px * 0.73;
			if ((r.length - 1) * px + boven > beschikbaar) return null;
			return { regels: r, maat: px, boven: boven };
		}

		if (woorden.length && beschikbaar > TITEL_MIN) {
			gekozen = probeer(TITEL_MAX);
			if (!gekozen) {
				var laag = TITEL_MIN, hoog = TITEL_MAX;
				var kleinste = probeer(TITEL_MIN);
				if (kleinste) {
					gekozen = kleinste;
					// Twintig halveringen brengen ons op minder dan een tiende
					// van een eenheid nauwkeurig — ruim genoeg.
					for (var i = 0; i < 20; i++) {
						var midden = (laag + hoog) / 2;
						var poging = probeer(midden);
						if (poging) { gekozen = poging; laag = midden; }
						else { hoog = midden; }
					}
				}
			}
		}

		/* -------------------------------------------------------------- sluier
		   Enkel bij een beeld, en enkel zo hoog als de letter reikt. Op een vlak
		   in de kleur van de groep staat er niets tussen: wit op die vijf tinten
		   heeft contrast genoeg. Precies zoals de hero het doet. */

		if (staat.beeld) {
			var letterTop = gekozen
				? titelOnder - (gekozen.regels.length - 1) * gekozen.maat - gekozen.boven
				: H - randOnder - blokH;
			var top = Math.max(0, Math.min(letterTop - RAND * 2, H * 0.62));
			var sluier = c.createLinearGradient(0, H, 0, top);
			sluier.addColorStop(0, "rgba(0,0,0,0.72)");
			sluier.addColorStop(0.55, "rgba(0,0,0,0.32)");
			sluier.addColorStop(1, "rgba(0,0,0,0)");
			c.fillStyle = sluier;
			c.fillRect(0, top, W, H - top);
		}

		/* --------------------------------------------------------------- letter */

		c.fillStyle = "#fff";
		c.textAlign = "left";
		c.textBaseline = "alphabetic";

		// De titel gaat op de optische rand staan, niet op de rekenkundige. Een
		// letter begint namelijk niet meteen bij zijn beginpunt: er zit links wat
		// lucht in de letter zelf, en bij een korps van honderden eenheden zie je
		// dat als een inspringing. We meten die lucht en trekken hem eraf, zodat
		// de inkt precies op de rand begint. De hero doet hetzelfde met een vaste
		// -0,05em; meten is nauwkeuriger, en die -0,05em is hier het vangnet voor
		// browsers die de meting niet aanbieden.
		if (gekozen) {
			zetLetter(c, 700, gekozen.maat, "-0.03em");
			gekozen.regels.forEach(function (regel, i) {
				var y = titelOnder - (gekozen.regels.length - 1 - i) * gekozen.maat;
				var links = c.measureText(regel).actualBoundingBoxLeft;
				var x = (typeof links === "number") ? RAND + links : RAND - gekozen.maat * 0.05;
				c.fillText(regel, x, y);
			});
		}

		if (regelsGegevens.length) {
			zetLetter(c, 500, GEGEVENS, "0.07em");
			regelsGegevens.forEach(function (regel, i) {
				var y = H - randOnder - (regelsGegevens.length - 1 - i) * GEGEVENS * GEGEVENS_REGEL;
				var x = RAND;
				regel.forEach(function (deel) {
					c.fillText(deel, x, y);
					x += c.measureText(deel).width + GEGEVENS_GAT;
				});
			});
		}

		// Het wapen in de hoek tegenover de tekst, met zijn onderkant op
		// dezelfde lijn. Zo hoeft er geen tweede sluier bovenaan bij: het schild
		// staat in de sluier die er voor de letter toch al is.
		if (wapenB) {
			c.drawImage(wapen, W - RAND - wapenB, H - randOnder - wapenH, wapenB, wapenH);
		}

		c.restore();
	}

	/* ------------------------------------------------------------- voorbeeld */

	// Het voorbeeld wordt niet op ware grootte getekend — een A3 is zeventien
	// miljoen beeldpunten, en dat bij elke toetsaanslag opnieuw is te traag.
	// Negenhonderd op de langste zijde is scherp genoeg om te beoordelen.
	var VOORBEELD = 900;

	function ververs() {
		var f = formaatNu();
		var k = VOORBEELD / Math.max(f.breedte, f.hoogte);
		var b = Math.round(f.breedte * k), h = Math.round(f.hoogte * k);
		if (doek.width !== b || doek.height !== h) { doek.width = b; doek.height = h; }
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.clearRect(0, 0, b, h);
		teken(ctx, b, h);

		var maten = document.getElementById("maten");
		if (maten) maten.textContent = f.breedte + " × " + f.hoogte + " beeldpunten";
	}

	/* --------------------------------------------------------------- bewaren */

	function bestandsnaam(f) {
		var kern = staat.titel.trim().toLowerCase()
			.replace(/[àáâä]/g, "a").replace(/[èéêë]/g, "e").replace(/[ìíîï]/g, "i")
			.replace(/[òóôö]/g, "o").replace(/[ùúûü]/g, "u").replace(/ç/g, "c")
			.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
		return (kern || "poster") + "-" + f.sleutel + ".png";
	}

	function bewaren(knop) {
		var f = formaatNu();
		var oud = knop.textContent;
		knop.textContent = "Bezig…";
		knop.disabled = true;

		// Even wachten, anders tekent de browser het woord "Bezig…" pas nadat
		// de hele plaat al klaar is en zie je het nooit staan.
		setTimeout(function () {
			var af = function (bericht) {
				knop.textContent = oud;
				knop.disabled = false;
				melding(bericht || "");
			};

			var uit = document.createElement("canvas");
			uit.width = f.breedte;
			uit.height = f.hoogte;

			var c = uit.getContext("2d");
			if (!c) return af("Deze browser kan geen poster tekenen.");

			try {
				teken(c, f.breedte, f.hoogte);
			} catch (e) {
				return af("Het tekenen lukte niet: " + e.message);
			}

			try {
				uit.toBlob(function (blob) {
					if (!blob) {
						return af("Het bewaren lukte niet. De affiche is heel groot — " +
							"probeer het opnieuw, of kies een van de andere formaten.");
					}
					var adres = URL.createObjectURL(blob);
					var a = el("a");
					a.href = adres;
					a.download = bestandsnaam(f);
					document.body.appendChild(a);
					a.click();
					a.remove();
					setTimeout(function () { URL.revokeObjectURL(adres); }, 2000);
					af("");
				}, "image/png");
			} catch (e) {
				af("Het bewaren lukte niet: " + e.message);
			}
		}, 30);
	}

	function melding(tekst) {
		var p = document.getElementById("melding");
		if (!p) return;
		p.textContent = tekst;
		p.hidden = !tekst;
	}

	/* ------------------------------------------------------------- de knoppen */

	function koppelVelden() {
		["titel", "datum", "tijd", "locatie", "spreker", "soort"].forEach(function (naam) {
			var invoer = document.getElementById("v-" + naam);
			if (!invoer) return;
			invoer.value = staat[naam];
			invoer.addEventListener("input", function () {
				staat[naam] = invoer.value;
				ververs();
			});
		});

		Object.keys(staat.toon).forEach(function (naam) {
			var vink = document.getElementById("t-" + naam);
			if (!vink) return;
			vink.checked = staat.toon[naam];
			vink.addEventListener("change", function () {
				staat.toon[naam] = vink.checked;
				ververs();
			});
		});
	}

	function koppelFormaat() {
		var doelen = document.querySelectorAll('input[name="formaat"]');
		[].forEach.call(doelen, function (knop) {
			knop.checked = knop.value === staat.formaat;
			knop.addEventListener("change", function () {
				if (!knop.checked) return;
				staat.formaat = knop.value;
				ververs();
			});
		});
	}

	function vulActiviteiten() {
		var kiezer = document.getElementById("kies");
		if (!kiezer) return;

		var lijst = Array.isArray(window.KMF_AGENDA)
			? window.KMF_AGENDA
			: ((window.KMF && window.KMF.activiteiten) || []);

		komende = hulp().komende ? hulp().komende(lijst) : [];

		komende.forEach(function (g, i) {
			var optie = el("option", null,
				hulp().toonDatum(g.start) + "   " + g.titel);
			optie.value = String(i);
			kiezer.appendChild(optie);
		});

		if (!komende.length) {
			kiezer.disabled = true;
			kiezer.options[0].textContent = "Geen activiteiten in de agenda";
			return;
		}

		kiezer.addEventListener("change", function () { neemOver(+kiezer.value); });

		// De eerstvolgende staat er al in zodra je de pagina opent. Dat is bijna
		// altijd degene waar je een poster voor komt maken, en je ziet meteen
		// hoe een poster eruitziet in plaats van een leeg vlak.
		kiezer.value = "0";
		neemOver(0);
	}

	function neemOver(i) {
		var g = komende[i];
		if (!g) return;
		staat.titel = g.titel;
		staat.datum = isoDatum(g.start);
		staat.tijd = g.tijd || "";
		staat.locatie = g.locatie || "";
		staat.spreker = g.spreker || "";
		staat.soort = g.soort || "";
		koppelWaarden();
		ververs();
	}

	function isoDatum(d) {
		var p = function (n) { return String(n).padStart(2, "0"); };
		return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
	}

	// Na het kiezen van een activiteit staan de velden vol; die waarden moeten
	// ook in de vakjes komen, want daar pas je ze daarna in aan.
	function koppelWaarden() {
		["titel", "datum", "tijd", "locatie", "spreker", "soort"].forEach(function (naam) {
			var invoer = document.getElementById("v-" + naam);
			if (invoer) invoer.value = staat[naam];
		});
	}

	function koppelBeeld() {
		var invoer = document.getElementById("bestand");
		var weg = document.getElementById("beeld-weg");
		var zoom = document.getElementById("zoom");

		if (invoer) {
			invoer.addEventListener("change", function () {
				var bestand = invoer.files && invoer.files[0];
				if (!bestand) return;
				var lezer = new FileReader();
				lezer.onload = function () {
					var beeld = new Image();
					beeld.onload = function () {
						staat.beeld = beeld;
						staat.zoom = 1;
						staat.panX = 0;
						staat.panY = 0;
						if (zoom) zoom.value = "1";
						toonBeeldregelaars(true, bestand.name);
						ververs();
					};
					beeld.onerror = function () {
						melding("Dat bestand kon niet als afbeelding gelezen worden.");
					};
					// Als tekst inlezen en niet als adres: een adres naar een
					// bestand op je schijf geldt voor de browser als een vreemde
					// bron, en dan kan de poster achteraf niet bewaard worden.
					beeld.src = lezer.result;
				};
				lezer.readAsDataURL(bestand);
			});
		}

		if (weg) {
			weg.addEventListener("click", function (e) {
				e.preventDefault();
				staat.beeld = null;
				if (invoer) invoer.value = "";
				toonBeeldregelaars(false, "");
				ververs();
			});
		}

		if (zoom) {
			zoom.addEventListener("input", function () {
				staat.zoom = +zoom.value;
				ververs();
			});
		}
	}

	function toonBeeldregelaars(aan, naam) {
		var blok = document.getElementById("uitsnede");
		if (blok) blok.hidden = !aan;
		var label = document.getElementById("bestandsnaam");
		if (label) label.textContent = naam || "Nog geen beeld gekozen";
	}

	// Slepen in het voorbeeld verschuift het beeld. De muis loopt over een
	// verkleinde plaat, dus wordt elke pixel omgerekend naar de eenheden waarin
	// getekend wordt.
	function koppelSlepen() {
		var sleept = false, vanX = 0, vanY = 0, beginX = 0, beginY = 0;

		doek.addEventListener("pointerdown", function (e) {
			if (!staat.beeld) return;
			sleept = true;
			vanX = e.clientX;
			vanY = e.clientY;
			beginX = staat.panX;
			beginY = staat.panY;
			doek.setPointerCapture(e.pointerId);
			e.preventDefault();
		});

		doek.addEventListener("pointermove", function (e) {
			if (!sleept) return;
			var kast = doek.getBoundingClientRect();
			var perPixel = REF / kast.width;
			var W = REF, H = (doek.height / doek.width) * REF;
			var kader = beeldkader(W, H);
			staat.panX = Math.max(-kader.speling.x, Math.min(kader.speling.x,
				beginX + (e.clientX - vanX) * perPixel));
			staat.panY = Math.max(-kader.speling.y, Math.min(kader.speling.y,
				beginY + (e.clientY - vanY) * perPixel));
			ververs();
		});

		["pointerup", "pointercancel"].forEach(function (soort) {
			doek.addEventListener(soort, function () { sleept = false; });
		});
	}

	/* ----------------------------------------------------------------- start */

	function laadWapen(klaar) {
		var beeld = new Image();
		beeld.onload = function () { wapen = beeld; klaar(); };
		beeld.onerror = function () {
			if (beeld.src !== window.KMF_WAPEN && window.KMF_WAPEN) {
				beeld.src = window.KMF_WAPEN;
			} else {
				klaar();
			}
		};
		// Rechtstreeks vanaf de schijf geopend telt img/kmf-wapen.png als een
		// vreemde bron en kan de poster daarna niet bewaard worden. Dan meteen
		// de kopie uit js/kmf-wapen.js. Online gewoon het bestand zelf, zodat
		// een scherper wapen vanzelf meekomt.
		beeld.src = (location.protocol === "file:" && window.KMF_WAPEN)
			? window.KMF_WAPEN
			: "img/kmf-wapen.png";
	}

	function begin() {
		doek = document.getElementById("doek");
		if (!doek) return;
		ctx = doek.getContext("2d");

		koppelFormaat();
		koppelVelden();
		koppelBeeld();
		koppelSlepen();
		vulActiviteiten();
		toonBeeldregelaars(false, "");

		var knop = document.getElementById("bewaren");
		if (knop) knop.addEventListener("click", function () { bewaren(knop); });

		laadWapen(ververs);

		// Meten heeft pas zin als Inter binnen is: met de terugvalletter komt er
		// een andere breedte uit en staat de titel achteraf te klein. Dezelfde
		// reden als bij de hero.
		if (document.fonts && document.fonts.load) {
			Promise.all([
				document.fonts.load("700 100px Inter"),
				document.fonts.load("500 40px Inter")
			]).then(ververs)["catch"](ververs);
		}

		ververs();
	}

	if (window.KMF_GEREED) {
		begin();
	} else {
		document.addEventListener("kmf-klaar", begin);
	}
})();
