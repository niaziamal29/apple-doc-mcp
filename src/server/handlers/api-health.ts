import type {ServerContext, ToolResponse} from '../context.js';
import {bold, header} from '../markdown.js';

export const buildApiHealthHandler = (context: ServerContext) =>
	async (): Promise<ToolResponse> => {
		const provider = context.state.getProvider();
		const health = await provider.checkHealth?.();
		const lines = [
			header(1, '🩺 API Health'),
			'',
			bold('Provider', provider.name),
			bold('Status', health?.ok ? 'OK' : 'Unhealthy'),
			bold('Latency (ms)', health?.latencyMs?.toString() ?? 'unknown'),
			health?.message ? bold('Message', health.message) : '',
		].filter(Boolean);

		return {content: [{type: 'text', text: lines.join('\n')}]};
	};
