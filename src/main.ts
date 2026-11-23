// Phase 1 placeholder: proves the engine builds and runs in a browser bundle.
import { createGame } from './engine';

const game = createGame(1);
const rows: string[] = [];
for (let r = 0; r < game.config.size; r++) {
  rows.push(
    game.board
      .slice(r * game.config.size, (r + 1) * game.config.size)
      .map((t) => (t ? String(t.value).padStart(3) : '  .'))
      .join(' '),
  );
}
document.getElementById('out')!.textContent = `Merge Rush engine (seed 1)\n\n${rows.join('\n')}\n\nNext: ${game.queue.join(', ')}`;
