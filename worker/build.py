#!/usr/bin/env python3
"""
Build-Script für den Cloudflare Pre-Render Worker.
Extrahiert SEO-Daten (Title, Description) aus dem Quellcode und injiziert sie in den Worker.
Wird automatisch von der GitHub Action bei jedem Push ausgeführt.

Fixes v2 (2026-03-24):
- Ratgeber: Splittet Dateien in Export-Blöcke statt findall für alle title:-Felder
- Landing Pages: Korrektes Glob-Pattern (src/data/landing-page-*.ts)
- Template-Literals: Parst auch title={`...`} und description={`...`}
- Titel-Kürzung: Kürzt alle Titel auf max 60 Zeichen
"""

import re
import os
import json
import glob

SITE_NAME = "CaravanWert"
MAX_TITLE_LENGTH = 60


def resolve_template_literal(value):
    """Ersetzt ${siteName} und ähnliche Template-Variablen durch den tatsächlichen Wert."""
    value = value.replace("${siteName}", SITE_NAME)
    value = value.replace("${SITE_NAME}", SITE_NAME)
    return value


def extract_prop(content, prop_name):
    """Extrahiert einen Prop-Wert aus JSX, unterstützt sowohl "..." als auch {`...`}."""
    # Versuch 1: prop="value"
    match = re.search(rf'{prop_name}="([^"]+)"', content)
    if match:
        return match.group(1)

    # Versuch 2: prop={`value`} (Template-Literal mit geschweiften Klammern)
    match = re.search(rf'{prop_name}={{`([^`]+)`}}', content)
    if match:
        return resolve_template_literal(match.group(1))

    # Versuch 3: prop={`value`} (ohne doppelte geschweifte Klammern in Regex)
    match = re.search(prop_name + r'=\{`([^`]+)`\}', content)
    if match:
        return resolve_template_literal(match.group(1))

    return None


def shorten_title(title, max_len=MAX_TITLE_LENGTH):
    """Kürzt einen Titel intelligent auf max_len Zeichen."""
    if len(title) <= max_len:
        return title

    # Strategie 1: " | CaravanWert" entfernen
    suffix = " | CaravanWert"
    if title.endswith(suffix):
        shortened = title[:-len(suffix)]
        if len(shortened) <= max_len:
            return shortened
        title = shortened

    # Strategie 2: " – " oder " — " als Trennzeichen nutzen
    for sep in [" – ", " — ", " - ", " | "]:
        if sep in title:
            parts = title.split(sep)
            candidate = parts[0].strip()
            if len(candidate) <= max_len and len(candidate) >= 20:
                return candidate

    # Strategie 3: Am letzten Wort vor max_len abschneiden
    if len(title) > max_len:
        truncated = title[:max_len - 1]
        last_space = truncated.rfind(" ")
        if last_space > 20:
            return truncated[:last_space] + "…"
        return truncated + "…"

    return title


def extract_seo_routes():
    """Extrahiert alle SEO-Routen aus dem Quellcode."""
    routes = {}
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

    # ─── 1. Hauptseiten aus pages/*.tsx ───────────────────────────────────────
    page_files = glob.glob(os.path.join(base_dir, "src/pages/*.tsx"))
    for f in page_files:
        with open(f) as fh:
            content = fh.read()

        # Skip private pages (noIndex)
        if "noIndex" in content and "true" in content.split("noIndex")[1][:20]:
            continue

        title = extract_prop(content, "title")
        desc = extract_prop(content, "description")
        path = extract_prop(content, "canonicalPath")

        if title and desc and path:
            if "| CaravanWert" not in title and "CaravanWert" not in title:
                title = title + " | CaravanWert"
            routes[path] = {
                "title": shorten_title(title),
                "description": desc
            }

    # ─── 2. Ratgeber aus data/ratgeber/ratgeber-*.ts ─────────────────────────
    ratgeber_files = glob.glob(os.path.join(base_dir, "src/data/ratgeber/ratgeber-*.ts"))
    for f in ratgeber_files:
        basename = os.path.basename(f)
        if "types" in basename or "index" in basename:
            continue
        with open(f) as fh:
            content = fh.read()

        # Splitte die Datei in Export-Blöcke
        # Jeder Block beginnt mit "export const"
        blocks = re.split(r'(?=export\s+const\s+\w+)', content)

        for block in blocks:
            if not block.strip() or "export const" not in block:
                continue

            # Extrahiere nur die Top-Level-Felder (2 Spaces Einrückung)
            slug_m = re.search(r'^\s{2}slug:\s*"([^"]+)"', block, re.MULTILINE)
            title_m = re.search(r'^\s{2}title:\s*"([^"]+)"', block, re.MULTILINE)
            desc_m = re.search(r'^\s{2}metaDescription:\s*"([^"]+)"', block, re.MULTILINE)

            if slug_m and title_m and desc_m:
                path = f"/ratgeber/{slug_m.group(1)}"
                title = title_m.group(1)
                if "| CaravanWert" not in title and "CaravanWert" not in title:
                    title = title + " | CaravanWert"
                routes[path] = {
                    "title": shorten_title(title),
                    "description": desc_m.group(1)
                }

    # ─── 3. Landing Pages aus data/landing-page-*.ts ─────────────────────────
    # Korrektes Pattern: Einzeldateien in src/data/, NICHT in einem Unterverzeichnis
    landing_files = glob.glob(os.path.join(base_dir, "src/data/landing-page-*.ts"))
    for f in landing_files:
        basename = os.path.basename(f)
        if "types" in basename or basename == "landing-pages.ts":
            continue
        with open(f) as fh:
            content = fh.read()

        # Splitte auch Landing Pages in Export-Blöcke (falls mehrere Exports pro Datei)
        blocks = re.split(r'(?=export\s+const\s+\w+)', content)

        for block in blocks:
            if not block.strip() or "export const" not in block:
                continue

            path_m = re.search(r'^\s{2}path:\s*"([^"]+)"', block, re.MULTILINE)
            title_m = re.search(r'^\s{2}title:\s*"([^"]+)"', block, re.MULTILINE)
            # Versuche metaTitle zuerst, dann title
            meta_title_m = re.search(r'^\s{2}metaTitle:\s*"([^"]+)"', block, re.MULTILINE)
            desc_m = re.search(r'^\s{2}metaDescription:\s*"([^"]+)"', block, re.MULTILINE)
            # metaDescription kann über mehrere Zeilen gehen
            if not desc_m:
                desc_m = re.search(r'metaDescription:\s*\n?\s*"([^"]+)"', block)

            if path_m and desc_m:
                path = path_m.group(1)
                title = (meta_title_m or title_m)
                if title:
                    title = title.group(1)
                else:
                    continue
                if "| CaravanWert" not in title and "CaravanWert" not in title:
                    title = title + " | CaravanWert"
                routes[path] = {
                    "title": shorten_title(title),
                    "description": desc_m.group(1)
                }

    # Entferne dynamische Routen und noIndex-Seiten die nicht prerendered werden sollen
    routes_to_remove = [p for p in routes if '${' in p or '/danke' in p]
    for p in routes_to_remove:
        print(f"  Removed non-indexable route: {p}")
        del routes[p]

    return routes


def build_worker():
    """Baut den Worker: SEO-Daten extrahieren und in den Worker injizieren."""
    worker_dir = os.path.dirname(os.path.abspath(__file__))
    src_file = os.path.join(worker_dir, "src", "index.js")
    dist_dir = os.path.join(worker_dir, "dist")
    dist_file = os.path.join(dist_dir, "index.js")

    # SEO-Routen extrahieren
    routes = extract_seo_routes()
    print(f"Extracted {len(routes)} SEO routes")

    # Statistiken
    long_titles = [p for p, d in routes.items() if len(d["title"]) > MAX_TITLE_LENGTH]
    if long_titles:
        print(f"WARNING: {len(long_titles)} titles still > {MAX_TITLE_LENGTH} chars:")
        for p in long_titles[:5]:
            print(f"  [{len(routes[p]['title'])}] {p}: {routes[p]['title']}")

    # Einige Beispiele ausgeben
    for path in sorted(routes.keys())[:5]:
        print(f"  {path}: {routes[path]['title']}")
    if len(routes) > 5:
        print(f"  ... and {len(routes) - 5} more")

    # Worker-Source lesen
    with open(src_file) as f:
        worker = f.read()

    # SEO-Daten injizieren
    worker = worker.replace(
        "__SEO_ROUTES_PLACEHOLDER__",
        json.dumps(routes, ensure_ascii=False)
    )

    # dist-Verzeichnis erstellen
    os.makedirs(dist_dir, exist_ok=True)

    # Worker schreiben
    with open(dist_file, "w") as f:
        f.write(worker)

    print(f"Worker built: {os.path.getsize(dist_file)} bytes → {dist_file}")


if __name__ == "__main__":
    build_worker()
