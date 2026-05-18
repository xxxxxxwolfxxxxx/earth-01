// src/lib/hexUtils.js
// Pointy-top hex grid using odd-r offset coordinates.
// Reference: Red Blob Games (Amit Patel) hex grid guide.

export const HEX_SIZE = 18 // radius in pixels

// Pointy-top: flat sides left/right, points top/bottom
const SQRT3 = Math.sqrt(3)

// --- Coordinate Conversion ---

// Offset (col, row) → pixel center
export function hexToPixel(col, row) {
  const x = HEX_SIZE * SQRT3 * (col + 0.5 * (row & 1))
  const y = HEX_SIZE * 1.5 * row
  return [x, y]
}

// Pixel → nearest offset (col, row)
// Uses cube-coordinate rounding for accuracy.
export function pixelToHex(px, py) {
  // Convert pixel to fractional axial coordinates (pointy-top)
  const q = (SQRT3 / 3 * px - 1 / 3 * py) / HEX_SIZE
  const r = (2 / 3 * py) / HEX_SIZE
  // Axial to cube
  const s = -q - r
  // Round cube coordinates
  let rq = Math.round(q)
  let rr = Math.round(r)
  let rs = Math.round(s)
  const dq = Math.abs(rq - q)
  const dr = Math.abs(rr - r)
  const ds = Math.abs(rs - s)
  if (dq > dr && dq > ds) rq = -rr - rs
  else if (dr > ds) rr = -rq - rs
  // Cube (rq, rr) is axial — convert to odd-r offset
  const col = rq + Math.floor((rr - (rr & 1)) / 2)
  const row = rr
  return [col, row]
}

// --- Hex Geometry ---

// 6 corner points for a pointy-top hex centered at (cx, cy)
export function hexCorners(cx, cy, size) {
  const corners = []
  for (let i = 0; i < 6; i++) {
    const angleDeg = 60 * i - 30
    const angleRad = Math.PI / 180 * angleDeg
    corners.push([
      cx + size * Math.cos(angleRad),
      cy + size * Math.sin(angleRad),
    ])
  }
  return corners
}

// --- Neighbors (odd-r offset) ---

const EVEN_OFFSETS = [[-1, -1], [0, -1], [-1, 0], [1, 0], [-1, 1], [0, 1]]
const ODD_OFFSETS  = [[0, -1], [1, -1], [-1, 0], [1, 0], [0, 1], [1, 1]]

export function hexNeighbors(col, row, gridSize = 30) {
  const offsets = row % 2 === 0 ? EVEN_OFFSETS : ODD_OFFSETS
  return offsets
    .map(([dc, dr]) => [col + dc, row + dr])
    .filter(([c, r]) => c >= 0 && r >= 0 && c < gridSize && r < gridSize)
}

// --- Distance ---

// Convert odd-r offset to cube coordinates for distance calculation
function offsetToCube(col, row) {
  const q = col - Math.floor((row - (row & 1)) / 2)
  const r = row
  const s = -q - r
  return [q, r, s]
}

export function hexDistance(col1, row1, col2, row2) {
  const [q1, r1, s1] = offsetToCube(col1, row1)
  const [q2, r2, s2] = offsetToCube(col2, row2)
  return Math.max(Math.abs(q1 - q2), Math.abs(r1 - r2), Math.abs(s1 - s2))
}

// All cells within radius (inclusive) of (col, row)
export function hexCellsInRadius(col, row, radius, gridSize = 30) {
  const [cq, cr, cs] = offsetToCube(col, row)
  const cells = []
  for (let dq = -radius; dq <= radius; dq++) {
    for (let dr = Math.max(-radius, -dq - radius); dr <= Math.min(radius, -dq + radius); dr++) {
      const ds = -dq - dr
      const q = cq + dq
      const r = cr + dr
      // Cube to odd-r offset
      const c = q + Math.floor((r - (r & 1)) / 2)
      if (c >= 0 && r >= 0 && c < gridSize && r < gridSize) {
        cells.push([c, r])
      }
    }
  }
  return cells
}

// --- Canvas Size ---

export function canvasSize(gridSize = 30) {
  const w = Math.ceil(HEX_SIZE * SQRT3 * (gridSize + 0.5)) + 2
  const h = Math.ceil(HEX_SIZE * 1.5 * (gridSize - 1) + HEX_SIZE * 2) + 2
  return [w, h]
}
