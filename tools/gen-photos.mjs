// Builds photos.json (what the website loads) by MERGING:
//   1. people.json  — the hand-edited master list of people (name, status, photo)
//   2. the photo/   — any image files, so a dropped-in photo appears automatically
//
// To add people: edit people.json (see PEOPLE-HOWTO.md). To add a photo:
// drop the image in the photo folder and put its filename in the person's
// "photo" field — or just drop it in and it will be auto-added.
//
// Run:  node tools/gen-photos.mjs

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const PHOTO_DIR = 'photo';
const IMAGE_RE = /\.(jpe?g|png|webp|gif)$/i;

const normStatus = s => (/exec/i.test(s || '') ? 'executed' : 'risk');
const normName = s => String(s).toLowerCase().replace(/[^a-z\s]/g, '').replace(/\s+/g, ' ').trim();

function parseFromFilename(file) {
  const base = file.replace(/\.[^.]+$/, '');
  const status = /exec/i.test(base) ? 'executed' : 'risk';
  const name = base
    .replace(/[\s._-]*(executed|execution|executes|exec|at[\s._-]*risk|risk)[\s._-]*$/i, '')
    .replace(/[_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return { file, name, status };
}

let manual = [];
try { manual = JSON.parse(readFileSync(join(root, 'people.json'), 'utf8')); }
catch (e) { console.warn('No readable people.json — using photos only.'); }

const files = readdirSync(join(root, PHOTO_DIR)).filter(f => IMAGE_RE.test(f));
const used = new Set();
const out = [];

// 1) the curated list (in the order written)
for (const p of manual) {
  const name = (p.name || '').trim();
  if (!name) continue;
  let photo = (p.photo || '').trim();
  if (photo && !files.includes(photo)) {
    console.warn('  ! photo not found for "' + name + '": ' + photo + '  (showing silhouette)');
    photo = '';
  }
  if (photo) used.add(photo);
  out.push({ file: photo, name, status: normStatus(p.status), age: p.age || '', note: p.note || '' });
}

// 2) any photos not already referenced -> auto-added from their filename
const manualNames = new Set(out.map(p => normName(p.name)));
for (const f of files.sort((a, b) => a.localeCompare(b))) {
  if (used.has(f)) continue;
  const parsed = parseFromFilename(f);
  if (!parsed.name || /^(executed|risk)$/i.test(parsed.name)) continue; // skip generic (e.g. Risk.png)
  if (manualNames.has(normName(parsed.name))) continue;                  // variant filename of a listed person
  out.push({ ...parsed, age: '', note: '' });
}

// People with a photo float to the top (stable — keeps existing order otherwise),
// so the strongest, face-first entries lead the gallery.
out.sort((a, b) => (b.file ? 1 : 0) - (a.file ? 1 : 0));

writeFileSync(join(root, 'photos.json'), JSON.stringify(out, null, 2) + '\n');
console.log('Wrote photos.json: ' + out.length + ' people (' +
  out.filter(p => p.file).length + ' with photos, ' +
  out.filter(p => !p.file).length + ' with silhouette).');
