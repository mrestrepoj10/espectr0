function canonicalize(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(canonicalize);
	if (value && typeof value === "object") {
		return Object.fromEntries(
			Object.entries(value)
				.sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
				.map(([key, nested]) => [key, canonicalize(nested)]),
		);
	}
	return value;
}

export function deterministicJson(value: unknown): string {
	return `${JSON.stringify(canonicalize(value), null, 2)}\n`;
}
