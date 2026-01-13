/* eslint-disable complexity */
import type {ServerContext, ToolResponse} from '../context.js';
import {header, bold} from '../markdown.js';
import {buildNoTechnologyMessage} from './no-technology.js';

type SearchEntry = {
	id: string;
	title: string;
	path: string;
	kind: string;
	abstract: string;
	platforms: string[];
	tokens: string[];
	filePath: string;
};

const normalizePlatform = (value: string): string =>
	value.toLowerCase().replaceAll(/[^a-z\d]+/g, '');

export const buildSearchSymbolsHandler = (context: ServerContext) => {
	const {client, state} = context;
	const noTechnology = buildNoTechnologyMessage(context);
	const telemetry = state.getTelemetry();

	return async (args: {
		maxResults?: number;
		platform?: string;
		query: string;
		symbolType?: string;
		scope?: string;
	}): Promise<ToolResponse> => {
		const activeTechnology = state.getActiveTechnology();
		if (!activeTechnology) {
			return noTechnology();
		}

		const {query, maxResults = 20, platform, symbolType, scope = 'technology'} = args;
		const startTime = Date.now();

		// Get or create technology-specific local index from state
		const techLocalIndex = state.getLocalSymbolIndex(client);
		const globalIndex = state.getGlobalSymbolIndex(client);
		const useGlobal = scope === 'global';

		if (useGlobal) {
			await globalIndex.buildIndexFromCache();
		} else {
			// Build local index from cached files if not already built
			if (techLocalIndex.getSymbolCount() === 0) {
				try {
					console.error('📚 Building symbol index from cache...');
					await techLocalIndex.buildIndexFromCache();
					console.error(`✅ Index built with ${techLocalIndex.getSymbolCount()} symbols`);
					telemetry.recordIndexBuild();
				} catch (error) {
					console.warn('Failed to build local symbol index:', error instanceof Error ? error.message : String(error));
				}
			}

			// Refresh index with any newly cached symbols (background downloads)
			try {
				await techLocalIndex.refreshFromCache();
			} catch (error) {
				console.warn('Failed to refresh local symbol index:', error instanceof Error ? error.message : String(error));
			}
		}

		// If local index is empty/small, use direct framework search as fallback
		let symbolResults: SearchEntry[] = useGlobal
			? globalIndex.search(query, maxResults * 2)
			: techLocalIndex.search(query, maxResults * 2);

		if (useGlobal) {
			// Global search does not trigger framework-specific fallback.
		} else if (symbolResults.length === 0 && techLocalIndex.getSymbolCount() < 50) {
			// Kick off background download to improve coverage (non-blocking)
			if (!state.isComprehensiveDownloadRunning()) {
				const downloader = state.getComprehensiveDownloader(client);
				const downloadPromise = downloader.downloadAllSymbols(context, data => {
					techLocalIndex.ingestSymbolData(data);
				});
				state.startComprehensiveDownload(downloadPromise);
				telemetry.recordBackgroundDownload();
			}

			// Fallback: search framework.references directly (fast, no download needed)
			console.error('📋 Using framework references for search...');
			const frameworkResults = await provider.searchFramework(activeTechnology.title, query, {maxResults: maxResults * 2, platform, symbolType});
			symbolResults = frameworkResults.map(r => ({
				id: r.path ?? r.title,
				title: r.title,
				path: r.path ?? '',
				kind: r.symbolKind ?? 'symbol',
				abstract: r.description,
				platforms: r.platforms ? r.platforms.split(', ') : [],
				tokens: [],
				filePath: '',
			}));
		}

		// Apply filters
		let filteredResults = symbolResults;
		if (platform) {
			const platformNormalized = normalizePlatform(platform);
			filteredResults = filteredResults.filter(result =>
				result.platforms.some(p => normalizePlatform(p).includes(platformNormalized)));
		}

		if (symbolType) {
			const typeLower = symbolType.toLowerCase();
			filteredResults = filteredResults.filter(result =>
				result.kind.toLowerCase().includes(typeLower));
		}

		filteredResults = filteredResults.slice(0, maxResults);

		// Validate result relevance
		const technologyIdentifier = activeTechnology.identifier.replace('doc://com.apple.documentation/', '').replace(/^documentation\//, '');
		const isRelevantResult = (result: SearchEntry) => {
			const resultPath = result.path.toLowerCase();
			const technologyPath = technologyIdentifier.toLowerCase();
			return resultPath.includes(technologyPath);
		};

		const relevantResults = filteredResults.filter(result => isRelevantResult(result));
		const hasIrrelevantResults = relevantResults.length < filteredResults.length;

		const lines = [
			header(1, `🔍 Search Results for "${query}"`),
			'',
			bold('Scope', useGlobal ? 'Global (all cached frameworks)' : activeTechnology.title),
			bold('Matches', filteredResults.length.toString()),
			bold('Total Symbols Indexed', useGlobal ? globalIndex.getSymbolCount().toString() : techLocalIndex.getSymbolCount().toString()),
			'',
		];

		// Add status information
		if (useGlobal) {
			lines.push(
				'✅ **Comprehensive Index:** Global cached symbol database is available.',
				'',
			);
		} else if (techLocalIndex.getSymbolCount() < 50) {
			lines.push(
				'⚠️ **Limited Results:** Only basic symbols are indexed.',
				'For comprehensive results, additional symbols are being downloaded in the background.',
				'',
			);
		} else {
			lines.push(
				'✅ **Comprehensive Index:** Full symbol database is available.',
				'',
			);
		}

		lines.push(header(2, 'Symbols'), '');

		// Show warning if results seem irrelevant
		if (useGlobal) {
			// No relevance warning needed for global searches.
		} else if (hasIrrelevantResults && filteredResults.length > 0) {
			lines.push(
				'⚠️ **Note:** Some results may not be from the selected technology.',
				'For specific symbol names, try using `get_documentation` instead.',
				'',
			);
		}

		if (filteredResults.length > 0) {
			for (const result of filteredResults) {
				const platforms = result.platforms.length > 0 ? result.platforms.join(', ') : 'All platforms';
				lines.push(
					`### ${result.title}`,
					`   • **Kind:** ${result.kind}`,
					`   • **Path:** ${result.path}`,
					`   • **Platforms:** ${platforms}`,
					`   ${result.abstract}`,
					'',
				);
			}
		} else {
			// Check if this looks like a specific symbol name that should use direct documentation lookup
			const isSpecificSymbol = /^[A-Z][a-zA-Z\d]*$/.test(query) || /^[A-Z][a-zA-Z\d]*\.[A-Z][a-zA-Z\d]*$/.test(query);

			lines.push(
				`No symbols matched those terms within this ${useGlobal ? 'scope' : 'technology'}.`,
				'',
				'**Search Tips:**',
				'• Try wildcards: `Grid*` or `*Item`',
				'• Use broader keywords: "grid" instead of "griditem"',
				'• Check spelling and try synonyms',
				'',
			);

			if (isSpecificSymbol) {
				const identifierParts = activeTechnology.identifier.split('/');
				const frameworkName = identifierParts.at(-1);
				const fallbackPath = frameworkName ? `documentation/${frameworkName}/${query}` : query;

				try {
					const fallbackData = await client.getSymbol(fallbackPath);
					const fallbackEntry = {
						id: fallbackPath,
						title: fallbackData.metadata?.title ?? query,
						path: fallbackPath,
						kind: fallbackData.metadata?.symbolKind ?? 'symbol',
						abstract: client.extractText(fallbackData.abstract),
						platforms: fallbackData.metadata?.platforms?.map(p => p.name).filter(Boolean) ?? [],
						tokens: [],
						filePath: '',
					};
					filteredResults = [fallbackEntry];
					lines.push(
						'**✅ Found exact symbol via live lookup.**',
						'',
						`### ${fallbackEntry.title}`,
						`   • **Kind:** ${fallbackEntry.kind}`,
						`   • **Path:** ${fallbackEntry.path}`,
						`   • **Platforms:** ${fallbackEntry.platforms.length > 0 ? fallbackEntry.platforms.join(', ') : 'All platforms'}`,
						`   ${fallbackEntry.abstract}`,
						'',
					);
				} catch (error) {
					console.warn('Live lookup failed:', error instanceof Error ? error.message : String(error));
					if (useGlobal) {
						// No framework-specific download queue for global searches.
					} else {
						const downloader = state.getComprehensiveDownloader(client);
						downloader.queuePriorityPaths([fallbackPath]);
					}
				}

				lines.push(
					'**💡 Suggestion:** This looks like a specific symbol name.',
					'Try using `get_documentation` instead for direct access:',
					'',
					'```',
					`get_documentation { "path": "${query}" }`,
					'```',
					'',
				);
			}

			lines.push(
				'**Note:** If this is your first search, symbols are being downloaded in the background.',
				'Try searching again in a few moments for more comprehensive results.',
				'',
			);
		}

		telemetry.recordSearch(Date.now() - startTime);

		return {
			content: [{text: lines.join('\n'), type: 'text'}],
		};
	};
};
/* eslint-enable complexity */
