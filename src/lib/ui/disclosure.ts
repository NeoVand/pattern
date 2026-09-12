/** Animate a native disclosure without losing summary keyboard behavior. */
export function disclosure(node: HTMLDetailsElement) {
	const summary = node.querySelector('summary');
	if (!summary) return;
	let animation: Animation | undefined;
	let expanded = node.open;
	const restore = () => {
		node.style.height = '';
		node.style.overflow = '';
	};
	const toggle = (event: MouseEvent) => {
		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
		event.preventDefault();
		expanded = animation ? !expanded : !node.open;
		const from = node.getBoundingClientRect().height;
		if (animation) {
			animation.onfinish = null;
			animation.cancel();
		}
		restore();
		node.open = expanded;
		const to = node.getBoundingClientRect().height;
		node.open = true;
		node.style.height = `${from}px`;
		node.style.overflow = 'hidden';
		animation = node.animate(
			{ height: [`${from}px`, `${to}px`] },
			{ duration: 260, easing: 'cubic-bezier(.22, 1, .36, 1)' }
		);
		animation.onfinish = () => {
			node.open = expanded;
			animation = undefined;
			restore();
		};
	};
	summary.addEventListener('click', toggle);
	return () => {
		if (animation) {
			animation.onfinish = null;
			animation.cancel();
		}
		summary.removeEventListener('click', toggle);
		restore();
	};
}
