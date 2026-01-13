import type {ServerContext, ToolResponse} from '../context.js';
import {bold, header} from '../markdown.js';

export const buildRefreshFrameworkHandler = (context: ServerContext) =>
	async (): Promise<ToolResponse> => {
		const active = context.state.getActiveTechnology();
		if (!active) {
			return {
				content: [{type: 'text', text: [header(1, '⚠️ No technology selected'), 'Run `choose_technology` first.'].join('\n')}],
			};
		}

		const provider = context.state.getProvider();
		const frameworkName = active.identifier.split('/').at(-1);
		if (!frameworkName) {
			return {
				content: [{type: 'text', text: [header(1, '⚠️ Invalid technology identifier'), active.identifier].join('\n')}],
			};
		}

		const data = provider.refreshFramework
			? await provider.refreshFramework(frameworkName)
			: await provider.getFramework(frameworkName);

		const lines = [
			header(1, '🔄 Framework Refreshed'),
			'',
			bold('Framework', data.metadata.title),
			bold('Provider', provider.name),
		];

		return {content: [{type: 'text', text: lines.join('\n')}]};
	};
