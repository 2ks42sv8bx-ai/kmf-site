(function () {
	"use strict";

	var FIELDS = {titel: "title", datum: "date", tijd: "time", locatie: "venue", spreker: "speaker", soort: "kind", crest: "crest"};

	var SIZES = [
		{ key: "post",    name: "Instagram-post",    width: 1080, height: 1080 },
		{ key: "verhaal", name: "Instagram-verhaal", width: 1080, height: 1920 },

		{ key: "deelbeeld", name: "Deelbeeld",      width: 1200, height: 630 },

		{ key: "affiche", name: "Affiche A3",        width: 3508, height: 4961 }
	];

	var REF = 1000;

	var FONT_STACK = "'Inter', 'Helvetica Neue', Helvetica, Arial, sans-serif";

	var MARGIN = 40;

	var GAP = 54;
	var CREST_H = 76;
	var META_SIZE = 27;
	var META_GAP = 44;
	var META_LEADING = 1.45;
	var TITLE_MIN = 34;
	var TITLE_MAX = 300;

	var state = {
		formaat: "post",
		titel: "",
		datum: "",
		tijd: "",
		locatie: "",
		spreker: "",
		soort: "",
		toon: { datum: true, tijd: true, locatie: true, spreker: true, soort: true, crest: true },
		beeld: null,
		zoom: 1,
		panX: 0,
		panY: 0
	};

	var upcoming = [];
	var crest = null;

	var canvas, ctx;

	function elem(tag, klasse, tekst) {
		var n = document.createElement(tag);
		if (klasse) n.className = klasse;
		if (tekst != null) n.textContent = tekst;
		return n;
	}

	function utils() { return window.SiteUtils || {}; }

	function printColour(group) {
		var styles = getComputedStyle(document.documentElement);
		var colour = styles.getPropertyValue("--print-" + group).trim();
		return colour || styles.getPropertyValue("--print-social").trim() || "#B93A57";
	}

	function currentGroup() {
		var f = utils().groupOf;
		return f ? f(state.soort) : "social";
	}

	function dateText() {
		var ruw = state.datum.trim();
		if (!ruw) return "";
		var d = utils().parseDate ? utils().parseDate(ruw) : null;
		return d ? utils().formatDate(d) : ruw;
	}

	function currentSize() {
		for (var i = 0; i < SIZES.length; i++) {
			if (SIZES[i].key === state.formaat) return SIZES[i];
		}
		return SIZES[0];
	}

	function metaParts() {
		var out = [];
		if (state.toon.datum && dateText()) out.push(dateText());
		if (state.toon.tijd && state.tijd.trim()) out.push(state.tijd.trim());
		if (state.toon.locatie && state.locatie.trim()) out.push(state.locatie.trim());
		if (state.toon.spreker && state.spreker.trim()) out.push(state.spreker.trim());
		if (state.toon.soort && state.soort.trim()) out.push(state.soort.trim());
		return out.map(function (s) { return s.toUpperCase(); });
	}

	function setFont(c, gewicht, size, spatie) {
		c.font = gewicht + " " + size + "px " + FONT_STACK;
		try { c.letterSpacing = spatie; } catch (e) {}
	}

	function wrapWords(c, words, maxB) {
		var lines = [], current = "";
		for (var i = 0; i < words.length; i++) {
			if (c.measureText(words[i]).width > maxB) return null;
			var poging = current ? current + " " + words[i] : words[i];
			if (c.measureText(poging).width <= maxB) {
				current = poging;
			} else {
				lines.push(current);
				current = words[i];
			}
		}
		if (current) lines.push(current);
		return lines;
	}

	function wrapParts(c, parts, maxB) {
		var lines = [], current = [], width = 0;
		parts.forEach(function (d) {
			var w = c.measureText(d).width;
			var extra = current.length ? META_GAP + w : w;
			if (current.length && width + extra > maxB) {
				lines.push(current);
				current = [d];
				width = w;
			} else {
				current.push(d);
				width += extra;
			}
		});
		if (current.length) lines.push(current);
		return lines;
	}

	function photoBox(W, H) {
		var b = state.beeld;
		var cover = Math.max(W / b.naturalWidth, H / b.naturalHeight);
		var s = cover * state.zoom;
		var bw = b.naturalWidth * s, bh = b.naturalHeight * s;
		return {
			width: bw,
			height: bh,
			slack: { x: Math.max(0, (bw - W) / 2), y: Math.max(0, (bh - H) / 2) }
		};
	}

	function draw(c, plaatB, plaatH) {
		var k = plaatB / REF;
		var W = REF, H = plaatH / k;

		var marginBottom = currentSize().key === "verhaal" ? H * 0.13 : MARGIN;

		c.save();
		c.setTransform(k, 0, 0, k, 0, 0);

		if (state.beeld) {
			c.fillStyle = "#000";
			c.fillRect(0, 0, W, H);
			var box = photoBox(W, H);
			var px = Math.max(-box.slack.x, Math.min(box.slack.x, state.panX));
			var py = Math.max(-box.slack.y, Math.min(box.slack.y, state.panY));
			c.drawImage(state.beeld,
				(W - box.width) / 2 + px,
				(H - box.height) / 2 + py,
				box.width, box.height);
		} else {
			c.fillStyle = printColour(currentGroup());
			c.fillRect(0, 0, W, H);
		}

		var crestW = 0, crestH = 0;
		if (state.toon.crest && crest && crest.naturalWidth) {
			crestH = CREST_H;
			crestW = CREST_H * (crest.naturalWidth / crest.naturalHeight);
		}

		var parts = metaParts();
		var metaLines = [];
		var metaH = 0;

		if (parts.length) {
			setFont(c, 500, META_SIZE, "0.07em");
			var ruimte = W - 2 * MARGIN - (crestW ? crestW + GAP : 0);
			metaLines = wrapParts(c, parts, ruimte);

			metaH = (metaLines.length - 1) * META_SIZE * META_LEADING + META_SIZE * 0.73;
		}

		var blockH = Math.max(metaH, crestH);
		var titleBase = H - marginBottom - (blockH ? blockH + GAP : 0);

		var words = state.titel.trim().split(/\s+/).filter(Boolean);
		var maxLines = (H / W > 1.2) ? 4 : 3;
		var titleW = W - 2 * MARGIN;
		var available = titleBase - MARGIN;
		var chosen = null;

		function attempt(px) {
			setFont(c, 700, px, "-0.03em");
			var r = wrapWords(c, words, titleW);
			if (!r || r.length > maxLines) return null;
			var ascent = c.measureText(r[0]).actualBoundingBoxAscent || px * 0.73;
			if ((r.length - 1) * px + ascent > available) return null;
			return { lines: r, size: px, ascent: ascent };
		}

		if (words.length && available > TITLE_MIN) {
			chosen = attempt(TITLE_MAX);
			if (!chosen) {
				var laag = TITLE_MIN, hoog = TITLE_MAX;
				var kleinste = attempt(TITLE_MIN);
				if (kleinste) {
					chosen = kleinste;

					for (var i = 0; i < 20; i++) {
						var midden = (laag + hoog) / 2;
						var poging = attempt(midden);
						if (poging) { chosen = poging; laag = midden; }
						else { hoog = midden; }
					}
				}
			}
		}

		if (state.beeld) {
			var textTop = chosen
				? titleBase - (chosen.lines.length - 1) * chosen.size - chosen.ascent
				: H - marginBottom - blockH;
			var top = Math.max(0, Math.min(textTop - MARGIN * 2, H * 0.62));
			var scrim = c.createLinearGradient(0, H, 0, top);
			scrim.addColorStop(0, "rgba(0,0,0,0.72)");
			scrim.addColorStop(0.55, "rgba(0,0,0,0.32)");
			scrim.addColorStop(1, "rgba(0,0,0,0)");
			c.fillStyle = scrim;
			c.fillRect(0, top, W, H - top);
		}

		c.fillStyle = "#fff";
		c.textAlign = "left";
		c.textBaseline = "alphabetic";

		if (chosen) {
			setFont(c, 700, chosen.size, "-0.03em");
			chosen.lines.forEach(function (regel, i) {
				var y = titleBase - (chosen.lines.length - 1 - i) * chosen.size;
				var bearing = c.measureText(regel).actualBoundingBoxLeft;
				var x = (typeof bearing === "number") ? MARGIN + bearing : MARGIN - chosen.size * 0.05;
				c.fillText(regel, x, y);
			});
		}

		if (metaLines.length) {
			setFont(c, 500, META_SIZE, "0.07em");
			metaLines.forEach(function (regel, i) {
				var y = H - marginBottom - (metaLines.length - 1 - i) * META_SIZE * META_LEADING;
				var x = MARGIN;
				regel.forEach(function (deel) {
					c.fillText(deel, x, y);
					x += c.measureText(deel).width + META_GAP;
				});
			});
		}

		if (crestW) {
			c.drawImage(crest, W - MARGIN - crestW, H - marginBottom - crestH, crestW, crestH);
		}

		c.restore();
	}

	var PREVIEW_MAX = 900;

	function refresh() {
		var f = currentSize();
		var k = PREVIEW_MAX / Math.max(f.width, f.height);
		var b = Math.round(f.width * k), h = Math.round(f.height * k);
		if (canvas.width !== b || canvas.height !== h) { canvas.width = b; canvas.height = h; }
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.clearRect(0, 0, b, h);
		draw(ctx, b, h);

		var dimensions = document.getElementById("dimensions");
		if (dimensions) dimensions.textContent = f.width + " × " + f.height + " beeldpunten";
	}

	function fileName(f) {
		var kern = state.titel.trim().toLowerCase()
			.replace(/[àáâä]/g, "a").replace(/[èéêë]/g, "e").replace(/[ìíîï]/g, "i")
			.replace(/[òóôö]/g, "o").replace(/[ùúûü]/g, "u").replace(/ç/g, "c")
			.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
		return (kern || "poster") + "-" + f.key + ".png";
	}

	function save(button) {
		var f = currentSize();
		var oud = button.textContent;
		button.textContent = "Bezig…";
		button.disabled = true;

		setTimeout(function () {
			var done = function (bericht) {
				button.textContent = oud;
				button.disabled = false;
				notify(bericht || "");
			};

			var out = document.createElement("canvas");
			out.width = f.width;
			out.height = f.height;

			var c = out.getContext("2d");
			if (!c) return done("Deze browser kan geen poster tekenen.");

			try {
				draw(c, f.width, f.height);
			} catch (e) {
				return done("Het tekenen lukte niet: " + e.message);
			}

			try {
				out.toBlob(function (blob) {
					if (!blob) {
						return done("Het save lukte niet. De affiche is heel groot — " +
							"attempt het opnieuw, of pick-event een van de andere formaten.");
					}
					var url = URL.createObjectURL(blob);
					var a = elem("a");
					a.href = url;
					a.download = fileName(f);
					document.body.appendChild(a);
					a.click();
					a.remove();
					setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
					done("");
				}, "image/png");
			} catch (e) {
				done("Het save lukte niet: " + e.message);
			}
		}, 30);
	}

	function notify(tekst) {
		var p = document.getElementById("notify");
		if (!p) return;
		p.textContent = tekst;
		p.hidden = !tekst;
	}

	function bindFields() {
		["titel", "datum", "tijd", "locatie", "spreker", "soort"].forEach(function (name) {
			var input = document.getElementById("f-" + FIELDS[name]);
			if (!input) return;
			input.value = state[name];
			input.addEventListener("input", function () {
				state[name] = input.value;
				refresh();
			});
		});

		Object.keys(state.toon).forEach(function (name) {
			var vink = document.getElementById("s-" + FIELDS[name]);
			if (!vink) return;
			vink.checked = state.toon[name];
			vink.addEventListener("change", function () {
				state.toon[name] = vink.checked;
				refresh();
			});
		});
	}

	function bindSizes() {
		var doelen = document.querySelectorAll('input[name="formaat"]');
		[].forEach.call(doelen, function (button) {
			button.checked = button.value === state.formaat;
			button.addEventListener("change", function () {
				if (!button.checked) return;
				state.formaat = button.value;
				refresh();
			});
		});
	}

	function fillEvents() {
		var picker = document.getElementById("pick-event");
		if (!picker) return;

		var lijst = Array.isArray(window.KMF_AGENDA)
			? window.KMF_AGENDA
			: ((window.KMF && window.KMF.activiteiten) || []);

		upcoming = utils().upcoming ? utils().upcoming(lijst) : [];

		upcoming.forEach(function (g, i) {
			var optie = elem("option", null,
				utils().formatDate(g.start) + "   " + g.titel);
			optie.value = String(i);
			picker.appendChild(optie);
		});

		if (!upcoming.length) {
			picker.disabled = true;
			picker.options[0].textContent = "Geen activiteiten in de agenda";
			return;
		}

		picker.addEventListener("change", function () { applyEvent(+picker.value); });

		picker.value = "0";
		applyEvent(0);
	}

	function applyEvent(i) {
		var g = upcoming[i];
		if (!g) return;
		state.titel = g.titel;
		state.datum = isoDate(g.start);
		state.tijd = g.tijd || "";
		state.locatie = g.locatie || "";
		state.spreker = g.spreker || "";
		state.soort = g.soort || "";
		syncFields();
		refresh();
	}

	function isoDate(d) {
		var p = function (n) { return String(n).padStart(2, "0"); };
		return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
	}

	function syncFields() {
		["titel", "datum", "tijd", "locatie", "spreker", "soort"].forEach(function (name) {
			var input = document.getElementById("f-" + FIELDS[name]);
			if (input) input.value = state[name];
		});
	}

	function bindPhoto() {
		var input = document.getElementById("file");
		var clear = document.getElementById("beeld-clear");
		var zoom = document.getElementById("zoom");

		if (input) {
			input.addEventListener("change", function () {
				var file = input.files && input.files[0];
				if (!file) return;
				var reader = new FileReader();
				reader.onload = function () {
					var beeld = new Image();
					beeld.onload = function () {
						state.beeld = beeld;
						state.zoom = 1;
						state.panX = 0;
						state.panY = 0;
						if (zoom) zoom.value = "1";
						showCropControls(true, file.name);
						refresh();
					};
					beeld.onerror = function () {
						notify("Dat file kon niet als afbeelding gelezen worden.");
					};

					beeld.src = reader.result;
				};
				reader.readAsDataURL(file);
			});
		}

		if (clear) {
			clear.addEventListener("click", function (e) {
				e.preventDefault();
				state.beeld = null;
				if (input) input.value = "";
				showCropControls(false, "");
				refresh();
			});
		}

		if (zoom) {
			zoom.addEventListener("input", function () {
				state.zoom = +zoom.value;
				refresh();
			});
		}
	}

	function showCropControls(aan, name) {
		var panel = document.getElementById("crop");
		if (panel) panel.hidden = !aan;
		var label = document.getElementById("fileName");
		if (label) label.textContent = name || "Nog geen beeld chosen";
	}

	function bindDrag() {
		var dragging = false, vanX = 0, vanY = 0, beginX = 0, beginY = 0;

		canvas.addEventListener("pointerdown", function (e) {
			if (!state.beeld) return;
			dragging = true;
			vanX = e.clientX;
			vanY = e.clientY;
			beginX = state.panX;
			beginY = state.panY;
			canvas.setPointerCapture(e.pointerId);
			e.preventDefault();
		});

		canvas.addEventListener("pointermove", function (e) {
			if (!dragging) return;
			var rect = canvas.getBoundingClientRect();
			var unitsPerPixel = REF / rect.width;
			var W = REF, H = (canvas.height / canvas.width) * REF;
			var box = photoBox(W, H);
			state.panX = Math.max(-box.slack.x, Math.min(box.slack.x,
				beginX + (e.clientX - vanX) * unitsPerPixel));
			state.panY = Math.max(-box.slack.y, Math.min(box.slack.y,
				beginY + (e.clientY - vanY) * unitsPerPixel));
			refresh();
		});

		["pointerup", "pointercancel"].forEach(function (soort) {
			canvas.addEventListener(soort, function () { dragging = false; });
		});
	}

	function loadCrest(klaar) {
		var beeld = new Image();
		beeld.onload = function () { crest = beeld; klaar(); };
		beeld.onerror = function () {
			if (beeld.src !== window.CREST_PNG && window.CREST_PNG) {
				beeld.src = window.CREST_PNG;
			} else {
				klaar();
			}
		};

		beeld.src = (location.protocol === "file:" && window.CREST_PNG)
			? window.CREST_PNG
			: "img/kmf-crest.png";
	}

	function init() {
		canvas = document.getElementById("canvas");
		if (!canvas) return;
		ctx = canvas.getContext("2d");

		bindSizes();
		bindFields();
		bindPhoto();
		bindDrag();
		fillEvents();
		showCropControls(false, "");

		var button = document.getElementById("save");
		if (button) button.addEventListener("click", function () { save(button); });

		loadCrest(refresh);

		if (document.fonts && document.fonts.load) {
			Promise.all([
				document.fonts.load("700 100px Inter"),
				document.fonts.load("500 40px Inter")
			]).then(refresh)["catch"](refresh);
		}

		refresh();
	}

	if (window.siteReady) {
		init();
	} else {
		document.addEventListener("site:ready", init);
	}
})();
