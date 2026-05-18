// 30x30 land mask matching simulation-tick. L=land, o=ocean.
// Maps to lat 80°N..80°S, lng 160°W..160°E
export const LAND_MASK = [
  "oooooooooooooooooooooooooooooo", // 0  Arctic
  "oLLoooooooooooooooLLLLLLLooooo", // 1  Alaska, Siberia
  "oLLLooooooooooLLoLLLLLLLLooooo", // 2  W.Canada, Iceland, Russia
  "oLLLLoooooooooLLLLLLLLLLLLoooo", // 3  Canada, Scandinavia, Russia
  "ooLLLLLooooooLLLLLLLLLLLLLoooo", // 4  S.Canada, UK/Europe, Russia
  "ooLLLLLooooooLLLLLLLLLLLLLoooo", // 5  US/Canada, W.Europe, Russia
  "ooLLLLLooooooLLLLLLLLLLLLooooo", // 6  US, Med, Central Asia, China
  "oooLLLLooooooLLLLLLLLLLLLooooo", // 7  US, N.Africa, Middle East, China
  "oooLLLLooooooLLLLLLLLLLLLooooo", // 8  S.US, Sahara, India, China
  "ooooLLLooooooLLLLLoLLLLLLooooo", // 9  Mexico, W.Africa, India, SE Asia
  "oooooLLooooooLLLLLoLLLLLoooooo", // 10 C.America, Africa, India
  "oooooLLooooooLLLLLoLLLLLoooooo", // 11 C.America, W.Africa, SE Asia
  "ooooooLLooooLLLLLLoooLLLoooooo", // 12 N.S.America, W.Africa, SE Asia
  "ooooooLLLooLLLLLLLoooooLoooooo", // 13 S.America, C.Africa, Indonesia
  "oooooooLLLoLLLLLLooooooooooLoo", // 14 Brazil, Africa, PNG
  "oooooooLLLoooLLLLooooooooLLLoo", // 15 Brazil, E.Africa, N.Australia
  "ooooooooLLooooLLLLoooooLLLLLoo", // 16 Brazil, E.Africa, Australia
  "ooooooooLLooooLLLooooooLLLLLoo", // 17 S.Brazil, SE.Africa, Australia
  "oooooooooLLoooooLLooooLLLLLLoo", // 18 Argentina, S.Africa, Australia
  "oooooooooLLoooooLLoooooLLLLLoo", // 19 Argentina, S.Africa, Australia
  "ooooooooLLooooooLooooooooLLLoo", // 20 Argentina, S.Africa tip, SE Aus
  "ooooooooLLoooooooooooooooooooo", // 21 Patagonia
  "oooooooooLoooooooooooooooooooo", // 22 Patagonia tip
  "oooooooooooooooooooooooooooooo", // 23
  "oooooooooooooooooooooooooooooo", // 24
  "oooooooooooooooooooooooooooooo", // 25
  "oooooooooooooooooooooooooooooo", // 26
  "oooooooooooooooooooooooooooooo", // 27
  "oooooooooooooooooooooooooooooo", // 28
  "oooooooooooooooooooooooooooooo", // 29
].map(row => row.length < 30 ? row + "o".repeat(30 - row.length) : row.slice(0, 30))

export function isLand(x, y) {
  if (y < 0 || y >= 30 || x < 0 || x >= 30) return false
  return LAND_MASK[y][x] === 'L'
}

// Latitude-based land color (empty tiles)
export function landBaseColor(y) {
  if (y <= 2 || y >= 24) return [220, 230, 240] // polar/ice
  if (y <= 4 || y >= 21) return [140, 160, 100] // taiga/tundra
  if (y <= 6 || y >= 18) return [120, 150, 80]  // temperate
  if (y <= 8 || y >= 15) return [180, 170, 100] // steppe/savanna
  if (y <= 10) return [210, 190, 130]            // desert/arid
  return [60, 130, 60]                           // tropical
}

export const OCEAN_COLOR = [20, 50, 100]
export const DEEP_OCEAN_COLOR = [10, 30, 70]

// Hex neighbors (odd-r offset, pointy-top)
const EVEN_OFFSETS = [[-1, -1], [0, -1], [-1, 0], [1, 0], [-1, 1], [0, 1]]
const ODD_OFFSETS  = [[0, -1], [1, -1], [-1, 0], [1, 0], [0, 1], [1, 1]]

export function hexNeighbors(col, row, gridSize = 30) {
  const offsets = row % 2 === 0 ? EVEN_OFFSETS : ODD_OFFSETS
  return offsets
    .map(([dc, dr]) => [col + dc, row + dr])
    .filter(([c, r]) => c >= 0 && r >= 0 && c < gridSize && r < gridSize)
}

export function landHexNeighbors(col, row, gridSize = 30) {
  return hexNeighbors(col, row, gridSize).filter(([c, r]) => isLand(c, r))
}
