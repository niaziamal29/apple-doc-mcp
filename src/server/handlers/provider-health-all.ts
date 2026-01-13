import type {ServerContext, ToolResponse} from '../context.js';
import {bold, header} from '../markdown.js';

export const buildProviderHealthAllHandler = (context: ServerContext) =>
	async (): Promise<ToolResponse> => {
		const providers = context.state.getProviders();
		const lines = [
			header(1, '🩺 Provider Health Summary'),
			'',
		];

		const healthResults = await Promise.all(providers.map(async provider => ({
			provider,
			health: await provider.checkHealth?.(),
		})));

		for (const {provider, health} of healthResults) {
			lines.push(
				header(2, provider.name),
				bold('Status', health?.ok ? 'OK' : 'Unhealthy'),
				bold('Latency (ms)', health?.latencyMs?.toString() ?? 'unknown'),
				health?.message ? bold('Message', health.message) : '',
				'',
			);
		}

		return {content: [{type: 'text', text: lines.filter(Boolean).join('\n')}]};
	};
