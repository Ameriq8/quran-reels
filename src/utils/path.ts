import { resolve, sep } from "path";

export function resolveWithin(rootDir: string, requestedPath: string): string | null {
	const root = resolve(rootDir);
	const filePath = resolve(root, requestedPath);
	return filePath.startsWith(root + sep) ? filePath : null;
}
