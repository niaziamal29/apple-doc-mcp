import type {ServerContext, ToolResponse} from '../context.js';
import {bold, header, list} from '../markdown.js';

const workflowMap: Record<string, string[]> = {
	onboarding: ['SwiftUI', 'UserNotifications', 'AuthenticationServices'],
	camera: ['AVFoundation', 'PhotosUI', 'SwiftUI'],
	ar: ['ARKit', 'RealityKit', 'SwiftUI'],
	health: ['HealthKit', 'SwiftUI'],
	maps: ['MapKit', 'CoreLocation', 'SwiftUI'],
};

export const buildWorkflowSuggestionsHandler = (context: ServerContext) =>
	async (args: {workflow?: string}): Promise<ToolResponse> => {
		const workflow = args.workflow?.toLowerCase().trim() ?? '';
		if (!workflow) {
			return {
				content: [{type: 'text', text: [header(1, '⚠️ Workflow required'), 'Provide a `workflow` name to get suggestions.'].join('\n')}],
			};
		}

		const suggestions = workflowMap[workflow] ?? [];
		const technologies = await context.state.getProvider().getTechnologies();
		const available = new Set(Object.values(technologies).map(tech => tech.title));
		const resolved = suggestions.map(name => `${name} ${available.has(name) ? '(available)' : '(not in catalog)'}`);

		const lines = [
			header(1, '🧩 Workflow Suggestions'),
			'',
			bold('Workflow', workflow),
			'',
			list(resolved),
		];

		return {content: [{type: 'text', text: lines.join('\n')}]};
	};
