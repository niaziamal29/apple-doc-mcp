import type {ServerContext, ToolResponse} from '../context.js';
import {bold, header, list} from '../markdown.js';

export const buildNextStepsHandler = (context: ServerContext) =>
	async (): Promise<ToolResponse> => {
		const active = context.state.getActiveTechnology();
		const provider = context.state.getProvider();

		const steps = active
			? [
				'search_symbols { "query": "layout" }',
				'get_documentation { "path": "View" }',
				'refresh_framework',
			]
			: [
				'discover_technologies { "query": "swift" }',
				'choose_technology { "name": "SwiftUI" }',
			];

		steps.push(
			'provider_status',
			'index_status',
		);

		const lines = [
			header(1, '🧭 Recommended Next Steps'),
			'',
			bold('Provider', provider.name),
			bold('Active Technology', active?.title ?? 'None'),
			'',
			list(steps.map(step => `• ${step}`)),
		];

		return {content: [{type: 'text', text: lines.join('\n')}]};
	};
