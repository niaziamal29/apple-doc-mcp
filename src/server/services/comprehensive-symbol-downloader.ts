/* eslint-disable max-depth */
import {promises as fs} from 'node:fs';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {ErrorCode, McpError} from '@modelcontextprotocol/sdk/types.js';
import type {ServerContext} from '../context.js';
import {
	type SymbolData, type ReferenceData, type FrameworkData, type AppleDevDocsClient,
} from '../../apple-client.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export type SymbolIndexEntry = {
	id: string;
	title: string;
	path: string;
	kind: string;
	abstract: string;
	platforms: string[];
	tokens: string[];
};

export class ComprehensiveSymbolDownloader {
	private readonly downloadedSymbols = new Set<string>();
	private readonly pendingSymbols: string[] = [];
	private statePath = '';
	private running = false;
	private activeTechnologyIdentifier?: string;

	constructor(private readonly client: AppleDevDocsClient) {}

	private get rateLimitDelay(): number {
		return 100; // 100ms between requests
	}

	private get maxRetries(): number {
		return 3;
	}

	private get maxConcurrency(): number {
		return 5;
	}

	private get maxRecursionDepth(): number {
		return 4; // Maximum depth to prevent runaway downloads
	}

	getDownloadedCount(): number {
		return this.downloadedSymbols.size;
	}

	getDownloadedSymbols(): string[] {
		return [...this.downloadedSymbols];
	}

	queuePriorityPaths(paths: string[]): void {
		const normalized = paths.map(path => this.normalizeIdentifier(path));
		const pendingSet = new Set(this.pendingSymbols);
		for (const path of normalized.reverse()) {
			if (!this.downloadedSymbols.has(path) && !pendingSet.has(path)) {
				this.pendingSymbols.unshift(path);
				pendingSet.add(path);
			}
		}
	}

	async downloadAllSymbols(
		context: ServerContext,
		onSymbolDownloaded?: (data: SymbolData | FrameworkData) => void,
	): Promise<void> {
		const {state} = context;
		const activeTechnology = state.getActiveTechnology();

		if (!activeTechnology) {
			throw new McpError(
				ErrorCode.InvalidRequest,
				'No technology selected. Use `discover_technologies` then `choose_technology` first.',
			);
		}

		console.error(`🚀 Starting comprehensive symbol download for ${activeTechnology.title}`);
		console.error('⏳ This will download additional symbols to improve search results...');

		this.activeTechnologyIdentifier = activeTechnology.identifier;
		await this.loadState(activeTechnology.identifier);

		if (this.pendingSymbols.length === 0) {
			// Load main framework data
			const frameworkData = await this.client.getFramework(activeTechnology.title);
			onSymbolDownloaded?.(frameworkData);

			// Extract all identifiers from main framework
			const initialIdentifiers = this.extractAllIdentifiers(frameworkData);
			console.error(`📋 Found ${initialIdentifiers.length} initial identifiers to process`);
			this.queueIdentifiers(initialIdentifiers);
		}

		await this.downloadSymbolsRecursively(onSymbolDownloaded);

		console.error(`✅ Download completed! Total symbols downloaded: ${this.downloadedSymbols.size}`);
	}

	private async delay(ms: number): Promise<void> {
		return new Promise<void>(resolve => {
			setTimeout(resolve, ms);
		});
	}

	private extractAllIdentifiers(data: SymbolData | FrameworkData): string[] {
		const identifiers = new Set<string>();

		// Extract from topicSections
		if (data.topicSections) {
			for (const section of data.topicSections) {
				if (section.identifiers) {
					for (const id of section.identifiers) {
						identifiers.add(id);
					}
				}
			}
		}

		// Extract from references
		if (data.references) {
			for (const [refId, ref] of Object.entries(data.references)) {
				identifiers.add(refId);
			}
		}

		return [...identifiers];
	}

	private async downloadSymbolWithRetry(identifier: string, attempt = 1): Promise<SymbolData | undefined> {
		try {
			const symbolPath = this.normalizeIdentifier(identifier);

			const data = await this.client.getSymbol(symbolPath);
			return data;
		} catch (error) {
			console.warn(`Attempt ${attempt} failed for ${identifier}:`, error instanceof Error ? error.message : String(error));

			if (attempt < this.maxRetries) {
				// Exponential backoff
				await this.delay(this.rateLimitDelay * (2 ** (attempt - 1)));

				return this.downloadSymbolWithRetry(identifier, attempt + 1);
			}

			return undefined;
		}
	}

	private async downloadSymbolsRecursively(
		onSymbolDownloaded?: (data: SymbolData | FrameworkData) => void,
		depth = 0,
	): Promise<void> {
		if (this.running) {
			console.error('⏳ Comprehensive download already running, skipping');
			return;
		}

		this.running = true;
		try {
			let currentDepth = depth;
			while (this.pendingSymbols.length > 0 && currentDepth < this.maxRecursionDepth) {
				const batch = this.pendingSymbols.splice(0, this.maxConcurrency);
				let processed = 0;
				const totalToProcess = batch.length;

				console.error(`📥 Processing ${totalToProcess} symbols (depth ${currentDepth})...`);

				// eslint-disable-next-line no-await-in-loop
				const results = await Promise.all(batch.map(async identifier => {
					if (this.downloadedSymbols.has(identifier)) {
						return undefined;
					}

					processed++;
					if (processed % 5 === 0 || processed === totalToProcess) {
						console.error(`📥 Progress: ${processed}/${totalToProcess} symbols processed (${this.downloadedSymbols.size} total downloaded)`);
					}

					await this.delay(this.rateLimitDelay);
					const data = await this.downloadSymbolWithRetry(identifier);
					if (data) {
						this.downloadedSymbols.add(identifier);
						onSymbolDownloaded?.(data);
						return data;
					}

					return undefined;
				}));

				const newIdentifiers: string[] = [];
				for (const data of results) {
					if (!data) {
						continue;
					}

					for (const newId of this.extractAllIdentifiers(data)) {
						if (!this.downloadedSymbols.has(newId)) {
							newIdentifiers.push(newId);
						}
					}
				}

				if (newIdentifiers.length > 0) {
					console.error(`🔍 Found ${newIdentifiers.length} new identifiers to download (depth ${currentDepth + 1})`);
					this.queueIdentifiers(newIdentifiers);
					currentDepth += 1;
				}

				// eslint-disable-next-line no-await-in-loop
				await this.persistState();
			}

			if (this.pendingSymbols.length > 0) {
				console.error(`⚠️ Pausing recursion at depth ${currentDepth} to prevent runaway downloads`);
			}
		} finally {
			this.running = false;
			await this.persistState();
		}
	}

	private queueIdentifiers(identifiers: string[]): void {
		const pendingSet = new Set(this.pendingSymbols);
		for (const id of identifiers) {
			const normalized = this.normalizeIdentifier(id);
			if (!this.downloadedSymbols.has(normalized) && !pendingSet.has(normalized)) {
				this.pendingSymbols.push(normalized);
				pendingSet.add(normalized);
			}
		}
	}

	private async loadState(technologyIdentifier: string): Promise<void> {
		this.activeTechnologyIdentifier = technologyIdentifier;
		this.statePath = join(__dirname, '../../../.cache/comprehensive-download-state.json');
		this.downloadedSymbols.clear();
		this.pendingSymbols.splice(0);

		try {
			const raw = await fs.readFile(this.statePath, 'utf8');
			const parsed = JSON.parse(raw) as {
				technologyIdentifier?: string;
				pending?: string[];
				completed?: string[];
			};

			if (parsed.technologyIdentifier === technologyIdentifier) {
				for (const id of parsed.completed ?? []) {
					this.downloadedSymbols.add(id);
				}

				this.pendingSymbols.push(...(parsed.pending ?? []));
			}
		} catch (error) {
			if ((error as NodeJS.ErrnoException)?.code !== 'ENOENT') {
				console.warn('Failed to load download state:', error instanceof Error ? error.message : String(error));
			}
		}
	}

	private async persistState(): Promise<void> {
		if (!this.activeTechnologyIdentifier) {
			return;
		}

		const payload = {
			technologyIdentifier: this.activeTechnologyIdentifier,
			pending: this.pendingSymbols,
			completed: [...this.downloadedSymbols],
			updatedAt: new Date().toISOString(),
		};

		try {
			await fs.mkdir(join(__dirname, '../../../.cache'), {recursive: true});
			await fs.writeFile(this.statePath, JSON.stringify(payload, null, 2));
		} catch (error) {
			console.warn('Failed to persist download state:', error instanceof Error ? error.message : String(error));
		}
	}

	private normalizeIdentifier(identifier: string): string {
		if (identifier.startsWith('documentation/')) {
			return identifier;
		}

		if (identifier.startsWith('doc://com.apple.documentation/')) {
			return identifier.replace('doc://com.apple.documentation/', '').replace(/^documentation\//, 'documentation/');
		}

		if (identifier.includes('/')) {
			return identifier.replace(/^\/+/, '');
		}

		return identifier;
	}
}
/* eslint-enable max-depth */
