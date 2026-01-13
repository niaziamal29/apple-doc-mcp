import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {promises as fs} from 'node:fs';
import type {ServerContext, ToolResponse} from '../context.js';
import {bold, header} from '../markdown.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const buildClearCacheHandler = ({client, state}: ServerContext) =>
	async (): Promise<ToolResponse> => {
		await client.clearCache();
		state.clearLocalSymbolIndex();
		state.clearGlobalSymbolIndex();

		const cacheDir = join(__dirname, '../../../.cache');
		let removed = 0;
		try {
			const entries = await fs.readdir(cacheDir);
			const jsonEntries = entries.filter(entry => entry.endsWith('.json'));
			await Promise.all(jsonEntries.map(async entry => fs.unlink(join(cacheDir, entry))));
			removed = jsonEntries.length;
		} catch (error) {
			if ((error as NodeJS.ErrnoException)?.code !== 'ENOENT') {
				throw error;
			}
		}

		const lines = [
			header(1, '🧹 Cache Cleared'),
			'',
			bold('Files Removed', removed.toString()),
			'',
			'Run `discover_technologies` or `search_symbols` to rebuild caches as needed.',
		];

		return {
			content: [{type: 'text', text: lines.join('\n')}],
		};
	};
