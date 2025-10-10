// Exemplos de obstáculos: cada obstáculo é um array de blocos (x, y)
// Os blocos representam paredes que o usuário deve desviar

export type Bloco = { x: number; y: number };

export const obstaculosList: Bloco[][] = [
	// Parede vertical
	[
		{ x: 5, y: 0 },
		{ x: 5, y: 1 },
		{ x: 5, y: 2 },
		{ x: 5, y: 3 },
		{ x: 5, y: 4 },
	],
	// Parede horizontal
	[
		{ x: 2, y: 6 },
		{ x: 3, y: 6 },
		{ x: 4, y: 6 },
		{ x: 5, y: 6 },
		{ x: 6, y: 6 },
	],
	// Obstáculo em L
	[
		{ x: 8, y: 2 },
		{ x: 8, y: 3 },
		{ x: 8, y: 4 },
		{ x: 9, y: 4 },
		{ x: 10, y: 4 },
	],
	// Obstáculo diagonal
	[
		{ x: 0, y: 0 },
		{ x: 1, y: 1 },
		{ x: 2, y: 2 },
		{ x: 3, y: 3 },
		{ x: 4, y: 4 },
	],
];
