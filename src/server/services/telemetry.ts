import process from 'node:process';

type TelemetryCounters = {
	searchRequests: number;
	searchDurationMs: number;
	indexBuilds: number;
	backgroundDownloads: number;
	cacheEvictions: number;
};

export class Telemetry {
	private readonly enabled: boolean;
	private readonly counters: TelemetryCounters = {
		searchRequests: 0,
		searchDurationMs: 0,
		indexBuilds: 0,
		backgroundDownloads: 0,
		cacheEvictions: 0,
	};

	constructor() {
		this.enabled = process.env.MCP_TELEMETRY === '1';
	}

	isEnabled(): boolean {
		return this.enabled;
	}

	recordSearch(durationMs: number) {
		this.counters.searchRequests += 1;
		this.counters.searchDurationMs += durationMs;
	}

	recordIndexBuild() {
		this.counters.indexBuilds += 1;
	}

	recordBackgroundDownload() {
		this.counters.backgroundDownloads += 1;
	}

	recordCacheEviction(count = 1) {
		this.counters.cacheEvictions += count;
	}

	getSnapshot(): TelemetryCounters {
		return {...this.counters};
	}
}
