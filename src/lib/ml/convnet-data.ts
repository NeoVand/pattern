import { base } from '$app/paths';
export interface ConvFashionData {
	trainX: Float32Array;
	trainY: Int32Array;
	testX: Float32Array;
	testY: Int32Array;
}
async function fetchOk(path: string) {
	const response = await fetch(`${base}/data/${path}`);
	if (!response.ok)
		throw new Error(
			`The Fashion-MNIST ${path.includes('labels') ? 'labels' : 'images'} could not load.`
		);
	return response;
}
async function loadSheet(file: string, count: number, cols: number): Promise<Float32Array> {
	const image = await createImageBitmap(await (await fetchOk(file)).blob());
	const canvas = new OffscreenCanvas(image.width, image.height);
	const context = canvas.getContext('2d', { willReadFrequently: true });
	if (!context) throw new Error('This browser cannot decode the clothing examples.');
	context.drawImage(image, 0, 0);
	image.close();
	const rgba = context.getImageData(0, 0, canvas.width, canvas.height).data;
	const pixels = new Float32Array(count * 784);
	for (let index = 0; index < count; index++) {
		const ox = (index % cols) * 28,
			oy = Math.floor(index / cols) * 28;
		for (let y = 0; y < 28; y++)
			for (let x = 0; x < 28; x++)
				pixels[index * 784 + y * 28 + x] = rgba[((oy + y) * canvas.width + ox + x) * 4] / 255;
	}
	return pixels;
}
export async function loadConvFashion(): Promise<ConvFashionData> {
	const meta = (await (await fetchOk('fashion-meta.json')).json()) as {
		side: number;
		cols: number;
		train: number;
		test: number;
	};
	if (meta.side !== 28 || meta.train !== 12000 || meta.test !== 2000)
		throw new Error('The Fashion-MNIST subset metadata does not match this checkpoint.');
	const [trainX, testX, labelBuffer] = await Promise.all([
		loadSheet('fashion-train.png', meta.train, meta.cols),
		loadSheet('fashion-test.png', meta.test, meta.cols),
		fetchOk('fashion-labels.bin').then((r) => r.arrayBuffer())
	]);
	const labels = new Uint8Array(labelBuffer);
	if (labels.length !== meta.train + meta.test || labels.some((x) => x > 9))
		throw new Error('The Fashion-MNIST labels are incomplete.');
	return {
		trainX,
		testX,
		trainY: Int32Array.from(labels.subarray(0, meta.train)),
		testY: Int32Array.from(labels.subarray(meta.train))
	};
}
