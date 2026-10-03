#!/usr/bin/env node
/**
 * The test fixtures, stored one JSON file each.
 *
 * A fixture is a small repository the suite scans and compares with a saved
 * snapshot. Until 10.1.2 each one was a folder of loose files, 403 files for
 * 30 fixtures, and the claude.ai plugin directory counts every file in the
 * repository against a limit of 512. So each fixture is kept as
 * tests/fixtures/<name>.json: every path and its text, and a symbolic link as
 * { "link": target }. The suite unpacks them into a temporary folder before
 * it runs, and every test reads folders exactly as before.
 *
 * The folder stays the thing you edit; the JSON is how it is stored:
 *
 *   node tests/fixtures.mjs unpack [name] [dest]   write the folder(s) to dest
 *                                                  (default tests/fixtures-work/)
 *   node tests/fixtures.mjs pack [name] [src]      read the folder(s) back from
 *                                                  src into the JSON
 *   node tests/fixtures.mjs list                   the fixtures and their file counts
 *
 * Text only: a fixture holds no image, font or other binary (the directory
 * would hold the repository for those too). Paths are sorted so a repack
 * changes only what changed.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, readlinkSync, rmSync, statSync, lstatSync, symlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const STORE = join(HERE, 'fixtures');

/** The fixture names the store holds, sorted. */
export function fixtureNames() {
  return readdirSync(STORE).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)).sort();
}

/** Every path under `dir`, relative, with '/' separators, sorted. */
function walk(dir, base = dir, out = []) {
  for (const name of readdirSync(dir).sort()) {
    const full = join(dir, name);
    const st = lstatSync(full);
    if (st.isDirectory()) walk(full, base, out);
    else out.push(relative(base, full).split('\\').join('/'));
  }
  return out;
}

/** A folder as the store's record: { files: { path: text | { link } } }. */
export function packDir(dir) {
  const files = {};
  for (const rel of walk(dir)) {
    const full = join(dir, rel);
    if (lstatSync(full).isSymbolicLink()) { files[rel] = { link: readlinkSync(full) }; continue; }
    const buf = readFileSync(full);
    if (buf.includes(0)) throw new Error(`${rel} is not a text file; fixtures hold text only`);
    files[rel] = buf.toString('utf8');
  }
  return { files };
}

/** Write a store record out as a folder (replacing what is there). */
export function unpackTo(record, dest) {
  rmSync(dest, { recursive: true, force: true });
  mkdirSync(dest, { recursive: true });
  for (const [rel, body] of Object.entries(record.files)) {
    const full = join(dest, rel);
    mkdirSync(dirname(full), { recursive: true });
    if (body && typeof body === 'object' && body.link !== undefined) symlinkSync(body.link, full);
    else writeFileSync(full, body);
  }
}

/** Read one fixture's record from the store. */
export function readFixture(name) {
  const p = join(STORE, `${name}.json`);
  if (!existsSync(p)) throw new Error(`no fixture named ${name} in ${STORE}`);
  return JSON.parse(readFileSync(p, 'utf8'));
}

/** Write one fixture's record to the store, paths sorted. */
export function writeFixture(name, record) {
  const files = Object.fromEntries(Object.entries(record.files).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
  writeFileSync(join(STORE, `${name}.json`), JSON.stringify({ files }, null, 1) + '\n');
}

/**
 * Unpack every fixture (or the named ones) under `dest`, one folder each, and
 * return dest. The suite calls this once at start and points FIXTURES at it.
 */
export function unpackAll(dest, names = fixtureNames()) {
  mkdirSync(dest, { recursive: true });
  for (const name of names) unpackTo(readFixture(name), join(dest, name));
  return dest;
}

// ---------- command line ----------
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [cmd, name, where] = process.argv.slice(2);
  const work = resolve(where ?? join(HERE, 'fixtures-work'));
  if (cmd === 'list') {
    for (const n of fixtureNames()) console.log(`${n.padEnd(18)} ${Object.keys(readFixture(n).files).length} files`);
  } else if (cmd === 'unpack') {
    const names = name && name !== 'all' ? [name] : fixtureNames();
    unpackAll(work, names);
    console.log(`unpacked ${names.length} fixture${names.length === 1 ? '' : 's'} into ${work}`);
    console.log('edit there, then: node tests/fixtures.mjs pack ' + (names.length === 1 ? names[0] : 'all'));
  } else if (cmd === 'pack') {
    const names = name && name !== 'all' ? [name] : readdirSync(work).filter((d) => statSync(join(work, d)).isDirectory()).sort();
    for (const n of names) {
      const dir = join(work, n);
      if (!existsSync(dir)) { console.error(`no folder ${dir}; unpack first`); process.exit(1); }
      writeFixture(n, packDir(dir));
    }
    console.log(`packed ${names.length} fixture${names.length === 1 ? '' : 's'} from ${work}`);
  } else {
    console.log('usage: node tests/fixtures.mjs list | unpack [name|all] [dest] | pack [name|all] [src]');
    process.exit(cmd ? 1 : 0);
  }
}
