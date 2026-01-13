import type {ServerContext, ToolResponse} from '../context.js';
import {bold, header} from '../markdown.js';

export const buildSearchMultiFrameworkHandler = (context: ServerContext) =>
	async (args: {query?: string; frameworks?: string[]; maxResults?: number}): Promise<ToolResponse> => {
		const query = args.query?.trim() ?? '';
		const frameworks = args.frameworks ?? [];
		const maxResults = args.maxResults ?? 10;
		if (!query || frameworks.length === 0) {
			return {
				content: [{type: 'text', text: [header(1, '⚠️ Query and frameworks required'), 'Provide `query` and a `frameworks` array.'].join('\n')}],
			};
		}

		const provider = context.state.getProvider();
		const results = await Promise.all(frameworks.map(async framework => {
			const hits = await provider.searchFramework(framework, query, {maxResults});
			return hits.map(hit => ({...hit, framework}));
		}));

		const merged = results.flat();
		const lines = [
			header(1, `🧩 Multi-Framework Search for "${query}"`),
			'',
			bold('Frameworks', frameworks.join(', ')),
			bold('Matches', merged.length.toString()),
			'',
		];

		for (const hit of merged) {
			lines.push(
				`### ${hit.title}`,
				`   • **Framework:** ${hit.framework}`,
				`   • **Path:** ${hit.path}`,
				`   ${hit.description}`,
				'',
			);
		}

		return {content: [{type: 'text', text: lines.join('\n')}]};
	};
