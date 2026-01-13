import type {LocalSymbolIndexEntry} from './local-symbol-index.js';
import type {GlobalSymbolIndexEntry} from './global-symbol-index.js';

type Vector = Map<string, number>;

const toVector = (tokens: string[]): Vector => {
	const vector = new Map<string, number>();
	for (const token of tokens) {
		const normalized = token.toLowerCase();
		vector.set(normalized, (vector.get(normalized) ?? 0) + 1);
	}

	return vector;
};

const cosineSimilarity = (a: Vector, b: Vector): number => {
	let dot = 0;
	let magA = 0;
	let magB = 0;

	for (const value of a.values()) {
		magA += value * value;
	}

	for (const value of b.values()) {
		magB += value * value;
	}

	for (const [key, value] of a.entries()) {
		const other = b.get(key);
		if (other) {
			dot += value * other;
		}
	}

	if (magA === 0 || magB === 0) {
		return 0;
	}

	return dot / (Math.sqrt(magA) * Math.sqrt(magB));
};

export const semanticSearch = (
	query: string,
	entries: Array<LocalSymbolIndexEntry | GlobalSymbolIndexEntry>,
	maxResults = 20,
) => {
	const queryVector = toVector(query.split(/\s+/g).filter(Boolean));

	return entries
		.map(entry => ({
			entry,
			score: cosineSimilarity(queryVector, toVector(entry.tokens)),
		}))
		.filter(result => result.score > 0)
		.sort((a, b) => b.score - a.score)
		.slice(0, maxResults)
		.map(result => result.entry);
};
