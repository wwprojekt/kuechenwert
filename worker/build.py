#!/usr/bin/env python3
"""
Build-Script für den Cloudflare Pre-Render Worker.
Extrahiert SEO-Daten (Title, Description) aus dem Quellcode und injiziert sie in den Worker.
Wird automatisch von der GitHub Action bei jedem Push ausgeführt.
"""

import re
import os
import json
import glob

def extract_seo_routes():
    """Extrahiert alle SEO-Routen aus dem Quellcode."""
    routes = {}
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

    # 1. Hauptseiten aus pages/*.tsx
    page_files = glob.glob(os.path.join(base_dir, "src/pages/*.tsx"))
    for f in page_files:
        with open(f) as fh:
            content = fh.read()

        # Skip private pages (noIndex)
        if "noIndex" in content and "true" in content.split("noIndex")[1][:20]:
            continue

        title_match = re.search(r'title="([^"]+)"', content)
        desc_match = re.search(r'description="([^"]+)"', content)
        path_match = re.search(r'canonicalPath="([^"]+)"', content)

        if title_match and desc_match and path_match:
            path = path_match.group(1)
            title = title_match.group(1)
            if "| CaravanWert" not in title:
                title = title + " | CaravanWert"
            routes[path] = {
                "title": title,
                "description": desc_match.group(1)
            }

    # 2. Ratgeber aus data/ratgeber/*.ts
    ratgeber_files = glob.glob(os.path.join(base_dir, "src/data/ratgeber/ratgeber-*.ts"))
    for f in ratgeber_files:
        if "types" in f or "index" in f:
            continue
        with open(f) as fh:
            content = fh.read()

        slugs = re.findall(r'slug:\s*"([^"]+)"', content)
        titles = re.findall(r'title:\s*"([^"]+)"', content)
        descs = re.findall(r'metaDescription:\s*"([^"]+)"', content)

        for i, slug in enumerate(slugs):
            path = f"/ratgeber/{slug}"
            title = titles[i] if i < len(titles) else slug
            desc = descs[i] if i < len(descs) else ""
            if title and desc:
                if "| CaravanWert" not in title:
                    title = title + " | CaravanWert"
                routes[path] = {"title": title, "description": desc}

    # 3. Landing Pages aus data/landing-pages/*.ts
    landing_files = glob.glob(os.path.join(base_dir, "src/data/landing-pages/*.ts"))
    for f in landing_files:
        with open(f) as fh:
            content = fh.read()

        path_match = re.search(r'path:\s*"([^"]+)"', content)
        title_match = re.search(r'metaTitle:\s*"([^"]+)"', content)
        desc_match = re.search(r'metaDescription:\s*"([^"]+)"', content)

        if path_match and title_match and desc_match:
            path = path_match.group(1)
            title = title_match.group(1)
            if "| CaravanWert" not in title:
                title = title + " | CaravanWert"
            routes[path] = {"title": title, "description": desc_match.group(1)}

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

    # Einige Beispiele ausgeben
    for path in sorted(routes.keys())[:5]:
        print(f"  {path}: {routes[path]['title'][:60]}")
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
