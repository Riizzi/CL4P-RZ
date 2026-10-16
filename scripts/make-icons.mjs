// Gera os ícones (PWA + Android) a partir do desenho abaixo. Uso: npm run icons
// Padrão dos apps do João: squircle cinza com símbolo preto monocromático.
import sharp from 'sharp';
import { existsSync, readdirSync, statSync, writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

const CINZA = '#8A8A8A';
const PRETO = '#1C1C1C';
const CREME = '#FAF7F2';

// Símbolo numa grade 108x108 (zona segura do ícone adaptativo: círculo central de 66).
// Um nó central ligado a seis apps em volta: o hub.
const pontos = Array.from({ length: 6 }, (_, i) => {
  const a = (Math.PI / 3) * i - Math.PI / 2;
  return [54 + 22 * Math.cos(a), 54 + 22 * Math.sin(a)];
});
const simbolo = (cor) => `
  <g stroke="${cor}" stroke-width="3.2" stroke-linecap="round" fill="none">
    ${pontos.map(([x, y]) => `<line x1="54" y1="54" x2="${x.toFixed(2)}" y2="${y.toFixed(2)}"/>`).join('')}
    <polygon points="${pontos.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ')}" stroke-width="2.4" stroke-dasharray="3 3"/>
  </g>
  <g fill="${cor}">
    ${pontos.map(([x, y]) => `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="5"/>`).join('')}
    <rect x="45" y="45" width="18" height="18" rx="5"/>
  </g>`;

const svg = (corpo, defs = '') => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 108">${defs}${corpo}</svg>`);
const squircle = `<rect width="108" height="108" rx="24" fill="${CINZA}"/>`;
const completo = svg(`${squircle}${simbolo(PRETO)}`);
const cheio = svg(`<rect width="108" height="108" fill="${CINZA}"/>${simbolo(PRETO)}`);
const redondo = svg(`<g clip-path="url(#c)"><rect width="108" height="108" fill="${CINZA}"/>${simbolo(PRETO)}</g>`, `<defs><clipPath id="c"><circle cx="54" cy="54" r="54"/></clipPath></defs>`);
const frente = svg(simbolo(PRETO));
const mono = svg(simbolo('#000000'));

// PWA
writeFileSync('public/icon.svg', completo.toString());
await sharp(completo, { density: 512 }).resize(192, 192).png().toFile('public/icon-192.png');
await sharp(completo, { density: 512 }).resize(512, 512).png().toFile('public/icon-512.png');
await sharp(cheio, { density: 512 }).resize(512, 512).png().toFile('public/icon-maskable-512.png');
await sharp(mono, { density: 512 }).resize(512, 512).png().toFile('public/icon-mono.png');
await sharp(completo, { density: 512 }).resize(180, 180).png().toFile('public/apple-touch-icon.png');

// Android (só se o projeto nativo existir)
const RES = 'android/app/src/main/res';
if (existsSync(RES)) {
  const dens = { mdpi: [48, 108], hdpi: [72, 162], xhdpi: [96, 216], xxhdpi: [144, 324], xxxhdpi: [192, 432] };
  for (const [d, [legado, adapt]] of Object.entries(dens)) {
    const dir = join(RES, `mipmap-${d}`);
    await sharp(completo, { density: 512 }).resize(legado, legado).png().toFile(join(dir, 'ic_launcher.png'));
    await sharp(redondo, { density: 512 }).resize(legado, legado).png().toFile(join(dir, 'ic_launcher_round.png'));
    await sharp(frente, { density: 512 }).resize(adapt, adapt).png().toFile(join(dir, 'ic_launcher_foreground.png'));
  }
  writeFileSync(join(RES, 'values/ic_launcher_background.xml'), `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${CINZA}</color>\n</resources>\n`);
  // Splash: fundo creme + ícone no centro
  const icone = await sharp(completo, { density: 512 }).resize(512, 512).png().toBuffer();
  for (const dir of readdirSync(RES)) {
    if (!dir.startsWith('drawable')) continue;
    const f = join(RES, dir, 'splash.png');
    try { statSync(f); } catch { continue; }
    const { width, height } = await sharp(f).metadata();
    const lado = Math.round(Math.min(width, height) * 0.22);
    const ic = await sharp(icone).resize(lado, lado).png().toBuffer();
    await sharp({ create: { width, height, channels: 3, background: CREME } }).composite([{ input: ic, gravity: 'center' }]).png().toFile(f + '.tmp');
    await sharp(f + '.tmp').toFile(f);
    unlinkSync(f + '.tmp');
  }
}
console.log('ícones gerados');
