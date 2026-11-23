import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const dir = join(__dirname, '../../src/engine');
const files = readdirSync(dir).filter((f) => f.endsWith('.ts'));

describe('engine purity', () => {
  it.each(files)('%s uses no ambient randomness, clock, DOM, storage or outside imports', (file) => {
    const source = readFileSync(join(dir, file), 'utf8');
    expect(source).not.toMatch(/Math\.random|Date\.|new Date|performance\.|setTimeout|setInterval|requestAnimationFrame/);
    expect(source).not.toMatch(/\b(window|document|localStorage|sessionStorage|navigator)\b/);
    for (const [, spec] of source.matchAll(/from\s+'([^']+)'/g)) expect(spec).toMatch(/^\.\/[\w]+$/);
  });
});
