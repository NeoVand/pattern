import { loadMnist } from './mnist-data';
import { loadConvFashion, type ConvFashionData } from './convnet-data';
import { CONV_CLASSES } from './convnet';

export type AutoencoderDatasetId = 'mnist' | 'fashion';
export type AutoencoderData = ConvFashionData;
export type AutoencoderDataset = {
	id: AutoencoderDatasetId;
	name: string;
	subtitle: string;
	kicker: string;
	item: string;
	items: string;
	labels: readonly string[];
	initialPair: [number, number];
	checkpoint: '/data/mnist-autoencoder.f32' | '/data/fashion-autoencoder.f32';
	provenance: '/data/MNIST-PROVENANCE.md' | '/data/FASHION-AUTOENCODER-PROVENANCE.md';
	load: () => Promise<AutoencoderData>;
};

let fashion: Promise<AutoencoderData> | undefined;
function loadFashion() {
	// Keep decoded pixels for a return visit; workers receive their own copies.
	fashion ??= loadConvFashion().catch((error) => {
		fashion = undefined;
		throw error;
	});
	return fashion;
}

export const autoencoderDatasets: Record<AutoencoderDatasetId, AutoencoderDataset> = {
	mnist: {
		id: 'mnist',
		name: 'MNIST',
		subtitle: 'Handwritten digits',
		kicker: 'HANDWRITING, REIMAGINED',
		item: 'digit',
		items: 'digits',
		labels: Array.from({ length: 10 }, (_, i) => String(i)),
		initialPair: [3, 8],
		checkpoint: '/data/mnist-autoencoder.f32',
		provenance: '/data/MNIST-PROVENANCE.md',
		load: loadMnist
	},
	fashion: {
		id: 'fashion',
		name: 'Fashion-MNIST',
		subtitle: 'Clothing & accessories',
		kicker: 'A WARDROBE OF PATTERNS',
		item: 'item',
		items: 'clothing images',
		labels: CONV_CLASSES,
		initialPair: [7, 9],
		checkpoint: '/data/fashion-autoencoder.f32',
		provenance: '/data/FASHION-AUTOENCODER-PROVENANCE.md',
		load: loadFashion
	}
};
