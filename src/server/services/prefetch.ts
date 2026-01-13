import type {AppleDevDocsClient} from '../../apple-client.js';

const coreFrameworks = ['SwiftUI', 'UIKit', 'Foundation', 'Combine', 'SwiftData'];

export const prefetchCoreFrameworks = async (client: AppleDevDocsClient): Promise<void> => {
	await Promise.all(coreFrameworks.map(async framework => {
		try {
			await client.getFramework(framework);
		} catch (error) {
			console.warn(`Failed to prefetch ${framework}:`, error instanceof Error ? error.message : String(error));
		}
	}));
};
