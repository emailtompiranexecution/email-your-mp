// Weekly review helper.
// Monitors reputable sources — Amnesty International and Iran Human Rights (IHR) —
// for Iran execution / death-sentence coverage, pulls out candidate person names,
// compares them with the people currently on the site (people.json), and writes
// review.md for a human to review. It never edits the site itself.
//
// Run:  node tools/amnesty-review.mjs   ->   writes review.md

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const UA = { 'User-Agent': 'Mozilla/5.0 (campaign-review-bot; +https://github.com/)' };

// --- sources ---
const AMNESTY_INDEX = 'https://www.amnesty.org/en/location/middle-east-and-north-africa/middle-east/iran/';
const IHR_FEED = 'https://iranhr.net/en/rss/';   // Atom feed (not bot-blocked)
const KW = /execut|hang(?:ed|ing|s)?|sentenced to death|death sentence|risk of execution/i;
// Campaign scope = protesters / political cases only (IHR also lists many ordinary
// murder & drug executions, which do NOT belong on this campaign).
const POLITICAL = /protest|political prisoner|dissident|moharebeh|enmity against god|corruption on earth|baghi|national security|opposition|demonstrat|for protesting/i;

// Capitalised sequences that are not people.
const STOP = new Set(('Iran Iranian Amnesty International Revolutionary Court Guards Supreme ' +
  'Islamic Republic Middle East North Africa Human Rights Government Canada United Nations ' +
  'Ghezel Hesar Evin Karaj Tehran Esfahan Isfahan Shiraz Shahroud Semnan Alborz Kurdish ' +
  'January February March April May June July August September October November December ' +
  'Basij God Molotov Espionage Law Further Information Urgent Action News Middle-East ' +
  'Prison Prisons Death Execution Executions Executed Hanged Hangings Hanging Public Protesters ' +
  'Protester Dissidents State Security Forces First Second Report Statement Regional Director ' +
  'Who What Run Work Countries Research Impact Search Donate Involved Education Copyright Credit ' +
  'Political Prisoner Imminent Risk Groups Call Action Afghan Nationals Murder Strike Continues ' +
  'English Espaol Espanol Franais Francais Deutsch Arabic Farsi ' +
  'Gonbad Kavous Urmia Ardabil Mashhad Ghezelhesar Gohardasht Semnan Gilan')
  .split(/\s+/).map(s => s.toLowerCase()));

const norm = s => String(s).toLowerCase().replace(/[^a-z\s]/g, '').replace(/\s+/g, ' ').trim();
const strip = html => html.replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ')
  .replace(/&[a-z]+;/gi, ' ').replace(/&#\d+;/g, ' ').replace(/\s+/g, ' ').trim();
const cdata = s => String(s).replace(/<!\[CDATA\[/g, '').replace(/\]\]>/g, '').trim();

async function get(url) {
  try { const r = await fetch(url, { headers: UA }); return r.ok ? await r.text() : ''; }
  catch { return ''; }
}

// Extract candidate names that sit within ~90 characters of execution wording.
// Case-insensitive on the status word, case-sensitive on the name — works for
// both Amnesty prose ("execution of Ali Fahim") and IHR titles ("... Safari Executed").
function candidateNames(text, into) {
  const NAME = /[A-Z][a-zA-Zà-ÿ’'-]+(?:\s+[A-Z][a-zA-Zà-ÿ’'-]+){1,3}/g;
  const anchor = new RegExp(KW.source, 'gi');
  let a;
  while ((a = anchor.exec(text))) {
    const win = text.slice(Math.max(0, a.index - 90), a.index + 90);
    let m; NAME.lastIndex = 0;
    while ((m = NAME.exec(win))) {
      const disp = m[0].replace(/\s+/g, ' ').trim();
      const words = norm(disp).split(' ');
      if (words.length < 2 || words.length > 4) continue;
      if (words.some(w => STOP.has(w))) continue;
      if (!into.has(norm(disp))) into.set(norm(disp), disp);
    }
  }
}

// --- gather documents + source links ---
const found = new Map();
const amnestyLinks = [];
const ihrLinks = [];

// Amnesty: HTML index -> article links -> article text
const aIndex = await get(AMNESTY_INDEX);
const aArts = [...new Set([...aIndex.matchAll(/href="(https:\/\/www\.amnesty\.org\/en\/latest\/news\/[^"]+)"/g)]
  .map(m => m[1].split('?')[0])
  .filter(u => /execut|death-sentence|at-risk|hang|protester/i.test(u)))].slice(0, 8);
for (const u of aArts) {
  const t = strip(await get(u));
  if (!t) continue;
  amnestyLinks.push(u);
  candidateNames(t, found);
}

// IHR: Atom feed -> entries about executions
const feed = await get(IHR_FEED);
const entries = [...feed.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map(m => {
  const b = m[1];
  const title = cdata((b.match(/<title[^>]*>([\s\S]*?)<\/title>/) || [])[1] || '');
  const link = (b.match(/<link[^>]*href="([^"]+)"/) || [])[1] || '';
  const summary = strip(cdata((b.match(/<summary[^>]*>([\s\S]*?)<\/summary>/) || [])[1] || ''));
  return { title, link: link.replace(/^http:/, 'https:'), summary };
});
for (const e of entries.slice(0, 20)) {
  const blob = e.title + ' ' + e.summary;
  if (!KW.test(blob) || !POLITICAL.test(blob)) continue;   // protester/political cases only
  ihrLinks.push({ title: e.title, url: e.link });
  candidateNames(e.title + '. ' + e.summary, found);
}

// --- diff against the site ---
const people = JSON.parse(readFileSync(join(root, 'people.json'), 'utf8'));
const onSite = new Set(people.map(p => norm(p.name)));
const newNames = [...found.entries()].filter(([n]) => !onSite.has(n)).map(([, d]) => d);

// --- report ---
const date = new Date().toISOString().slice(0, 10);
let md = `# Weekly review — ${date}\n\n`;
md += `**Automated reminder to keep the campaign list current.** Nothing has been changed on ` +
  `the site — this is for a human to review. Confirm on the sources, then edit \`people.json\` if needed.\n\n`;

md += `## Sources to skim\n`;
md += `- Amnesty — Latest Iran: ${AMNESTY_INDEX}\n`;
amnestyLinks.forEach(u => md += `  - ${u}\n`);
md += `- Iran Human Rights — feed: ${IHR_FEED}\n`;
ihrLinks.forEach(x => md += `  - ${x.title} — ${x.url}\n`);

md += `\n## Names stated near execution wording, not yet on the site\n`;
md += newNames.length
  ? newNames.map(n => `- [ ] **${n}** — confirm on a source, then add to \`people.json\``).join('\n') + '\n'
  : `_None detected this week. Extraction is conservative and can miss names — please still skim the sources above._\n`;

md += `\n## Also verify (quick manual check)\n`;
md += `- [ ] Has any **"at risk"** person on the site been **executed**? (update their status)\n`;
md += `- [ ] Any case **resolved / released**? (consider removing)\n`;
md += `- [ ] Any **new** protester execution or death sentence above that isn't on the site?\n`;

md += `\n---\n_Heuristic tool across Amnesty + Iran Human Rights — a prompt to review, not a source of truth. ` +
  `Only edit \`people.json\` after confirming._\n`;

writeFileSync(join(root, 'review.md'), md);
console.log('review.md written — new-name candidates: ' + newNames.length +
  ', Amnesty articles: ' + amnestyLinks.length + ', IHR items: ' + ihrLinks.length);
