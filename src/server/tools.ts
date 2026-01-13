import type {Server} from '@modelcontextprotocol/sdk/server/index.js';
import {CallToolRequestSchema, ListToolsRequestSchema} from '@modelcontextprotocol/sdk/types.js';
import type {ServerContext} from './context.js';
import {buildDiscoverHandler} from './handlers/discover.js';
import {buildChooseTechnologyHandler} from './handlers/choose-technology.js';
import {buildCurrentTechnologyHandler} from './handlers/current-technology.js';
import {buildGetDocumentationHandler} from './handlers/get-documentation.js';
import {buildSearchSymbolsHandler} from './handlers/search-symbols.js';
import {buildVersionHandler} from './handlers/version.js';
import {buildSuggestTechnologyStackHandler} from './handlers/suggest-technology-stack.js';
import {buildIndexStatusHandler} from './handlers/index-status.js';
import {buildClearCacheHandler} from './handlers/clear-cache.js';
import {buildProviderStatusHandler} from './handlers/provider-status.js';
import {buildSetProviderHandler} from './handlers/set-provider.js';
import {buildSemanticSearchHandler} from './handlers/search-semantic.js';
import {buildSearchMultiFrameworkHandler} from './handlers/search-multi-framework.js';
import {buildPlanQueryHandler} from './handlers/plan-query.js';
import {
	buildExportBundleHandler,
	buildImportBundleHandler,
	buildListBundlesHandler,
} from './handlers/bundle-tools.js';
import {buildCacheDiffHandler} from './handlers/cache-diff.js';
import {buildApiHealthHandler} from './handlers/api-health.js';
import {buildWorkflowSuggestionsHandler} from './handlers/workflow-suggestions.js';
import {buildExplainSearchHandler} from './handlers/explain-search.js';
import {buildExtractSnippetsHandler} from './handlers/extract-snippets.js';
import {buildProviderHealthAllHandler} from './handlers/provider-health-all.js';
import {buildRefreshTechnologiesHandler} from './handlers/refresh-technologies.js';
import {buildRefreshFrameworkHandler} from './handlers/refresh-framework.js';
import {buildNextStepsHandler} from './handlers/next-steps.js';
import {buildServiceStatusHandler} from './handlers/service-status.js';

type ToolDefinition = {
	name: string;
	description: string;
	inputSchema: Record<string, unknown>;
	handler: (args: any) => Promise<{content: Array<{text: string; type: 'text'}>}>;
};

// eslint-disable-next-line @typescript-eslint/no-deprecated
export const registerTools = (server: Server, context: ServerContext) => {
	const toolDefinitions: ToolDefinition[] = [
		{
			name: 'discover_technologies',
			description: 'Explore and filter available Apple technologies/frameworks before choosing one',
			inputSchema: {
				type: 'object',
				required: [],
				properties: {
					page: {
						type: 'number',
						description: 'Optional page number (default 1)',
					},
					pageSize: {
						type: 'number',
						description: 'Optional page size (default 25, max 100)',
					},
					query: {
						type: 'string',
						description: 'Optional keyword to filter technologies',
					},
				},
			},
			handler: buildDiscoverHandler(context),
		},
		{
			name: 'choose_technology',
			description: 'Select the framework/technology to scope all subsequent searches and documentation lookups',
			inputSchema: {
				type: 'object',
				required: [],
				properties: {
					identifier: {
						type: 'string',
						description: 'Optional technology identifier (e.g. doc://.../SwiftUI)',
					},
					name: {
						type: 'string',
						description: 'Technology name/title (e.g. SwiftUI)',
					},
				},
			},
			handler: buildChooseTechnologyHandler(context),
		},
		{
			name: 'current_technology',
			description: 'Report the currently selected technology and how to change it',
			inputSchema: {
				type: 'object',
				required: [],
				properties: {},
			},
			handler: buildCurrentTechnologyHandler(context),
		},
		{
			name: 'get_documentation',
			description: 'Get detailed documentation for specific symbols within the selected technology. '
				+ 'Use this for known symbol names (e.g., "View", "Button", "GridItem"). Accepts relative symbol names.',
			inputSchema: {
				type: 'object',
				required: ['path'],
				properties: {
					path: {
						type: 'string',
						description: 'Symbol path or relative name (e.g. "View", "GridItem", "Button")',
					},
				},
			},
			handler: buildGetDocumentationHandler(context),
		},
		{
			name: 'search_symbols',
			description: 'Search and discover symbols within the currently selected technology. '
				+ 'Use this for exploration and finding symbols by keywords. Supports wildcards (* and ?). '
				+ 'For specific known symbols, use get_documentation instead.',
			inputSchema: {
				type: 'object',
				required: ['query'],
				properties: {
					maxResults: {
						type: 'number',
						description: 'Optional maximum number of results (default 20)',
					},
					platform: {
						type: 'string',
						description: 'Optional platform filter (iOS, macOS, etc.)',
					},
					query: {
						type: 'string',
						description: 'Search keywords with wildcard support (* for any characters, ? for single character)',
					},
					scope: {
						type: 'string',
						description: 'Optional scope: "technology" (default) or "global" to search all cached frameworks',
					},
					symbolType: {
						type: 'string',
						description: 'Optional symbol kind filter (class, protocol, etc.)',
					},
				},
			},
			handler: buildSearchSymbolsHandler(context),
		},
		{
			name: 'index_status',
			description: 'Report cache and symbol index coverage, plus telemetry metrics if enabled',
			inputSchema: {
				type: 'object',
				required: [],
				properties: {},
			},
			handler: buildIndexStatusHandler(context),
		},
		{
			name: 'provider_status',
			description: 'List available documentation providers',
			inputSchema: {
				type: 'object',
				required: [],
				properties: {},
			},
			handler: buildProviderStatusHandler(context),
		},
		{
			name: 'provider_health_all',
			description: 'Check health across all registered providers',
			inputSchema: {
				type: 'object',
				required: [],
				properties: {},
			},
			handler: buildProviderHealthAllHandler(context),
		},
		{
			name: 'service_status',
			description: 'Summarize provider health, cache size, and telemetry metrics',
			inputSchema: {
				type: 'object',
				required: [],
				properties: {},
			},
			handler: buildServiceStatusHandler(context),
		},
		{
			name: 'set_provider',
			description: 'Select an active documentation provider',
			inputSchema: {
				type: 'object',
				required: ['name'],
				properties: {
					name: {
						type: 'string',
						description: 'Provider name (e.g. "apple")',
					},
				},
			},
			handler: buildSetProviderHandler(context),
		},
		{
			name: 'search_semantic',
			description: 'Run semantic search over cached symbols',
			inputSchema: {
				type: 'object',
				required: ['query'],
				properties: {
					query: {type: 'string', description: 'Natural language search query'},
					maxResults: {type: 'number', description: 'Optional max results (default 10)'},
					scope: {type: 'string', description: 'Optional scope: "technology" or "global"'},
				},
			},
			handler: buildSemanticSearchHandler(context),
		},
		{
			name: 'search_multi_framework',
			description: 'Search multiple frameworks in one request',
			inputSchema: {
				type: 'object',
				required: ['query', 'frameworks'],
				properties: {
					query: {type: 'string', description: 'Search query'},
					frameworks: {type: 'array', items: {type: 'string'}, description: 'Framework names to search'},
					maxResults: {type: 'number', description: 'Optional max results per framework'},
				},
			},
			handler: buildSearchMultiFrameworkHandler(context),
		},
		{
			name: 'plan_query',
			description: 'Generate a suggested MCP workflow from a natural language request',
			inputSchema: {
				type: 'object',
				required: ['description'],
				properties: {
					description: {type: 'string', description: 'Plain-language request'},
				},
			},
			handler: buildPlanQueryHandler(context),
		},
		{
			name: 'list_bundles',
			description: 'List offline cache bundles',
			inputSchema: {type: 'object', required: [], properties: {}},
			handler: buildListBundlesHandler(),
		},
		{
			name: 'export_bundle',
			description: 'Export cached documentation files into a bundle',
			inputSchema: {
				type: 'object',
				required: ['name', 'filters'],
				properties: {
					name: {type: 'string', description: 'Bundle name'},
					filters: {type: 'array', items: {type: 'string'}, description: 'Filters for cache filenames'},
				},
			},
			handler: buildExportBundleHandler(),
		},
		{
			name: 'import_bundle',
			description: 'Import cached documentation files from a bundle',
			inputSchema: {
				type: 'object',
				required: ['name'],
				properties: {
					name: {type: 'string', description: 'Bundle name'},
				},
			},
			handler: buildImportBundleHandler(),
		},
		{
			name: 'cache_diff',
			description: 'List cache entries updated since a given timestamp',
			inputSchema: {
				type: 'object',
				required: [],
				properties: {
					since: {type: 'string', description: 'ISO timestamp (defaults to 24h ago)'},
				},
			},
			handler: buildCacheDiffHandler(),
		},
		{
			name: 'refresh_technologies',
			description: 'Force refresh the technologies catalogue from the provider',
			inputSchema: {
				type: 'object',
				required: [],
				properties: {},
			},
			handler: buildRefreshTechnologiesHandler(context),
		},
		{
			name: 'refresh_framework',
			description: 'Force refresh the currently selected framework',
			inputSchema: {
				type: 'object',
				required: [],
				properties: {},
			},
			handler: buildRefreshFrameworkHandler(context),
		},
		{
			name: 'next_steps',
			description: 'Suggest next actions based on current selection and provider status',
			inputSchema: {
				type: 'object',
				required: [],
				properties: {},
			},
			handler: buildNextStepsHandler(context),
		},
		{
			name: 'api_health',
			description: 'Check the documentation API health and latency',
			inputSchema: {type: 'object', required: [], properties: {}},
			handler: buildApiHealthHandler(context),
		},
		{
			name: 'workflow_suggestions',
			description: 'Suggest frameworks for common iOS workflows',
			inputSchema: {
				type: 'object',
				required: ['workflow'],
				properties: {
					workflow: {type: 'string', description: 'Workflow keyword (e.g., onboarding, camera, maps)'},
				},
			},
			handler: buildWorkflowSuggestionsHandler(context),
		},
		{
			name: 'explain_search',
			description: 'Explain why a symbol matched a query',
			inputSchema: {
				type: 'object',
				required: ['query', 'symbol'],
				properties: {
					query: {type: 'string'},
					symbol: {type: 'string', description: 'Symbol path or title'},
				},
			},
			handler: buildExplainSearchHandler(context),
		},
		{
			name: 'extract_snippets',
			description: 'Extract code snippets from symbol documentation',
			inputSchema: {
				type: 'object',
				required: ['path'],
				properties: {
					path: {type: 'string', description: 'Symbol documentation path'},
					language: {type: 'string', description: 'Optional language filter (swift, objc)'},
				},
			},
			handler: buildExtractSnippetsHandler(context),
		},
		{
			name: 'clear_cache',
			description: 'Clear cached documentation and reset local/global indexes',
			inputSchema: {
				type: 'object',
				required: [],
				properties: {},
			},
			handler: buildClearCacheHandler(context),
		},
		{
			name: 'suggest_technology_stack',
			description: 'Suggest a technology stack based on an app description so an agent can plan an iOS implementation',
			inputSchema: {
				type: 'object',
				required: ['description'],
				properties: {
					description: {
						type: 'string',
						description: 'Short description of the iOS app, including key features (notifications, sync, auth, maps, etc.)',
					},
				},
			},
			handler: buildSuggestTechnologyStackHandler(context),
		},
		{
			name: 'get_version',
			description: 'Get the current version information of the Apple Doc MCP server',
			inputSchema: {
				type: 'object',
				required: [],
				properties: {},
			},
			handler: buildVersionHandler(),
		},
	];

	server.setRequestHandler(ListToolsRequestSchema, async () => ({
		tools: toolDefinitions.map(({name, description, inputSchema}) => ({name, description, inputSchema})),
	}));

	server.setRequestHandler(CallToolRequestSchema, async request => {
		const tool = toolDefinitions.find(entry => entry.name === request.params.name);
		if (!tool) {
			throw new Error(`Unknown tool: ${request.params.name}`);
		}

		return tool.handler(request.params.arguments ?? {});
	});
};
