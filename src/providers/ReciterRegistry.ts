import fs from "fs/promises";
import { existsSync } from "fs";
import { join, resolve } from "path";
import axios from "axios";
import type { IReciter, IReciterProvider, IAyahAudioSource, ProviderHealth } from "./types";
import { QuranFoundationProvider } from "./QuranFoundationProvider";
import { EveryAyahProvider } from "./EveryAyahProvider";
import { IraqiReciterProvider } from "./IraqiReciterProvider";

export class ReciterRegistry {
	private providers: IReciterProvider[] = [];
	private favorites: Set<string> = new Set(["ea-dossari", "qf-alafasy", "iq-raad-alkurdi", "ea-minshawi-murattal"]);
	private recent: string[] = ["ea-dossari", "qf-alafasy", "iq-raad-alkurdi"];
	private baseCacheDir = resolve("cache", "audio");

	constructor() {
		this.providers = [
			new IraqiReciterProvider(),
			new QuranFoundationProvider(),
			new EveryAyahProvider(),
		];
	}

	/**
	 * Normalize text for searching (removes diacritics, extra spaces, normalize Arabic letters)
	 */
	static normalizeSearchText(text: string): string {
		if (!text) return "";
		return text
			.toLowerCase()
			.replace(/[ًٌٍَُِّْـ]/g, "") // Tashkeel
			.replace(/[إأآٱ]/g, "ا")
			.replace(/ة/g, "ه")
			.replace(/ى/g, "ي")
			.replace(/[-_]/g, " ")
			.trim();
	}

	/**
	 * Get all reciters across all providers
	 */
	async getAllReciters(iraqiFirst: boolean = true): Promise<IReciter[]> {
		const allLists = await Promise.all(this.providers.map((p) => p.getReciters()));
		const flattened = allLists.flat();

		// Sort by priority and Iraqi status
		const sorted = flattened.sort((a, b) => {
			if (iraqiFirst) {
				if (a.countryCode === "IQ" && b.countryCode !== "IQ") return -1;
				if (a.countryCode !== "IQ" && b.countryCode === "IQ") return 1;
			}
			return a.priority - b.priority;
		});

		const seen = new Set<string>();
		return sorted.filter((reciter) => {
			const key = `${reciter.nameArabic}|${reciter.style || ""}`;
			if (seen.has(key)) return false;
			seen.add(key);
			return true;
		});
	}

	/**
	 * Find reciter by ID
	 */
	async getReciterById(id: string): Promise<IReciter | undefined> {
		const allLists = await Promise.all(this.providers.map((provider) => provider.getReciters()));
		return allLists.flat().find((reciter) => reciter.id === id);
	}

	/**
	 * Get provider by reciter ID
	 */
	getProviderForReciter(reciter: IReciter): IReciterProvider {
		const provider = this.providers.find((p) => p.type === reciter.provider);
		if (!provider) {
			throw new Error(`Provider ${reciter.provider} not found for reciter ${reciter.id}`);
		}
		return provider;
	}

	/**
	 * Download and cache verse audio
	 */
	async downloadAndCacheAudio(
		reciter: IReciter,
		surah: number,
		ayah: number
	): Promise<string> {
		const provider = this.getProviderForReciter(reciter);
		const audioSource = await provider.getAyahAudio(reciter.id, surah, ayah);

		const targetDir = join(this.baseCacheDir, reciter.provider, reciter.id);
		await fs.mkdir(targetDir, { recursive: true });

		const filename = `surah_${surah.toString().padStart(3, "0")}_ayah_${ayah.toString().padStart(3, "0")}.mp3`;
		const targetPath = join(targetDir, filename);

		if (existsSync(targetPath)) {
			return targetPath;
		}

		// Download audio with arraybuffer
		const response = await axios.get(audioSource.url, {
			responseType: "arraybuffer",
			timeout: 25000,
		});

		await fs.writeFile(targetPath, Buffer.from(response.data));
		return targetPath;
	}

	/**
	 * Download and cache full Surah audio (for Surah-level reciters)
	 */
	async downloadAndCacheSurahAudio(
		reciter: IReciter,
		surah: number
	): Promise<string> {
		const provider = this.getProviderForReciter(reciter);
		const audioSource = await provider.getAyahAudio(reciter.id, surah, 1);

		const targetDir = join(this.baseCacheDir, reciter.provider, reciter.id);
		await fs.mkdir(targetDir, { recursive: true });

		const filename = `surah_${surah.toString().padStart(3, "0")}_full.mp3`;
		const targetPath = join(targetDir, filename);

		if (existsSync(targetPath)) {
			return targetPath;
		}

		const response = await axios.get(audioSource.url, {
			responseType: "arraybuffer",
			timeout: 30000,
		});

		await fs.writeFile(targetPath, Buffer.from(response.data));
		return targetPath;
	}

	/**
	 * Check health of all providers
	 */
	async checkAllProvidersHealth(): Promise<Record<string, ProviderHealth>> {
		const result: Record<string, ProviderHealth> = {};
		for (const p of this.providers) {
			result[p.name] = await p.checkHealth();
		}
		return result;
	}

	/**
	 * Favorites management
	 */
	getFavorites(): string[] {
		return Array.from(this.favorites);
	}

	toggleFavorite(id: string): boolean {
		if (this.favorites.has(id)) {
			this.favorites.delete(id);
			return false;
		} else {
			this.favorites.add(id);
			return true;
		}
	}

	/**
	 * Recents management
	 */
	getRecentReciters(): string[] {
		return this.recent;
	}

	addRecentReciter(id: string) {
		this.recent = [id, ...this.recent.filter((r) => r !== id)].slice(0, 8);
	}
}
