import type {
	FrameworkData,
	SymbolData,
	Technology,
	SearchResult,
	AppleDevDocsClient,
} from '../../apple-client.js';

export type DocProvider = {
	name: string;
	getFramework: (frameworkName: string) => Promise<FrameworkData>;
	refreshFramework?: (frameworkName: string) => Promise<FrameworkData>;
	getSymbol: (path: string) => Promise<SymbolData>;
	getTechnologies: () => Promise<Record<string, Technology>>;
	refreshTechnologies?: () => Promise<Record<string, Technology>>;
	searchFramework: (
		frameworkName: string,
		query: string,
		options?: {
			maxResults?: number;
			platform?: string;
			symbolType?: string;
		},
	) => Promise<SearchResult[]>;
	checkHealth?: () => Promise<{ok: boolean; latencyMs: number; message?: string}>;
};

export class AppleDocProvider implements DocProvider {
	name = 'apple';

	constructor(private readonly client: AppleDevDocsClient) {}

	async getFramework(frameworkName: string): Promise<FrameworkData> {
		return this.client.getFramework(frameworkName);
	}

	async refreshFramework(frameworkName: string): Promise<FrameworkData> {
		return this.client.refreshFramework(frameworkName);
	}

	async getSymbol(path: string): Promise<SymbolData> {
		return this.client.getSymbol(path);
	}

	async getTechnologies(): Promise<Record<string, Technology>> {
		return this.client.getTechnologies();
	}

	async refreshTechnologies(): Promise<Record<string, Technology>> {
		return this.client.refreshTechnologies();
	}

	async searchFramework(
		frameworkName: string,
		query: string,
		options?: {maxResults?: number; platform?: string; symbolType?: string},
	): Promise<SearchResult[]> {
		return this.client.searchFramework(frameworkName, query, options);
	}

	async checkHealth(): Promise<{ok: boolean; latencyMs: number; message?: string}> {
		return this.client.checkHealth();
	}
}

export class ProviderRegistry {
	private readonly providers = new Map<string, DocProvider>();

	register(provider: DocProvider): void {
		this.providers.set(provider.name, provider);
	}

	get(name: string): DocProvider | undefined {
		return this.providers.get(name);
	}

	list(): string[] {
		return [...this.providers.keys()];
	}

	entries(): DocProvider[] {
		return [...this.providers.values()];
	}
}
