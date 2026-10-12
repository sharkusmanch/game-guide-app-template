import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';
const script = resolve('scripts/install-skill.mjs');
const canonical = resolve('skills/build-game-guide');
const run = (...args) => spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' });
for (const mode of ['link', 'copy']) test(`safe ${mode} installation with spaces and bundled references`, async () => {
  const dir = await mkdtemp(join(tmpdir(), 'skill install '));
  try {
    const result = run('--skills-dir', dir, '--mode', mode);
    assert.equal(result.status, 0, result.stderr);
    const target = join(dir, 'build-game-guide');
    assert.match(await readFile(join(target, 'SKILL.md'), 'utf8'), /name: build-game-guide/);
    assert.ok((await readdir(join(target, 'references'))).includes('workflow.md'));
    if (mode === 'link') assert.equal(await realpath(target), canonical);
    assert.equal(run('--skills-dir', dir, '--mode', mode).status, 0);
    await rm(target, { recursive: true, force: true });
    await mkdir(target);
    await writeFile(join(target, 'marker'), 'unrelated');
    assert.notEqual(run('--skills-dir', dir, '--mode', mode).status, 0);
    assert.equal(await readFile(join(target, 'marker'), 'utf8'), 'unrelated');
    assert.notEqual(run('--skills-dir', dir, '--mode', 'unknown').status, 0);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
