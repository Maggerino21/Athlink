import { Resvg } from '@resvg/resvg-js';
import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const BG   = '#0B0B0D';
const WARM = '#F4F1ED';
const COOL = '#ECE9F5';
const MARK = 'M 16 98 L 16 28 A 18 18 0 0 1 52 28 L 52 80 A 18 18 0 0 0 88 80 L 88 38';

function iconSvg(size) {
  const pad   = size * 0.18;
  const avail = size - pad * 2;
  const scale = avail / 110;
  const sw    = (16 / 104) * avail;
  const tx    = pad + (avail - 104 * scale) / 2;
  const ty    = pad;
  const rx    = size * 0.22;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="mg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${WARM}"/>
      <stop offset="100%" stop-color="${COOL}"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" fill="${BG}" rx="${rx}"/>
  <g transform="translate(${tx},${ty}) scale(${scale})">
    <path d="${MARK}" stroke="url(#mg)" stroke-width="${sw/scale}"
      stroke-linecap="square" stroke-linejoin="round" fill="none"/>
  </g>
</svg>`;
}

function renderPng(size) {
  return new Resvg(iconSvg(size), { fitTo: { mode: 'original' } }).render().asPng();
}

// ICO format: header + directory entry + PNG data
// Modern ICO supports embedded PNG directly (Vista+)
// sizes: array of { png, size } — size 256 is encoded as 0 in the ICO spec
function buildIco(images) {
  const count  = images.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(count, 4);

  const dirEntrySize = 16;
  let offset = 6 + dirEntrySize * count;
  const entries = [];

  for (const { png, size } of images) {
    const entry = Buffer.alloc(dirEntrySize);
    entry.writeUInt8(size === 256 ? 0 : size, 0); // width  (0 encodes 256)
    entry.writeUInt8(size === 256 ? 0 : size, 1); // height (0 encodes 256)
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    entries.push(entry);
    offset += png.length;
  }

  return Buffer.concat([header, ...entries, ...images.map(i => i.png)]);
}

const ico = buildIco([
  { png: renderPng(16), size: 16 },
  { png: renderPng(32), size: 32 },
  { png: renderPng(48), size: 48 },
]);
const out = resolve(__dirname, '../app/favicon.ico');
writeFileSync(out, ico);
console.log(`✓ favicon.ico (${(ico.length / 1024).toFixed(1)} KB) → ${out}`);
