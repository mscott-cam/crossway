import sharp from 'sharp';

const [input, outBase] = process.argv.slice(2);
if (!input || !outBase) {
  console.error('usage: make-poster.mjs <frame.png> <out-base>');
  process.exit(1);
}

const image = sharp(input).resize({ width: 1280 });
await image.clone().avif({ quality: 60, effort: 6 }).toFile(`${outBase}.avif`);
await image
  .clone()
  .jpeg({ quality: 78, mozjpeg: true })
  .toFile(`${outBase}.jpg`);
