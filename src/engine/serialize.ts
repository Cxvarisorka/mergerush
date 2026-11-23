import type { GameConfig, GameState, Tile } from './types';

export function serialize(state: GameState): string {
  return JSON.stringify(state);
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isUint = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0;
const isPowerOfTwo = (v: unknown): v is number => isUint(v) && v >= 2 && (v & (v - 1)) === 0;

function parseConfig(v: unknown): GameConfig | null {
  if (!isObject(v)) return null;
  const { size, initialTiles, queueLength, spawnTable } = v;
  if (!isUint(size) || size < 2 || size > 10) return null;
  if (!isUint(initialTiles) || !isUint(queueLength) || queueLength < 1) return null;
  if (!Array.isArray(spawnTable) || spawnTable.length === 0) return null;
  const table = [];
  for (const entry of spawnTable) {
    if (!isObject(entry) || !isPowerOfTwo(entry.value) || !isUint(entry.weight) || entry.weight < 1) return null;
    table.push({ value: entry.value, weight: entry.weight });
  }
  return { size, initialTiles, queueLength, spawnTable: table };
}

/** Parses and validates a saved game. Returns null for anything malformed or from another version. */
export function deserialize(json: string): GameState | null {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return null;
  }
  if (!isObject(data) || data.version !== 1) return null;
  const config = parseConfig(data.config);
  if (!config) return null;
  const { seed, rngState, board, queue, nextTileId, score, moves, longestChain, highestTile, status } = data;
  if (![seed, rngState, nextTileId, score, moves, longestChain, highestTile].every(isUint)) return null;
  if (status !== 'playing' && status !== 'over') return null;
  if (!Array.isArray(board) || board.length !== config.size * config.size) return null;
  if (!Array.isArray(queue) || queue.length !== config.queueLength || !queue.every(isPowerOfTwo)) return null;

  const ids = new Set<number>();
  const tiles: Array<Tile | null> = [];
  for (const cell of board) {
    if (cell === null) {
      tiles.push(null);
      continue;
    }
    if (!isObject(cell) || !isUint(cell.id) || !isPowerOfTwo(cell.value) || ids.has(cell.id)) return null;
    if (cell.id >= (nextTileId as number)) return null;
    ids.add(cell.id);
    tiles.push({ id: cell.id, value: cell.value });
  }
  const full = tiles.every((t) => t !== null);
  if ((status === 'over') !== full) return null;

  return {
    version: 1,
    config,
    seed: seed as number,
    rngState: rngState as number,
    board: tiles,
    queue: queue as number[],
    nextTileId: nextTileId as number,
    score: score as number,
    moves: moves as number,
    longestChain: longestChain as number,
    highestTile: highestTile as number,
    status,
  };
}
