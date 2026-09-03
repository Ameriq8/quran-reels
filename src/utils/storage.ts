import fs from "fs/promises";
import { existsSync } from "fs";
import { join, resolve } from "path";

export interface IAppSettings {
	defaultReciter: string;
	defaultTemplate: string;
	defaultBackground: string;
	defaultTranslation: number;
	showTranslationDefault: boolean;
	iraqiFirst: boolean;
	maxReelDuration: number;
	concurrency: number;
}

export const DEFAULT_SETTINGS: IAppSettings = {
	defaultReciter: "iq-raad-alkurdi",
	defaultTemplate: "mushaf-focus",
	defaultBackground: "",
	defaultTranslation: 85,
	showTranslationDefault: true,
	iraqiFirst: true,
	maxReelDuration: 60,
	concurrency: 1,
};

export class StorageManager {
	private settingsFile = resolve("cache", "settings.json");

	async getFolderSize(dirPath: string): Promise<number> {
		if (!existsSync(dirPath)) return 0;
		let total = 0;

		try {
			const entries = await fs.readdir(dirPath, { withFileTypes: true });
			for (const entry of entries) {
				const fullPath = join(dirPath, entry.name);
				if (entry.isDirectory()) {
					total += await this.getFolderSize(fullPath);
				} else if (entry.isFile()) {
					const stats = await fs.stat(fullPath);
					total += stats.size;
				}
			}
		} catch (e) {
			console.warn(`Could not read dir size for ${dirPath}:`, e);
		}

		return total;
	}

	formatBytes(bytes: number): string {
		if (bytes === 0) return "0 MB";
		const k = 1024;
		const sizes = ["Bytes", "KB", "MB", "GB"];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
	}

	async getStorageStats() {
		const audioCacheSize = await this.getFolderSize(resolve("cache", "audio"));
		const tempCacheSize = await this.getFolderSize(resolve("cache", "temp"));
		const outputsSize = await this.getFolderSize(resolve("output"));
		const assetsSize = await this.getFolderSize(resolve("assets"));
		const total = audioCacheSize + tempCacheSize + outputsSize + assetsSize;

		return {
			audioCacheBytes: audioCacheSize,
			audioCacheFormatted: this.formatBytes(audioCacheSize),
			audioCacheMb: (audioCacheSize / (1024 * 1024)).toFixed(2),
			tempCacheBytes: tempCacheSize,
			tempCacheFormatted: this.formatBytes(tempCacheSize),
			tempMb: (tempCacheSize / (1024 * 1024)).toFixed(2),
			outputsBytes: outputsSize,
			outputBytes: outputsSize,
			outputsFormatted: this.formatBytes(outputsSize),
			outputMb: (outputsSize / (1024 * 1024)).toFixed(2),
			outputsMb: (outputsSize / (1024 * 1024)).toFixed(2),
			assetsBytes: assetsSize,
			assetsFormatted: this.formatBytes(assetsSize),
			assetsMb: (assetsSize / (1024 * 1024)).toFixed(2),
			totalBytes: total,
			totalFormatted: this.formatBytes(total),
			totalMb: (total / (1024 * 1024)).toFixed(2),
		};
	}

	async cleanTempFiles(): Promise<number> {
		const tempDir = resolve("cache", "temp");
		if (!existsSync(tempDir)) return 0;
		let count = 0;
		const files = await fs.readdir(tempDir);
		for (const file of files) {
			await fs.unlink(join(tempDir, file)).catch(() => {});
			count++;
		}
		return count;
	}

	async cleanAudioCache(): Promise<void> {
		const audioDir = resolve("cache", "audio");
		if (existsSync(audioDir)) {
			await fs.rm(audioDir, { recursive: true, force: true }).catch(() => {});
			await fs.mkdir(audioDir, { recursive: true });
		}
	}

	async getSettings(): Promise<IAppSettings> {
		try {
			if (existsSync(this.settingsFile)) {
				const content = await fs.readFile(this.settingsFile, "utf-8");
				return { ...DEFAULT_SETTINGS, ...JSON.parse(content) };
			}
		} catch (e) {
			console.warn("Could not read settings.json:", e);
		}
		return DEFAULT_SETTINGS;
	}

	async saveSettings(settings: Partial<IAppSettings>): Promise<IAppSettings> {
		const current = await this.getSettings();
		const updated = { ...current, ...settings };
		await fs.mkdir(resolve("cache"), { recursive: true });
		await fs.writeFile(this.settingsFile, JSON.stringify(updated, null, 2), "utf-8");
		return updated;
	}
}
