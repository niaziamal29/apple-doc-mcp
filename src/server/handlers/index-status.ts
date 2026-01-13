import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import type {ServerContext, ToolResponse} from '../context.js';
import {bold, header} from '../markdown.js';
import {CacheIndex} from '../../apple-client/cache/cache-index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const buildIndexStatusHandler = (context: ServerContext) =>
	async (): Promise<ToolResponse> => {
		const {state, client} = context;
		const localIndex = state.getLocalSymbolIndex(client);
		const globalIndex = state.getGlobalSymbolIndex(client);
		await globalIndex.buildIndexFromCache();

		const cacheDir = join(__dirname, '../../../.cache');
		const cacheIndex = new CacheIndex(cacheDir);
		await cacheIndex.load();

		const telemetry = state.getTelemetry();
		const telemetrySnapshot = telemetry.getSnapshot();

		const lines = [
			header(1, '📊 Index Status'),
			'',
			bold('Local Index Symbols', localIndex.getSymbolCount().toString()),
			bold('Global Index Symbols', globalIndex.getSymbolCount().toString()),
			bold('Cache Entries', cacheIndex.getEntryCount().toString()),
			bold('Cache Size (bytes)', cacheIndex.getTotalBytes().toString()),
			'',
			header(2, 'Telemetry'),
			bold('Enabled', telemetry.isEnabled() ? 'Yes' : 'No'),
			bold('Search Requests', telemetrySnapshot.searchRequests.toString()),
			bold('Search Time (ms)', telemetrySnapshot.searchDurationMs.toString()),
			bold('Index Builds', telemetrySnapshot.indexBuilds.toString()),
			bold('Background Downloads', telemetrySnapshot.backgroundDownloads.toString()),
			bold('Cache Evictions', telemetrySnapshot.cacheEvictions.toString()),
		];

		return {
			content: [{type: 'text', text: lines.join('\n')}],
		};
	};
