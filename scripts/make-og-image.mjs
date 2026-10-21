import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { colors } from '../src/lib/tokens.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const at = (...parts) => resolve(root, ...parts);

const WIDTH = 1200;
const HEIGHT = 630;
const LOCKUP_WIDTH = 620;
const MARGIN = 72;

async function makeOgImage() {
  const wash = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}">
      <defs>
        <linearGradient id="w" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stop-color="${colors.paper}" stop-opacity="0.96"/>
          <stop offset="0.45" stop-color="${colors.paper}" stop-opacity="0.9"/>
          <stop offset="0.8" stop-color="${colors.paper}" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#w)"/>
    </svg>`,
  );
  const lockup = await sharp(at('design/assets/crossway-lockup-on-light.svg'), {
    density: 300,
  })
    .resize({ width: LOCKUP_WIDTH })
    .png()
    .toBuffer();
  const { height } = await sharp(lockup).metadata();

  await mkdir(at('public/og'), { recursive: true });
  await sharp(at('public/video/lobby-poster.jpg'))
    .resize(WIDTH, HEIGHT, { fit: 'cover', position: 'centre' })
    .composite([
      { input: wash },
      {
        input: lockup,
        left: MARGIN,
        top: Math.round((HEIGHT - height) / 2),
      },
    ])
    .jpeg({ quality: 78, mozjpeg: true })
    .toFile(at('public/og/default.jpg'));
}

async function makeIcon(size, file) {
  const markHeight = Math.round(size * 0.58);
  const mark = await sharp(at('design/assets/crossway-mark-amber.svg'), {
    density: 600,
  })
    .resize({ height: markHeight })
    .png()
    .toBuffer();
  const { width } = await sharp(mark).metadata();
  await sharp({
    create: {
      width: size,
      height: size,
      channels: 3,
      background: colors.navy,
    },
  })
    .composite([
      {
        input: mark,
        left: Math.round((size - width) / 2),
        top: Math.round((size - markHeight) / 2),
      },
    ])
    .png({ compressionLevel: 9 })
    .toFile(at('public', file));
}

await makeOgImage();
await mkdir(at('public/icons'), { recursive: true });
await makeIcon(180, 'apple-touch-icon.png');
await makeIcon(192, 'icons/icon-192.png');
await makeIcon(512, 'icons/icon-512.png');
