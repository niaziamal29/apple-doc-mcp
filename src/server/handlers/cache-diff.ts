import {fileURLToPath} from 'node:url';
import {join, dirname} from 'node:path';
import type {ServerContext, ToolResponse} from '../context.js';
import {bold, header, list} from '../markdown.js';
import {CacheIndex} from '../../apple-client/cache/cache-index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const buildCacheDiffHandler = () =>
	async (args: {since?: string}): Promise<ToolResponse> => {
		const since = args.since
			? new Date(args.since)
			: new Date(Date.now() - (24 * 60 * 60 * 1000));

		if (args.since && Number.isNaN(since.getTime())) {
			const errorLines = [
				header(1, '🧾 Cache Diff'),
				'',
				bold('Error', `Invalid "since" date: ${args.since}`),
			];

			return {content: [{type: 'text', text: errorLines.join('\n')}]};
		}

		const cacheDir = join(__dirname, '../../../.cache');
		const cacheIndex = new CacheIndex(cacheDir);
		await cacheIndex.load();

		const entries = cacheIndex.listEntries()
			.filter(entry => new Date(entry.updatedAt) > since)
			.map(entry => `${entry.fileName} • ${entry.updatedAt}`);

		const lines = [
			header(1, '🧾 Cache Diff'),
			'',
			bold('Since', since.toISOString()),
			bold('Entries', entries.length.toString()),
			'',
			list(entries),
		];

		return {content: [{type: 'text', text: lines.join('\n')}]};
	};
