#!/usr/bin/env python3
"""Build d1-polling.json: geocoded Travis County polling places for the Nov 3, 2026 election.

Input:  scripts/polling-locations.csv  (hand-transcribed from the two Travis County
        flyers: "G26 - Early Voting Flyer Court 9.21.pdf" and
        "G26 - Election Day Flyer 9.21.pdf"; one row per unique street address,
        kind = ev / ed / both after dedupe by street address)
Output: d1-polling.json (repo root) — minified JSON array of
        {n, r, a, k, lat, lng, bus, ext, note?}

Geocoding cascade (every site must resolve):
  1. US Census batch geocoder (benchmark=Public_AR_Current) — free, no key.
  2. City of Austin ArcGIS locator (COA_Locator findAddressCandidates).
  3. OSM Nominatim (one-off requests, with User-Agent, throttled 1.1 s).
  4. HAND_FIXES table below (verified manually) for anything all three miss.

Validation (printed at the end):
  - every point inside the Travis County bbox (lat 30.0-30.63, lng -98.2 to -97.3)
  - no two distinct addresses closer than 30 m (suspicious duplicates flagged)
  - per-kind counts and spot checks of known sites.

Usage:  python3 scripts/build-polling.py
        Caches geocode results in scripts/.geocode-cache.json so reruns are cheap.
"""

import csv
import json
import math
import subprocess
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CSV_PATH = ROOT / "scripts" / "polling-locations.csv"
OUT_PATH = ROOT / "d1-polling.json"
CACHE_PATH = ROOT / "scripts" / ".geocode-cache.json"

CENSUS_BATCH_URL = "https://geocoding.geo.census.gov/geocoder/locations/addressbatch"
COA_URL = ("https://maps.austintexas.gov/arcgis/rest/services/Geocode/COA_Locator/"
           "GeocodeServer/findAddressCandidates")
NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
UA = "district-map-polling-builder/1.0 (hamza.sait@gmail.com)"

# Manually verified coordinates for addresses no geocoder resolves cleanly.
HAND_FIXES = {
    # "street|city|zip": (lat, lng),
    # Laura Bush Community Library: Census misses it, and the COA locator
    # mismatches "Bee Caves Rd" to the City of Bee Cave, ~8 km off.
    # Verified manually (30 18'56.19"N 97 52'16.82"W).
    "9411 Bee Caves Rd|Austin|78733": (30.31561, -97.87134),
}

BBOX = (30.0, 30.63, -98.2, -97.3)  # lat_min, lat_max, lng_min, lng_max


def key(row):
    return f"{row['address']}|{row['city']}|{row['zip']}"


def census_batch(rows, cache):
    """Batch-geocode all uncached rows via the Census geocoder. Fills cache."""
    todo = [r for r in rows if key(r) not in cache]
    if not todo:
        return
    batch_file = ROOT / "scripts" / ".census-batch.csv"
    with batch_file.open("w", newline="") as f:
        w = csv.writer(f)
        for i, r in enumerate(todo):
            w.writerow([i, r["address"], r["city"], "TX", r["zip"]])
    out = subprocess.run(
        ["curl", "-sS", "--form", f"addressFile=@{batch_file}",
         "--form", "benchmark=Public_AR_Current", CENSUS_BATCH_URL],
        capture_output=True, text=True, timeout=300)
    batch_file.unlink(missing_ok=True)
    if out.returncode != 0:
        print(f"census batch failed: {out.stderr}", file=sys.stderr)
        return
    for line in csv.reader(out.stdout.splitlines()):
        # id, input addr, Match/No_Match/Tie, Exact/Non_Exact, matched addr, "lng,lat", ...
        if len(line) >= 6 and line[2] == "Match":
            lng, lat = (float(v) for v in line[5].split(","))
            cache[key(todo[int(line[0])])] = {"lat": lat, "lng": lng, "src": "census"}


def coa_geocode(row):
    single = f"{row['address']}, {row['city']}, TX {row['zip']}"
    q = urllib.parse.urlencode({"f": "json", "outSR": "4326", "SingleLine": single,
                                "maxLocations": "1"})
    req = urllib.request.Request(f"{COA_URL}?{q}", headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = json.load(resp)
    cands = data.get("candidates") or []
    if cands:
        loc = cands[0]["location"]
        return {"lat": loc["y"], "lng": loc["x"], "src": "coa"}
    return None


def nominatim_geocode(row):
    q = urllib.parse.urlencode({
        "q": f"{row['address']}, {row['city']}, TX {row['zip']}, USA",
        "format": "json", "limit": "1"})
    req = urllib.request.Request(f"{NOMINATIM_URL}?{q}", headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = json.load(resp)
    time.sleep(1.1)  # Nominatim usage policy: max 1 req/s
    if data:
        return {"lat": float(data[0]["lat"]), "lng": float(data[0]["lon"]),
                "src": "nominatim"}
    return None


def haversine_m(a, b):
    r = 6371000.0
    p1, p2 = math.radians(a[0]), math.radians(b[0])
    dp = p2 - p1
    dl = math.radians(b[1] - a[1])
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(h))


def main():
    rows = list(csv.DictReader(CSV_PATH.open()))
    cache = json.loads(CACHE_PATH.read_text()) if CACHE_PATH.exists() else {}

    census_batch(rows, cache)
    CACHE_PATH.write_text(json.dumps(cache, indent=1))

    for r in rows:
        k = key(r)
        if k in cache:
            continue
        hit = None
        if k in HAND_FIXES:  # hand-verified beats any locator guess
            lat, lng = HAND_FIXES[k]
            cache[k] = {"lat": lat, "lng": lng, "src": "hand"}
            CACHE_PATH.write_text(json.dumps(cache, indent=1))
            continue
        try:
            hit = coa_geocode(r)
        except Exception as e:
            print(f"COA error for {k}: {e}", file=sys.stderr)
        if not hit:
            try:
                hit = nominatim_geocode(r)
            except Exception as e:
                print(f"Nominatim error for {k}: {e}", file=sys.stderr)
        if not hit and k in HAND_FIXES:
            lat, lng = HAND_FIXES[k]
            hit = {"lat": lat, "lng": lng, "src": "hand"}
        # Reject fallback hits that land outside Travis County (bad match).
        if hit and not (BBOX[0] <= hit["lat"] <= BBOX[1] and BBOX[2] <= hit["lng"] <= BBOX[3]):
            print(f"rejected out-of-county {hit['src']} hit for {k}", file=sys.stderr)
            hit = None
            if k in HAND_FIXES:
                lat, lng = HAND_FIXES[k]
                hit = {"lat": lat, "lng": lng, "src": "hand"}
        if hit:
            cache[k] = hit
            CACHE_PATH.write_text(json.dumps(cache, indent=1))
        else:
            print(f"UNRESOLVED: {k}  (add to HAND_FIXES)", file=sys.stderr)

    missing = [key(r) for r in rows if key(r) not in cache]
    if missing:
        print(f"FATAL: {len(missing)} unresolved addresses: {missing}", file=sys.stderr)
        sys.exit(1)

    out = []
    for r in rows:
        c = cache[key(r)]
        item = {
            "n": r["name"],
            "r": r["room"],
            "a": f"{r['address']}, {r['city']} TX {r['zip']}",
            "k": r["kind"],
            "lat": round(c["lat"], 5),
            "lng": round(c["lng"], 5),
            "bus": 1 if r["bus"].strip().lower() == "yes" else 0,
            "ext": int(r["extended"]),
        }
        if r["note"].strip():
            item["note"] = r["note"].strip()
        out.append(item)
    OUT_PATH.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")) + "\n")

    # ---- validation report ----
    src_counts = {}
    for r in rows:
        s = cache[key(r)]["src"]
        src_counts[s] = src_counts.get(s, 0) + 1
    kinds = {}
    for r in rows:
        kinds[r["kind"]] = kinds.get(r["kind"], 0) + 1
    print(f"sites: {len(out)}  kinds: {kinds}  ext: {sum(1 for r in rows if r['extended'] == '1')}")
    print(f"geocoder sources: {src_counts}")

    oob = [o["n"] for o in out
           if not (BBOX[0] <= o["lat"] <= BBOX[1] and BBOX[2] <= o["lng"] <= BBOX[3])]
    print(f"out-of-bbox: {oob or 'none'}")

    close = []
    for i in range(len(out)):
        for j in range(i + 1, len(out)):
            d = haversine_m((out[i]["lat"], out[i]["lng"]), (out[j]["lat"], out[j]["lng"]))
            if d < 30:
                close.append((out[i]["n"], out[j]["n"], round(d, 1)))
    print(f"pairs <30m apart: {close or 'none'}")

    spots = {
        "301 W 2nd St": (30.2650, -97.7470),
        "1161 Angelina St": (30.2705, -97.7188),
    }
    for o in out:
        for street, (slat, slng) in spots.items():
            if o["a"].startswith(street):
                d = haversine_m((o["lat"], o["lng"]), (slat, slng))
                print(f"spot-check {o['n']}: {o['lat']},{o['lng']} vs {slat},{slng} -> {d:.0f} m")


if __name__ == "__main__":
    main()
