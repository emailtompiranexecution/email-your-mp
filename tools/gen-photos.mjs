// Scans the photo folder and writes photos.json describing each person.
//
// Naming convention for files in the photo folder:
//     <Name>-<status>.<ext>
//   where <status> contains either "execut..." or "risk".
//   Examples:
//     Abolfazl-executed.jpg          -> name "Abolfazl",  status "executed"
//     Amir Hossein Safari-risk.jpg   -> name "Amir Hossein Safari", status "risk"
//
// Run:  node tools/gen-photos.mjs

import { readdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const PHOTO_DIR = 'photo';
const IMAGE_RE = /\.(jpe?g|png|webp|gif)$/i;

function parse(file) {
  const base = file.replace(/\.[^.]+$/, '');               // drop extension
  const status = /exec/i.test(base) ? 'executed'
               : /risk/i.test(base) ? 'risk'
               : 'risk';
  // remove the trailing status word (and separators) to get the display name
  let name = base
    .replace(/[\s._-]*(executed|execution|executes|exec|at[\s._-]*risk|risk)[\s._-]*$/i, '')
    .replace(/[_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return { file, name, status };
}

const files = readdirSync(join(root, PHOTO_DIR))
  .filter(f => IMAGE_RE.test(f))
  .sort((a, b) => a.localeCompare(b));

const people = files
  .map(parse)
  // skip files that don't yield a real name (e.g. a generic "Risk.png" banner)
  .filter(p => p.name && !/^(executed|risk)$/i.test(p.name));

writeFileSync(join(root, 'photos.json'), JSON.stringify(people, null, 2) + '\n');
console.log('Wrote photos.json with ' + people.length + ' people:');
people.forEach(p => console.log('  - ' + p.name + ' [' + p.status + ']  (' + p.file + ')'));
