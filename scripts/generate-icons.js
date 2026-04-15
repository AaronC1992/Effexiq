#!/usr/bin/env node
/**
 * Generate PWA PNG icons from icon.svg using sharp.
 * Run: node scripts/generate-icons.js
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const sharp = (await import('sharp')).default;

  const svgPath = path.join(__dirname, '..', 'public', 'icon.svg');
  const svg = fs.readFileSync(svgPath);

  for (const size of [192, 512]) {
    const out = path.join(__dirname, '..', 'public', `icon-${size}.png`);
    await sharp(svg).resize(size, size).png().toFile(out);
    console.log(`Created ${out}`);
  }

  // OG image (1200x630)
  const ogSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
    <rect width="1200" height="630" fill="#0a0a0a"/>
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#8a2be2"/>
        <stop offset="100%" stop-color="#03dac6"/>
      </linearGradient>
    </defs>
    <circle cx="600" cy="280" r="120" fill="url(#g)" opacity="0.25"/>
    <g fill="#bb86fc" transform="translate(556,200)">
      <path d="M64 0v70c0 13.6-13 24.6-29 24.6S6 83.6 6 70s13-24.6 29-24.6c4.8 0 9.4 1 13.4 2.8V16.1L64 0z"/>
      <circle cx="35" cy="70" r="14" fill="#fff" opacity="0.9"/>
    </g>
    <text x="600" y="410" text-anchor="middle" fill="#ffffff" font-family="system-ui,sans-serif" font-size="64" font-weight="800">Effexiq</text>
    <text x="600" y="470" text-anchor="middle" fill="#aaaaaa" font-family="system-ui,sans-serif" font-size="24">AI-Powered Sound Design for Storytellers</text>
  </svg>`;

  const ogOut = path.join(__dirname, '..', 'public', 'og-image.png');
  await sharp(Buffer.from(ogSvg)).resize(1200, 630).png().toFile(ogOut);
  console.log(`Created ${ogOut}`);
}

main().catch(e => { console.error(e); process.exit(1); });
