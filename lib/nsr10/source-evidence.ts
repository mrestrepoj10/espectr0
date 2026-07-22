export type NormalizedPdfRect = {
	left: number;
	top: number;
	width: number;
	height: number;
};

export const caliSourceEvidence = {
	pageNumber: 191,
	printedPage: "A-177",
	row: {
		left: 0.1340196078,
		top: 0.6368939394,
		width: 0.7318627451,
		height: 0.0137121212,
	},
	values: [
		{
			key: "Aa",
			value: "0.25",
			rect: {
				left: 0.4815542484,
				top: 0.6360844697,
				width: 0.036725817,
				height: 0.0164141414,
			},
		},
		{
			key: "Av",
			value: "0.25",
			rect: {
				left: 0.5521277778,
				top: 0.6360844697,
				width: 0.036725817,
				height: 0.0164141414,
			},
		},
	],
} as const satisfies {
	pageNumber: number;
	printedPage: string;
	row: NormalizedPdfRect;
	values: ReadonlyArray<{
		key: "Aa" | "Av";
		value: string;
		rect: NormalizedPdfRect;
	}>;
};
