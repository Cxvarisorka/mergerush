import { DIRECTIONS, neighbour } from './board';
import type { CellIndex, Direction, GameEvent, Tile } from './types';

export interface Resolution {
  readonly events: GameEvent[];
  readonly points: number;
  readonly chain: number;
  readonly finalCell: CellIndex;
}

/**
 * Resolves the active tile at `activeCell` in place on `board` (which the caller owns).
 * Rules (docs/GAME_DESIGN.md section 4):
 *  1. Candidates: orthogonal neighbours with an equal value.
 *  2. Priority: the current momentum direction if it is a candidate, else Up, Right, Down, Left.
 *  3. The active tile moves into the target, doubles, and keeps its id.
 *  4. It then slides in the same direction until a wall or any tile blocks it.
 *  5. Repeat. Each merge removes a tile, so the loop always terminates.
 */
export function resolve(board: Array<Tile | null>, activeCell: CellIndex, size: number): Resolution {
  const events: GameEvent[] = [];
  let position = activeCell;
  let momentum: Direction | null = null;
  let chain = 0;
  let points = 0;

  for (;;) {
    const active = board[position];
    /* c8 ignore next */
    if (!active) throw new Error('resolve: no active tile');

    const candidates = DIRECTIONS.filter((d) => {
      const n = neighbour(position, d, size);
      return n !== null && board[n]?.value === active.value;
    });
    if (candidates.length === 0) break;

    const direction: Direction =
      momentum !== null && candidates.includes(momentum) ? momentum : candidates[0]!;
    const target = neighbour(position, direction, size)!;
    const removed = board[target]!;
    const newValue = active.value * 2;
    chain += 1;
    const gained = newValue * chain;
    points += gained;

    board[position] = null;
    board[target] = { id: active.id, value: newValue };
    events.push({
      type: 'merged',
      tileId: active.id,
      removedTileId: removed.id,
      from: position,
      to: target,
      direction,
      newValue,
      chain,
      points: gained,
    });
    position = target;
    momentum = direction;

    const slideStart = position;
    let distance = 0;
    for (;;) {
      const next = neighbour(position, direction, size);
      if (next === null || board[next] !== null) break;
      board[next] = board[position]!;
      board[position] = null;
      position = next;
      distance += 1;
    }
    if (distance > 0) {
      events.push({ type: 'slid', tileId: active.id, from: slideStart, to: position, direction, distance });
    }
  }

  return { events, points, chain, finalCell: position };
}
