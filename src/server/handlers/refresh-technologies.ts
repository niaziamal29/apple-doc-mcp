import type {ServerContext, ToolResponse} from '../context.js';
import {bold, header} from '../markdown.js';

export const buildRefreshTechnologiesHandler = (context: ServerContext) =>
	async (): Promise<ToolResponse> => {
		const provider = context.state.getProvider();
		const technologies = provider.refreshTechnologies
			? await provider.refreshTechnologies()
			: await provider.getTechnologies();

		const lines = [
			header(1, '🔄 Technologies Refreshed'),
			'',
			bold('Provider', provider.name),
			bold('Technologies', Object.keys(technologies).length.toString()),
		];

		return {content: [{type: 'text', text: lines.join('\n')}]};
	};
