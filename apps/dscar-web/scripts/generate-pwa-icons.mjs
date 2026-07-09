// Gera os ícones do PWA a partir do logo — roda no prebuild.
// Uso: node scripts/generate-pwa-icons.mjs
import sharp from "sharp";
import { mkdirSync } from "node:fs";

const SRC = "public/dscar-logo.png";
const BG = "#0a0a0a";
mkdirSync("public/icons", { recursive: true });

await sharp(SRC).resize(192, 192, { fit: "contain", background: BG }).png().toFile("public/icons/icon-192.png");
await sharp(SRC).resize(512, 512, { fit: "contain", background: BG }).png().toFile("public/icons/icon-512.png");
// maskable: 20% de padding (safe zone do Android)
await sharp(SRC)
  .resize(410, 410, { fit: "contain", background: BG })
  .extend({ top: 51, bottom: 51, left: 51, right: 51, background: BG })
  .png()
  .toFile("public/icons/icon-maskable-512.png");
await sharp(SRC).resize(180, 180, { fit: "contain", background: BG }).png().toFile("public/icons/apple-touch-icon.png");

console.log("ícones PWA gerados em public/icons/");
