(function () {
	"use strict";

	var GROUPS = {"doen": "social", "studie": "study", "meedoen": "join", "wij": "about", "hulp": "support"};

	var KINDS_WITH_SPEAKER = ["lezing", "debat"];
	var RECURRENCE = { wekelijks: 7, tweewekelijks: 14, maandelijks: null };

	function parseDate(s) {
		var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || "").trim());
		if (!m) return null;
		var year = +m[1], month = +m[2], day = +m[3];
		var d = new Date(year, month - 1, day);
		if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) {
			return null;
		}
		return d;
	}

	function today() {
		var n = new Date();
		return new Date(n.getFullYear(), n.getMonth(), n.getDate());
	}

	function formatDate(d) {
		var p = function (n) { return String(n).padStart(2, "0"); };
		return p(d.getDate()) + "." + p(d.getMonth() + 1) + "." + String(d.getFullYear()).slice(2);
	}

	function formatRange(start, einde) {
		if (!einde || einde.getTime() === start.getTime()) return formatDate(start);
		var p = function (n) { return String(n).padStart(2, "0"); };
		return p(start.getDate()) + "." + p(start.getMonth() + 1) + " — " + formatDate(einde);
	}

	function relativeDay(start, tijd) {
		var v = today();
		var diff = Math.round((start - v) / (1000 * 60 * 60 * 24));
		if (diff < 0) return "";

		if (diff === 0) {
			var hour = parseInt(tijd, 10);
			return (!isNaN(hour) && hour < 17) ? "Vandaag" : "Vanavond";
		}
		if (diff === 1) return "Morgen";

		var isoDay = v.getDay() === 0 ? 7 : v.getDay();
		var daysToSunday = 7 - isoDay;

		if (diff <= daysToSunday) {
			var dayNames = ["Zondag", "Maandag", "Dinsdag", "Woensdag", "Donderdag", "Vrijdag", "Zaterdag"];
			return dayNames[start.getDay()];
		}

		return "";
	}

	function validate(rows) {
		var errors = [];
		if (!Array.isArray(rows)) {
			errors.push("De rows <code>activiteiten</code> ontbreekt in data/kmf-data.js.");
			return errors;
		}

		rows.forEach(function (a, i) {
			var naam = a && a.titel ? '"' + a.titel + '"' : "de activiteit op plaats " + (i + 1);

			if (!a || typeof a !== "object") {
				errors.push("Plaats " + (i + 1) + " in de rows is geen activiteit.");
				return;
			}
			if (!a.titel) {
				errors.push("De activiteit op plaats " + (i + 1) + " heeft geen <code>titel</code>.");
			}
			if (!a.start) {
				errors.push(naam + " heeft geen <code>start</code>.");
			} else if (!parseDate(a.start)) {
				errors.push(naam + " heeft een onleesbare <code>start</code>: <code>" + a.start +
					"</code>. Schrijf de datum als year-month-day, bijvoorbeeld <code>2026-11-19</code>.");
			}
			if (a.einde && !parseDate(a.einde)) {
				errors.push(naam + " heeft een onleesbare <code>einde</code>: <code>" + a.einde + "</code>.");
			}
			if (a.einde && parseDate(a.einde) && parseDate(a.start) &&
				parseDate(a.einde) < parseDate(a.start)) {
				errors.push(naam + " eindigt vóór ze begint.");
			}
			if (a.herhaling) {
				if (!(a.herhaling in RECURRENCE)) {
					errors.push(naam + " heeft een onbekende <code>herhaling</code>: <code>" + a.herhaling +
						"</code>. Kies uit wekelijks, tweewekelijks of maandelijks.");
				} else if (!a.herhaling_tot) {
					errors.push(naam + " herhaalt zich maar heeft geen <code>herhaling_tot</code>, " +
						"dus weet de site niet wanneer ze moet stoppen.");
				} else if (!parseDate(a.herhaling_tot)) {
					errors.push(naam + " heeft een onleesbare <code>herhaling_tot</code>: <code>" +
						a.herhaling_tot + "</code>.");
				}
			}
		});

		return errors;
	}

	function reportErrors(errors) {
		var bar = document.createElement("div");
		bar.className = "errors";
		bar.setAttribute("role", "alert");
		bar.innerHTML =
			"<p>Er staat iets fout in <code>data/kmf-data.js</code> — de agenda is daardoor onvolledig.</p><ul>" +
			errors.map(function (f) { return "<li>" + f + "</li>"; }).join("") + "</ul>";
		document.body.insertBefore(bar, document.body.firstChild);
	}

	function expand(a) {
		if (!a.titel) return [];
		var start = parseDate(a.start);
		if (!start) return [];
		var einde = a.einde ? parseDate(a.einde) : null;
		return [toEvent(a, start, einde)];
	}

	function toEvent(a, start, einde) {
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

	function upcomingEvents(rows) {
		var cutoff = today();
		var all = [];

		(rows || []).forEach(function (a) {
			expand(a).forEach(function (g) { all.push(g); });
		});

		var upcoming = all

			.filter(function (g) { return (g.einde || g.start) >= cutoff; })
			.sort(function (x, y) { return x.start - y.start; });

		var seen = {};
		upcoming.forEach(function (g) {
			var key = g.titel.toLowerCase();
			g.herhaald = seen[key] === true;
			seen[key] = true;
		});

		return upcoming;
	}

	function elem(tag, klasse, tekst) {
		var n = document.createElement(tag);
		if (klasse) n.className = klasse;
		if (tekst != null) n.textContent = tekst;
		return n;
	}

	function renderAside(g) {
		var marge = elem("div", "aside");
		var status = relativeDay(g.start, g.tijd);

		if (status) marge.appendChild(elem("span", "status", status));

		if (!isImminent(status)) {
			marge.appendChild(elem("span", "date", formatRange(g.start, g.einde)));
		}
		if (g.tijd) marge.appendChild(elem("span", "time", g.tijd));

		return marge;
	}

	function hashEvents(upcoming) {
		var raw = upcoming.map(function (g) {
			var d = g.start;
			var iso = d.getFullYear() + "-" +
				String(d.getMonth() + 1).padStart(2, "0") + "-" +
				String(d.getDate()).padStart(2, "0");
			return g.titel + "|" + iso + "|" + (g.tijd || "");
		}).join(";");

		var h = 5381;
		for (var i = 0; i < raw.length; i++) {
			h = ((h * 33) ^ raw.charCodeAt(i)) >>> 0;
		}
		return h.toString(16);
	}

	var HASH_FIELDS = ["naam", "titel", "functie", "datum", "prijs", "auteur",
		"box", "link", "beeld", "tekst"];

	function hashRows(rows) {
		var raw = (rows || []).map(function (r) {
			return HASH_FIELDS.map(function (v) { return r[v] || ""; }).join("|");
		}).join(";");

		var h = 5381;
		for (var i = 0; i < raw.length; i++) h = ((h * 33) ^ raw.charCodeAt(i)) >>> 0;
		return h.toString(16);
	}

	function hashNav(data, hier) {
		var parts = [hier];
		(data.navigatie || []).forEach(function (groep) {
			parts.push(groep.thema || "");
			(groep.items || []).forEach(function (item) { parts.push(item.naam || ""); });
		});
		var raw = parts.join("|");
		var h = 5381;
		for (var i = 0; i < raw.length; i++) h = ((h * 33) ^ raw.charCodeAt(i)) >>> 0;
		return h.toString(16);
	}

	function isFresh(baked, hash) {
		return !!baked && baked.getAttribute("data-hash") === hash;
	}

	function isImminent(status) {
		return status === "Vandaag" || status === "Vanavond" || status === "Morgen";
	}

	function renderDetails(g) {
		var parts = [];
		if (g.locatie) parts.push(elem("span", "venue", g.locatie));
		if (g.spreker && KINDS_WITH_SPEAKER.indexOf(g.soort) !== -1) {
			parts.push(elem("span", "speaker", g.spreker));
		}

		if (g.soort && !sameWord(g.soort, g.titel)) {
			parts.push(elem("span", "kind", g.soort));
		}
		if (!parts.length) return null;

		var line = elem("p", "details");
		parts.forEach(function (deel) { line.appendChild(deel); });
		return line;
	}

	function groupOf(soort) {
		var tabel = (window.KMF && window.KMF.soorten) || {};
		return GROUPS[tabel[String(soort || "").trim().toLowerCase()]] || "social";
	}

	function sameWord(a, b) {
		return String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
	}

	function renderItem(g) {
		var li = elem("li", "item row theme-" + groupOf(g.soort));

		li.appendChild(renderAside(g));

		var maat = elem("div", "measure");
		var titel = elem("h3", "title");

		if (g.link) {
			var a = elem("a", null, g.titel);
			a.href = g.link;
			a.rel = "noopener";
			titel.appendChild(a);
		} else {
			titel.textContent = g.titel;
		}
		maat.appendChild(titel);

		var details = renderDetails(g);
		if (details) maat.appendChild(details);

		if (g.tekst && !g.herhaald) maat.appendChild(elem("p", "body", g.tekst));

		if (g.link) {
			var verder = elem("a", "more");
			verder.href = g.link;
			verder.rel = "noopener";
			verder.appendChild(elem("span", "body-small", "meer"));
			verder.appendChild(elem("span", "arrow", "→"));
			maat.appendChild(verder);
		}

		li.appendChild(maat);

		return li;
	}

	function renderList(target, events) {
		if (!target) return;
		target.innerHTML = "";

		if (!events.length) {
			target.appendChild(elem("p", "empty",
				"Er staat nog niets gepland. Voeg een activiteit toe in data/kmf-data.js."));
			return;
		}

		var ul = elem("ul", "list");
		events.forEach(function (g) { ul.appendChild(renderItem(g)); });
		target.appendChild(ul);
	}

	function fitTitle(titel) {
		var MIN = 28, MAX = 220, MAX_LIJNEN = 3;

		var width = titel.clientWidth;
		if (!width) return;

		titel.style.fontSize = MAX + "px";

		var fits = function (px) {
			titel.style.fontSize = px + "px";
			return titel.scrollWidth <= titel.clientWidth + 1 &&
				titel.scrollHeight <= px * MAX_LIJNEN + 1;
		};

		if (!fits(MIN)) { titel.style.fontSize = ""; return; }

		var low = MIN, high = MAX;
		if (fits(MAX)) { low = MAX; }
		else {

			for (var i = 0; i < 20; i++) {
				var mid = (low + high) / 2;
				if (fits(mid)) low = mid; else high = mid;
			}
		}
		titel.style.fontSize = Math.floor(low) + "px";
	}

	function fitHero() {
		var titel = document.querySelector('.hero .title');
		if (titel) fitTitle(titel);
	}

	var heroVolgt = false;
	function watchHero() {
		fitHero();
		if (heroVolgt) return;
		heroVolgt = true;

		if (document.fonts && document.fonts.ready) {
			document.fonts.ready.then(fitHero);
		}

		var wacht;
		window.addEventListener("resize", function () {
			clearTimeout(wacht);
			wacht = setTimeout(fitHero, 150);
		});
	}

	function renderHero(target, g) {
		if (!target) return;
		target.innerHTML = "";

		var inhoud = elem("div", "content");

		if (!g) {
			inhoud.appendChild(elem("h2", "title", "Tot binnenkort"));
			var leegGegevens = elem("div", "meta");
			leegGegevens.appendChild(elem("span", null, "Geen activiteiten gepland"));
			inhoud.appendChild(leegGegevens);
			target.appendChild(inhoud);
			return;
		}

		if (g.beeld) {
			target.classList.add("has-photo");
			var img = elem("img", "photo");
			img.src = g.beeld;
			img.alt = "";
			target.appendChild(img);
		}

		var titel = elem("h2", "title");
		g.titel.split(/\s+/).forEach(function (woord, i) {
			if (i) titel.appendChild(document.createTextNode(" "));
			titel.appendChild(elem("span", "word", woord));
		});
		inhoud.appendChild(titel);

		var gegevens = elem("div", "meta");
		var status = relativeDay(g.start, g.tijd);
		if (status) {
			gegevens.appendChild(elem("span", "kind", status));
		}
		if (!isImminent(status)) {
			gegevens.appendChild(elem("span", null, formatRange(g.start, g.einde)));
		}
		if (g.tijd) gegevens.appendChild(elem("span", null, g.tijd));
		if (g.locatie) gegevens.appendChild(elem("span", null, g.locatie));
		if (g.soort && !sameWord(g.soort, g.titel)) {
			gegevens.appendChild(elem("span", "kind", g.soort));
		}
		target.setAttribute("data-group", groupOf(g.soort));
		inhoud.appendChild(gegevens);

		target.appendChild(inhoud);
	}

	function loadData(klaar) {
		if (window.KMF && window.KMF_AGENDA) return klaar();

		var pending = 2;
		var done = function () { if (--pending === 0) klaar(); };

		loadScript("data/kmf-data.js?t=" + Date.now(), done, function () {
			loadScript("data/kmf-data.js", done, function () {
				reportErrors(["Het file <code>data/kmf-data.js</code> kon niet geladen worden. " +
					"Staat het nog in de map <code>data</code>?"]);
				done();
			});
		});

		loadScript("data/agenda.js?t=" + Date.now(), done, done);
	}

	function loadScript(src, ok, fail) {
		var s = document.createElement("script");
		s.src = src;
		s.onload = function () { window.KMF ? ok() : fail(); };
		s.onerror = fail;
		document.head.appendChild(s);
	}

	function currentPage() {
		var path = location.pathname.split("/").pop();
		return path === "" ? "index.html" : path;
	}

	function renderNav(data) {
		var doelen = document.querySelectorAll('nav.nav, nav.index');
		if (!doelen.length) return;

		var hier = currentPage();
		var groepen = data.navigatie || [];

		doelen.forEach(function (nav) {
			var index = nav.classList.contains("index");
			nav.innerHTML = "";

			var houder = nav;
			if (index) {
				houder = elem("div", "lists");
				nav.appendChild(houder);
			} else {

				var terug = elem("div", "group");
				terug.appendChild(navLink({ naam: "Startpagina", pagina: "index.html" }, data));
				houder.appendChild(terug);
			}

			groepen.forEach(function (groep) {
				var items = groep.items || [];
				if (!items.length) return;

				var box = elem("div", "group " + (GROUPS[groep.thema] || ""));

				if (groep.naam) box.appendChild(elem("span", "visually-hidden", groep.naam));
				items.forEach(function (item) {
					var link = navLink(item, data);

					if (item.pagina === hier) link.classList.add("current");
					box.appendChild(link);
				});
				houder.appendChild(box);
			});
		});
	}

	var RUIMER = 2.4;
	var GAT_MIN = 7;
	var GAT_MAX = 22;
	var MAAT_MIN = 10.5;

	function fitNav() {
		var nav = document.querySelector("nav.nav");
		if (!nav) return;

		var groepen = [].slice.call(nav.querySelectorAll(".group"));
		var items = [].slice.call(nav.querySelectorAll("a, .stub"));
		if (!groepen.length || !items.length) return;

		nav.classList.remove("single-line");
		nav.style.removeProperty("--nav-size");

		nav.classList.add("measuring");
		nav.querySelectorAll(".group").forEach(function (g) { g.classList.remove("empty"); });

		var stijl = getComputedStyle(nav);
		var beschikbaar = nav.clientWidth
			- parseFloat(stijl.paddingLeft) - parseFloat(stijl.paddingRight);

		var nBinnen = items.length - groepen.length;
		var nTussen = groepen.length - 1;

		function itemsWidth() {
			var sum = 0;
			for (var i = 0; i < items.length; i++) sum += items[i].getBoundingClientRect().width;
			return sum;
		}

		function minimumWidth() {
			return itemsWidth() + (nBinnen + nTussen * RUIMER) * GAT_MIN;
		}

		var maat = parseFloat(getComputedStyle(items[0]).fontSize);
		while (maat > MAAT_MIN && minimumWidth() > beschikbaar) {
			maat -= 0.5;
			nav.style.setProperty("--nav-size", maat + "px");
		}

		if (minimumWidth() > beschikbaar) {

			nav.style.removeProperty("--nav-size");
			nav.style.setProperty("--gap-inner", "0.7rem");
			nav.style.setProperty("--gap-outer", "1.65rem");
			hideCurrent(nav);
			return;
		}

		nav.classList.add("single-line");

		var spare = beschikbaar - itemsWidth();
		var eenheid = spare / (nBinnen + nTussen * RUIMER);
		var inner = Math.max(GAT_MIN, Math.min(GAT_MAX, eenheid));

		nav.style.setProperty("--gap-inner", inner + "px");
		nav.style.setProperty("--gap-outer", (inner * RUIMER) + "px");

		hideCurrent(nav);
	}

	function hideCurrent(nav) {
		nav.classList.remove("measuring");
		nav.querySelectorAll(".group").forEach(function (groep) {
			var visible = [].slice.call(groep.children).filter(function (k) {
				return !k.classList.contains("current") && !k.classList.contains("visually-hidden");
			});
			if (!visible.length) groep.classList.add("empty");
		});
	}

	var navVolgt = false;
	function watchNav() {
		fitNav();
		if (navVolgt) return;
		navVolgt = true;
		if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitNav);

		var wacht;
		window.addEventListener("resize", function () {
			clearTimeout(wacht);
			wacht = setTimeout(fitNav, 120);
		});
	}

	function navLink(item, data) {
		var href = item.pagina;
		if (!href && item.link) href = (data.links || {})[item.link] || item.link;

		if (!href) {
			var stuk = elem("span", "stub", item.naam);
			stuk.title = "Nog niet gebouwd";
			return stuk;
		}

		var a = elem("a", null, item.naam);
		a.href = href;
		if (!item.pagina) { a.target = "_blank"; a.rel = "noopener"; }
		return a;
	}

	function renderThemeToggle() {
		var voet = document.querySelector(".footer .start");
		if (!voet || voet.querySelector(".theme-button")) return;

		var knop = elem("button", "theme-button");
		knop.type = "button";

		function activeTheme() {
			var chosen = document.documentElement.getAttribute("data-theme");
			if (chosen) return chosen;
			return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
		}

		function sync() {
			var next = activeTheme() === "dark" ? "light" : "dark";

			knop.textContent = next === "dark" ? "Donkere modus" : "Lichte modus";
			knop.setAttribute("aria-label", "Schakel naar " + knop.textContent.toLowerCase());
		}

		knop.addEventListener("click", function () {
			var next = activeTheme() === "dark" ? "light" : "dark";
			document.documentElement.setAttribute("data-theme", next);
			try { localStorage.setItem("site-theme", next); } catch (e) {}
			sync();
		});

		window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", sync);

		sync();
		voet.appendChild(knop);
	}

	var PAGE_SHAPES = {
		presidium: { gegevens: ["functie"], titel: "naam", tekst: "tekst", mail: "mail", beeld: "beeld" },
		boeken:    { gegevens: ["box", "prijs"], titel: "titel", tekst: "tekst", onder: "auteur" },
		merch:     { gegevens: ["prijs"], titel: "naam", tekst: "tekst", beeld: "beeld" },
		sponsors:  { gegevens: [], titel: "naam", tekst: "tekst", link: "link", beeld: "beeld" },
		vstn:      { gegevens: ["datum"], titel: "titel", tekst: "tekst", link: "link" },
		lichtung:  { gegevens: ["datum", "auteur"], titel: "titel", tekst: "tekst", link: "link" }
	};

	function renderPageList(target, soort, rows) {
		var shape = PAGE_SHAPES[soort];
		if (!target || !shape) return;

		target.innerHTML = "";

		if (!rows || !rows.length) {
			target.appendChild(renderEmptyState(soort));
			return;
		}

		var ul = elem("ul", "list");

		rows.forEach(function (rij) {
			var li = elem("li", "item row");

			var marge = elem("div", "aside");
			shape.gegevens.forEach(function (veld) {
				if (rij[veld]) marge.appendChild(elem("span", veld, rij[veld]));
			});
			if (marge.childNodes.length) li.appendChild(marge);

			if (shape.beeld) li.appendChild(renderPhoto(rij[shape.beeld]));

			var maat = elem("div", "measure");

			var titel = elem("h2", "title");
			var href = shape.link && rij[shape.link];
			if (href) {
				var a = elem("a", null, rij[shape.titel]);
				a.href = href; a.rel = "noopener"; a.target = "_blank";
				titel.appendChild(a);
			} else {
				titel.textContent = rij[shape.titel] || "";
			}
			maat.appendChild(titel);

			if (shape.onder && rij[shape.onder]) maat.appendChild(elem("p", "body", rij[shape.onder]));
			if (shape.tekst && rij[shape.tekst]) maat.appendChild(elem("p", "body", rij[shape.tekst]));

			if (shape.mail && rij[shape.mail]) {
				var m = elem("a", "more");
				m.href = "mailto:" + rij[shape.mail];
				m.appendChild(elem("span", "body-small", rij[shape.mail]));
				maat.appendChild(m);
			}

			li.appendChild(maat);
			ul.appendChild(li);
		});

		target.appendChild(ul);
	}

	function renderPhoto(src) {
		if (!src) {
			var vlak = elem("div", "photo-slot");
			vlak.appendChild(elem("span", null, "Beeld"));
			return vlak;
		}
		var img = elem("img", "photo-slot photo");
		img.src = src;
		img.alt = "";
		img.loading = "lazy";
		return img;
	}

	function renderPhotos(target, fotos) {
		if (!target) return;
		target.innerHTML = "";

		if (!fotos || !fotos.length) {
			target.appendChild(renderEmptyState("fotos"));
			return;
		}

		var rooster = elem("div", "grid row");
		fotos.forEach(function (f) {
			var fig = elem("figure", "figure");
			fig.appendChild(renderPhoto(f.beeld));
			if (f.bijschrift) fig.appendChild(elem("figcaption", null, f.bijschrift));
			rooster.appendChild(fig);
		});
		target.appendChild(rooster);
	}

	function renderEmptyState(key, eigenLijn) {
		var blok = elem("div", "empty-state" + (eigenLijn === false ? "" : " rij"));
		blok.appendChild(elem("p", null, "WIP"));
		return blok;
	}

	function renderTextBlock(target) {
		if (!target || target.querySelector(".empty-state")) return;
		if (target.textContent.trim() !== "") return;
		target.appendChild(renderEmptyState(target.getAttribute("data-source") || "deze pagina", false));
	}

	window.SiteUtils = {
		parseDate: parseDate,
		formatDate: formatDate,
		formatRange: formatRange,
		groupOf: groupOf,
		upcoming: upcomingEvents
	};

	function start() {
		var data = window.KMF;

		if (!data) {
			reportErrors(["Het file <code>data/kmf-data.js</code> is geladen, maar bevat geen " +
				"<code>window.KMF</code>. Is de first line per ongeluk gewist?"]);
			return;
		}

		var mark = hashNav(data, currentPage());
		var navFresh = [].slice.call(document.querySelectorAll("nav.nav, nav.index"))
			.every(function (n) { return n.getAttribute("data-hash") === mark; });
		if (!navFresh) renderNav(data);

		renderThemeToggle();

		var fromSheet = Array.isArray(window.KMF_AGENDA);
		var rows = fromSheet ? window.KMF_AGENDA : data.activiteiten;

		var errors = (window.KMF_AGENDA_FOUTEN || []).slice();
		errors = errors.concat(validate(rows));
		if (errors.length) reportErrors(errors);

		var upcoming = upcomingEvents(rows);

		var heroTarget = document.querySelector('[data-render="hero"]');
		if (heroTarget) {

			heroTarget.setAttribute("data-group",
				upcoming[0] ? groupOf(upcoming[0].soort) : "");

			if (!isFresh(heroTarget.querySelector(".content"), hashEvents(upcoming.slice(0, 1)))) {
				renderHero(heroTarget, upcoming[0]);
			}
		}

		var listTarget = document.querySelector('[data-render="agenda"]');
		if (listTarget && !isFresh(listTarget.querySelector(".list"), hashEvents(upcoming))) {
			renderList(listTarget, upcoming);
		}

		Object.keys(PAGE_SHAPES).forEach(function (soort) {
			var target = document.querySelector('[data-render="' + soort + '"]');
			if (!target) return;
			var reeds = target.querySelector(".list, .empty-state");
			if (!isFresh(reeds, hashRows(data[soort]))) {
				renderPageList(target, soort, data[soort]);
			}
		});

		var photoTarget = document.querySelector('[data-render="fotos"]');
		if (photoTarget && !isFresh(photoTarget.querySelector(".grid, .empty-state"),
				hashRows(data.fotos))) {
			renderPhotos(photoTarget, data.fotos);
		}

		document.querySelectorAll('[data-render="tekst"]').forEach(renderTextBlock);

		watchHero();
		watchNav();
	}

	watchNav();
	watchHero();

	function boot() {
		try { start(); } finally {
			window.siteReady = true;
			document.dispatchEvent(new CustomEvent("site:ready"));
		}
	}

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", function () { loadData(boot); });
	} else {
		loadData(boot);
	}
})();
