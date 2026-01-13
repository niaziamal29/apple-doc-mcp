import type {ServerContext, ToolResponse} from '../context.js';
import {header, list, paragraph} from '../markdown.js';

const guessIntent = (description: string): string[] => {
	const steps: string[] = [];
	const lower = description.toLowerCase();

	if (!lower.includes('technology') && !lower.includes('framework')) {
		steps.push('discover_technologies { "query": "swift" }');
	}

	if (lower.includes('search') || lower.includes('find') || lower.includes('symbol')) {
		steps.push('search_symbols { "query": "<keywords>" }');
	}

	if (lower.includes('documentation') || lower.includes('docs')) {
		steps.push('get_documentation { "path": "<SymbolName>" }');
	}

	return steps;
};

export const buildPlanQueryHandler = (_context: ServerContext) =>
	async (args: {description?: string}): Promise<ToolResponse> => {
		const description = args.description?.trim() ?? '';
		if (!description) {
			return {
				content: [{type: 'text', text: [header(1, '⚠️ Description required'), 'Provide a description to plan a query.'].join('\n')}],
			};
		}

		const steps = guessIntent(description);
		const lines = [
			header(1, '🗺️ Query Plan'),
			'',
			paragraph(description),
			'',
			header(2, 'Suggested Steps'),
			list(steps.length > 0 ? steps : ['`discover_technologies`']),
		];

		return {content: [{type: 'text', text: lines.join('\n')}]};
	};
