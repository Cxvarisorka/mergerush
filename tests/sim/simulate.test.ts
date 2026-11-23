import { describe, expect, it } from 'vitest';
import { createGame } from '../../src/engine/game';
import { greedyBot, percentile, playGame, randomBot, type Bot, type GameStats } from './bots';

/**
 * Balancing simulations (docs/TESTING_STRATEGY.md section 3). These report statistics; the
 * only hard assertions are sanity checks. Run with: npm run sim
 */
function run(bot: Bot, games: number, maxMoves: number) {
  const stats: GameStats[] = [];
  for (let seed = 1; seed <= games; seed++) stats.push(playGame(createGame(seed), bot, seed * 31, maxMoves));
  const sorted = (f: (s: GameStats) => number) => stats.map(f).sort((a, b) => a - b);
  const moves = sorted((s) => s.moves);
  const score = sorted((s) => s.score);
  const tile = sorted((s) => s.highestTile);
  const chain = sorted((s) => s.longestChain);
  const totalMoves = moves.reduce((a, b) => a + b, 0);
  return {
    games,
    finishedShare: stats.filter((s) => s.finished).length / games,
    moves: { p10: percentile(moves, 0.1), median: percentile(moves, 0.5), p90: percentile(moves, 0.9) },
    score: { p10: percentile(score, 0.1), median: percentile(score, 0.5), p90: percentile(score, 0.9) },
    highestTile: { median: percentile(tile, 0.5), p90: percentile(tile, 0.9), max: tile.at(-1) },
    longestChain: { median: percentile(chain, 0.5), max: chain.at(-1) },
    chain2MoveShare: stats.reduce((a, s) => a + s.movesWithChain2, 0) / totalMoves,
  };
}

describe('balancing simulation', () => {
  it('random and greedy bots', () => {
    const random = run(randomBot, 2000, 5000);
    const greedy = run(greedyBot, 300, 2000);
    const report = { random, greedy, greedyToRandomMedianScore: greedy.score.median / Math.max(1, random.score.median) };
    console.log(JSON.stringify(report, null, 2));
    expect(random.finishedShare).toBe(1);
    expect(greedy.score.median).toBeGreaterThan(random.score.median);
  }, 300_000);
});
