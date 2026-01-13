import type {ServerContext, ToolResponse} from '../context.js';
import {
	bold,
	header,
	list,
	paragraph,
} from '../markdown.js';

const featureToFrameworks: Record<string, string[]> = {
	ui: ['SwiftUI', 'UIKit'],
	accessibility: ['Accessibility'],
	animation: ['SwiftUI', 'UIKit', 'Core Animation'],
	ar: ['ARKit', 'RealityKit'],
	audio: ['AVFoundation', 'AudioToolbox'],
	auth: ['AuthenticationServices', 'LocalAuthentication'],
	background: ['BackgroundTasks'],
	bluetooth: ['CoreBluetooth'],
	camera: ['AVFoundation', 'PhotosUI'],
	concurrency: ['Swift Concurrency', 'Combine'],
	data: ['SwiftData', 'Core Data', 'CloudKit'],
	graphics: ['Core Graphics', 'Metal', 'MetalKit'],
	health: ['HealthKit'],
	location: ['CoreLocation', 'MapKit'],
	machinelearning: ['Core ML', 'Vision', 'Natural Language', 'Speech'],
	maps: ['MapKit'],
	networking: ['URLSession', 'Network', 'WebKit'],
	notifications: ['UserNotifications'],
	payments: ['StoreKit'],
	sharing: ['ShareLink', 'UIActivityViewController'],
	storage: ['SwiftData', 'Core Data', 'FileManager', 'CloudKit'],
	tests: ['XCTest', 'XCUITest'],
	video: ['AVFoundation', 'AVKit'],
	watch: ['WatchKit', 'WatchConnectivity'],
	widgets: ['WidgetKit'],
};

const normalize = (value: string): string => value.toLowerCase().replaceAll(/[^a-z\d]+/g, '');

const tokenize = (value: string): string[] => value
	.toLowerCase()
	.split(/[\s,./_-]+/g)
	.map(token => token.trim())
	.filter(Boolean);

const buildKeywordMatches = (tokens: string[]): string[] => {
	const tokenSet = new Set(tokens.map(token => normalize(token)));
	const matched: string[] = [];

	for (const keyword of Object.keys(featureToFrameworks)) {
		if (tokenSet.has(normalize(keyword))) {
			matched.push(keyword);
		}
	}

	return matched;
};

const resolveFrameworks = (
	keywords: string[],
	availableTitles: Map<string, string>,
): Array<{title: string; available: boolean; reason: string}> => {
	const seen = new Set<string>();
	const results: Array<{title: string; available: boolean; reason: string}> = [];

	for (const keyword of keywords) {
		const frameworks = featureToFrameworks[keyword] ?? [];
		for (const framework of frameworks) {
			if (seen.has(framework)) {
				continue;
			}

			seen.add(framework);
			const normalizedFramework = normalize(framework);
			const matchedTitle = availableTitles.get(normalizedFramework);
			const available = Boolean(matchedTitle);
			results.push({
				title: matchedTitle ?? framework,
				available,
				reason: `Matched feature keyword "${keyword}"`,
			});
		}
	}

	return results;
};

export const buildSuggestTechnologyStackHandler = ({client, state}: ServerContext) =>
	async (args: {description?: string}): Promise<ToolResponse> => {
		const description = args.description?.trim() ?? '';
		if (!description) {
			return {
				content: [
					{
						type: 'text',
						text: [
							header(1, '⚠️ Provide an app description'),
							'',
							'Use `suggest_technology_stack` with a short app description so the server can propose frameworks.',
							'',
							'Example:',
							'```',
							'suggest_technology_stack { "description": "iOS habit tracker with notifications, charts, and cloud sync" }',
							'```',
						].join('\n'),
					},
				],
			};
		}

		const technologies = await state.getProvider().getTechnologies();
		const availableTitles = new Map<string, string>();
		for (const tech of Object.values(technologies)) {
			if (tech.title) {
				availableTitles.set(normalize(tech.title), tech.title);
			}
		}

		const tokens = tokenize(description);
		const matchedKeywords = buildKeywordMatches(tokens);

		const suggestions = resolveFrameworks(matchedKeywords, availableTitles);

		const lines: string[] = [
			header(1, '🧭 Suggested Technology Stack'),
			'',
			bold('App Description', description),
			'',
		];

		if (suggestions.length === 0) {
			lines.push(
				paragraph('No direct feature keyword matches were found. Try adding keywords like "ui", "data", "networking", "notifications", "maps", or "auth".'),
				'',
				header(2, 'Next steps'),
				'• Use `discover_technologies { "query": "swiftui" }` to explore UI frameworks',
				'• Use `discover_technologies { "query": "data" }` to explore data persistence frameworks',
			);
		} else {
			lines.push(
				header(2, 'Framework Recommendations'),
				list(suggestions.map(entry => {
					const availability = entry.available ? 'Available' : 'Not found in catalogue (try discover_technologies)';
					return `${entry.title} — ${entry.reason} • ${availability}`;
				}), '•'),
				'',
				header(2, 'Suggested workflow'),
				'1. Pick a UI framework (SwiftUI or UIKit)',
				'2. Choose supporting frameworks (data, networking, auth, etc.)',
				'3. Use `choose_technology` + `search_symbols` to explore each framework',
				'',
				header(2, 'Quick commands'),
			);

			for (const suggestion of suggestions.filter(entry => entry.available)) {
				lines.push(`• \`choose_technology { "name": "${suggestion.title}" }\``);
			}
		}

		return {
			content: [{type: 'text', text: lines.join('\n')}],
		};
	};
