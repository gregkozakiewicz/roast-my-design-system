/**
 * A fixture as a folder, for the unit tests. The fixtures are stored as one
 * JSON file each (tests/fixtures.mjs); the first call in a process unpacks
 * them all into a temporary folder and later calls reuse it.
 */
import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { unpackAll } from '../fixtures.mjs';

let root = null;
export function fixture(name) {
  if (!root) root = unpackAll(mkdtempSync(join(tmpdir(), 'roast-fixtures-')));
  return join(root, name);
}
