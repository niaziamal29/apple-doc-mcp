import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { AppleDevDocsClient } from '../apple-client.js';
import { ServerState } from './state.js';
import { registerTools } from './tools.js';
import { prefetchCoreFrameworks } from './services/prefetch.js';
import { AppleDocProvider, ProviderRegistry } from './services/doc-provider.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// Read version from package.json
const packageJsonPath = join(__dirname, '../../package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
export const createServer = () => {
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    const server = new Server({
        name: 'apple-dev-docs-mcp',
        version: packageJson.version,
    }, {
        capabilities: {
            tools: {},
        },
    });
    const client = new AppleDevDocsClient();
    const providerRegistry = new ProviderRegistry();
    providerRegistry.register(new AppleDocProvider(client));
    const state = new ServerState(providerRegistry);
    registerTools(server, { client, state });
    void prefetchCoreFrameworks(client);
    return server;
};
//# sourceMappingURL=app.js.map