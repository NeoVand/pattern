import { mkdirSync, copyFileSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';
const dir = '/Users/neo/.codex/generated_images/01a08dbb-d3ec-7f50-b8e0-631cae5933e1';
const files = [
	'exec-dc12b4fa-c292-4283-afba-b95457e1e2d8.png',
	'exec-23437788-e7fa-4635-97dd-f1d89c57b345.png',
	'exec-84102b19-d7c7-4a42-9706-f7b47da3a33d.png'
];
mkdirSync('static/images/edition-4', { recursive: true });
const meta = [];
for (let i = 0; i < files.length; i++) {
	let letter = 'ABC'[i];
	const src = dir + '/' + files[i];
	copyFileSync(src, `static/art-review/generalization-${letter}-v4.png`);
	const m = await sharp(src).metadata();
	meta.push({ letter, source: src, width: m.width, height: m.height });
	if (i === 0) {
		await sharp(src)
			.webp({ quality: 94, alphaQuality: 100 })
			.toFile('static/images/edition-4/generalization.webp');
		await sharp(src)
			.resize({ width: 800 })
			.webp({ quality: 92, alphaQuality: 100 })
			.toFile('static/images/edition-4/generalization-800.webp');
	}
}
writeFileSync('docs/art-assets-v4.json', JSON.stringify(meta, null, 2));
const cards = ['A · Familiar plots', 'B · Fine lines', 'C · Sculptural curves'];
writeFileSync(
	'static/art-review/edition-4.html',
	`<!doctype html><html lang="en" data-theme="dark"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Pattern · Generalization art study</title><style>*{box-sizing:border-box}body{--bg:#141619;--ink:#e9edf5;--muted:#a9b4c5;--surface:#1d232e;background:var(--bg);color:var(--ink);font:15px/1.7 system-ui;margin:0;padding:38px}[data-theme=light] body{--bg:#edf0f6;--ink:#29364b;--muted:#5d6c83;--surface:#fbfcff}main{max-width:1240px;margin:auto}header{display:flex;gap:20px;justify-content:space-between;align-items:center}h1{font:italic 44px Georgia;margin:0}header p,p{color:var(--muted);font-size:13px}button,a{font:13px system-ui;border:0;border-radius:10px;padding:12px;color:var(--ink);background:var(--surface)}button{cursor:pointer}article{margin:34px 0 54px}h2{font-size:15px;font-weight:500;margin:0}img{display:block;width:100%;height:auto;margin-top:18px}article p{margin-top:8px}a{display:inline-block;text-decoration:none}nav{display:flex;gap:10px;flex-shrink:0}@media(max-width:650px){body{padding:22px}header{display:block}nav{margin-top:20px}h1{font-size:35px}}</style></head><body><main><header><div><h1>The real test is something new.</h1><p>Three transparent studies. Same blue for every curve. No cream tiles, orange markers, or background fill.</p></div><nav><button id="theme">Light background</button><a href="/#generalization">Back to the chapter</a></nav></header>${cards.map((name, i) => `<article><h2>${name}</h2><img src="generalization-${'ABC'[i]}-v4.png" alt="${name}: underfitting, generalization, overfitting"/><p>${['The strongest distinction between a rigid line, a broad trend, and an over-flexible fit. Provisional choice in the app.', 'The lightest graphic treatment. The overfit curve is less pronounced.', 'A quieter composition without axes. The points are too orderly to make the noise lesson as clear.'][i]}</p></article>`).join('')}<p>These illustrations communicate an idea. The live lab supplies actual fitted curves and measured errors.</p></main><script>document.getElementById('theme').onclick=()=>{const light=document.documentElement.dataset.theme!=='light';document.documentElement.dataset.theme=light?'light':'dark';document.getElementById('theme').textContent=light?'Dark background':'Light background';};</script></body></html>`
);
console.log(meta);
