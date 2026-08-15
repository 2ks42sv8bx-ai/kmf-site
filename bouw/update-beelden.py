import os
import re

# 1. Haal de site-URL op uit data/kmf-data.js
data_pad = os.path.join("data", "kmf-data.js")
site_url = ""

if os.path.exists(data_pad):
    with open(data_pad, "r", encoding="utf-8") as f:
        data_inhoud = f.read()
        match = re.search(r'site:\s*["\']([^"\']+)["\']', data_inhoud)
        if match:
            site_url = match.group(1).rstrip("/")

if not site_url:
    print("Fout: Geen site-URL gevonden in data/kmf-data.js. Controleer links.site.")
    exit(1)

doelbestand = "agenda.html"

if not os.path.exists(doelbestand):
    print(f"Fout: {doelbestand} niet gevonden in de huidige map.")
    exit(1)

beeld_url = f"{site_url}/img/deelbeeld.png"
pagina_url = f"{site_url}/{doelbestand}"

# 2. Lees agenda.html uit
with open(doelbestand, "r", encoding="utf-8") as f:
    inhoud = f.read()

# Titel en omschrijving ophalen uit agenda.html
titel_match = re.search(r"<title>(.*?)</title>", inhoud, re.IGNORECASE)
desc_match = re.search(r'<meta\s+name=["\']description["\']\s+content=["\'](.*?)["\']', inhoud, re.IGNORECASE)

titel = titel_match.group(1) if titel_match else "Agenda"
beschrijving = desc_match.group(1) if desc_match else ""

# 3. Open Graph blok samenstellen
og_blok = f"""<!-- deelvoorbeeld:start -->
<meta property="og:type" content="website">
<meta property="og:url" content="{pagina_url}">
<meta property="og:title" content="{titel}">
<meta property="og:description" content="{beschrijving}">
<meta property="og:image" content="{beeld_url}">
<meta name="twitter:card" content="summary_large_image">
<!-- deelvoorbeeld:einde -->"""

# 4. Vervangen en opslaan
patroon = r"<!-- deelvoorbeeld:start -->.*?<!-- deelvoorbeeld:einde -->"
if re.search(patroon, inhoud, re.DOTALL):
    nieuwe_inhoud = re.sub(patroon, og_blok, inhoud, flags=re.DOTALL)
    with open(doelbestand, "w", encoding="utf-8") as f:
        f.write(nieuwe_inhoud)
    print(f"{doelbestand} is succesvol bijgewerkt.")
else:
    print(f"{doelbestand} overgeslagen: markeringen <!-- deelvoorbeeld:start --> niet gevonden.")