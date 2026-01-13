import {promises as fs} from 'node:fs';
import {join, dirname, basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import {Buffer} from 'node:buffer';
import process from 'node:process';
import type {FrameworkData, SymbolData, Technology} from '../types/index.js';
import {CacheIndex} from './cache-index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class FileCache {
	private readonly docsDir: string;
	private readonly technologiesCachePath: string;
	private readonly cacheIndex: CacheIndex;
	private readonly maxCacheBytes: number;
	private readonly maxCacheEntries: number;
	private readonly cacheSchemaPath: string;

	constructor(baseDir?: string) {
		// Use MCP's own directory structure instead of process.cwd()
		const mcpRoot = join(__dirname, '../../..');
		this.docsDir = join(baseDir ?? mcpRoot, '.cache');
		this.technologiesCachePath = join(this.docsDir, 'technologies.json');
		this.cacheIndex = new CacheIndex(this.docsDir);
		this.maxCacheBytes = Number(process.env.MCP_CACHE_MAX_BYTES ?? 250 * 1024 * 1024);
		this.maxCacheEntries = Number(process.env.MCP_CACHE_MAX_ENTRIES ?? 5000);
		this.cacheSchemaPath = join(this.docsDir, 'cache-schema.json');
	}

	private get cacheSchemaVersion(): number {
		return 1;
	}

	async loadFramework(frameworkName: string): Promise<FrameworkData | undefined> {
		await this.ensureCacheDir();
		try {
			const cachePath = this.getCachePath(frameworkName);
			const raw = await this.readWithIntegrity(cachePath);
			if (!raw) {
				return undefined;
			}

			return JSON.parse(raw) as FrameworkData;
		} catch (error) {
			if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') {
				return undefined;
			}

			throw error;
		}
	}

	async saveFramework(frameworkName: string, data: FrameworkData): Promise<void> {
		await this.ensureCacheDir();
		const cachePath = this.getCachePath(frameworkName);
		const payload = JSON.stringify(data, null, 2);
		await fs.writeFile(cachePath, payload);
		await this.recordCacheEntry(cachePath, payload);
		await this.enforceCacheLimits();
	}

	async loadSymbol(path: string): Promise<SymbolData | undefined> {
		try {
			const safePath = path.replaceAll('/', '__');
			const cachePath = join(this.docsDir, `${safePath}.json`);
			const raw = await this.readWithIntegrity(cachePath);
			if (!raw) {
				return undefined;
			}

			return JSON.parse(raw) as SymbolData;
		} catch (error) {
			if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') {
				return undefined;
			}

			throw error;
		}
	}

	async saveSymbol(path: string, data: SymbolData): Promise<void> {
		await this.ensureCacheDir();
		const safePath = path.replaceAll('/', '__');
		const cachePath = join(this.docsDir, `${safePath}.json`);
		const payload = JSON.stringify(data, null, 2);
		await fs.writeFile(cachePath, payload);
		await this.recordCacheEntry(cachePath, payload);
		await this.enforceCacheLimits();
	}

	async loadTechnologies(): Promise<Record<string, Technology> | undefined> {
		await this.ensureCacheDir();
		try {
			const data = await this.readWithIntegrity(this.technologiesCachePath);
			if (!data) {
				return undefined;
			}

			const parsed = JSON.parse(data) as unknown;

			// Handle different possible formats of the cached data
			if (parsed && typeof parsed === 'object') {
				// First try: data has a 'references' property (new format from API)
				if ('references' in parsed) {
					const wrapper = parsed as {references?: Record<string, Technology>};
					const refs = wrapper.references ?? {};
					// Validate that we got actual technology data
					if (Object.keys(refs).length > 0) {
						return refs;
					}
				}

				// Second try: data is already the references object (legacy format)
				const direct = parsed as Record<string, Technology>;
				if (Object.keys(direct).length > 0) {
					// Check if it looks like technology data (has identifier/title fields)
					const firstValue = Object.values(direct)[0];
					if (firstValue && typeof firstValue === 'object' && ('identifier' in firstValue || 'title' in firstValue)) {
						return direct;
					}
				}
			}

			// If we got here, the cache might be corrupted or empty
			console.warn('Technologies cache exists but appears invalid, will refetch');
			return undefined;
		} catch (error) {
			if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') {
				return undefined;
			}

			console.error('Error loading technologies cache:', error);
			throw error;
		}
	}

	async saveTechnologies(technologies: Record<string, Technology>): Promise<void> {
		await this.ensureCacheDir();
		const payload = JSON.stringify(technologies, null, 2);
		await fs.writeFile(this.technologiesCachePath, payload);
		await this.recordCacheEntry(this.technologiesCachePath, payload);
		await this.enforceCacheLimits();
	}

	async clearAll(): Promise<void> {
		await this.ensureCacheDir();
		await this.clearCacheDir();
		await this.cacheIndex.load();
		await this.cacheIndex.persist();
	}

	private sanitizeFrameworkName(name: string): string {
		return name.replaceAll(/[^\w-]/gi, '_');
	}

	private async ensureCacheDir(): Promise<void> {
		await fs.mkdir(this.docsDir, {recursive: true});
		await this.ensureSchemaVersion();
		await this.cacheIndex.load();
	}

	private getCachePath(frameworkName: string): string {
		const safeName = this.sanitizeFrameworkName(frameworkName);
		return join(this.docsDir, `${safeName}.json`);
	}

	private async ensureSchemaVersion(): Promise<void> {
		try {
			const raw = await fs.readFile(this.cacheSchemaPath, 'utf8');
			const parsed = JSON.parse(raw) as {version?: number};
			if (parsed.version !== this.cacheSchemaVersion) {
				await this.clearCacheDir();
				await this.persistSchema();
			}
		} catch (error) {
			if ((error as NodeJS.ErrnoException)?.code !== 'ENOENT') {
				throw error;
			}

			await this.persistSchema();
		}
	}

	private async persistSchema(): Promise<void> {
		await fs.writeFile(this.cacheSchemaPath, JSON.stringify({version: this.cacheSchemaVersion}, null, 2));
	}

	private async clearCacheDir(): Promise<void> {
		const entries = await fs.readdir(this.docsDir);
		await Promise.all(entries.map(async entry => {
			const entryPath = join(this.docsDir, entry);
			// Skip the schema file - it should be preserved
			if (entryPath === this.cacheSchemaPath) {
				return;
			}

			try {
				// Only attempt to delete files. unlink() will fail on directories,
				// and those failures are caught and ignored (ENOENT or other errors).
				// This preserves subdirectories like 'bundles' and 'cache-index.json'.
				await fs.unlink(entryPath);
			} catch (error) {
				// Ignore if file doesn't exist or if it's a directory (EISDIR/EPERM)
				if ((error as NodeJS.ErrnoException)?.code !== 'ENOENT') {
					throw error;
				}
			}
		}));
	}

	private async readWithIntegrity(filePath: string): Promise<string | undefined> {
		const fileName = basename(filePath);
		const raw = await fs.readFile(filePath, 'utf8');
		const hash = CacheIndex.createHash(raw);
		const existing = this.cacheIndex.getEntry(fileName);

		if (existing && existing.hash !== hash) {
			await this.removeCorruptFile(filePath, fileName);
			return undefined;
		}

		const now = new Date().toISOString();
		this.cacheIndex.setEntry({
			fileName,
			bytes: Buffer.byteLength(raw),
			hash,
			lastAccessedAt: now,
			updatedAt: existing?.updatedAt ?? now,
		});
		await this.cacheIndex.persist();
		return raw;
	}

	private async recordCacheEntry(filePath: string, payload: string): Promise<void> {
		const fileName = basename(filePath);
		const now = new Date().toISOString();

		this.cacheIndex.setEntry({
			fileName,
			bytes: Buffer.byteLength(payload),
			hash: CacheIndex.createHash(payload),
			lastAccessedAt: now,
			updatedAt: now,
		});
		await this.cacheIndex.persist();
	}

	private async removeCorruptFile(filePath: string, fileName: string): Promise<void> {
		try {
			await fs.unlink(filePath);
		} catch (error) {
			if ((error as NodeJS.ErrnoException)?.code !== 'ENOENT') {
				throw error;
			}
		}

		this.cacheIndex.removeEntry(fileName);
		await this.cacheIndex.persist();
	}

	private async enforceCacheLimits(): Promise<void> {
		const entries = this.cacheIndex.listEntries();
		let totalBytes = entries.reduce((sum, entry) => sum + entry.bytes, 0);
		let totalEntries = entries.length;

		if (totalBytes <= this.maxCacheBytes && totalEntries <= this.maxCacheEntries) {
			return;
		}

		const sorted = [...entries].sort((a, b) => a.lastAccessedAt.localeCompare(b.lastAccessedAt));
		const toDelete: string[] = [];
		for (const entry of sorted) {
			if (totalBytes <= this.maxCacheBytes && totalEntries <= this.maxCacheEntries) {
				break;
			}

			totalBytes -= entry.bytes;
			totalEntries -= 1;
			this.cacheIndex.removeEntry(entry.fileName);
			toDelete.push(entry.fileName);
		}

		await Promise.all(toDelete.map(async entryName => {
			const filePath = join(this.docsDir, entryName);
			try {
				await fs.unlink(filePath);
			} catch (error) {
				if ((error as NodeJS.ErrnoException)?.code !== 'ENOENT') {
					throw error;
				}
			}
		}));

		await this.cacheIndex.persist();
	}
}
