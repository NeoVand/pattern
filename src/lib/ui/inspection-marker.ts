/** Open corners leave the underlying sample completely visible. */
export function inspectionMarkerPath(radius = 12, arm = 4): string {
	const r = radius;
	const a = arm;
	return `M${-r + a} ${-r}H${-r}V${-r + a} M${r - a} ${-r}H${r}V${-r + a} M${r} ${r - a}V${r}H${r - a} M${-r + a} ${r}H${-r}V${r - a}`;
}
