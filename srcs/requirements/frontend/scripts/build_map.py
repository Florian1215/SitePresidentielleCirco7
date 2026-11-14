"""Génère src/data/europe-map.ts à partir de world-atlas (Natural Earth 1:50m).

Usage :
    curl -L https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-50m.json -o /tmp/countries-50m.json
    python3 scripts/build_map.py /tmp/countries-50m.json src/data/europe-map.ts
"""
import json, math, sys

src, out = sys.argv[1], sys.argv[2]
t = json.load(open(src))
sx, sy = t['transform']['scale']; tx, ty = t['transform']['translate']

# Décodage des arcs TopoJSON (coordonnées delta-encodées)
arcs = []
for arc in t['arcs']:
    x = y = 0; pts = []
    for dx, dy in arc:
        x += dx; y += dy
        pts.append((x * sx + tx, y * sy + ty))
    arcs.append(pts)

def ring(idx):
    pts = []
    for i in idx:
        a = arcs[i] if i >= 0 else arcs[~i][::-1]
        pts.extend(a if not pts else a[1:])
    return pts

LON0, LAT0 = math.radians(17), math.radians(48.5)
def laea(lon, lat):
    l, p = math.radians(lon), math.radians(lat)
    k = math.sqrt(2 / (1 + math.sin(LAT0) * math.sin(p) + math.cos(LAT0) * math.cos(p) * math.cos(l - LON0)))
    return (k * math.cos(p) * math.sin(l - LON0),
            k * (math.cos(LAT0) * math.sin(p) - math.sin(LAT0) * math.cos(p) * math.cos(l - LON0)))

# Cadre : de la mer du Nord à l'Albanie, de la Sarre à la mer Noire
corners = [laea(lo, la) for lo, la in [(5.0, 55.4), (30.2, 55.4), (5.0, 39.2), (30.2, 39.2), (17, 55.6), (17, 39.0)]]
xmin = min(c[0] for c in corners); xmax = max(c[0] for c in corners)
ymin = min(c[1] for c in corners); ymax = max(c[1] for c in corners)
W = 1000.0
S = W / (xmax - xmin); H = (ymax - ymin) * S

def proj(lon, lat):
    x, y = laea(lon, lat)
    return ((x - xmin) * S, (ymax - y) * S)

CIRCO = {'276': 'DE', '008': 'AL', '040': 'AT', '070': 'BA', '100': 'BG', '191': 'HR', '348': 'HU', '807': 'MK',
         '499': 'ME', '616': 'PL', '642': 'RO', '688': 'RS', '703': 'SK', '705': 'SI', '203': 'CZ'}

# Zone couverte par les données : bien plus large que le cadre, pour remplir une carte en pleine largeur
EXT = (-900.0, -300.0, W + 900.0, H + 300.0)


def clip(pts, xmin, ymin, xmax, ymax):
    """Découpe un polygone par le rectangle (Sutherland–Hodgman)."""
    def edge(points, inside, cut):
        out = []
        for i, cur in enumerate(points):
            prev = points[i - 1]
            if inside(cur):
                if not inside(prev):
                    out.append(cut(prev, cur))
                out.append(cur)
            elif inside(prev):
                out.append(cut(prev, cur))
        return out

    def at_x(x):
        return lambda a, b: (x, a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0]))

    def at_y(y):
        return lambda a, b: (a[0] + (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]), y)

    for inside, cut in [
        (lambda p: p[0] >= xmin, at_x(xmin)), (lambda p: p[0] <= xmax, at_x(xmax)),
        (lambda p: p[1] >= ymin, at_y(ymin)), (lambda p: p[1] <= ymax, at_y(ymax)),
    ]:
        pts = edge(pts, inside, cut)
        if not pts:
            break
    return pts


def path_for(polys, step):
    parts = []
    for poly in polys:
        for r in poly:
            pts = clip([proj(lo, la) for lo, la in ring(r)], *EXT)
            if len(pts) < 3:
                continue
            simp = [pts[0]]
            for p in pts[1:]:
                if math.hypot(p[0] - simp[-1][0], p[1] - simp[-1][1]) >= step:
                    simp.append(p)
            if len(simp) < 4:
                continue
            parts.append('M' + 'L'.join(f'{x:.0f} {y:.0f}' if step > 2 else f'{x:.1f} {y:.1f}' for x, y in simp) + 'Z')
    return ''.join(parts)

countries = []
for g in t['objects']['countries']['geometries']:
    name = g['properties']['name']
    code = CIRCO.get(g.get('id')) or ('XK' if name == 'Kosovo' else None)
    polys = g['arcs'] if g['type'] == 'MultiPolygon' else [g['arcs']] if g['type'] == 'Polygon' else []
    # Pays de la circonscription détaillés ; pays voisins plus simplifiés (fichier plus léger)
    d = path_for(polys, 1.6 if code else 3.0)
    if d:
        countries.append((code, d))

# Les pays de la circonscription en dernier (dessinés par-dessus)
countries.sort(key=lambda c: c[0] is not None)
lines = [
    '/**',
    ' * Fond de carte de la 7e circonscription — généré à partir de Natural Earth 1:50m (domaine public)',
    ' * via le paquet world-atlas. Projection azimutale équivalente de Lambert centrée sur 17°E / 48,5°N.',
    ' * Ne pas modifier à la main.',
    ' */',
    f"export const MAP_VIEWBOX = '0 0 {W:.0f} {H:.0f}';",
    '/** Cadre centré sur la circonscription ; les pays voisins sont tracés bien au-delà, pour une carte en pleine largeur. */',
    f'export const MAP_EXTENT = {{ x: {EXT[0]:.0f}, y: {EXT[1]:.0f}, w: {EXT[2]-EXT[0]:.0f}, h: {EXT[3]-EXT[1]:.0f} }};',
    '',
    '/** Pays affichés : `code` = code ISO des pays de la circonscription, `null` pour les pays voisins. */',
    'export const MAP_COUNTRIES: { code: string | null; d: string }[] = [',
]
for code, d in countries:
    lines.append(f"  {{ code: {repr(code) if code else 'null'}, d: '{d}' }},")
lines += [
    '];',
    '',
    'const LON0 = (17 * Math.PI) / 180;',
    'const LAT0 = (48.5 * Math.PI) / 180;',
    '',
    '/** Convertit longitude / latitude en coordonnées du fond de carte. */',
    'export function project(lon: number, lat: number): [number, number] {',
    '  const l = (lon * Math.PI) / 180;',
    '  const p = (lat * Math.PI) / 180;',
    '  const k = Math.sqrt(2 / (1 + Math.sin(LAT0) * Math.sin(p) + Math.cos(LAT0) * Math.cos(p) * Math.cos(l - LON0)));',
    '  const x = k * Math.cos(p) * Math.sin(l - LON0);',
    '  const y = k * (Math.cos(LAT0) * Math.sin(p) - Math.sin(LAT0) * Math.cos(p) * Math.cos(l - LON0));',
    f'  return [(x - ({xmin!r})) * {S!r}, ({ymax!r} - y) * {S!r}];',
    '}',
    '',
]
open(out, 'w').write('\n'.join(lines))
print('viewBox', W, round(H), 'countries', len(countries), 'circo', sum(1 for c in countries if c[0]))
