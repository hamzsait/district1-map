#!/usr/bin/env python3
"""Rebuild d1-outline.geojson and d1-precincts.geojson from City of Austin open data.

  pip install shapely
  python3 scripts/build-data.py

Sources (ArcGIS FeatureServer, public):
  BOUNDARIES_single_member_districts  -> council district polygons (COUNCIL_DISTRICT = 1)
  EXTERNAL_travis_voter_precincts     -> Travis County voting precincts
Precincts are clipped to the district; pieces under 0.01 km2 are dropped as
alignment slivers. Output keeps only `district` / `p` properties.
"""
import json, urllib.request
from shapely.geometry import shape, mapping, MultiPolygon
from shapely.validation import make_valid
from shapely.ops import unary_union

H = "https://services.arcgis.com/0L95CJ0VTaxqcmED/arcgis/rest/services"
KM2 = 111 * 111 * 0.86

def get(url):
    with urllib.request.urlopen(url, timeout=60) as r: return json.load(r)
def rnd(g, nd=6): return shape(json.loads(json.dumps(mapping(g)), parse_float=lambda x: round(float(x), nd)))
def flatten(g):
    if g.geom_type == "Polygon": return [g]
    return [p for q in getattr(g, "geoms", []) for p in flatten(q)]
def mp(g): return MultiPolygon([p for p in flatten(g) if p.area > 0])

d = get(f"{H}/BOUNDARIES_single_member_districts/FeatureServer/0/query?where=COUNCIL_DISTRICT%3D1&outFields=COUNCIL_DISTRICT&outSR=4326&f=geojson")
D = mp(make_valid(shape(d["features"][0]["geometry"])))
for nd in (6, 7):
    Dr = rnd(D, nd)
    if Dr.is_valid: break
assert Dr.is_valid
json.dump({"type": "FeatureCollection", "features": [{"type": "Feature", "properties": {"district": 1}, "geometry": mapping(Dr)}]},
          open("d1-outline.geojson", "w"), separators=(",", ":"))

b = Dr.bounds
env = f"{b[0]-0.02},{b[1]-0.02},{b[2]+0.02},{b[3]+0.02}"
p = get(f"{H}/EXTERNAL_travis_voter_precincts/FeatureServer/0/query?where=1%3D1&geometry={env}&geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=PRECINCT&outSR=4326&f=geojson&resultRecordCount=2000")
assert not p.get("exceededTransferLimit")
out = []
for f in p["features"]:
    c = mp(make_valid(shape(f["geometry"])).intersection(Dr))
    keep = [q for q in c.geoms if q.area * KM2 >= 0.01]
    if not keep: continue
    c = mp(make_valid(rnd(MultiPolygon(keep).simplify(0.000005, preserve_topology=True), 6)))
    out.append({"type": "Feature", "properties": {"p": int(f["properties"]["PRECINCT"])}, "geometry": mapping(c)})
out.sort(key=lambda f: f["properties"]["p"])
json.dump({"type": "FeatureCollection", "features": out}, open("d1-precincts.geojson", "w"), separators=(",", ":"))

ps = [shape(f["geometry"]) for f in out]
u = unary_union(ps)
print(f"district {Dr.area*KM2:.1f} km2 | {len(out)} precincts | coverage {Dr.intersection(u).area/Dr.area:.3%} | all valid: {all(g.is_valid for g in ps)}")
