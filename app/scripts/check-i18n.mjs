/**
 * Fails if the translation files have drifted apart.
 *
 * With two languages a missing key is something you notice. With fifteen it is
 * not: i18next falls back to English, so the app looks fine to whoever added
 * the string and shows English to everyone else. This is the thing that
 * notices instead.
 *
 *   node scripts/check-i18n.mjs        (also: npm run check:i18n)
 *
 * English is the reference because it is `fallbackLng`.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'i18n');
const REFERENCE = 'en';

const flatten = (obj, prefix = '') =>
  Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? flatten(v, `${prefix}${k}.`)
      : [`${prefix}${k}`],
  );

const read = code => JSON.parse(readFileSync(join(DIR, `${code}.json`), 'utf8'));

const codes = readdirSync(DIR)
  .filter(f => f.endsWith('.json'))
  .map(f => f.replace('.json', ''));

const reference = new Set(flatten(read(REFERENCE)));
let failed = false;

for (const code of codes) {
  if (code === REFERENCE) continue;
  const keys = new Set(flatten(read(code)));
  const missing = [...reference].filter(k => !keys.has(k));
  const extra = [...keys].filter(k => !reference.has(k));

  if (missing.length || extra.length) {
    failed = true;
    console.error(`\n${code}.json`);
    if (missing.length) console.error(`  missing ${missing.length}: ${missing.slice(0, 12).join(', ')}${missing.length > 12 ? ' …' : ''}`);
    if (extra.length)   console.error(`  not in ${REFERENCE} (${extra.length}): ${extra.slice(0, 12).join(', ')}${extra.length > 12 ? ' …' : ''}`);
  }
}

if (failed) {
  console.error(`\nTranslation files are out of sync with ${REFERENCE}.json.`);
  process.exit(1);
}
console.log(`i18n: ${codes.length} languages, ${reference.size} keys, all in sync.`);
