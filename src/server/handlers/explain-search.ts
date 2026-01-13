import type {ServerContext, ToolResponse} from '../context.js';
import {bold, header, list} from '../markdown.js';

export const buildExplainSearchHandler = (context: ServerContext) =>
	async (args: {query?: string; symbol?: string}): Promise<ToolResponse> => {
		const query = args.query?.trim() ?? '';
		const symbol = args.symbol?.trim() ?? '';
		if (!query || !symbol) {
			return {
				content: [{type: 'text', text: [header(1, '⚠️ Query and symbol required'), 'Provide `query` and `symbol`.'].join('\n')}],
			};
		}

		const {state, client} = context;
		const localIndex = state.getLocalSymbolIndex(client);
		const entry = localIndex.findEntry(symbol);
		if (!entry) {
			return {
				content: [{type: 'text', text: [header(1, '⚠️ Symbol not indexed'), 'Try `search_symbols` to ensure it is cached.'].join('\n')}],
			};
		}

		const explanation = localIndex.explainMatch(query, entry);
		const lines = [
			header(1, '🔎 Search Explanation'),
			'',
			bold('Symbol', entry.title),
			bold('Path', entry.path),
			bold('Score', explanation.score.toString()),
			'',
			header(2, 'Query Tokens'),
			list(explanation.tokens),
		];

		return {content: [{type: 'text', text: lines.join('\n')}]};
	};
