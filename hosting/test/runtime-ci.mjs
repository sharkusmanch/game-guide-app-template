#!/usr/bin/env node
// Actual Docker acceptance runner. No registry push or cluster mutation.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { request } from 'node:http';
const nodeImage = 'node:24.21.0-alpine3.24';
const docker = (...args) => command('docker', args);
function command(executable, args) {
  const result = spawnSync(executable, args, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  if (result.status !== 0) throw Error(`${executable} ${args[0]} failed (${result.status}):\n${result.stdout}\n${result.stderr}`);
  return result.stdout.trim();
}
function get(url, method = 'GET', body = '') {
  return new Promise((resolveResult, reject) => {
    const req = request(url, { method, headers: { Authorization: 'Bearer synthetic-test', Cookie: 'session=synthetic-test', 'Content-Length': Buffer.byteLength(body) } }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolveResult({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
    });
    req.setTimeout(5000, () => req.destroy(Error('HTTP deadline')));
    req.on('error', reject);
    req.end(body);
  });
}
const scratch = await mkdtemp(join(tmpdir(), 'guide-runtime-'));
const suffix = `${process.pid}-${Date.now()}`;
const image = `guide-runtime-test:${suffix}`, network = `guide-runtime-${suffix}`;
const containers = [];
try {
  const source = join(scratch, 'source'), output = join(scratch, 'output'), saves = join(scratch, 'saves');
  await Promise.all([mkdir(source), mkdir(output), mkdir(saves)]);
  // Only committed public source is staged, never ignored private/untracked files.
  const archive = spawnSync('git', ['archive', 'HEAD'], { cwd: resolve('.'), maxBuffer: 32 * 1024 * 1024 });
  assert.equal(archive.status, 0);
  const extract = spawnSync('tar', ['-x', '-C', source], { input: archive.stdout });
  assert.equal(extract.status, 0);
  const uid = String(process.getuid()), gid = String(process.getgid());
  docker('run', '--rm', '--mount', `type=bind,src=${source},dst=/source,readonly`, '--mount', `type=bind,src=${output},dst=/output`, nodeImage,
    'sh', '/source/hosting/build-output.sh', '/source', '/output', uid, gid);
  const files = command('find', [output, '-type', 'f']).split('\n');
  assert.ok(files.length > 1);
  for (const path of files) {
    const metadata = await stat(path);
    assert.equal(metadata.uid, Number(uid));
    assert.equal(metadata.gid, Number(gid));
  }
  await writeFile(join(output, 'ownership-write-test'), 'host runner can write');
  await rm(output, { recursive: true });
  assert.equal(spawnSync('test', ['-e', output]).status, 1);
  console.log('PASS read-only source build, runner output ownership, write and unprivileged cleanup');
  docker('build', '-f', 'hosting/Dockerfile', '--build-arg', `SOURCE_REVISION=${command('git', ['rev-parse', 'HEAD'])}`, '-t', image, '.');
  assert.equal(docker('image', 'inspect', image, '--format', '{{.Config.User}}'), '10000:10000');
  const labels = JSON.parse(docker('image', 'inspect', image, '--format', '{{json .Config.Labels}}'));
  assert.equal(labels['org.opencontainers.image.revision'], command('git', ['rev-parse', 'HEAD']));
  assert.equal(labels['org.opencontainers.image.version'], '0.1.0');
  assert.equal(labels['org.opencontainers.image.source'], 'https://github.com/sharkusmanch/game-guide-app-template');
  docker('network', 'create', network);
  const upstream = `guide-upstream-${suffix}`;
  containers.push(upstream);
  docker('run', '-d', '--name', upstream, '--network', network, '--network-alias', 'progress', '--read-only', '--tmpfs', '/tmp', '--user', '10000:10000', nodeImage,
    'node', '--input-type=module', '-e', "import http from 'node:http'; http.createServer((req,res)=>{let body='';req.on('data',c=>body+=c);req.on('end',()=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify({path:req.url,method:req.method,headers:req.headers,body}));});}).listen(8080,'0.0.0.0');");
  await writeFile(join(saves, 'Example RPG (USA) [Rev 1] + Bonus #1.srm'), Buffer.from([0, 255, 4, 128]));
  async function start(name, settings = []) {
    containers.push(name);
    docker('run', '-d', '--name', name, '--network', network, '--read-only', '--tmpfs', '/tmp:rw,nosuid,nodev,noexec,size=16m', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges', '--publish', '127.0.0.1::8080', '--mount', `type=bind,src=${saves},dst=/saves,readonly`, ...settings.flatMap(x => ['--env', x]), image);
    const port = docker('port', name, '8080/tcp').split(':').at(-1);
    const base = `http://127.0.0.1:${port}`;
    for (let attempt = 0; attempt < 40; attempt++) {
      try { if ((await get(`${base}/healthz`)).status === 200) return base; } catch { /* startup */ }
      await new Promise(r => setTimeout(r, 100));
    }
    throw Error(`Runtime did not start: ${docker('logs', name)}`);
  }
  const defaults = await start(`guide-default-${suffix}`);
  assert.equal((await get(`${defaults}/save`)).status, 404);
  assert.equal((await get(`${defaults}/companion/api/achievements/ra/12`)).status, 404);
  const name = `guide-selected-${suffix}`;
  const base = await start(name, ['SAVE_FILE=/saves/Example RPG (USA) [Rev 1] + Bonus #1.srm', 'PROGRESS_UPSTREAM=progress:8080', 'PROGRESS_PREFIX=/service/v1', 'PROGRESS_IDS=12,34']);
  const root = await get(base);
  assert.equal(root.status, 200);
  const asset = root.body.toString().match(/(?:src|href)="\.\/(assets\/[^\"]+)"/);
  assert.ok(asset, 'Built relative asset path');
  assert.equal((await get(`${base}/${asset[1]}`)).status, 200);
  for (const route of ['/', '/healthz', '/save', '/service/v1/api/achievements/ra/12']) {
    assert.equal((await get(`${base}${route}`, 'HEAD')).status, 200);
    assert.equal((await get(`${base}${route}`, 'HEAD')).body.length, 0);
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'TRACE']) assert.equal((await get(`${base}${route}`, method)).status, 405);
  }
  const save = await get(`${base}/save`);
  assert.deepEqual(save.body, Buffer.from([0, 255, 4, 128]));
  assert.equal(save.headers['content-type'], 'application/octet-stream');
  assert.equal(save.headers['cache-control'], 'no-store');
  for (const route of ['/save/', '/save/selected.bin', '/save-other', '/assets/missing.js', '/service/v1', '/service/v1/api/achievements/ra/13', '/service/v1/api/achievements/ra/12/extra']) assert.equal((await get(`${base}${route}`)).status, 404);
  for (const id of [12, 34]) {
    const result = await get(`${base}/service/v1/api/achievements/ra/${id}`, 'GET', 'synthetic-body');
    assert.equal(result.status, 200);
    const upstreamRequest = JSON.parse(result.body);
    assert.equal(upstreamRequest.path, `/service/v1/api/achievements/ra/${id}`);
    assert.equal(upstreamRequest.method, 'GET');
    assert.equal(upstreamRequest.headers.authorization, undefined);
    assert.equal(upstreamRequest.headers.cookie, undefined);
    assert.equal(upstreamRequest.body, '');
  }
  assert.equal(docker('exec', name, 'id', '-u'), '10000');
  assert.equal(docker('exec', name, 'id', '-g'), '10000');
  assert.equal(docker('inspect', name, '--format', '{{.HostConfig.ReadonlyRootfs}}'), 'true');
  docker('exec', name, 'python3', '-c', "import pathlib; pathlib.Path('/tmp/write-test').write_text('ok')");
  assert.notEqual(spawnSync('docker', ['exec', name, 'python3', '-c', "import pathlib; pathlib.Path('/srv/www/write-test').write_text('fail')"]).status, 0);
  for (const setting of ['SAVE_FILE=/saves/a;invalid', 'PROGRESS_IDS=0', 'PROGRESS_IDS=12', 'PROGRESS_UPSTREAM=host:65536', 'PROGRESS_PREFIX=/../escape', 'PROGRESS_PREFIX=/index.html', 'PROGRESS_PREFIX=/assets/private']) {
    const invalid = spawnSync('docker', ['run', '--rm', '--read-only', '--tmpfs', '/tmp', '--env', setting, image], { encoding: 'utf8' });
    assert.notEqual(invalid.status, 0);
    assert.match(invalid.stderr, /Invalid runtime configuration:/);
  }
  docker('stop', '--time', '5', name);
  assert.equal(docker('inspect', name, '--format', '{{.State.ExitCode}}'), '0');
  console.log('PASS actual runtime: assets, methods, exact routes, binary/no-store, prefix, credential/body stripping, invalid settings, UID/read-only root, SIGTERM');
} finally {
  for (const name of containers.reverse()) spawnSync('docker', ['rm', '-f', name], { stdio: 'ignore' });
  spawnSync('docker', ['network', 'rm', network], { stdio: 'ignore' });
  spawnSync('docker', ['image', 'rm', image], { stdio: 'ignore' });
  await rm(scratch, { recursive: true, force: true });
}
