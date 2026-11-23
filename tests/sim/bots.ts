import { applyMove, validMoves } from '../../src/engine/game';
import { nextInt } from '../../src/engine/rng';
import type { GameState } from '../../src/engine/types';

export type Bot = (state: GameState, rng: number) => { cell: number; rng: number };

export const randomBot: Bot = (state, rng) => {
  const options = validMoves(state);
  const pick = nextInt(rng, options.length);
  return { cell: options[pick.value]!, rng: pick.state };
};

/** Highest immediate score; ties broken by most empty cells left, then lowest index. */
export const greedyBot: Bot = (state, rng) => {
  let best = -1;
  let bestKey = [-1, -1];
  for (const cell of validMoves(state)) {
    const r = applyMove(state, cell);
    if (!r.ok) continue;
    const key = [r.state.score - state.score, r.state.board.filter((t) => t === null).length];
    if (key[0]! > bestKey[0]! || (key[0] === bestKey[0] && key[1]! > bestKey[1]!)) {
      best = cell;
      bestKey = key;
    }
  }
  return { cell: best, rng };
};

export interface GameStats {
  moves: number;
  score: number;
  highestTile: number;
  longestChain: number;
  movesWithChain2: number;
  finished: boolean;
}

export function playGame(start: GameState, bot: Bot, rngSeed: number, maxMoves: number): GameStats {
  let state = start;
  let rng = rngSeed >>> 0;
  let movesWithChain2 = 0;
  while (state.status === 'playing' && state.moves < maxMoves) {
    const choice = bot(state, rng);
    rng = choice.rng;
    const r = applyMove(state, choice.cell);
    if (!r.ok) throw new Error(r.reason);
    if (r.events.filter((e) => e.type === 'merged').length >= 2) movesWithChain2++;
    state = r.state;
  }
  return {
    moves: state.moves,
    score: state.score,
    highestTile: state.highestTile,
    longestChain: state.longestChain,
    movesWithChain2,
    finished: state.status === 'over',
  };
}

export const percentile = (sorted: number[], p: number) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))]!;
