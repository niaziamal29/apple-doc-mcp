import type {ServerContext, ToolResponse} from '../context.js';
import {bold, header, list} from '../markdown.js';
import {exportBundle, importBundle, listBundles} from '../services/bundle-manager.js';

export const buildListBundlesHandler = () =>
	async (): Promise<ToolResponse> => {
		const bundles = await listBundles();
		const lines = [
			header(1, '📦 Bundles'),
			'',
			bold('Total Bundles', bundles.length.toString()),
			'',
			list(bundles),
		];

		return {
			content: [{type: 'text', text: lines.join('\n')}],
		};
	};

export const buildExportBundleHandler = () =>
	async (args: {name?: string; filters?: string[]}): Promise<ToolResponse> => {
		const name = args.name?.trim() ?? '';
		const filters = args.filters ?? [];
		if (!name || filters.length === 0) {
			return {
				content: [{type: 'text', text: [header(1, '⚠️ Bundle name and filters required'), 'Provide a `name` and `filters` array.'].join('\n')}],
			};
		}

		const result = await exportBundle(name, filters);
		const lines = [
			header(1, '✅ Bundle Exported'),
			'',
			bold('Bundle Path', result.path),
			bold('Files', result.files.toString()),
		];

		return {content: [{type: 'text', text: lines.join('\n')}]};
	};

export const buildImportBundleHandler = () =>
	async (args: {name?: string}): Promise<ToolResponse> => {
		const name = args.name?.trim() ?? '';
		if (!name) {
			return {
				content: [{type: 'text', text: [header(1, '⚠️ Bundle name required'), 'Provide a `name` to import.'].join('\n')}],
			};
		}

		const result = await importBundle(name);
		const lines = [
			header(1, '✅ Bundle Imported'),
			'',
			bold('Bundle Path', result.path),
			bold('Files', result.files.toString()),
		];

		return {content: [{type: 'text', text: lines.join('\n')}]};
	};
