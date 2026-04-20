import { Resvg } from '@resvg/resvg-js';
import { writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const BG      = '#0B0B0D';
const WARM    = '#F4F1ED';
const COOL    = '#ECE9F5';
const MARK_PATH = 'M 16 98 L 16 28 A 18 18 0 0 1 52 28 L 52 80 A 18 18 0 0 0 88 80 L 88 38';

// The mark sits in a 104×110 viewBox. We centre it in a square canvas with padding.
// padding = 18% of the icon size on each side.
function iconSvg(size, bg = BG) {
  const pad  = size * 0.18;
  const avail = size - pad * 2;
  // Scale to fill the available height (mark is taller than wide: 104×110 ratio)
  const scale = avail / 110;
  const sw    = (16 / 104) * avail;   // stroke width proportional to mark width
  const tx    = pad + (avail - 104 * scale) / 2;
  const ty    = pad;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="mg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"   stop-color="${WARM}" />
      <stop offset="100%" stop-color="${COOL}" />
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" fill="${bg}" rx="${size * 0.22}" />
  <g transform="translate(${tx}, ${ty}) scale(${scale})">
    <path
      d="${MARK_PATH}"
      stroke="url(#mg)"
      stroke-width="${sw / scale}"
      stroke-linecap="square"
      stroke-linejoin="round"
      fill="none"
    />
  </g>
</svg>`;
}

// Adaptive icon foreground: mark on transparent bg (Android adds its own shape+bg)
function adaptiveSvg(size) {
  const pad   = size * 0.28;
  const avail = size - pad * 2;
  const scale = avail / 110;
  const sw    = (16 / 104) * avail;
  const tx    = pad + (avail - 104 * scale) / 2;
  const ty    = pad;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="mg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"   stop-color="${WARM}" />
      <stop offset="100%" stop-color="${COOL}" />
    </linearGradient>
  </defs>
  <g transform="translate(${tx}, ${ty}) scale(${scale})">
    <path
      d="${MARK_PATH}"
      stroke="url(#mg)"
      stroke-width="${sw / scale}"
      stroke-linecap="square"
      stroke-linejoin="round"
      fill="none"
    />
  </g>
</svg>`;
}

function render(svg, outPath) {
  const resvg = new Resvg(svg, { fitTo: { mode: 'original' } });
  const png   = resvg.render().asPng();
  writeFileSync(outPath, png);
  console.log(`✓ ${outPath}`);
}

const appAssets = resolve(__dirname, '../../app/assets');
const webApp    = resolve(__dirname, '../app');

// App icon (1024×1024) — iOS + main Expo icon
render(iconSvg(1024),         resolve(appAssets, 'icon.png'));
// Splash icon (200×200 — contained inside splash screen)
render(iconSvg(512),          resolve(appAssets, 'splash-icon.png'));
// Android adaptive foreground (1024×1024, transparent bg)
render(adaptiveSvg(1024),     resolve(appAssets, 'adaptive-icon.png'));
// Expo web favicon
render(iconSvg(64, BG),       resolve(appAssets, 'favicon.png'));

// Web Next.js favicon (32×32 PNG → will be used alongside the SVG)
render(iconSvg(256),          resolve(webApp, 'favicon-source.png'));

console.log('\nAll icons generated.');
