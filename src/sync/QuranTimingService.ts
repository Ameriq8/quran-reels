import type { IWord } from "./types";

export class QuranTimingService {
	/**
	 * Calculate word weight based on Arabic phonetics (letters, madd, shaddah, tanween)
	 */
	static getWordWeight(word: string): number {
		let weight = 0;
		// Base characters
		const baseChars = word.replace(/[ًٌٍَُِّْـ]/g, "");
		weight += baseChars.length * 1.0;

		// Extra weight for long vowels (Alif, Waw, Yaa, Dagger Alif, Maddah)
		const madds = word.match(/[اويٰۤ]/g) || [];
		weight += madds.length * 0.8;

		// Extra weight for Shaddah
		const shaddahs = word.match(/ّ/g) || [];
		weight += shaddahs.length * 0.7;

		// Extra weight for Tanween / Sukun pauses
		const tanweens = word.match(/[ًٌٍْ]/g) || [];
		weight += tanweens.length * 0.3;

		return Math.max(1.0, weight);
	}

	/**
	 * Align and enrich words with startMs and endMs timestamps
	 */
	alignWordTimings(
		words: IWord[],
		audioSegments?: number[][],
		actualDurationSec?: number
	): IWord[] {
		const wordItems = words.filter((w) => w.char_type_name === "word");
		if (wordItems.length === 0) return words;

		const totalDurationMs = (actualDurationSec || 5.0) * 1000;

		// Case 1: Provider supplied audio segments (e.g. [[0, 1, 60, 610], ...])
		if (audioSegments && audioSegments.length > 0) {
			const maxSegmentEnd = Math.max(...audioSegments.map((s) => s[3])) || 1;
			const scale = totalDurationMs / maxSegmentEnd;

			for (let i = 0; i < wordItems.length; i++) {
				const seg = audioSegments.find((s) => s[0] === i);
				if (seg) {
					wordItems[i].startMs = Math.round(seg[2] * scale);
					wordItems[i].endMs = Math.round(seg[3] * scale);
				}
			}

			// Fill any gaps
			let lastEnd = 0;
			for (let i = 0; i < wordItems.length; i++) {
				if (wordItems[i].startMs === undefined) {
					wordItems[i].startMs = lastEnd;
					wordItems[i].endMs = Math.min(totalDurationMs, lastEnd + 1000);
				}
				lastEnd = wordItems[i].endMs || lastEnd;
			}
			return words;
		}

		// Case 2: Fallback proportional acoustic duration estimation
		const weights = wordItems.map((w) => QuranTimingService.getWordWeight(w.text_uthmani));
		const totalWeight = weights.reduce((sum, w) => sum + w, 0) || 1;

		let currentMs = 0;
		for (let i = 0; i < wordItems.length; i++) {
			const fraction = weights[i] / totalWeight;
			const wordDuration = Math.round(fraction * totalDurationMs);

			wordItems[i].startMs = currentMs;
			wordItems[i].endMs = Math.min(totalDurationMs, currentMs + wordDuration);
			currentMs += wordDuration;
		}

		// Ensure last word reaches full duration
		if (wordItems.length > 0) {
			wordItems[wordItems.length - 1].endMs = totalDurationMs;
		}

		return words;
	}

	/**
	 * Compute phrase timing given start and end word indices
	 */
	getPhraseTiming(
		words: IWord[],
		startIdx: number,
		endIdx: number,
		baseOffsetSec: number = 0,
		ayahTotalDurationSec: number = 5.0
	): { startTime: number; endTime: number; startMs: number; endMs: number; duration: number } {
		const wordItems = words.filter((w) => w.char_type_name === "word");
		const startWord = wordItems[startIdx] || wordItems[0];
		const endWord = wordItems[Math.min(endIdx, wordItems.length - 1)] || wordItems[wordItems.length - 1];

		const startMs = startWord?.startMs ?? 0;
		const endMs = endWord?.endMs ?? (ayahTotalDurationSec * 1000);

		const startTime = Number((baseOffsetSec + (startMs / 1000)).toFixed(2));
		const endTime = Number((baseOffsetSec + (endMs / 1000)).toFixed(2));
		const duration = Number((endTime - startTime).toFixed(2));

		return {
			startTime,
			endTime,
			startMs,
			endMs,
			duration: Math.max(0.5, duration),
		};
	}
}
