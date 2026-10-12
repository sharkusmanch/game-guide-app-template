import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

// Inspect the actual workflow event and dependency blocks, not a duplicate model.
const section = (yaml, name) => yaml.split('\n').slice(yaml.split('\n').findIndex(l => l === `${name}:`) + 1).join('\n').split(/\n(?=[A-Za-z][^\n]*:)/)[0];
test('a main push has one validation owner; Pages depends on both shared checks', async () => {
  const checks = await readFile('.github/workflows/check.yml', 'utf8');
  const pages = await readFile('.github/workflows/pages.yml', 'utf8');
  const shared = await readFile('.github/workflows/validate.yml', 'utf8');
  assert.match(section(checks, 'on'), /^  pull_request:/m);
  assert.match(section(checks, 'on'), /^  workflow_dispatch:/m);
  assert.doesNotMatch(section(checks, 'on'), /^  push:/m);
  assert.match(section(pages, 'on'), /^  push:\n    branches: \[main\]/m);
  for (const yaml of [checks, pages]) assert.match(section(yaml, 'jobs'), /validate:\n    uses: \.\/\.github\/workflows\/validate.yml/);
  assert.match(section(shared, 'jobs'), /^  browser:/m);
  assert.match(section(shared, 'jobs'), /^  runtime:/m);
  assert.match(section(pages, 'jobs'), /artifact:\n    needs: validate/);
  assert.match(section(pages, 'jobs'), /deploy:\n    needs: \[validate, artifact\]/);
});
for (const failure of [false, true]) test(`container build script ${failure ? 'failure' : 'success'} runs build only and leaves host-owned output`, async () => {
  const scratch = await mkdtemp(join(tmpdir(), 'build proof '));
  try {
    const source = join(scratch, 'source'), output = join(scratch, 'output'), bin = join(scratch, 'bin'), log = join(scratch, 'npm.log');
    await Promise.all([mkdir(source), mkdir(output), mkdir(bin)]);
    await writeFile(join(source, 'source-marker'), 'unchanged');
    await writeFile(join(bin, 'npm'), '#!/bin/sh\necho "$*" >> "$BUILD_CALL_LOG"\nif [ "$1" = ci ] && [ "$FAIL_NPM_CI" = 1 ]; then exit 7; fi\nif [ "$1 $2" = "run build" ]; then mkdir dist; echo synthetic > dist/index.html; fi\n', { mode: 0o755 });
    const result = spawnSync('sh', [resolve('hosting/build-output.sh'), source, output, String(process.getuid()), String(process.getgid())], {
      encoding: 'utf8', env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, BUILD_CALL_LOG: log, FAIL_NPM_CI: failure ? '1' : '0' },
    });
    assert.equal(result.status, failure ? 7 : 0, result.stderr);
    assert.deepEqual((await readFile(log, 'utf8')).trim().split('\n'), failure ? ['ci'] : ['ci', 'run build']);
    assert.equal(await readFile(join(source, 'source-marker'), 'utf8'), 'unchanged');
    assert.equal((await stat(output)).uid, process.getuid());
    assert.equal((await stat(output)).gid, process.getgid());
    if (!failure) assert.equal(await readFile(join(output, 'index.html'), 'utf8'), 'synthetic\n');
    await writeFile(join(output, 'host-write'), 'ok');
    await rm(output, { recursive: true });
  } finally { await rm(scratch, { recursive: true, force: true }); }
});
test('trusted publisher selects the app version and runtime reuses it for OCI metadata', async () => {
  const dockerfile = await readFile('hosting/Dockerfile', 'utf8');
  // Existing publisher selects the first *_VERSION argument for its image tag.
  const versions = [...dockerfile.matchAll(/^ARG ([A-Z_]+_VERSION)(?:=(.*))?$/gm)];
  assert.equal(versions[0][1], 'APP_VERSION');
  assert.equal(versions[0][2], '0.1.0');
  const runtime = dockerfile.split(/FROM alpine:[^\n]+ AS runtime\n/)[1];
  assert.ok(runtime, 'Actual final runtime stage');
  assert.match(runtime, /^ARG APP_VERSION$/m);
  assert.match(runtime, /org\.opencontainers\.image\.version=\$APP_VERSION/);
});
