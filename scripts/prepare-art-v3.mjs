import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root = path.resolve(import.meta.dirname, '..');
const read = async (name) => JSON.parse(await fs.readFile(path.join(root, 'docs', name), 'utf8'));
const candidates = await read('art-candidates-v3.json');
const choices = await read('art-selections-v3.json');
const direction = await read('art-direction-v3.json');
const review = path.join(root, 'static/art-review');
const output = path.join(root, 'static/images/edition-3');
const proofs = path.join(root, 'test-results/art-v3');
await Promise.all([review, output, proofs].map((p) => fs.mkdir(p, { recursive: true })));
// These are derived exports; archived originals remain in the review gallery.
for (const [asset, choice] of Object.entries(choices)) {
	if (!choice.variant) {
		await Promise.all(
			[`${asset}.webp`, `${asset}-800.webp`].map((name) =>
				fs.rm(path.join(output, name), { force: true })
			)
		);
	}
}
const meta = [];
for (const c of candidates) {
	const { data, info } = await sharp(c.source)
		.ensureAlpha()
		.raw()
		.toBuffer({ resolveWithObject: true });
	let x0 = info.width,
		y0 = info.height,
		x1 = -1,
		y1 = -1,
		transparent = 0;
	for (let y = 0; y < info.height; y++)
		for (let x = 0; x < info.width; x++) {
			const a = data[(y * info.width + x) * 4 + 3];
			if (a < 10) transparent++;
			if (a > 20) {
				x0 = Math.min(x0, x);
				x1 = Math.max(x1, x);
				y0 = Math.min(y0, y);
				y1 = Math.max(y1, y);
			}
		}
	if (transparent / (info.width * info.height) < 0.06)
		throw new Error(`${c.asset} ${c.variant}: no usable transparency`);
	// Crop only unused outer canvas; preserve all opaque content and a 2% safety margin.
	const pad = Math.round(info.width * 0.02);
	const crop = { left: Math.max(0, x0 - pad), top: Math.max(0, y0 - pad), width: 0, height: 0 };
	crop.width = Math.min(info.width, x1 + pad + 1) - crop.left;
	crop.height = Math.min(info.height, y1 + pad + 1) - crop.top;
	const base = `${c.asset}-${c.variant}`;
	const pipeline = () => sharp(c.source).extract(crop);
	await pipeline()
		.resize({ width: 1200, withoutEnlargement: true })
		.webp({ quality: 90, alphaQuality: 100 })
		.toFile(path.join(review, `${base}.webp`));
	const selected = choices[c.asset]?.variant === c.variant;
	if (selected) {
		await pipeline()
			.webp({ quality: 94, alphaQuality: 100 })
			.toFile(path.join(output, `${c.asset}.webp`));
		await pipeline()
			.resize({ width: 800, withoutEnlargement: true })
			.webp({ quality: 90, alphaQuality: 100 })
			.toFile(path.join(output, `${c.asset}-800.webp`));
		for (const [theme, background] of [
			['dark', '#141619'],
			['light', '#edf0f6']
		]) {
			await pipeline()
				.resize({ width: 1200 })
				.flatten({ background })
				.png()
				.toFile(path.join(proofs, `${base}-${theme}.png`));
		}
	}
	meta.push({
		...c,
		source: path.basename(c.source),
		width: crop.width,
		height: crop.height,
		crop,
		transparentFraction: transparent / (info.width * info.height),
		selected
	});
}
await fs.writeFile(
	path.join(root, 'docs/art-assets-v3.json'),
	JSON.stringify(meta, null, 2) + '\n'
);
const escape = (s) => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
const sections = direction.chapters.filter((c) => candidates.some((i) => i.asset === c.asset));
const renderCard = (m, chapter) => {
	const choice = choices[m.asset];
	const rejected = choice?.rejectedVariants?.includes(m.variant);
	const status = m.selected
		? 'Your selection'
		: rejected
			? 'Earlier direction'
			: m.reviewRound === 2
				? 'New direction'
				: '';
	const reviewText = m.revisionNote || (m.selected ? choice.reason : '');
	return `<article class="${m.selected ? 'selected' : ''}"><button class="image" data-src="${m.asset}-${m.variant}.webp" data-title="${escape(chapter.chapter)} · ${m.variant}" aria-label="Enlarge ${escape(chapter.chapter)} candidate ${m.variant}"><img loading="lazy" width="${m.width}" height="${m.height}" src="${m.asset}-${m.variant}.webp" alt="${escape(m.label || `Candidate ${m.variant} for ${chapter.chapter}`)}"></button><div class="caption"><span class="letter">${m.variant}</span><span>${escape(m.label || chapter.chapter)}</span>${status ? `<span class="status">${status}</span>` : ''}</div><details><summary>Concept and review</summary><p>${escape(chapter.variants[m.variant.charCodeAt(0) - 65])}</p>${reviewText ? `<p>${escape(reviewText)}</p>` : ''}</details></article>`;
};
const renderSection = (chapter) => {
	const choice = choices[chapter.asset];
	const images = meta.filter((m) => m.asset === chapter.asset);
	const archived = images.filter(
		(m) => choice?.status === 'interactive-only' || choice?.rejectedVariants?.includes(m.variant)
	);
	const current = images.filter((m) => !archived.includes(m));
	return `<section id="${chapter.asset}"><h2>${escape(chapter.chapter)}</h2>${choice?.status ? `<p class="section-note">${escape(choice.reason)}</p>` : ''}${current.length ? `<div class="grid">${current.map((m) => renderCard(m, chapter)).join('')}</div>` : ''}${archived.length ? `<details class="archive"><summary>${choice?.status === 'interactive-only' ? 'Archived studies · interactive map retained' : 'Earlier directions · not selected'}</summary><div class="grid">${archived.map((m) => renderCard(m, chapter)).join('')}</div></details>` : ''}</section>`;
};
const html = `<!doctype html>
<html lang="en" data-theme="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Pattern · Image studies</title>
<style>
:root{color-scheme:dark;--bg:#141619;--surface:#1d2025;--ink:#efeee9;--muted:#afb3bb;--accent:#c9b9f1} :root[data-theme=light]{color-scheme:light;--bg:#edf0f6;--surface:#fbfcff;--ink:#29364b;--muted:#5d6c83;--accent:#775ba8}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.6 system-ui,sans-serif}header{position:sticky;top:0;background:var(--bg);z-index:2;padding:15px max(24px,calc((100vw - 1440px)/2));display:flex;align-items:center;gap:20px;box-shadow:0 1px 0 #8882}header a{color:var(--ink);text-decoration:none;font-size:21px;font-weight:600}header span{color:var(--muted);flex:1}button,select{font:inherit;color:var(--ink);background:var(--surface);border:0;border-radius:9px;padding:9px 14px;cursor:pointer}button:focus-visible,select:focus-visible,a:focus-visible{outline:2px solid var(--accent);outline-offset:4px}main{max-width:1440px;margin:auto;padding:36px 24px 80px}h1{font-size:clamp(32px,5vw,52px);font-weight:500;letter-spacing:-.045em;margin:0}h2{font-size:25px;letter-spacing:-.03em;font-weight:500;margin:0}p{color:var(--muted);max-width:760px}section{scroll-margin-top:100px;margin:56px 0 80px}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px;margin-top:22px}article{background:var(--surface);border-radius:15px;overflow:hidden;min-width:0}article.selected{box-shadow:inset 0 0 0 1px var(--accent)}.image{display:block;width:100%;padding:20px;background:var(--bg);border-radius:0}.image img{display:block;width:100%;height:auto;aspect-ratio:2.4;object-fit:contain}.caption{padding:14px 19px;display:flex;gap:12px;align-items:center}.letter{font-size:18px;font-weight:600}.status{margin-left:auto;color:var(--accent);font-size:12px}details{padding:0 19px 16px;font-size:12px;color:var(--muted)}summary{cursor:pointer}details p{line-height:1.7}.archive{margin-top:20px;padding:16px 0}.archive>summary{color:var(--muted)}.section-note{margin-bottom:0}.lead{display:flex;align-items:end;justify-content:space-between;gap:20px}dialog{border:0;border-radius:15px;padding:22px;background:var(--bg);color:var(--ink);max-width:min(96vw,1800px);width:96vw}dialog::backdrop{background:#000b;backdrop-filter:blur(10px)}dialog img{width:100%;max-height:78vh;object-fit:contain;display:block}dialog form{display:flex;align-items:center;gap:20px;justify-content:space-between}dialog h2{font-size:17px}footer{color:var(--muted);font-size:12px}@media(max-width:700px){header{padding:12px 18px;gap:12px}header span{display:none}.grid{grid-template-columns:1fr}.lead{display:block}select{max-width:100%}main{padding:28px 18px}section{margin-top:40px}.image{padding:12px}}
</style></head><body><header><a href="/">pattern.</a><span>Image studies · ${candidates.length} candidates</span><button id="theme" type="button">Light background</button></header><main><div class="lead"><div><h1>A closer look.</h1><p>Your selections are marked, including the new self-supervision direction H. Open any image for a closer look and compare both app backgrounds.</p></div><label>Chapter <select id="chapter">${sections.map((s) => `<option value="${s.asset}">${escape(s.chapter)}</option>`).join('')}</select></label></div>
${sections.map(renderSection).join('')}
<footer>Created with the built-in image generation tool. The curriculum’s retained illustrations are unchanged. These are conceptual illustrations; the live labs expose measured model behavior.</footer></main><dialog id="detail"><form method="dialog"><h2 id="detail-title"></h2><button>Close</button></form><img id="detail-image" alt=""></dialog>
<script>const theme=document.getElementById('theme'),dialog=document.getElementById('detail');theme.addEventListener('click',()=>{const light=document.documentElement.dataset.theme!=='light';document.documentElement.dataset.theme=light?'light':'dark';theme.textContent=light?'Dark background':'Light background'});document.getElementById('chapter').addEventListener('change',e=>{document.getElementById(e.target.value).scrollIntoView({behavior:'smooth',block:'start'})});document.querySelectorAll('[data-src]').forEach(b=>b.addEventListener('click',()=>{document.getElementById('detail-image').src=b.dataset.src;document.getElementById('detail-image').alt=b.dataset.title;document.getElementById('detail-title').textContent=b.dataset.title;dialog.showModal()}));dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close()}});</script></body></html>`;
await fs.writeFile(path.join(review, 'index.html'), html);
console.log(
	JSON.stringify(
		{
			candidates: candidates.length,
			selected: meta
				.filter((m) => m.selected)
				.map(({ asset, variant, width, height }) => ({ asset, variant, width, height }))
		},
		null,
		2
	)
);
