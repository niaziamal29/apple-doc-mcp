import type {
	FrameworkData, ReferenceData, Technology, AppleDevDocsClient,
} from '../apple-client.js';
import {LocalSymbolIndex} from './services/local-symbol-index.js';
import {ComprehensiveSymbolDownloader} from './services/comprehensive-symbol-downloader.js';
import {Telemetry} from './services/telemetry.js';
import {GlobalSymbolIndex} from './services/global-symbol-index.js';

export type LastDiscovery = {
	query?: string;
	results: Technology[];
};

export type FrameworkIndexEntry = {
	id: string;
	ref: ReferenceData;
	tokens: string[];
};

export class ServerState {
	private activeTechnology?: Technology;
	private activeFrameworkData?: FrameworkData;
	private frameworkIndex?: Map<string, FrameworkIndexEntry>;
	private readonly expandedIdentifiers = new Set<string>();
	private lastDiscovery?: LastDiscovery;
	private localSymbolIndex?: LocalSymbolIndex;
	private comprehensiveDownloader?: ComprehensiveSymbolDownloader;
	private comprehensiveDownloadPromise?: Promise<void>;
	private telemetry?: Telemetry;
	private globalSymbolIndex?: GlobalSymbolIndex;

	getActiveTechnology(): Technology | undefined {
		return this.activeTechnology;
	}

	setActiveTechnology(technology: Technology | undefined) {
		const previousTechnology = this.activeTechnology;
		this.activeTechnology = technology;

		if (!technology) {
			this.resetIndexForNewTechnology();
		} else if (previousTechnology?.identifier !== technology.identifier) {
			// Technology changed, reset index
			this.resetIndexForNewTechnology();
		}
	}

	getActiveFrameworkData(): FrameworkData | undefined {
		return this.activeFrameworkData;
	}

	setActiveFrameworkData(data: FrameworkData | undefined) {
		this.activeFrameworkData = data;
	}

	clearActiveFrameworkData() {
		this.activeFrameworkData = undefined;
	}

	getFrameworkIndex(): Map<string, FrameworkIndexEntry> | undefined {
		return this.frameworkIndex;
	}

	setFrameworkIndex(index: Map<string, FrameworkIndexEntry> | undefined) {
		this.frameworkIndex = index;
	}

	clearFrameworkIndex() {
		this.frameworkIndex = undefined;
		this.expandedIdentifiers.clear();
	}

	hasExpandedIdentifier(identifier: string): boolean {
		return this.expandedIdentifiers.has(identifier);
	}

	markIdentifierExpanded(identifier: string) {
		this.expandedIdentifiers.add(identifier);
	}

	getLastDiscovery(): LastDiscovery | undefined {
		return this.lastDiscovery;
	}

	setLastDiscovery(lastDiscovery: LastDiscovery | undefined) {
		this.lastDiscovery = lastDiscovery;
	}

	getLocalSymbolIndex(client: AppleDevDocsClient): LocalSymbolIndex {
		this.localSymbolIndex ??= new LocalSymbolIndex(
			client,
			this.activeTechnology?.identifier
				?.replace('doc://com.apple.documentation/', '')
				?.replace(/^documentation\//, ''),
		);

		return this.localSymbolIndex;
	}

	clearLocalSymbolIndex() {
		this.localSymbolIndex = undefined;
	}

	getGlobalSymbolIndex(client: AppleDevDocsClient): GlobalSymbolIndex {
		this.globalSymbolIndex ??= new GlobalSymbolIndex(client);

		return this.globalSymbolIndex;
	}

	clearGlobalSymbolIndex() {
		this.globalSymbolIndex = undefined;
	}

	getComprehensiveDownloader(client: AppleDevDocsClient): ComprehensiveSymbolDownloader {
		this.comprehensiveDownloader ??= new ComprehensiveSymbolDownloader(client);

		return this.comprehensiveDownloader;
	}

	isComprehensiveDownloadRunning(): boolean {
		return Boolean(this.comprehensiveDownloadPromise);
	}

	startComprehensiveDownload(promise: Promise<void>) {
		this.comprehensiveDownloadPromise = (async () => {
			try {
				await promise;
			} finally {
				this.comprehensiveDownloadPromise = undefined;
			}
		})();
	}

	getTelemetry(): Telemetry {
		this.telemetry ??= new Telemetry();

		return this.telemetry;
	}

	// Reset index when technology changes
	private resetIndexForNewTechnology() {
		this.localSymbolIndex = undefined;
		this.activeFrameworkData = undefined;
		this.frameworkIndex = undefined;
		this.expandedIdentifiers.clear();
		this.comprehensiveDownloader = undefined;
		this.comprehensiveDownloadPromise = undefined;
		this.globalSymbolIndex = undefined;
	}
}
