/** Resolve theme colors for canvas, and repaint when the app theme changes. */
export function canvasColor(element: HTMLElement, property: string): [number, number, number] {
	const color = getComputedStyle(element).getPropertyValue(property).trim();
	const sample = document.createElement('canvas').getContext('2d')!;
	sample.fillStyle = color;
	sample.fillRect(0, 0, 1, 1);
	const pixel = sample.getImageData(0, 0, 1, 1).data;
	return [pixel[0], pixel[1], pixel[2]];
}
export function observeCanvasTheme(paint: () => void): () => void {
	paint();
	const observer = new MutationObserver(paint);
	observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
	return () => observer.disconnect();
}
