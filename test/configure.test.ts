// @vitest-environment node
import { afterEach, it, expect } from "vitest";
import {
  mkdtemp,
  cp,
  readFile,
  readdir,
  symlink,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
const roots: string[] = [];
const args = [
  "--id",
  "example-rpg",
  "--title",
  "Example RPG",
  "--owner",
  "example",
  "--repo",
  "example-rpg-guide",
];
const paths = [
  "package.json",
  "package-lock.json",
  "game.config.json",
  "index.html",
];
async function project(label: string) {
  const root = await mkdtemp(join(tmpdir(), label));
  roots.push(root);
  for (const path of [
    ...paths,
    "scripts",
    "src",
    "vite.config.ts",
    "tsconfig.json",
  ])
    await cp(resolve(path), join(root, path), { recursive: true });
  await symlink(resolve("node_modules"), join(root, "node_modules"));
  return root;
}
const configure = (root: string, values = args) =>
  spawnSync(process.execPath, ["scripts/configure-game.mjs", ...values], {
    cwd: root,
    encoding: "utf8",
  });
const contents = (root: string) =>
  Promise.all(paths.map((p) => readFile(join(root, p), "utf8")));
async function treeContents(
  root: string,
  sub = "",
): Promise<Record<string, string>> {
  const files: Record<string, string> = {};
  for (const entry of await readdir(join(root, sub), { withFileTypes: true })) {
    if (entry.name === "node_modules") continue;
    const path = join(sub, entry.name);
    if (entry.isDirectory())
      Object.assign(files, await treeContents(root, path));
    else files[path] = await readFile(join(root, path), "utf8");
  }
  return files;
}
afterEach(async () => {
  for (const root of roots.splice(0))
    await rm(root, { recursive: true, force: true });
});
it("rejects invalid inputs without changing any configuration file", async () => {
  const root = await project("guide-config-");
  const before = await treeContents(root);
  for (const bad of [
    args.map((v) => (v === "example-rpg" ? "../escape" : v)),
    [...args, "--unknown", "x"],
    args.map((v) => (v === "example" ? "bad owner" : v)),
    args.map((v) => (v === "Example RPG" ? "<script>alert(1)</script>" : v)),
    args.slice(0, -2),
    [...args, "--id", "duplicate"],
  ]) {
    expect(configure(root, bad).status).not.toBe(0);
    expect(await treeContents(root)).toEqual(before);
  }
});
it("validates the complete current configuration before changes", async () => {
  const root = await project("guide-config-");
  await writeFile(join(root, "package-lock.json"), "broken");
  const before = await contents(root);
  expect(configure(root).status).not.toBe(0);
  expect(await contents(root)).toEqual(before);
});
it("configures coherent metadata and is idempotent in a path with spaces", async () => {
  const root = await project("guide project with spaces ");
  expect(configure(root).status).toBe(0);
  const first = await contents(root);
  const [pkg, lock, game, html] = first;
  expect(JSON.parse(pkg).name).toBe("example-rpg-guide");
  expect(JSON.parse(lock).packages[""].name).toBe("example-rpg-guide");
  expect(JSON.parse(game)).toMatchObject({
    id: "example-rpg",
    title: "Example RPG",
    repository: { owner: "example", name: "example-rpg-guide" },
    mode: "unsupported",
  });
  expect(html).toContain("<title>Example RPG</title>");
  expect(configure(root).status).toBe(0);
  expect(await contents(root)).toEqual(first);
});
it("builds two isolated renamed projects and rejects demo decoding", async () => {
  for (const [id, title] of [
    ["example-rpg", "Example RPG"],
    ["another-game", "Another Game"],
  ]) {
    const root = await project("generated game ");
    const ownArgs = args.map((v) =>
      v === "example-rpg" ? id : v === "Example RPG" ? title : v,
    );
    expect(configure(root, ownArgs).status).toBe(0);
    const build = spawnSync("npm", ["run", "build"], {
      cwd: root,
      encoding: "utf8",
    });
    expect(build.status, build.stdout + build.stderr).toBe(0);
    const script =
      "import { build } from 'vite'; await build({configFile:false,build:{outDir:'adapter-build',lib:{entry:'src/game/adapter.ts',formats:['es'],fileName:'adapter'}}}); const {decode,sampleText}=await import('./adapter-build/adapter.js'); if(decode(new TextEncoder().encode(sampleText)).ok || decode(new TextEncoder().encode(sampleText),'demo').ok) process.exit(1);";
    const adapter = spawnSync(
      process.execPath,
      ["--input-type=module", "-e", script],
      { cwd: root, encoding: "utf8" },
    );
    expect(adapter.status, adapter.stdout + adapter.stderr).toBe(0);
    expect(await readdir(join(root, "dist", "assets"))).not.toHaveLength(0);
  }
});

it.each([
  ["package.json", "[]"],
  ["package.json", "{}"],
  ["package.json", '{"name":42,"version":"0.1.0"}'],
  ["package-lock.json", '{"packages":{"":[]}}'],
  ["package-lock.json", '{"packages":[]}'],
  [
    "game.config.json",
    '{"id":"demo-quest","title":"Demo Quest","description":"Synthetic","repository":[],"mode":"demo"}',
  ],
])(
  "rejects malformed %s metadata shape before any file changes",
  async (path, malformed) => {
    const root = await project("guide-shape-");
    await writeFile(join(root, path), malformed);
    const before = await treeContents(root);
    expect(configure(root).status).not.toBe(0);
    expect(await treeContents(root)).toEqual(before);
  },
);
