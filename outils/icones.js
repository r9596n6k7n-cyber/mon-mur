// Génère les icônes PNG de l'app (aucune dépendance) : node outils/icones.js
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const CRC = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc32 = (buf) => { let c = -1; for (const b of buf) c = CRC[(c ^ b) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size, pixel) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  const SS = 4;
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0;
      for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
        const c = pixel((x + (sx + 0.5) / SS) / size, (y + (sy + 0.5) / SS) / size);
        r += c[0]; g += c[1]; b += c[2];
      }
      const o = y * (size * 4 + 1) + 1 + x * 4;
      raw[o] = r / (SS * SS); raw[o + 1] = g / (SS * SS); raw[o + 2] = b / (SS * SS); raw[o + 3] = 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const VIOLET = hex("#6b47ff"), ROSE = hex("#ff5fa2"), JAUNE = hex("#ffe679"), BLEU = hex("#b5d8ff"), VERT = hex("#b9efc9"), ENCRE = hex("#3a2f55");

// Point (x,y) dans un rectangle tourné ? Renvoie les coordonnées locales ou null.
function local(x, y, cx, cy, w, h, deg) {
  const a = (-deg * Math.PI) / 180, dx = x - cx, dy = y - cy;
  const u = dx * Math.cos(a) - dy * Math.sin(a), v = dx * Math.sin(a) + dy * Math.cos(a);
  return Math.abs(u) <= w / 2 && Math.abs(v) <= h / 2 ? [u / w + 0.5, v / h + 0.5] : null;
}

// scale < 1 garde le dessin dans la zone sûre des icônes « maskable »
function icon(scale) {
  return (x, y) => {
    let c = mix(VIOLET, ROSE, Math.min(1, Math.max(0, (x + y) / 2)));
    const X = 0.5 + (x - 0.5) / scale, Y = 0.5 + (y - 0.5) / scale;
    // ombre douce sous les post-its
    if (local(X, Y, 0.53, 0.56, 0.5, 0.5, -6)) c = mix(c, [40, 10, 80], 0.25);
    // post-it vert (fond)
    if (local(X, Y, 0.62, 0.42, 0.42, 0.42, 12)) c = VERT;
    // post-it bleu
    if (local(X, Y, 0.38, 0.44, 0.42, 0.42, -10)) c = BLEU;
    // post-it jaune (devant) avec 3 lignes d'écriture
    const p = local(X, Y, 0.5, 0.55, 0.46, 0.46, -4);
    if (p) {
      c = JAUNE;
      const [u, v] = p;
      const lines = [[0.36, 0.78], [0.54, 0.66], [0.72, 0.5]];
      for (const [ly, lw] of lines) if (Math.abs(v - ly) < 0.045 && u > 0.16 && u < 0.16 + lw * 0.84) c = ENCRE;
    }
    // bout de scotch
    if (local(X, Y, 0.5, 0.32, 0.2, 0.07, -8)) c = mix(c, [255, 255, 255], 0.6);
    return c;
  };
}

const out = path.join(__dirname, "..", "icons");
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, "icon-192.png"), png(192, icon(1)));
fs.writeFileSync(path.join(out, "icon-512.png"), png(512, icon(1)));
fs.writeFileSync(path.join(out, "apple-touch-icon.png"), png(180, icon(1)));
fs.writeFileSync(path.join(out, "icon-maskable-512.png"), png(512, icon(0.78)));
console.log("Icônes créées dans", out);
