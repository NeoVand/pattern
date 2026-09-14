import { asset } from '$app/paths';
import type { Sample } from './models';
export type FashionSample = Sample & { id: string; image: string; label: 'Sneaker' | 'Ankle boot' };
const image = (url: string) =>
	new Promise<HTMLImageElement>((resolve, reject) => {
		const img = new Image();
		img.onload = () => resolve(img);
		img.onerror = () =>
			reject(new Error('The clothing images could not load. Retry the dataset download.'));
		img.src = url;
	});
/** Jaxverse's Fashion-MNIST sprite packing: 100 columns, 28px tiles. Official test examples stay separate. */
export async function loadFashion(): Promise<FashionSample[]> {
	const [train, test, labelResponse] = await Promise.all([
		image(asset('/data/fashion-train.png')),
		image(asset('/data/fashion-test.png')),
		fetch(asset('/data/fashion-labels.bin'))
	]);
	if (!labelResponse.ok) throw new Error('The Fashion-MNIST labels could not load.');
	const labels = new Uint8Array(await labelResponse.arrayBuffer());
	if (labels.length !== 14000) throw new Error('Fashion-MNIST label file is incomplete.');
	const canvas = document.createElement('canvas');
	canvas.width = 28;
	canvas.height = 28;
	const ctx = canvas.getContext('2d', { willReadFrequently: true });
	if (!ctx) throw new Error('This browser cannot read the image dataset.');
	const output: FashionSample[] = [];
	for (const source of [
		{ img: train, offset: 0, n: 12000 },
		{ img: test, offset: 12000, n: 2000 }
	]) {
		const counts = [0, 0];
		for (let i = 0; i < source.n; i++) {
			const label = labels[source.offset + i];
			if (label !== 7 && label !== 9) continue;
			const y = label === 9 ? 1 : 0;
			const index = counts[y]++;
			if (index >= (source.offset ? 60 : 200)) continue;
			ctx.clearRect(0, 0, 28, 28);
			ctx.drawImage(source.img, (i % 100) * 28, Math.floor(i / 100) * 28, 28, 28, 0, 0, 28, 28);
			const rgba = ctx.getImageData(0, 0, 28, 28).data;
			const x = Array.from({ length: 196 }, (_, j) => {
				const row = Math.floor(j / 14) * 2,
					col = (j % 14) * 2;
				return (
					[0, 1, 28, 29].reduce((sum, delta) => sum + rgba[(row * 28 + col + delta) * 4], 0) /
					(4 * 255)
				);
			});
			output.push({
				id: `${source.offset ? 'test' : 'train'}-${i}`,
				x,
				y,
				split: source.offset ? 'test' : index < 160 ? 'train' : 'validation',
				image: canvas.toDataURL(),
				label: y ? 'Ankle boot' : 'Sneaker'
			});
		}
	}
	return (['train', 'validation', 'test'] as const).flatMap((split) => {
		const a = output.filter((p) => p.split === split && p.y === 0),
			b = output.filter((p) => p.split === split && p.y === 1);
		return a.flatMap((p, i) => [p, b[i]]);
	});
}
