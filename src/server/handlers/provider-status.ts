import type {ServerContext, ToolResponse} from '../context.js';
import {bold, header, list} from '../markdown.js';

export const buildProviderStatusHandler = (context: ServerContext) =>
	async (): Promise<ToolResponse> => {
		const providers = context.state.listProviders();
		const activeProvider = context.state.getProvider().name;

		const lines = [
			header(1, '🧭 Provider Status'),
			'',
			bold('Available Providers', providers.length.toString()),
			bold('Active Provider', activeProvider),
			'',
			list(providers),
		];

		return {
			content: [{type: 'text', text: lines.join('\n')}],
		};
	};
