import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

// Helper to calculate CRC32 for PNG chunks
function crc32(buf) {
  let c = 0xffffffff;
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let curr = n;
    for (let k = 0; k < 8; k++) {
      curr = (curr & 1) ? (0xedb88320 ^ (curr >>> 1)) : (curr >>> 1);
    }
    table[n] = curr;
  }
  for (let i = 0; i < buf.length; i++) {
    c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const len = data.length;
  const buf = Buffer.alloc(12 + len);
  buf.writeUInt32BE(len, 0);
  buf.write(type, 4, 4, 'ascii');
  data.copy(buf, 8);
  const typeAndData = buf.subarray(4, 8 + len);
  buf.writeUInt32BE(crc32(typeAndData), 8 + len);
  return buf;
}

function createPng(size, primaryHex = '#10b981', bgHex = '#0f172a') {
  // Signature
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // IHDR
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(size, 0); // width
  ihdrData.writeUInt32BE(size, 4); // height
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 6; // color type RGBA
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace
  const ihdrChunk = makeChunk('IHDR', ihdrData);

  // IDAT - Raw pixel data
  // Color palette: Dark slate background #0f172a (15, 23, 42, 255), Glowing emerald logo #10b981 (16, 185, 129, 255)
  const rowBytes = 1 + size * 4;
  const rawData = Buffer.alloc(size * rowBytes);

  const center = size / 2;
  const radius = size * 0.42;

  for (let y = 0; y < size; y++) {
    const rowOffset = y * rowBytes;
    rawData[rowOffset] = 0; // filter type 0 (None)

    for (let x = 0; x < size; x++) {
      const pxOffset = rowOffset + 1 + x * 4;
      const dx = x - center;
      const dy = y - center;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Draw rounded emblem badge in center
      const inCircle = dist <= radius;
      const inInnerSymbol = (dist >= radius * 0.35 && dist <= radius * 0.65);

      if (inCircle && inInnerSymbol) {
        // Cyan / Emerald gradient glow
        rawData[pxOffset] = 56;    // R
        rawData[pxOffset + 1] = 189; // G
        rawData[pxOffset + 2] = 248; // B
        rawData[pxOffset + 3] = 255; // A
      } else if (inCircle) {
        rawData[pxOffset] = 16;   // R
        rawData[pxOffset + 1] = 185; // G
        rawData[pxOffset + 2] = 129; // B
        rawData[pxOffset + 3] = 255; // A
      } else {
        // Dark background
        rawData[pxOffset] = 15;   // R
        rawData[pxOffset + 1] = 23;  // G
        rawData[pxOffset + 2] = 42;  // B
        rawData[pxOffset + 3] = 255; // A
      }
    }
  }

  const compressedData = zlib.deflateSync(rawData);
  const idatChunk = makeChunk('IDAT', compressedData);

  // IEND
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

const publicDir = path.resolve('public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Generate 192x192 PNG
const png192 = createPng(192);
fs.writeFileSync(path.join(publicDir, 'pwa-192x192.png'), png192);
console.log('Created public/pwa-192x192.png');

// Generate 512x512 PNG
const png512 = createPng(512);
fs.writeFileSync(path.join(publicDir, 'pwa-512x512.png'), png512);
console.log('Created public/pwa-512x512.png');

// Generate apple-touch-icon.png
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), png512);
console.log('Created public/apple-touch-icon.png');
