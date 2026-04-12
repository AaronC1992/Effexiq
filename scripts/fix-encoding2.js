import fs from 'fs';

const filePath = 'engine/Effexiq.js';
const buf = fs.readFileSync(filePath);

// Strategy: find double-encoded UTF-8 sequences at byte level.
// When UTF-8 is read as Latin-1/CP1252 and re-saved as UTF-8, each original byte
// becomes 2+ bytes. We detect these and decode them back.

// Known byte patterns (hex) for the garbled sequences:
const byteReplacements = [
  // em dash: \u2014 = E2 80 94, double-encoded = C3A2 E282AC E28094
  { find: [0xC3,0xA2, 0xE2,0x82,0xAC, 0xE2,0x80,0x9D], replace: Buffer.from('\u2014', 'utf8') },
  // en dash: \u2013 = E2 80 93, double-encoded = C3A2 E282AC E28093  
  { find: [0xC3,0xA2, 0xE2,0x82,0xAC, 0xE2,0x80,0x93], replace: Buffer.from('\u2013', 'utf8') },
  // right arrow: \u2192 = E2 86 92, double-encoded = C3A2 E280A0 E28099
  { find: [0xC3,0xA2, 0xE2,0x80,0xA0, 0xE2,0x80,0x99], replace: Buffer.from('\u2192', 'utf8') },
  // check mark: \u2713 = E2 9C 93, double-encoded = C3A2 C59C E28093
  { find: [0xC3,0xA2, 0xC5,0x93, 0xE2,0x80,0x9C], replace: Buffer.from('\u2713', 'utf8') },
  // warning: \u26A0 = E2 9A A0, double-encoded = C3A2 C5A1 C2A0
  { find: [0xC3,0xA2, 0xC5,0xA1, 0xC2,0xA0], replace: Buffer.from('\u26A0', 'utf8') },
  // lightning: \u26A1 = E2 9A A1, double-encoded = C3A2 C5A1 C2A1
  { find: [0xC3,0xA2, 0xC5,0xA1, 0xC2,0xA1], replace: Buffer.from('\u26A1', 'utf8') },
  // cross mark: \u274C = E2 9D 8C, double-encoded = C3A2 C29D C28C
  { find: [0xC3,0xA2, 0xC2,0x9D, 0xC2,0x8C], replace: Buffer.from('\u274C', 'utf8') },
  // approximately: \u2248 = E2 89 88, double-encoded = C3A2 E280B0 CB86
  { find: [0xC3,0xA2, 0xE2,0x80,0xB0, 0xCB,0x86], replace: Buffer.from('\u2248', 'utf8') },
  // multiplication \u00D7 = C3 97, double-encoded = C383 E280BA (maybe C383 C297?)
  { find: [0xC3,0x83, 0xC2,0x97], replace: Buffer.from('\u00D7', 'utf8') },
];

let result = Buffer.from(buf);
let totalFixes = 0;

for (const { find, replace } of byteReplacements) {
  const findBuf = Buffer.from(find);
  let offset = 0;
  const chunks = [];
  let lastEnd = 0;
  let count = 0;
  
  while (offset <= result.length - findBuf.length) {
    const idx = result.indexOf(findBuf, offset);
    if (idx === -1) break;
    chunks.push(result.slice(lastEnd, idx));
    chunks.push(replace);
    lastEnd = idx + findBuf.length;
    offset = lastEnd;
    count++;
  }
  
  if (count > 0) {
    chunks.push(result.slice(lastEnd));
    result = Buffer.concat(chunks);
    const char = replace.toString('utf8');
    console.log(`${char} (U+${char.codePointAt(0).toString(16).toUpperCase().padStart(4,'0')}): ${count} replacements`);
    totalFixes += count;
  }
}

console.log(`\nTotal: ${totalFixes} replacements`);

if (totalFixes > 0) {
  fs.writeFileSync(filePath, result);
  console.log('File saved.');
  
  // Verify: check for remaining C3 A2 sequences
  const remaining = [];
  for (let i = 0; i < result.length - 1; i++) {
    if (result[i] === 0xC3 && result[i+1] === 0xA2) {
      remaining.push(i);
    }
  }
  if (remaining.length > 0) {
    console.log(`\nWARNING: ${remaining.length} remaining C3 A2 sequences.`);
    for (let k = 0; k < Math.min(5, remaining.length); k++) {
      const pos = remaining[k];
      const hex = Array.from(result.slice(pos, pos + 10)).map(x => x.toString(16).padStart(2, '0')).join(' ');
      console.log(`  pos ${pos}: ${hex}`);
    }
  } else {
    console.log('All garbled sequences fixed!');
  }
} else {
  console.log('No replacements made.');
}
