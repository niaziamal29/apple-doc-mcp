import type {ServerContext, ToolResponse} from '../context.js';
import {bold, header} from '../markdown.js';

export const buildSetProviderHandler = (context: ServerContext) =>
	async (args: {name?: string}): Promise<ToolResponse> => {
		const {name} = args;
		if (!name) {
			return {
				content: [{type: 'text', text: [header(1, '⚠️ Provider name required'), 'Specify `name` to select a provider.'].join('\n')}],
			};
		}

		context.state.setProvider(name);

		const lines = [
			header(1, '✅ Provider Selected'),
			'',
			bold('Active Provider', name),
		];

		return {
			content: [{type: 'text', text: lines.join('\n')}],
		};
	};
