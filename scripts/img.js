// Generates brand images for xwhiz.com with NO external dependencies:
//   logo.png     512x512  (brand mark for schema.org logo)
//   og-image.png 1200x630 (social share image)
// Run: node scripts/img.js
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = path.join(__dirname, '..');

// ---------- minimal PNG (RGBA8) encoder ----------
const CRC_TAB = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TAB[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}
function encodePNG(w, h, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0; // filter none
    rgba.copy ? rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4) : Buffer.from(rgba).copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

// ---------- tiny canvas ----------
function canvas(w, h) { return { w, h, p: new Uint8Array(w * h * 4) }; }
function setp(c, x, y, r, g, b, a) {
  if (x < 0 || y < 0 || x >= c.w || y >= c.h) return;
  const i = (y * c.w + x) * 4;
  c.p[i] = r; c.p[i + 1] = g; c.p[i + 2] = b; c.p[i + 3] = a;
}
function fillRect(c, x0, y0, w, h, r, g, b, a) {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) setp(c, x, y, r, g, b, a);
}
function fillCircle(c, cx, cy, R, r, g, b, a) {
  const r2 = R * R;
  for (let y = Math.floor(cy - R); y <= cy + R; y++) for (let x = Math.floor(cx - R); x <= cx + R; x++) {
    const dx = x - cx, dy = y - cy;
    if (dx * dx + dy * dy <= r2) setp(c, x, y, r, g, b, a);
  }
}
function inPoly(px, py, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function fillPoly(c, poly, r, g, b, a) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of poly) { minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]); minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); }
  for (let y = Math.floor(minY); y <= maxY; y++) for (let x = Math.floor(minX); x <= maxX; x++) if (inPoly(x, y, poly)) setp(c, x, y, r, g, b, a);
}

// ---------- 5x7 pixel font ----------
const FONT = {
  A: [".###.","#...#","#...#","#####","#...#","#...#","#...#"],
  B: ["####.","#...#","#...#","####.","#...#","#...#","####."],
  C: [".####","#....","#....","#....","#....","#....",".####"],
  D: ["####.","#...#","#...#","#...#","#...#","#...#","####."],
  E: ["#####","#....","#....","####.","#....","#....","#####"],
  F: ["#####","#....","#....","####.","#....","#....","#...."],
  G: [".####","#....","#....","#..##","#...#","#...#",".###."],
  H: ["#...#","#...#","#...#","#####","#...#","#...#","#...#"],
  I: ["#####","..#..","..#..","..#..","..#..","..#..","#####"],
  J: ["....#","....#","....#","....#","....#","#...#",".###."],
  K: ["#...#","#..#.","#.#..","##...","#.#..","#..#.","#...#"],
  L: ["#....","#....","#....","#....","#....","#....","#####"],
  M: ["#...#","##.##","#.#.#","#.#.#","#...#","#...#","#...#"],
  N: ["#...#","##..#","#.#.#","#..##","#...#","#...#","#...#"],
  O: [".###.","#...#","#...#","#...#","#...#","#...#",".###."],
  P: ["####.","#...#","#...#","####.","#....","#....","#...."],
  Q: [".###.","#...#","#...#","#...#","#.###","#..##",".####"],
  R: ["####.","#...#","#...#","####.","#.#..","#..#.","#...#"],
  S: [".####","#....","#....",".###.","....#","....#","####."],
  T: ["#####","..#..","..#..","..#..","..#..","..#..","..#.."],
  U: ["#...#","#...#","#...#","#...#","#...#","#...#",".###."],
  V: ["#...#","#...#","#...#","#...#","#...#",".#.#.","..#.."],
  W: ["#...#","#...#","#...#","#.#.#","#.#.#","##.##","#...#"],
  X: ["#...#","#...#",".#.#.","..#..",".#.#.","#...#","#...#"],
  Y: ["#...#","#...#",".#.#.","..#..","..#..","..#..","..#.."],
  Z: ["#####","....#","...#.","..#..",".#...","#....","#####"],
  '.': [".....",".....",".....",".....",".....",".....","..#.."],
  ' ': [".....",".....",".....",".....",".....",".....","....."]
};
function glyphFor(ch) { return FONT[ch.toUpperCase()] || FONT[' ']; }
function textWidth(txt, scale, pad) { return txt.split('').reduce((a, ch) => a + (ch === ' ' ? 3 * scale : 5 * scale) + pad, 0) - pad; }
function drawText(c, txt, x, y, scale, r, g, b, a, pad) {
  pad = pad == null ? scale : pad;
  let cx = x;
  for (const ch of txt) {
    if (ch === ' ') { cx += 3 * scale + pad; continue; }
    const gglyph = glyphFor(ch);
    for (let row = 0; row < 7; row++) for (let col = 0; col < 5; col++) {
      if (gglyph[row][col] === '#') fillRect(c, cx + col * scale, y + row * scale, scale, scale, r, g, b, a);
    }
    cx += 5 * scale + pad;
  }
}

// ---------- football motif ----------
function pentagon(cx, cy, R, rot) {
  const pts = [];
  for (let i = 0; i < 5; i++) {
    const a = (rot != null ? rot : -90) + i * 72;
    const r = a * Math.PI / 180;
    pts.push([cx + R * Math.cos(r), cy + R * Math.sin(r)]);
  }
  return pts;
}
function drawBall(c, cx, cy, R, dark) {
  fillCircle(c, cx, cy, R, 255, 255, 255, 255);
  const rc = R * 0.22, ra = R * 0.14, off = R * 0.62;
  fillPoly(c, pentagon(cx, cy, rc, -90), dark[0], dark[1], dark[2], 255);
  for (let i = 0; i < 5; i++) {
    const a = -90 + i * 72;
    const x = cx + off * Math.cos(a * Math.PI / 180);
    const y = cy + off * Math.sin(a * Math.PI / 180);
    fillPoly(c, pentagon(x, y, ra, a), dark[0], dark[1], dark[2], 255);
  }
}

// ---------- logo.png ----------
const S = 512;
const logo = canvas(S, S);
const GREEN = [22, 163, 74], ZINC = [24, 24, 27], WHITE = [255, 255, 255];
const R = 110, C = S / 2;
for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
  const dx = Math.max(Math.abs(x - C) - (C - R), 0), dy = Math.max(Math.abs(y - C) - (C - R), 0);
  if (dx * dx + dy * dy <= R * R) setp(logo, x, y, GREEN[0], GREEN[1], GREEN[2], 255);
}
drawBall(logo, C, C - 40, 128, ZINC);
drawText(logo, 'XWHIZ', C - textWidth('XWHIZ', 6, 6) / 2, C + 128, 6, WHITE[0], WHITE[1], WHITE[2], 255, 6);
fs.writeFileSync(path.join(ROOT, 'logo.png'), encodePNG(S, S, logo.p));
console.log('logo.png', fs.statSync(path.join(ROOT, 'logo.png')).size, 'bytes');

// ---------- og-image.png ----------
const W2 = 1200, H2 = 630;
const og = canvas(W2, H2);
// vertical gradient deep green -> brand green
for (let y = 0; y < H2; y++) {
  const f = y / H2;
  const r = Math.round(20 + (22 - 20) * f), g = Math.round(70 + (163 - 70) * f), b = Math.round(45 + (74 - 45) * f);
  fillRect(og, 0, y, W2, 1, r, g, b, 255);
}
// slight diagonal light band
for (let y = 0; y < H2; y++) { const x0 = Math.round((W2 * 0.75) - (y * 0.35)); fillRect(og, x0, y, W2 - x0, 1, 255, 255, 255, 10); }
// ball left
drawBall(og, 300, 315, 210, ZINC);
// brand text right
drawText(og, 'XWHIZ', 640, 150, 48, 255, 255, 255, 255, 48);
// underline
fillRect(og, 646, 470, textWidth('XWHIZ', 48, 48), 14, 255, 255, 255, 230);
drawText(og, 'FOOTBALL PREDICTIONS', 646, 520, 14, 255, 255, 255, 230, 14);
drawText(og, 'STATISTICAL MODEL', 646, 560, 8, 255, 255, 255, 150, 8);
fs.writeFileSync(path.join(ROOT, 'og-image.png'), encodePNG(W2, H2, og.p));
console.log('og-image.png', fs.statSync(path.join(ROOT, 'og-image.png')).size, 'bytes');