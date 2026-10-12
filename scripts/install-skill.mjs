#!/usr/bin/env node
import { cp, lstat, mkdir, readFile, readdir, realpath, symlink } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// The source stays canonical; an existing unrelated target is never replaced.
const source = fileURLToPath(new URL('../skills/build-game-guide/', import.meta.url));
async function identical(a, b) {
  const aa = await readdir(a, { withFileTypes: true });
  const bb = await readdir(b, { withFileTypes: true });
  if (aa.length !== bb.length) return false;
  for (const entry of aa) {
    const other = bb.find(e => e.name === entry.name);
    if (!other || entry.isSymbolicLink() || other.isSymbolicLink() || entry.isDirectory() !== other.isDirectory()) return false;
    const x = join(a, entry.name), y = join(b, entry.name);
    if (entry.isDirectory() ? !await identical(x, y) : !(await readFile(x)).equals(await readFile(y))) return false;
  }
  return true;
}
try {
  const args = process.argv.slice(2);
  const options = {};
  for (let i = 0; i < args.length; i += 2) {
    if (!['--skills-dir', '--mode'].includes(args[i]) || !args[i + 1] || options[args[i]]) throw Error('Use --skills-dir PATH [--mode link|copy]');
    options[args[i]] = args[i + 1];
  }
  const mode = options['--mode'] ?? 'link';
  if (!options['--skills-dir'] || !['link', 'copy'].includes(mode)) throw Error('Use --skills-dir PATH [--mode link|copy]');
  const target = join(resolve(options['--skills-dir']), 'build-game-guide');
  const sourceReal = await realpath(source);
  let existing;
  try { existing = await lstat(target); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  if (existing) {
    if (existing.isSymbolicLink() && await realpath(target).catch(() => '') === sourceReal || existing.isDirectory() && await identical(source, target)) {
      console.log(`Already installed: ${target}`);
    } else throw Error(`Refusing to overwrite existing target: ${target}`);
  } else {
    await mkdir(resolve(options['--skills-dir']), { recursive: true });
    if (mode === 'link') await symlink(sourceReal, target, 'dir');
    else await cp(source, target, { recursive: true, errorOnExist: true, force: false });
    console.log(`Installed ${mode}: ${target}`);
  }
} catch (e) { console.error(e.message); process.exitCode = 1; }
