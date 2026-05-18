# Hex-Grid Weltkarte — Design Spec

## Kontext

Earth 0.1 hat aktuell ein 30×30 Square-Grid mit Canvas-Rendering. Die Karte soll auf hexagonale Kacheln (Civilization-Style) umgestellt werden — Frontend und Backend komplett.

## Entscheidungen

- **Rendering:** Canvas + eigenes Hex-Rendering (kein neues Package)
- **Orientierung:** Pointy-Top (Catan-Style, Spitze oben)
- **Style:** Terrain-Textur mit Noise, Küstenlinien-Glow, Wellen im Ozean
- **Koordinatensystem:** Offset-Koordinaten (odd-r)
- **Hex-Math:** Nach Red Blob Games Guide (Amit Patel)

## Hex-Koordinatensystem (odd-r Offset)

Grid bleibt 30×30. Ungerade Reihen sind um halbe Hex-Breite nach rechts versetzt. Jede Zelle hat 6 Nachbarn statt 4.

### Nachbar-Offsets (odd-r, pointy-top)

Gerade Reihe (r % 2 === 0):
```
[-1, -1], [0, -1],   // oben-links, oben-rechts
[-1,  0], [+1, 0],   // links, rechts
[-1, +1], [0, +1]    // unten-links, unten-rechts
```

Ungerade Reihe (r % 2 === 1):
```
[0, -1], [+1, -1],   // oben-links, oben-rechts
[-1, 0], [+1,  0],   // links, rechts
[0, +1], [+1, +1]    // unten-links, unten-rechts
```

### Pixel-Berechnung (Pointy-Top)

```
x = origin_x + size * √3 * (col + 0.5 * (row & 1))
y = origin_y + size * 1.5 * row
```

Hex-Ecken (pointy-top): `angle = 60° * i - 30°`

### Inverse Transformation (Pixel → Hex)

Für Click-Detection: Approximation via `row = round(py / (size * 1.5))`, dann `col` unter Berücksichtigung des Row-Offsets, mit Distanzkorrektur zum nächsten Hex-Zentrum.

## Backend-Änderungen (simulation-tick/index.ts)

### Nachbar-Funktion

Ersetze die aktuelle 4er-Nachbarschaft durch 6er Hex-Nachbarn:

```typescript
function hexNeighbors(x: number, y: number): [number, number][] {
  const even = [[-1,-1],[0,-1],[-1,0],[1,0],[-1,1],[0,1]];
  const odd  = [[0,-1],[1,-1],[-1,0],[1,0],[0,1],[1,1]];
  const offsets = y % 2 === 0 ? even : odd;
  return offsets
    .map(([dx, dy]) => [x + dx, y + dy] as [number, number])
    .filter(([nx, ny]) => nx >= 0 && ny >= 0 && nx < 30 && ny < 30);
}
```

### Betroffene Stellen

- `landNeighbors()` — nutzt `hexNeighbors()` statt 4-Richtungen
- Agent-Bewegung — wählt aus 6 statt 4 Nachbarn
- Kommunikations-Reichweite — Hex-Distanz statt Manhattan
- Reproduktion — Partner-Suche in Hex-Nachbarschaft
- Arrest-Mechanik — nahe Agenten via Hex-Nachbarn
- Katastrophen-Radius — Hex-basiert
- Port-Mechanik — bleibt gleich (Richtungssuche über Ozean)

### Keine Änderung

- DB-Schema (x/y bleiben Integer 0-29)
- Tiles-String (flat string, 900 Zeichen)
- Landmaske (30 Strings à 30 Zeichen)
- Food/Water Spawning (nur auf Land-Hexen)

## Frontend-Änderungen

### Neue Datei: src/lib/hexUtils.js

Enthält:
- `HEX_SIZE` — Radius eines Hexagons in Pixeln
- `hexToPixel(col, row)` — Offset-Koordinaten → Canvas-Pixel
- `pixelToHex(px, py)` — Canvas-Pixel → nächstes Hex (für Click-Detection)
- `hexCorners(cx, cy, size)` — 6 Eckpunkte eines Pointy-Top-Hexagons
- `hexNeighbors(col, row)` — 6 Nachbarn (odd-r offset)
- `hexDistance(a, b)` — Distanz zwischen zwei Hex-Zellen

### Umbau: src/components/WorldCanvas.jsx

- Canvas-Größe: `width = √3 * size * 30 + size`, `height = 1.5 * size * 29 + 2 * size`
- Tile-Rendering: `drawHex()` statt `fillRect()` — `beginPath` + 6 `lineTo`
- Terrain-Noise: Seeded RNG für deterministische Farbvariation pro Tile
- Ozean: leichte Wellenlinien-Striche
- Küstenlinien: Land-Hexe mit Ozean-Nachbar bekommen dickeren weißen Stroke
- Agenten: Kreise zentriert im Hex (wie bisher, Position via `hexToPixel`)
- Click-Detection: `pixelToHex()` statt `Math.floor(mx / STEP)`

### Ergänzung: src/lib/landMask.js

Export `hexNeighbors()` für Frontend-Nutzung (gleiche Logik wie Backend).

## Dateien-Übersicht

| Datei | Aktion |
|-------|--------|
| `src/lib/hexUtils.js` | NEU — Hex-Math Utilities |
| `src/lib/landMask.js` | ERGÄNZUNG — hexNeighbors Export |
| `src/components/WorldCanvas.jsx` | UMBAU — Hex-Rendering |
| `supabase/functions/simulation-tick/index.ts` | UMBAU — Hex-Nachbarn |

## Nicht im Scope

- WorldGlobe.jsx (3D-Ansicht) — bleibt unverändert, nutzt eigene Projektion
- DB-Schema-Änderungen
- Neue Tile-Typen
- Grid-Größe ändern (bleibt 30×30)
