/**
 * Generates a 512x512 grayscale noise PNG at assets/noise.png
 * Uses only Node.js built-ins (zlib + fs) — no npm packages needed.
 * Run: node scripts/generate-noise.js
 */
const zlib = require('zlib');
const fs   = require('fs');
const path = require('path');

const W = 512;
const H = 512;

// ── CRC32 table ───────────────────────────────────────────────────────────────
const crcTable = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let j = 0; j < 8; j++) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  crcTable[i] = c;
}
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const lenBuf  = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length);
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crcBuf  = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(typeAndData));
  return Buffer.concat([lenBuf, typeAndData, crcBuf]);
}

// ── Raw pixel data (grayscale, 1 byte per pixel + 1 filter byte per row) ──────
const rows = [];
for (let y = 0; y < H; y++) {
  const row = Buffer.alloc(W + 1);
  row[0] = 0; // filter type = None
  for (let x = 0; x < W; x++) {
    row[x + 1] = Math.floor(Math.random() * 256);
  }
  rows.push(row);
}
const rawData    = Buffer.concat(rows);
const compressed = zlib.deflateSync(rawData, { level: 6 });

// ── IHDR ──────────────────────────────────────────────────────────────────────
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0);
ihdr.writeUInt32BE(H, 4);
ihdr[8]  = 8; // bit depth
ihdr[9]  = 0; // color type: grayscale
ihdr[10] = 0; // compression method
ihdr[11] = 0; // filter method
ihdr[12] = 0; // interlace: none

// ── Assemble PNG ──────────────────────────────────────────────────────────────
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), // PNG signature
  makeChunk('IHDR', ihdr),
  makeChunk('IDAT', compressed),
  makeChunk('IEND', Buffer.alloc(0)),
]);

const outPath = path.join(__dirname, '..', 'assets', 'noise.png');
fs.writeFileSync(outPath, png);
console.log(`✓ Generated ${outPath}  (${(png.length / 1024).toFixed(1)} KB)`);
