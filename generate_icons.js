// Genera los íconos PNG de la PWA sin dependencias externas (solo zlib de Node).
// Diseño: fondo crema a sangre (iOS redondea las esquinas) + una cápsula/pastilla
// centrada, mitad roja y mitad crema, con una ranura al medio. Alto contraste.
const zlib = require('node:zlib');
const fs = require('node:fs');

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'latin1');
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePNG(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // color type RGBA
  ihdr[10] = 0;  // compression
  ihdr[11] = 0;  // filter
  ihdr[12] = 0;  // interlace

  // Cada fila lleva un byte de filtro (0) al inicio.
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });

  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

// Mezcla de color simple para bordes (anti-aliasing por cobertura 0..1).
function mix(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t)
  ];
}

function drawIcon(N) {
  const FONDO = [253, 246, 236];  // crema
  const ROJO = [228, 87, 46];     // rojo-naranja
  const CREMA = [244, 241, 234];  // mitad clara de la pastilla
  const RANURA = [214, 205, 193]; // línea del medio

  const cx = N / 2, cy = N / 2;
  const W = N * 0.64, H = N * 0.30;
  const r = H / 2;
  const halfFlat = W / 2 - r;   // mitad de la parte recta de la cápsula
  const gap = N * 0.012;        // media anchura de la ranura central

  const rgba = Buffer.alloc(N * N * 4);

  // Distancia al borde de la cápsula (negativa dentro). Supersampling 2x2 para AA.
  function coverage(px, py) {
    let inside = 0;
    const samples = [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]];
    for (const [ox, oy] of samples) {
      const x = px + ox, y = py + oy;
      const dx = Math.abs(x - cx), dy = Math.abs(y - cy);
      let d;
      if (dx <= halfFlat) {
        d = dy - r;                       // tramo recto
      } else {
        const ex = dx - halfFlat;
        d = Math.hypot(ex, dy) - r;       // tapas redondeadas
      }
      if (d <= 0) inside++;
    }
    return inside / samples.length;
  }

  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const cov = coverage(x, y);
      let col = FONDO;
      if (cov > 0) {
        // Color de la pastilla según el lado, con la ranura al medio.
        let pill;
        if (Math.abs(x + 0.5 - cx) < gap) {
          pill = RANURA;
        } else if (x + 0.5 < cx) {
          pill = ROJO;
        } else {
          pill = CREMA;
        }
        col = mix(FONDO, pill, cov);
      }
      const i = (y * N + x) * 4;
      rgba[i] = col[0];
      rgba[i + 1] = col[1];
      rgba[i + 2] = col[2];
      rgba[i + 3] = 255;
    }
  }

  return encodePNG(N, N, rgba);
}

for (const N of [180, 192, 512]) {
  const png = drawIcon(N);
  fs.writeFileSync(`icon-${N}.png`, png);
  console.log(`icon-${N}.png (${png.length} bytes)`);
}
