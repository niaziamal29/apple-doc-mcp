import type {ServerContext, ToolResponse} from '../context.js';
import {header, bold} from '../markdown.js';
import {semanticSearch} from '../services/semantic-index.js';

export const buildSemanticSearchHandler = (context: ServerContext) =>
	async (args: {query?: string; maxResults?: number; scope?: string}): Promise<ToolResponse> => {
		const {query, maxResults = 10, scope = 'technology'} = args;
		if (!query) {
			return {
				content: [{type: 'text', text: [header(1, '⚠️ Query required'), 'Provide a `query` to run semantic search.'].join('\n')}],
			};
		}

		const {state, client} = context;
		const useGlobal = scope === 'global';
		const activeTechnology = state.getActiveTechnology();
		if (!activeTechnology) {
			return {
				content: [{type: 'text', text: [header(1, '⚠️ No technology selected'), 'Run `choose_technology` first.'].join('\n')}],
			};
		}

		const entries = useGlobal
			? (() => {
				const globalIndex = state.getGlobalSymbolIndex(client);
				return [...globalIndex.search(query, 500)];
			})()
			: (() => {
				const localIndex = state.getLocalSymbolIndex(client);
				return [...localIndex.search(query, 500)];
			})();

		const results = semanticSearch(query, entries, maxResults);

		const lines = [
			header(1, `🧠 Semantic Search Results for "${query}"`),
			'',
			bold('Scope', useGlobal ? 'Global' : activeTechnology.title),
			bold('Matches', results.length.toString()),
			'',
		];

		for (const result of results) {
			lines.push(
				`### ${result.title}`,
				`   • **Kind:** ${result.kind}`,
				`   • **Path:** ${result.path}`,
				`   ${result.abstract}`,
				'',
			);
		}

		return {
			content: [{type: 'text', text: lines.join('\n')}],
		};
	};
