import fs from 'fs';

const filePath = 'engine/SoundGoblin.js';
const buf = fs.readFileSync(filePath);

// The file has double-encoded UTF-8: original UTF-8 bytes were interpreted as
// Windows-1252/Latin-1 and then re-encoded as UTF-8.
// Fix: decode as Latin-1 (to undo the outer UTF-8 layer), which gives us the
// original UTF-8 bytes as a string of code points 0-255, then encode those
// code points back to a Buffer and decode as UTF-8.

// We can't just re-decode the whole file because ASCII portions are fine.
// Instead, find sequences starting with 0xC3 0xA2 (double-encoded â = start of 
// multi-byte UTF-8) and fix those regions.

let content = buf.toString('utf8');

// Simple approach: find the known garbled string patterns and replace
const textReplacements = [
  ['â€"', '—'],    // em dash
  ['â€"', '–'],    // en dash (if any)
  ['â†'', '→'],    // right arrow
  ['âœ"', '✓'],    // check mark (heavy)
  ['âœ"', '✓'],    // check mark
  ['âš ï¸', '⚠️'],  // warning
  ['âš ', '⚠'],    // warning without VS
  ['âŒ', '❌'],    // cross mark
  ['â‰ˆ', '≈'],    // approximately
  ['Ã—', '×'],     // multiplication
  ['âš¡', '⚡'],    // lightning
];

let total = 0;
for (const [bad, good] of textReplacements) {
  let count = 0;
  while (content.includes(bad)) {
    content = content.replace(bad, good);
    count++;
  }
  if (count > 0) {
    console.log(`'${bad}' → '${good}': ${count} replacements`);
    total += count;
  }
}

console.log(`\nTotal: ${total} replacements`);

if (total > 0) {
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('File saved.');
} else {
  console.log('No text replacements found. Trying byte-level fix...');
  
  // Byte-level approach: find double-encoded sequences
  const result = [];
  let i = 0;
  let fixes = 0;
  while (i < buf.length) {
    // Check for double-encoded pattern: C3 xx where xx would be part of 
    // a Windows-1252 interpretation of a UTF-8 lead byte
    if (buf[i] === 0xC3 && i + 1 < buf.length) {
      const next = buf[i + 1];
      // C3 A2 = â (U+00E2), which is the lead byte of 3-byte UTF-8 sequences (E2 xx xx)
      if (next === 0xA2) {
        // Collect the double-encoded sequence
        // Original: E2 XX YY -> Encoded as: C3A2 [encoded XX] [encoded YY]
        const chunk = [];
        chunk.push(0xE2); // decoded â back to original byte
        let j = i + 2;
        // Read 2 more double-encoded bytes (each original byte 80-BF becomes C2xx or similar)
        for (let k = 0; k < 2 && j < buf.length; k++) {
          if (buf[j] === 0xC2 && j + 1 < buf.length) {
            chunk.push(buf[j + 1]);
            j += 2;
          } else if (buf[j] === 0xC3 && j + 1 < buf.length) {
            chunk.push(0xC0 | (buf[j + 1] & 0x3F));
            j += 2;
          } else if (buf[j] === 0xC5 && j + 1 < buf.length) {
            chunk.push(buf[j + 1] + 0x40);
            j += 2;
          } else if (buf[j] >= 0xE2 && buf[j] <= 0xEF) {
            // 3-byte UTF-8 sequence that's part of the double encoding
            chunk.push(buf[j + 1] < 0x80 ? buf[j + 1] : ((buf[j] & 0x0F) << 6 | (buf[j+1] & 0x3F)));
            // This is getting complex - let's just collect as-is
            chunk.push(buf[j], buf[j+1], buf[j+2]);
            j += 3;
            k++; // count as 2
          } else {
            chunk.push(buf[j]);
            j++;
          }
        }
        const decoded = Buffer.from(chunk).toString('utf8');
        if (decoded && !decoded.includes('\ufffd')) {
          for (const c of Buffer.from(decoded, 'utf8')) result.push(c);
          fixes++;
        } else {
          result.push(buf[i]);
        }
        i = j;
        continue;
      }
    }
    result.push(buf[i]);
    i++;
  }
  
  if (fixes > 0) {
    console.log(`Byte-level fixes: ${fixes}`);
    fs.writeFileSync(filePath, Buffer.from(result));
    console.log('File saved.');
  } else {
    console.log('No fixes applied.');
  }
}
