import {existsSync, readdirSync, promises as fs} from 'node:fs';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {Buffer} from 'node:buffer';
import type {
	AppleDevDocsClient,
	FrameworkData,
	SymbolData,
	ReferenceData,
} from '../../apple-client.js';
import {CacheIndex} from '../../apple-client/cache/cache-index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export type GlobalSymbolIndexEntry = {
	id: string;
	title: string;
	path: string;
	kind: string;
	abstract: string;
	platforms: string[];
	tokens: string[];
	filePath: string;
};

const synonymMap: Record<string, string[]> = {
	auth: ['authentication', 'authorize', 'oauth', 'signin'],
	notification: ['push', 'alert'],
	tabbar: ['tab', 'tabs'],
	modal: ['sheet', 'dialog'],
	db: ['database', 'storage'],
	net: ['network', 'networking'],
};

export class GlobalSymbolIndex {
	private readonly symbols = new Map<string, GlobalSymbolIndexEntry>();
	private readonly cacheDir: string;
	private readonly cacheIndex: CacheIndex;
	private readonly processedFiles = new Set<string>();

	constructor(private readonly client: AppleDevDocsClient) {
		this.cacheDir = join(__dirname, '../../../.cache');
		this.cacheIndex = new CacheIndex(this.cacheDir);
	}

	async buildIndexFromCache(): Promise<void> {
		await this.cacheIndex.load();
		if (!existsSync(this.cacheDir)) {
			return;
		}

		const files = readdirSync(this.cacheDir).filter(file => file.endsWith('.json'));
		for (const file of files) {
			const filePath = join(this.cacheDir, file);
			if (this.processedFiles.has(file)) {
				continue;
			}

			// eslint-disable-next-line no-await-in-loop
			if (!await this.validateIntegrity(filePath, file)) {
				continue;
			}

			try {
				// eslint-disable-next-line no-await-in-loop
				const rawData = await fs.readFile(filePath, 'utf8');
				const data = JSON.parse(rawData) as SymbolData | FrameworkData;
				if (!this.isValidCacheData(data)) {
					continue;
				}

				this.processSymbolData(data, filePath);
				this.processedFiles.add(file);
			} catch (error) {
				console.warn(`Failed to index ${file}:`, error instanceof Error ? error.message : String(error));
			}
		}
	}

	search(query: string, maxResults = 20): GlobalSymbolIndexEntry[] {
		const results: Array<{entry: GlobalSymbolIndexEntry; score: number}> = [];
		const queryTokens = this.expandTokens(this.tokenize(query));

		const hasWildcards = query.includes('*') || query.includes('?');

		for (const entry of this.symbols.values()) {
			let score = 0;
			if (hasWildcards) {
				const pattern = query.replaceAll('*', '.*').replaceAll('?', '.').toLowerCase();
				const regex = new RegExp(`^${pattern}$`);
				if (regex.test(entry.title.toLowerCase())
					|| regex.test(entry.path.toLowerCase())
					|| entry.tokens.some(token => regex.test(token))) {
					score = 100;
				}
			} else {
				for (const token of queryTokens) {
					if (entry.title.toLowerCase().includes(token)) {
						score += 50;
					}

					if (entry.tokens.includes(token)) {
						score += 30;
					}

					if (entry.abstract.toLowerCase().includes(token)) {
						score += 10;
					}
				}
			}

			if (score > 0) {
				results.push({entry, score});
			}
		}

		return results
			.sort((a, b) => b.score - a.score)
			.slice(0, maxResults)
			.map(result => result.entry);
	}

	getSymbolCount(): number {
		return this.symbols.size;
	}

	clear(): void {
		this.symbols.clear();
		this.processedFiles.clear();
	}

	private tokenize(text: string): string[] {
		if (!text) {
			return [];
		}

		const tokens = new Set<string>();
		const basicTokens = text.split(/[\s/._-]+/).filter(Boolean);

		for (const token of basicTokens) {
			tokens.add(token.toLowerCase());
			tokens.add(token);

			const camelParts = token.split(/(?=[A-Z])/).filter(Boolean);
			if (camelParts.length > 1) {
				for (const part of camelParts) {
					tokens.add(part.toLowerCase());
					tokens.add(part);
				}

				tokens.add(camelParts.join('').toLowerCase());
			}
		}

		return [...tokens];
	}

	private expandTokens(tokens: string[]): string[] {
		const expanded = new Set<string>(tokens.map(token => token.toLowerCase()));
		for (const token of tokens) {
			const normalized = token.toLowerCase();
			for (const synonym of synonymMap[normalized] ?? []) {
				expanded.add(synonym.toLowerCase());
			}
		}

		return [...expanded];
	}

	private isValidCacheData(data: unknown): data is SymbolData | FrameworkData {
		if (!data || typeof data !== 'object') {
			return false;
		}

		const object = data as Record<string, unknown>;
		if (!('abstract' in object) || !('metadata' in object)) {
			return false;
		}

		return true;
	}

	private processSymbolData(data: SymbolData | FrameworkData, filePath: string): void {
		const title = data.metadata?.title || 'Unknown';
		const path = (data.metadata && 'url' in data.metadata && typeof data.metadata.url === 'string') ? data.metadata.url : '';
		const kind = (data.metadata && 'symbolKind' in data.metadata && typeof data.metadata.symbolKind === 'string') ? data.metadata.symbolKind : 'framework';
		const abstract = this.client.extractText(data.abstract);
		const platforms = data.metadata?.platforms?.map(p => p.name).filter(Boolean) || [];

		const tokens = [...this.expandTokens(this.tokenize(title)), ...this.tokenize(abstract), ...this.tokenize(path)];

		this.symbols.set(path || title, {
			id: path || title,
			title,
			path,
			kind,
			abstract,
			platforms,
			tokens,
			filePath,
		});

		this.processReferences(data.references, filePath);
	}

	private processReferences(references: Record<string, ReferenceData> | undefined, filePath: string): void {
		if (!references) {
			return;
		}

		for (const [refId, ref] of Object.entries(references)) {
			if (ref.kind !== 'symbol' || !ref.title) {
				continue;
			}

			const tokens = [...this.expandTokens(this.tokenize(ref.title)), ...this.tokenize(ref.url ?? '')];

			this.symbols.set(refId, {
				id: refId,
				title: ref.title,
				path: ref.url || '',
				kind: ref.kind,
				abstract: this.client.extractText(ref.abstract ?? []),
				platforms: ref.platforms?.map(p => p.name).filter(Boolean) ?? [],
				tokens,
				filePath,
			});
		}
	}

	private async validateIntegrity(filePath: string, fileName: string): Promise<boolean> {
		const rawData = await fs.readFile(filePath, 'utf8');
		const hash = CacheIndex.createHash(rawData);
		const entry = this.cacheIndex.getEntry(fileName);
		if (entry && entry.hash !== hash) {
			console.warn(`Cache hash mismatch for ${fileName}, skipping`);
			try {
				await fs.unlink(filePath);
			} catch (error) {
				if ((error as NodeJS.ErrnoException)?.code !== 'ENOENT') {
					console.warn(`Failed to remove corrupt cache file ${fileName}:`, error instanceof Error ? error.message : String(error));
				}
			}

			this.cacheIndex.removeEntry(fileName);
			return false;
		}

		const now = new Date().toISOString();

		this.cacheIndex.setEntry({
			fileName,
			bytes: Buffer.byteLength(rawData),
			hash,
			lastAccessedAt: now,
			updatedAt: entry?.updatedAt ?? now,
		});
		await this.cacheIndex.persist();
		return true;
	}
}
