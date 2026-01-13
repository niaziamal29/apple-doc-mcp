import {promises as fs, readFileSync, existsSync, readdirSync, unlinkSync} from 'node:fs';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {Buffer} from 'node:buffer';
import type {
	AppleDevDocsClient,
	SymbolData,
	ReferenceData,
	FrameworkData,
} from '../../apple-client.js';
import {CacheIndex} from '../../apple-client/cache/cache-index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export type LocalSymbolIndexEntry = {
	id: string;
	title: string;
	path: string;
	kind: string;
	abstract: string;
	platforms: string[];
	tokens: string[];
	filePath: string;
};

export class LocalSymbolIndex {
	private readonly symbols = new Map<string, LocalSymbolIndexEntry>();
	private readonly cacheDir: string;
	private readonly technologyIdentifier?: string;
	private indexBuilt = false;
	private readonly processedFiles = new Set<string>();
	private readonly cacheIndex: CacheIndex;
	private readonly synonyms: Record<string, string[]> = {
		auth: ['authentication', 'authorize', 'oauth', 'signin'],
		notification: ['push', 'alert'],
		tabbar: ['tab', 'tabs'],
		modal: ['sheet', 'dialog'],
		db: ['database', 'storage'],
		net: ['network', 'networking'],
	};

	constructor(private readonly client: AppleDevDocsClient, technologyIdentifier?: string) {
		this.cacheDir = join(__dirname, '../../../.cache');
		this.technologyIdentifier = technologyIdentifier;
		this.cacheIndex = new CacheIndex(this.cacheDir);
	}

	async buildIndexFromCache(): Promise<void> {
		if (this.indexBuilt) {
			console.error('📚 Index already built, skipping rebuild');
			return;
		}

		console.error('📚 Building local symbol index from cached files...');
		await this.cacheIndex.load();

		// Validate cache directory exists
		if (!existsSync(this.cacheDir)) {
			console.warn(`Cache directory does not exist: ${this.cacheDir}`);
			this.indexBuilt = true;
			return;
		}

		// Read all JSON files in the docs directory
		const files = readdirSync(this.cacheDir).filter(file => file.endsWith('.json'));
		console.error(`📁 Found ${files.length} cached files`);

		let processedCount = 0;
		let errorCount = 0;

		for (const file of files) {
			const filePath = join(this.cacheDir, file);
			try {
				// eslint-disable-next-line no-await-in-loop
				if (!await this.validateIntegrity(filePath, file)) {
					errorCount++;
					continue;
				}

				// eslint-disable-next-line no-await-in-loop
				const rawData = await fs.readFile(filePath, 'utf8');
				const data = JSON.parse(rawData) as SymbolData | FrameworkData;

				// Validate data structure
				if (!this.isValidCacheData(data)) {
					console.warn(`Invalid cache data in ${file}, skipping`);
					errorCount++;
					continue;
				}

				// Process the data
				this.processSymbolData(data, filePath);
				this.processedFiles.add(file);
				processedCount++;
			} catch (error) {
				console.warn(`Failed to process ${file}:`, error instanceof Error ? error.message : String(error));
				errorCount++;
			}
		}

		this.indexBuilt = true;
		console.error(`✅ Local symbol index built with ${this.symbols.size} symbols (${processedCount} files processed, ${errorCount} errors)`);
	}

	async refreshFromCache(): Promise<void> {
		await this.cacheIndex.load();
		if (!existsSync(this.cacheDir)) {
			return;
		}

		const files = readdirSync(this.cacheDir).filter(file => file.endsWith('.json'));
		for (const file of files) {
			if (this.processedFiles.has(file)) {
				continue;
			}

			const filePath = join(this.cacheDir, file);
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
				console.warn(`Failed to refresh ${file}:`, error instanceof Error ? error.message : String(error));
			}
		}
	}

	search(query: string, maxResults = 20): LocalSymbolIndexEntry[] {
		const results: Array<{entry: LocalSymbolIndexEntry; score: number}> = [];
		const queryTokens = this.expandTokens(this.tokenize(query));

		// Check if query contains wildcards
		const hasWildcards = query.includes('*') || query.includes('?');

		for (const [id, entry] of this.symbols.entries()) {
			const score = this.scoreEntry(entry, queryTokens, query, hasWildcards);

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
		this.indexBuilt = false;
		this.processedFiles.clear();
	}

	ingestSymbolData(data: SymbolData | FrameworkData, filePath = ''): void {
		this.processSymbolData(data, filePath);
	}

	findEntry(query: string): LocalSymbolIndexEntry | undefined {
		if (this.symbols.has(query)) {
			return this.symbols.get(query);
		}

		return [...this.symbols.values()].find(entry =>
			entry.title.toLowerCase() === query.toLowerCase()
			|| entry.path.toLowerCase() === query.toLowerCase());
	}

	explainMatch(query: string, entry: LocalSymbolIndexEntry): {score: number; tokens: string[]} {
		const queryTokens = this.expandTokens(this.tokenize(query));
		const hasWildcards = query.includes('*') || query.includes('?');
		const score = this.scoreEntry(entry, queryTokens, query, hasWildcards);
		return {score, tokens: queryTokens};
	}

	private isValidCacheData(data: unknown): data is SymbolData | FrameworkData {
		if (!data || typeof data !== 'object') {
			return false;
		}

		const object = data as Record<string, unknown>;

		// Check for required properties
		if (!('abstract' in object) || !('metadata' in object)) {
			return false;
		}

		// Validate metadata structure
		const {metadata} = object;
		if (!metadata || typeof metadata !== 'object') {
			return false;
		}

		return true;
	}

	private tokenize(text: string): string[] {
		if (!text) {
			return [];
		}

		const tokens = new Set<string>();

		// Split on common delimiters
		const basicTokens = text.split(/[\s/._-]+/).filter(Boolean);

		for (const token of basicTokens) {
			// Add lowercase version
			tokens.add(token.toLowerCase());

			// Add original case version for exact matches
			tokens.add(token);

			// Handle camelCase/PascalCase (e.g., GridItem -> grid, item, griditem)
			const camelParts = token.split(/(?=[A-Z])/).filter(Boolean);
			if (camelParts.length > 1) {
				for (const part of camelParts) {
					tokens.add(part.toLowerCase());
					tokens.add(part);
				}

				// Add concatenated lowercase version
				tokens.add(camelParts.join('').toLowerCase());
			}
		}

		return [...tokens];
	}

	private scoreEntry(entry: LocalSymbolIndexEntry, queryTokens: string[], query: string, hasWildcards: boolean): number {
		if (hasWildcards) {
			const pattern = query
				.replaceAll('*', '.*')
				.replaceAll('?', '.')
				.toLowerCase();

			const regex = new RegExp(`^${pattern}$`);
			if (regex.test(entry.title.toLowerCase())
				|| regex.test(entry.path.toLowerCase())
				|| entry.tokens.some(token => regex.test(token))) {
				return 100;
			}

			return 0;
		}

		let score = 0;
		for (const queryToken of queryTokens) {
			if (entry.title.toLowerCase().includes(queryToken.toLowerCase())) {
				score += 50;
			}

			if (entry.tokens.includes(queryToken)) {
				score += 30;
			}

			if (entry.abstract.toLowerCase().includes(queryToken.toLowerCase())) {
				score += 10;
			}
		}

		return score;
	}

	private expandTokens(tokens: string[]): string[] {
		const expanded = new Set<string>(tokens.map(token => token.toLowerCase()));
		for (const token of tokens) {
			const normalized = token.toLowerCase();
			for (const synonym of this.synonyms[normalized] ?? []) {
				expanded.add(synonym.toLowerCase());
			}
		}

		return [...expanded];
	}

	private processSymbolData(data: SymbolData | FrameworkData, filePath: string): void {
		const title = data.metadata?.title || 'Unknown';
		const path = (data.metadata && 'url' in data.metadata && typeof data.metadata.url === 'string') ? data.metadata.url : '';
		const kind = (data.metadata && 'symbolKind' in data.metadata && typeof data.metadata.symbolKind === 'string') ? data.metadata.symbolKind : 'framework';
		const abstract = this.client.extractText(data.abstract);
		const platforms = data.metadata?.platforms?.map(p => p.name).filter(Boolean) || [];

		// Filter by technology if specified
		if (this.technologyIdentifier && path) {
			const technologyPath = this.technologyIdentifier.toLowerCase();
			const symbolPath = path.toLowerCase();
			if (!symbolPath.includes(technologyPath)) {
				return; // Skip symbols not from the selected technology
			}
		}

		// Create comprehensive tokens
		const tokens = this.createTokens(title, abstract, path, platforms);

		const entry: LocalSymbolIndexEntry = {
			id: path || title,
			title,
			path,
			kind,
			abstract,
			platforms,
			tokens,
			filePath,
		};

		this.symbols.set(path || title, entry);

		// Process references recursively
		this.processReferences(data.references, filePath);
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

		if (entry) {
			this.cacheIndex.setEntry({
				...entry,
				lastAccessedAt: new Date().toISOString(),
			});
		} else {
			const now = new Date().toISOString();
			this.cacheIndex.setEntry({
				fileName,
				bytes: Buffer.byteLength(rawData),
				hash,
				lastAccessedAt: now,
				updatedAt: now,
			});
		}

		await this.cacheIndex.persist();
		return true;
	}

	private createTokens(title: string, abstract: string, path: string, platforms: string[]): string[] {
		const tokens = new Set<string>();

		for (const token of this.tokenize(title)) {
			tokens.add(token);
		}

		for (const token of this.tokenize(abstract)) {
			tokens.add(token);
		}

		for (const token of this.tokenize(path)) {
			tokens.add(token);
		}

		// Add platform tokens
		for (const platform of platforms) {
			for (const token of this.tokenize(platform)) {
				tokens.add(token);
			}
		}

		return [...tokens];
	}

	private processReferences(references: Record<string, ReferenceData> | undefined, filePath: string): void {
		if (!references) {
			return;
		}

		for (const [refId, ref] of Object.entries(references)) {
			if (ref.kind === 'symbol' && ref.title) {
				// Filter references by technology if specified
				if (this.technologyIdentifier && ref.url) {
					const technologyPath = this.technologyIdentifier.toLowerCase();
					const refPath = ref.url.toLowerCase();
					if (!refPath.includes(technologyPath)) {
						continue; // Skip references not from the selected technology
					}
				}

				const refTokens = this.createTokens(
					ref.title,
					this.client.extractText(ref.abstract ?? []),
					ref.url || '',
					ref.platforms?.map(p => p.name).filter(Boolean) ?? [],
				);

				const refEntry: LocalSymbolIndexEntry = {
					id: refId,
					title: ref.title,
					path: ref.url || '',
					kind: ref.kind,
					abstract: this.client.extractText(ref.abstract ?? []),
					platforms: ref.platforms?.map(p => p.name).filter(Boolean) ?? [],
					tokens: refTokens,
					filePath,
				};

				this.symbols.set(refId, refEntry);
			}
		}
	}
}