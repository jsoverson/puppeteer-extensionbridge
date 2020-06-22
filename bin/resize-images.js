const path = require('path');

const sharp = require('sharp');

const original = path.join(__dirname, '..', 'logo512.png');
const destDir = path.join(__dirname, '..', 'extension', 'images');
const imagePrefix = 'icon';
const imageExtension = '.png';

const sizes = [16, 32, 48, 128];

main();

async function main() {
  const promises = sizes.map(size => sharp(original).resize(size).toFile(path.join(destDir, `${imagePrefix}${size}${imageExtension}`)));

  await Promise.allSettled([

  ]);
  console.log("Done");
}
