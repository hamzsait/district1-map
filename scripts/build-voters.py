#!/usr/bin/env python3
"""Build voter data files from the Travis County registered voter list.

Source (public record, published by Travis County):
https://voter-registration-maps-traviscountytx.hub.arcgis.com/pages/data-files-and-reference

Usage: python3 scripts/build-voters.py /path/to/Registered_Voter_List.csv

Outputs (repo root):
  d1-voters.json       — per-precinct registered/active counts (tiny, loaded with the map)
  d1-voter-index.json  — [name, precinct, active, registered address] for District 1
                         voters only (CITYSM == CA1), lazy-loaded by the lookup UI
"""
import csv, json, collections, re, sys, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def main(path):
    counts = collections.defaultdict(lambda: {"total": 0, "active": 0})
    voters = []
    with open(path, newline="", encoding="utf-8", errors="replace") as f:
        for row in csv.DictReader(f):
            if row.get("CITYSM", "").strip() != "CA1":
                continue
            pm = re.match(r"P\s*(\d+)", row.get("Precinct", "").strip())
            if not pm:
                continue
            p = int(pm.group(1))
            active = 1 if row.get("Status", "").strip() == "ACTIVE" else 0
            counts[p]["total"] += 1
            counts[p]["active"] += active
            name = " ".join(row.get("NAME", "").split())
            addr = " ".join(row.get("Residential Address", "").split())
            voters.append([name, p, active, addr])

    voters.sort(key=lambda v: v[0])
    with open(os.path.join(ROOT, "d1-voters.json"), "w") as f:
        json.dump({str(p): counts[p] for p in sorted(counts)}, f, separators=(",", ":"))
    with open(os.path.join(ROOT, "d1-voter-index.json"), "w") as f:
        json.dump(voters, f, separators=(",", ":"), ensure_ascii=False)
    print(f"{len(voters)} voters, {sum(v[2] for v in voters)} active, {len(counts)} precincts")

if __name__ == "__main__":
    main(sys.argv[1])
