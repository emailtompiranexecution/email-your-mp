// Weekly review helper.
// Fetches Amnesty International's latest Iran coverage, pulls out candidate
// person names near execution/death-sentence wording, compares them with the
// people currently on the site (people.json), and writes review.md — a report
// for a human to review. It never edits the site itself.
//
// Run:  node tools/amnesty-review.mjs   ->   writes review.md

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const UA = { 'User-Agent': 'Mozilla/5.0 (campaign-review-bot; +https://github.com/)' };

// Where to look. The Iran location page lists the newest articles.
const INDEX_URLS = [
  'https://www.amnesty.org/en/location/middle-east-and-north-africa/middle-east/iran/'
];

// Words that look like Capitalised names but are not people.
const STOP = new Set(('Iran Iranian Amnesty International Revolutionary Court Guards Supreme ' +
  'Islamic Republic Middle East North Africa Human Rights Government Canada United Nations ' +
  'Ghezel Hesar Evin Karaj Tehran Esfahan Isfahan Shiraz Shahroud Semnan Alborz Kurdish ' +
  'January February March April May June July August September October November December ' +
  'Basij God Molotov Espionage Law Further Information Urgent Action News Middle-East ' +
  'Prison Prisons Death Execution Executions Protesters Dissidents State Security Forces')
  .split(/\s+/).map(s => s.toLowerCase()));

const norm = s => String(s).toLowerCase().replace(/[^a-z\s]/g, '').replace(/\s+/g, ' ').trim();
const strip = html => html.replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ')
  .replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim();

async function get(url) {
  try {
    const r = await fetch(url, { headers: UA });
    if (!r.ok) return '';
    return await r.text();
  } catch { return ''; }
}

function articleLinks(html) {
  const out = new Set();
  const re = /href="(https:\/\/www\.amnesty\.org\/en\/latest\/news\/[^"]+)"/g;
  let m;
  while ((m = re.exec(html))) {
    const u = m[1];
    if (/execut|death-sentence|at-risk|hang|protester/i.test(u)) out.add(u.split('?')[0]);
  }
  return [...out];
}

function candidateNames(text) {
  const names = new Map(); // norm -> display
  const NAME = "[A-Z][a-z’'-]+(?:\\s+[A-Z][a-z’'-]+){1,3}";
  // Only look at names that sit right next to execution wording, e.g.
  //   "execution of <Name>", "<Name> was executed", "<Name> ... sentenced to death".
  // This window approach ignores page menus/footers, which are never near these verbs.
  const patterns = [
    new RegExp("execution[s]?\\s+of\\s+(" + NAME + ")", "g"),
    new RegExp("(" + NAME + ")\\s+(?:was|were|has been|had been|is|are)\\s+(?:secretly\\s+)?(?:arbitrarily\\s+)?(?:executed|hanged)", "g"),
    new RegExp("(" + NAME + ")\\s*,[^.]{0,60}?(?:executed|sentenced to death|death sentence|at risk of execution)", "g"),
    new RegExp("(" + NAME + ")\\s+(?:was|were|is|are|has been)\\s+(?:sentenced to death|at (?:imminent )?risk of execution)", "g")
  ];
  const add = disp => {
    disp = String(disp).replace(/\s+/g, ' ').trim();
    const n = norm(disp);
    const words = n.split(' ');
    if (words.length < 2 || words.length > 4) return;
    if (words.some(w => STOP.has(w))) return;
    if (!names.has(n)) names.set(n, disp);
  };
  for (const re of patterns) { let m; while ((m = re.exec(text))) add(m[1]); }
  // lists such as "the executions of A, B and C" — pull each name from the clause
  const listRe = new RegExp("execution[s]?\\s+of\\s+([^.]{0,200})", "g");
  let lm;
  while ((lm = listRe.exec(text))) {
    lm[1].split(/,|\band\b/).forEach(frag => {
      const mm = frag.trim().match(new RegExp("^(" + NAME + ")"));
      if (mm) add(mm[1]);
    });
  }
  return names;
}

const people = JSON.parse(readFileSync(join(root, 'people.json'), 'utf8'));
const onSite = new Set(people.map(p => norm(p.name)));

// 1) discover article URLs
let articles = [];
for (const u of INDEX_URLS) articles.push(...articleLinks(await get(u)));
articles = [...new Set(articles)].slice(0, 8);

// 2) scan each article for candidate names
const found = new Map();
const scanned = [];
for (const u of articles) {
  const text = strip(await get(u));
  if (!text) continue;
  scanned.push(u);
  for (const [n, disp] of candidateNames(text)) if (!found.has(n)) found.set(n, disp);
}

// 3) names clearly stated near execution wording that aren't on the site yet
const newNames = [...found.entries()].filter(([n]) => !onSite.has(n)).map(([, d]) => d);

// 4) write report
const date = new Date().toISOString().slice(0, 10);
let md = `# Weekly Amnesty review — ${date}\n\n`;
md += `**Automated reminder to keep the campaign list current.** Nothing has been changed on ` +
  `the site — this is for a human to review. Skim the sources, then edit \`people.json\` if needed.\n\n`;

md += `## Amnesty Iran articles to skim\n`;
md += INDEX_URLS.map(u => `- Latest Iran page: ${u}`).join('\n') + '\n';
md += scanned.length
  ? scanned.map(u => `- ${u}`).join('\n') + '\n'
  : `_(No execution-related articles auto-detected this week — check the Latest Iran page above.)_\n`;

md += `\n## Names stated near execution wording, not yet on the site\n`;
md += newNames.length
  ? newNames.map(n => `- [ ] **${n}** — confirm on the source, then add to \`people.json\``).join('\n') + '\n'
  : `_None detected this week. Extraction is conservative and can miss names — please still skim the articles above._\n`;

md += `\n## Also verify (quick manual check)\n`;
md += `- [ ] Has any **"at risk"** person on the site been **executed**? (update their status)\n`;
md += `- [ ] Any case **resolved/released**? (consider removing)\n`;
md += `- [ ] Any **new** protester execution or death sentence in the articles above not on the site?\n`;

md += `\n---\n_Heuristic tool — a prompt to review, not a source of truth. Only edit \`people.json\` after confirming against Amnesty._\n`;

writeFileSync(join(root, 'review.md'), md);
console.log('Wrote review.md — new-name candidates: ' + newNames.length + ', articles scanned: ' + scanned.length);
