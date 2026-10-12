#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const fields = ["id", "title", "owner", "repo"];
const record = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const text = (value) => typeof value === "string" && value.trim().length > 0;
const stringRecord = (value) =>
  record(value) && Object.values(value).every(text);
const htmlEscape = (text) =>
  text.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
try {
  const values = {};
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i]?.slice(2);
    if (
      !argv[i]?.startsWith("--") ||
      !fields.includes(key) ||
      Object.hasOwn(values, key) ||
      typeof argv[i + 1] !== "string" ||
      argv[i + 1].startsWith("--")
    )
      throw Error("Use each of --id, --title, --owner and --repo exactly once");
    values[key] = argv[i + 1];
  }
  if (!fields.every((k) => Object.hasOwn(values, k)))
    throw Error("All four configuration options are required");
  if (
    !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(values.id) ||
    values.id.length > 64
  )
    throw Error("id must be a lowercase slug, up to 64 characters");
  if (
    !/^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/.test(values.owner) ||
    /--/.test(values.owner)
  )
    throw Error("Invalid GitHub owner");
  if (!/^[a-z0-9][a-z0-9-]{0,99}$/.test(values.repo))
    throw Error(
      "repo must be a lowercase name with letters, digits or hyphens",
    );
  if (
    !values.title.trim() ||
    values.title !== values.title.trim() ||
    values.title.length > 100 ||
    /[<>\x00-\x1f\x7f]/.test(values.title)
  )
    throw Error(
      "title must contain 1–100 printable characters without HTML brackets",
    );

  // Read and validate every input before the first write. No command execution.
  const paths = [
    "package.json",
    "package-lock.json",
    "game.config.json",
    "index.html",
  ];
  const originals = await Promise.all(
    paths.map((p) => readFile(resolve(root, p), "utf8")),
  );
  const [pkg, lock, game] = originals.slice(0, 3).map((x) => JSON.parse(x));
  if (
    !record(pkg) ||
    !text(pkg.name) ||
    !text(pkg.version) ||
    !stringRecord(pkg.scripts) ||
    !["dev", "test", "typecheck", "build", "configure"].every((key) =>
      text(pkg.scripts[key]),
    ) ||
    !stringRecord(pkg.dependencies) ||
    !stringRecord(pkg.devDependencies) ||
    !record(pkg.engines) ||
    !text(pkg.engines.node) ||
    !record(lock) ||
    lock.lockfileVersion !== 3 ||
    !record(lock.packages) ||
    !record(lock.packages[""]) ||
    lock.name !== pkg.name ||
    lock.version !== pkg.version ||
    lock.packages[""].name !== pkg.name ||
    lock.packages[""].version !== pkg.version ||
    !stringRecord(lock.packages[""].dependencies) ||
    !stringRecord(lock.packages[""].devDependencies) ||
    !record(game) ||
    !text(game.id) ||
    !text(game.title) ||
    !text(game.description) ||
    !record(game.repository) ||
    !text(game.repository.owner) ||
    !text(game.repository.name) ||
    !["demo", "unsupported"].includes(game.mode)
  )
    throw Error("Invalid existing project configuration");
  if (
    !/<title>[^<]*<\/title>/.test(originals[3]) ||
    !/<meta\s+name="description"\s+content="[^"]*"\s*\/>/.test(originals[3])
  )
    throw Error("Missing HTML metadata markers");
  const renamed = values.id !== "demo-quest";
  const description = renamed
    ? `A game companion for ${values.title}. Implement the game adapter to decode saves.`
    : "A synthetic companion demonstrating a reusable game guide.";
  pkg.name = values.repo;
  lock.name = values.repo;
  lock.packages[""].name = values.repo;
  Object.assign(game, {
    id: values.id,
    title: values.title,
    description,
    repository: { owner: values.owner, name: values.repo },
    mode: renamed ? "unsupported" : "demo",
  });
  const html = originals[3]
    .replace(
      /<title>[^<]*<\/title>/,
      () => `<title>${htmlEscape(values.title)}</title>`,
    )
    .replace(
      /<meta\s+name="description"\s+content="[^"]*"\s*\/>/,
      () => `<meta name="description" content="${htmlEscape(description)}" />`,
    );
  const next = [pkg, lock, game]
    .map((v) => JSON.stringify(v, null, 2) + "\n")
    .concat(html);
  for (let i = 0; i < paths.length; i++)
    if (next[i] !== originals[i])
      await writeFile(resolve(root, paths[i]), next[i]);
  console.log(`Configured ${values.id}; decoder mode: ${game.mode}`);
} catch (error) {
  console.error(
    error instanceof Error ? error.message : "Configuration failed",
  );
  process.exitCode = 1;
}
