import {promises as fs} from 'node:fs';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const bundleRoot = join(__dirname, '../../../.cache/bundles');

export const listBundles = async (): Promise<string[]> => {
	try {
		return await fs.readdir(bundleRoot);
	} catch (error) {
		if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') {
			return [];
		}

		throw error;
	}
};

export const exportBundle = async (name: string, filters: string[]): Promise<{path: string; files: number}> => {
	const cacheDir = join(__dirname, '../../../.cache');
	const bundleDir = join(bundleRoot, name);
	await fs.mkdir(bundleDir, {recursive: true});

	const entries = await fs.readdir(cacheDir);
	const matches = entries.filter(entry =>
		entry.endsWith('.json') && filters.some(filter => entry.toLowerCase().includes(filter.toLowerCase())));

	await Promise.all(matches.map(async entry => fs.copyFile(join(cacheDir, entry), join(bundleDir, entry))));
	await fs.writeFile(join(bundleDir, 'manifest.json'), JSON.stringify({name, filters, files: matches}, null, 2));

	return {path: bundleDir, files: matches.length};
};

export const importBundle = async (name: string): Promise<{path: string; files: number}> => {
	const cacheDir = join(__dirname, '../../../.cache');
	const bundleDir = join(bundleRoot, name);
	const entries = await fs.readdir(bundleDir);
	const jsonEntries = entries.filter(entry => entry.endsWith('.json'));

	await Promise.all(jsonEntries.map(async entry => fs.copyFile(join(bundleDir, entry), join(cacheDir, entry))));

	return {path: bundleDir, files: jsonEntries.length};
};
