// Reproducible vector assets. The mark fits inside the maskable 80% safe circle.
import sharp from "sharp";
import { writeFile } from "node:fs/promises";
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><rect width="512" height="512" fill="#003d32"/><path d="M154 166h204M256 166v192" fill="none" stroke="white" stroke-width="35" stroke-linecap="round"/><path d="m308 315 25 28 30-38" fill="none" stroke="#00d574" stroke-width="22" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
for (const [name, size] of [["icon-192",192],["icon-512",512],["maskable-512",512],["apple-touch-icon",180]]) {
  await writeFile(new URL(`../public/icons/${name}.png`, import.meta.url), await sharp(Buffer.from(svg)).resize(size,size).png().toBuffer());
}
