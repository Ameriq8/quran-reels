import axios from "axios";
import fs from "fs/promises";
import { createWriteStream, existsSync } from "fs";
import { join, dirname } from "path";
import { pipeline } from "stream/promises";
import type { IChapter, IReciter, IVerse, IChapterAudioResponse } from "./types";

const BASE_URL = "https://api.quran.com/api/v4";
const AUDIO_BASE_URL = "https://verses.quran.com/";

export class QuranApi {
	private client = axios.create({
		baseURL: BASE_URL,
		timeout: 15000,
	});

	/**
	 * Get metadata for a specific chapter/surah
	 */
	async getChapter(chapterId: number): Promise<IChapter> {
		const { data } = await this.client.get<{ chapter: IChapter }>(
			`/chapters/${chapterId}?language=en`
		);
		return data.chapter;
	}

	/**
	 * Get list of available recitations
	 */
	async getRecitations(): Promise<IReciter[]> {
		const { data } = await this.client.get<{ recitations: IReciter[] }>(
			"/resources/recitations?language=ar"
		);
		return data.recitations;
	}

	/**
	 * Get verses of a chapter with Uthmanic Arabic text, words, and translations
	 */
	async getVerses(
		chapterId: number,
		fromVerse: number,
		count: number,
		translationId: number = 131,
		audioId: number = 7
	): Promise<IVerse[]> {
		const { data } = await this.client.get<{ verses: IVerse[] }>(
			`/verses/by_chapter/${chapterId}`,
			{
				params: {
					language: "en",
					words: true,
					word_fields: "text_uthmani,translation,audio_url",
					translations: translationId,
					audio: audioId,
					fields: "text_uthmani,chapter_id,verse_number",
					per_page: 300,
				},
			}
		);

		const startIdx = Math.max(0, fromVerse - 1);
		const endIdx = startIdx + Math.max(1, count);
		const slicedVerses = (data.verses || []).slice(startIdx, endIdx);

		// Clean translation html tags if any
		return slicedVerses.map((verse) => {
			if (verse.translations) {
				verse.translations = verse.translations.map((t) => ({
					...t,
					text: t.text.replace(/<sup[^>]*>.*?<\/sup>/g, "").replace(/<[^>]+>/g, "").trim(),
				}));
			}
			return verse;
		});
	}

	/**
	 * Get single verse with full word data
	 */
	async getVerseWithWords(
		chapterId: number,
		verseNumber: number,
		translationId: number = 131,
		audioId: number = 7
	): Promise<IVerse> {
		const { data } = await this.client.get<{ verse: IVerse }>(
			`/verses/by_key/${chapterId}:${verseNumber}`,
			{
				params: {
					language: "en",
					words: true,
					word_fields: "text_uthmani,translation,audio_url",
					translations: translationId,
					audio: audioId,
					fields: "text_uthmani,chapter_id,verse_number",
				},
			}
		);

		if (data.verse.translations) {
			data.verse.translations = data.verse.translations.map((t) => ({
				...t,
				text: t.text.replace(/<sup[^>]*>.*?<\/sup>/g, "").replace(/<[^>]+>/g, "").trim(),
			}));
		}

		return data.verse;
	}

	/**
	 * Get audio files for a chapter by reciter
	 */
	async getChapterAudio(
		reciterId: number,
		chapterId: number
	): Promise<IChapterAudioResponse> {
		const { data } = await this.client.get<IChapterAudioResponse>(
			`/recitations/${reciterId}/by_chapter/${chapterId}`
		);
		return data;
	}

	/**
	 * Download and cache audio file locally
	 */
	async downloadAudio(audioUrl: string, cacheDir: string): Promise<string> {
		await fs.mkdir(cacheDir, { recursive: true });

		const filename = audioUrl.split("/").pop() || "audio.mp3";
		const destinationPath = join(cacheDir, filename);

		if (existsSync(destinationPath)) {
			return destinationPath;
		}

		const fullUrl = audioUrl.startsWith("http")
			? audioUrl
			: `${AUDIO_BASE_URL}${audioUrl}`;

		const response = await axios.get(fullUrl, {
			responseType: "stream",
			timeout: 30000,
		});

		await pipeline(response.data, createWriteStream(destinationPath));
		return destinationPath;
	}
}
