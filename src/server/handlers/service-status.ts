import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import type {ServerContext, ToolResponse} from '../context.js';
import {bold, header} from '../markdown.js';
import {CacheIndex} from '../../apple-client/cache/cache-index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const buildServiceStatusHandler = (context: ServerContext) =>
	async (): Promise<ToolResponse> => {
		const provider = context.state.getProvider();
		const telemetry = context.state.getTelemetry();
		const cacheIndex = new CacheIndex(join(__dirname, '../../../.cache'));
		await cacheIndex.load();

		const health = await provider.checkHealth?.();
		const telemetrySnapshot = telemetry.getSnapshot();

		const lines = [
			header(1, '🧩 Service Status'),
			'',
			bold('Provider', provider.name),
			bold('Health', health?.ok ? 'OK' : 'Unhealthy'),
			bold('Latency (ms)', health?.latencyMs?.toString() ?? 'unknown'),
			bold('Cache Entries', cacheIndex.getEntryCount().toString()),
			bold('Cache Size (bytes)', cacheIndex.getTotalBytes().toString()),
			'',
			header(2, 'Telemetry'),
			bold('Search Requests', telemetrySnapshot.searchRequests.toString()),
			bold('Index Builds', telemetrySnapshot.indexBuilds.toString()),
			bold('Background Downloads', telemetrySnapshot.backgroundDownloads.toString()),
		];

		return {content: [{type: 'text', text: lines.join('\n')}]};
	};
