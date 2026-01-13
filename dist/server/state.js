import { LocalSymbolIndex } from './services/local-symbol-index.js';
import { ComprehensiveSymbolDownloader } from './services/comprehensive-symbol-downloader.js';
import { Telemetry } from './services/telemetry.js';
import { GlobalSymbolIndex } from './services/global-symbol-index.js';
export class ServerState {
    providerRegistry;
    activeTechnology;
    activeFrameworkData;
    frameworkIndex;
    expandedIdentifiers = new Set();
    lastDiscovery;
    localSymbolIndex;
    comprehensiveDownloader;
    comprehensiveDownloadPromise;
    telemetry;
    globalSymbolIndex;
    activeProviderName;
    constructor(providerRegistry, activeProviderName = 'apple') {
        this.providerRegistry = providerRegistry;
        this.activeProviderName = activeProviderName;
    }
    getActiveTechnology() {
        return this.activeTechnology;
    }
    setActiveTechnology(technology) {
        const previousTechnology = this.activeTechnology;
        this.activeTechnology = technology;
        if (!technology) {
            this.resetIndexForNewTechnology();
        }
        else if (previousTechnology?.identifier !== technology.identifier) {
            // Technology changed, reset index
            this.resetIndexForNewTechnology();
        }
    }
    getActiveFrameworkData() {
        return this.activeFrameworkData;
    }
    setActiveFrameworkData(data) {
        this.activeFrameworkData = data;
    }
    clearActiveFrameworkData() {
        this.activeFrameworkData = undefined;
    }
    getFrameworkIndex() {
        return this.frameworkIndex;
    }
    setFrameworkIndex(index) {
        this.frameworkIndex = index;
    }
    clearFrameworkIndex() {
        this.frameworkIndex = undefined;
        this.expandedIdentifiers.clear();
    }
    hasExpandedIdentifier(identifier) {
        return this.expandedIdentifiers.has(identifier);
    }
    markIdentifierExpanded(identifier) {
        this.expandedIdentifiers.add(identifier);
    }
    getLastDiscovery() {
        return this.lastDiscovery;
    }
    setLastDiscovery(lastDiscovery) {
        this.lastDiscovery = lastDiscovery;
    }
    getLocalSymbolIndex(client) {
        this.localSymbolIndex ??= new LocalSymbolIndex(client, this.activeTechnology?.identifier
            ?.replace('doc://com.apple.documentation/', '')
            ?.replace(/^documentation\//, ''));
        return this.localSymbolIndex;
    }
    clearLocalSymbolIndex() {
        this.localSymbolIndex = undefined;
    }
    getGlobalSymbolIndex(client) {
        this.globalSymbolIndex ??= new GlobalSymbolIndex(client);
        return this.globalSymbolIndex;
    }
    clearGlobalSymbolIndex() {
        this.globalSymbolIndex = undefined;
    }
    getProvider() {
        const provider = this.providerRegistry.get(this.activeProviderName);
        if (!provider) {
            throw new Error(`Unknown provider: ${this.activeProviderName}`);
        }
        return provider;
    }
    listProviders() {
        return this.providerRegistry.list();
    }
    getProviders() {
        return this.providerRegistry.entries();
    }
    setProvider(name) {
        if (!this.providerRegistry.get(name)) {
            throw new Error(`Unknown provider: ${name}`);
        }
        this.activeProviderName = name;
    }
    getComprehensiveDownloader(client) {
        this.comprehensiveDownloader ??= new ComprehensiveSymbolDownloader(client);
        return this.comprehensiveDownloader;
    }
    isComprehensiveDownloadRunning() {
        return Boolean(this.comprehensiveDownloadPromise);
    }
    startComprehensiveDownload(promise) {
        this.comprehensiveDownloadPromise = (async () => {
            try {
                await promise;
            }
            catch (error) {
                console.error('Comprehensive download failed:', error instanceof Error ? error.message : String(error));
            }
            finally {
                this.comprehensiveDownloadPromise = undefined;
            }
        })();
    }
    getTelemetry() {
        this.telemetry ??= new Telemetry();
        return this.telemetry;
    }
    // Reset index when technology changes
    resetIndexForNewTechnology() {
        this.localSymbolIndex = undefined;
        this.activeFrameworkData = undefined;
        this.frameworkIndex = undefined;
        this.expandedIdentifiers.clear();
        this.comprehensiveDownloader = undefined;
        this.comprehensiveDownloadPromise = undefined;
        this.globalSymbolIndex = undefined;
    }
}
//# sourceMappingURL=state.js.map