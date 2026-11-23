import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createGame, applyMove } from '../../src/engine/game';
import { serialize } from '../../src/engine/serialize';
import { randomPlayout } from './helpers';

/**
 * Golden replays: seed + moves -> frozen final state. Regenerate only when rules change on
 * purpose:  UPDATE_GOLDEN=1 npx vitest run tests/engine/golden.test.ts
 */
interface Golden {
  seed: number;
  moves: number[];
  finalScore: number;
  finalState: string;
}

const SEEDS = [1, 20261123, 0xc0ffee];
const dir = join(__dirname, 'golden');

describe('golden replays', () => {
  it.each(SEEDS)('seed %i replays byte-identically', (seed) => {
    const file = join(dir, `seed-${seed}.json`);
    if (process.env.UPDATE_GOLDEN || !existsSync(file)) {
      const { moves, states } = randomPlayout(createGame(seed), seed ^ 0x5eed);
      const golden: Golden = { seed, moves, finalScore: states.at(-1)!.score, finalState: serialize(states.at(-1)!) };
      writeFileSync(file, `${JSON.stringify(golden, null, 1)}\n`);
    }
    const golden = JSON.parse(readFileSync(file, 'utf8')) as Golden;
    for (let run = 0; run < 2; run++) {
      let state = createGame(golden.seed);
      for (const cell of golden.moves) {
        const r = applyMove(state, cell);
        if (!r.ok) throw new Error(`rejected ${cell}: ${r.reason}`);
        state = r.state;
      }
      expect(state.status).toBe('over');
      expect(state.score).toBe(golden.finalScore);
      expect(serialize(state)).toBe(golden.finalState);
    }
  });
});
