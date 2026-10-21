import { readFileSync, writeFileSync } from 'node:fs';
import { parse } from 'yaml';
import { rosterSchema, rosterToLeaders } from '../src/lib/leaders';

const raw = readFileSync('src/content/pages/who-we-are.md', 'utf8');
const front = parse(raw.match(/^---\n([\s\S]*?)\n---/)![1]!);
const leaders = rosterToLeaders(rosterSchema.parse(front.roster));

const docs = leaders.map(({ _id, name, role, group, order }) => ({
  _id,
  _type: 'leader',
  name,
  ...(role ? { role } : {}),
  group,
  order,
}));

writeFileSync(
  'scripts/leaders-seed.json',
  `${JSON.stringify(docs, null, 2)}\n`,
);
console.log(
  `Wrote ${docs.length} leader documents to scripts/leaders-seed.json`,
);
