import {promises as fs} from 'node:fs';
import {createHash} from 'node:crypto';
import {join} from 'node:path';

export type CacheEntryMetadata = {
	fileName: string;
	bytes: number;
	hash: string;
	lastAccessedAt: string;
	updatedAt: string;
};

type CacheIndexData = {
	version: number;
	entries: Record<string, CacheEntryMetadata>;
};

const cacheIndexVersion = 1;

export class CacheIndex {
	static createHash(content: string | Uint8Array): string {
		return createHash('sha256').update(content).digest('hex');
	}

	private readonly indexPath: string;
	private data?: CacheIndexData;

	constructor(private readonly cacheDir: string) {
		this.indexPath = join(cacheDir, 'cache-index.json');
	}

	async load(): Promise<void> {
		if (this.data) {
			return;
		}

		try {
			const raw = await fs.readFile(this.indexPath, 'utf8');
			const parsed = JSON.parse(raw) as CacheIndexData;
			if (parsed.version !== cacheIndexVersion || !parsed.entries) {
				this.data = {version: cacheIndexVersion, entries: {}};
				return;
			}

			this.data = parsed;
		} catch (error) {
			if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') {
				this.data = {version: cacheIndexVersion, entries: {}};
				return;
			}

			throw error;
		}
	}

	async persist(): Promise<void> {
		if (!this.data) {
			await this.load();
		}

		await fs.writeFile(this.indexPath, JSON.stringify(this.data, null, 2));
	}

	getEntry(fileName: string): CacheEntryMetadata | undefined {
		return this.data?.entries[fileName];
	}

	setEntry(entry: CacheEntryMetadata): void {
		this.data ??= {version: cacheIndexVersion, entries: {}};

		this.data.entries[entry.fileName] = entry;
	}

	removeEntry(fileName: string): void {
		if (!this.data) {
			return;
		}

		const {[fileName]: _removed, ...rest} = this.data.entries;
		this.data.entries = rest;
	}

	listEntries(): CacheEntryMetadata[] {
		return Object.values(this.data?.entries ?? {});
	}

	getTotalBytes(): number {
		return this.listEntries().reduce((sum, entry) => sum + entry.bytes, 0);
	}

	getEntryCount(): number {
		return this.listEntries().length;
	}
}
