import type {ServerContext, ToolResponse} from '../context.js';
import {bold, header, list} from '../markdown.js';
import type {SymbolData} from '../../apple-client.js';

type CodeSnippet = {
	language?: string;
	code: string;
};

const collectSnippets = (node: unknown, snippets: CodeSnippet[]) => {
	if (!node || typeof node !== 'object') {
		return;
	}

	if (Array.isArray(node)) {
		for (const item of node) {
			collectSnippets(item, snippets);
		}

		return;
	}

	const record = node as Record<string, unknown>;
	const possibleCode = record.code ?? record.codeListing;
	const possibleLanguage = record.language ?? record.codeListingLanguage;
	if (typeof possibleCode === 'string') {
		snippets.push({
			code: possibleCode,
			language: typeof possibleLanguage === 'string' ? possibleLanguage : undefined,
		});
	}

	for (const value of Object.values(record)) {
		collectSnippets(value, snippets);
	}
};

export const buildExtractSnippetsHandler = (context: ServerContext) =>
	async (args: {path?: string; language?: string}): Promise<ToolResponse> => {
		const path = args.path?.trim() ?? '';
		if (!path) {
			return {
				content: [{type: 'text', text: [header(1, '⚠️ Path required'), 'Provide a `path` to extract snippets.'].join('\n')}],
			};
		}

		const provider = context.state.getProvider();
		const data: SymbolData = await provider.getSymbol(path);
		const snippets: CodeSnippet[] = [];
		collectSnippets(data.primaryContentSections, snippets);

		const language = args.language?.toLowerCase();
		const filtered = language
			? snippets.filter(snippet => snippet.language?.toLowerCase().includes(language))
			: snippets;

		const lines = [
			header(1, '🧩 Code Snippets'),
			'',
			bold('Path', path),
			bold('Matches', filtered.length.toString()),
			'',
		];

		if (filtered.length === 0) {
			lines.push('No code snippets found.');
		} else {
			lines.push(list(filtered.map(snippet => `(${snippet.language ?? 'unknown'}) ${snippet.code}`)));
		}

		return {content: [{type: 'text', text: lines.join('\n')}]};
	};
