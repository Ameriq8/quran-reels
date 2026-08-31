import type { IWord, TimedQuranSegment, SyncMode } from "./types";
import { QuranTimingService } from "./QuranTimingService";

export class QuranPhraseSegmenter {
	private timingService = new QuranTimingService();

	/**
	 * Recognized Quran pause/waqf markers
	 */
	private static WAQF_MARKS = /[ۚۖۗۘۙۛ]/;

	/**
	 * Common Arabic clause starters
	 */
	private static CLAUSE_STARTERS = /^(وَهُوَ|وَهِيَ|وَهُمْ|وَإِن|فَإِن|وَإِذ|وَإِذَا|إِذَا|إِذ|ثُمَّ|إِنَّ|إِن|أَنَّ|أَلَم|أَفَلَا|كَلَّا|الَّذِي|الَّذِينَ|مَن|قُل|فَقَالَ|قَالَ|رَبَّنَا|بَل|لَا|فَلَا)$/;

	/**
	 * Check if a word contains a Waqf marker
	 */
	private hasWaqfMarker(text: string): boolean {
		return QuranPhraseSegmenter.WAQF_MARKS.test(text);
	}

	/**
	 * Segment an Ayah into timed visual phrase segments
	 */
	segmentAyah(
		surahNumber: number,
		ayahNumber: number,
		words: IWord[],
		ayahDurationSec: number,
		baseTimelineOffsetSec: number = 0,
		audioSegments?: number[][],
		mode: SyncMode = "auto"
	): TimedQuranSegment[] {
		const wordItems = words.filter((w) => w.char_type_name === "word");

		if (wordItems.length === 0) {
			return [];
		}

		// Align word timestamps
		this.timingService.alignWordTimings(wordItems, audioSegments, ayahDurationSec);

		// Determine if Ayah should remain whole
		const shouldKeepWhole =
			mode === "whole" ||
			(mode === "auto" &&
				(wordItems.length <= 5 ||
					ayahDurationSec <= 4.5 ||
					wordItems.map((w) => w.text_uthmani).join(" ").length <= 32));

		if (shouldKeepWhole) {
			const fullArabic = wordItems.map((w) => w.text_uthmani).join(" ");
			return [
				{
					id: `seg_${surahNumber}_${ayahNumber}_0`,
					surahNumber,
					ayahNumber,
					segmentIndex: 0,
					totalSegments: 1,
					startWordIndex: 0,
					endWordIndex: wordItems.length - 1,
					words: wordItems,
					arabicText: fullArabic,
					startTime: Number(baseTimelineOffsetSec.toFixed(2)),
					endTime: Number((baseTimelineOffsetSec + ayahDurationSec).toFixed(2)),
					startMs: 0,
					endMs: Math.round(ayahDurationSec * 1000),
					duration: Number(ayahDurationSec.toFixed(2)),
					isFirstSegment: true,
					isLastSegment: true,
					hasAyahMarker: true,
				},
			];
		}

		// Calculate phrase cut indices
		const cutIndices = this.findPhraseBoundaries(wordItems);

		// Build segments from boundaries
		const segments: TimedQuranSegment[] = [];
		let startIndex = 0;

		for (let i = 0; i < cutIndices.length; i++) {
			const endIndex = cutIndices[i];
			const segWords = wordItems.slice(startIndex, endIndex + 1);
			const arabicText = segWords.map((w) => w.text_uthmani).join(" ");

			const timing = this.timingService.getPhraseTiming(
				wordItems,
				startIndex,
				endIndex,
				baseTimelineOffsetSec,
				ayahDurationSec
			);

			const isFirst = startIndex === 0;
			const isLast = endIndex === wordItems.length - 1;

			segments.push({
				id: `seg_${surahNumber}_${ayahNumber}_${i}`,
				surahNumber,
				ayahNumber,
				segmentIndex: i,
				totalSegments: cutIndices.length,
				startWordIndex: startIndex,
				endWordIndex: endIndex,
				words: segWords,
				arabicText,
				startTime: timing.startTime,
				endTime: timing.endTime,
				startMs: timing.startMs,
				endMs: timing.endMs,
				duration: timing.duration,
				isFirstSegment: isFirst,
				isLastSegment: isLast,
				hasAyahMarker: isLast,
			});

			startIndex = endIndex + 1;
		}

		// Ensure total timeline continuity
		if (segments.length > 0) {
			segments[0].startTime = Number(baseTimelineOffsetSec.toFixed(2));
			segments[segments.length - 1].endTime = Number((baseTimelineOffsetSec + ayahDurationSec).toFixed(2));

			// Bridge any gap between consecutive segments
			for (let i = 0; i < segments.length - 1; i++) {
				segments[i].endTime = segments[i + 1].startTime;
			}
		}

		return segments;
	}

	/**
	 * Find optimal word boundary cut points with linguistic clause priority
	 */
	private findPhraseBoundaries(words: IWord[]): number[] {
		const n = words.length;
		if (n <= 5) return [n - 1];

		const cuts: number[] = [];
		let lastCut = -1;

		for (let i = 0; i < n - 1; i++) {
			const currentWord = words[i].text_uthmani;
			const nextWord = words[i + 1].text_uthmani;
			const cleanNext = nextWord.replace(/[ًٌٍَُِّْـ]/g, "");
			const currentPhraseLen = i - lastCut;
			const remainingWords = n - 1 - i;

			// Condition 1: Waqf / Pause mark attached to word
			if (this.hasWaqfMarker(currentWord) && currentPhraseLen >= 2 && remainingWords >= 2) {
				cuts.push(i);
				lastCut = i;
				continue;
			}

			// Condition 2: Next word is a strong clause starter (e.g. وهو, فإن, إن, إذا, ثم...)
			if (
				currentPhraseLen >= 3 &&
				remainingWords >= 2 &&
				(QuranPhraseSegmenter.CLAUSE_STARTERS.test(nextWord) ||
					QuranPhraseSegmenter.CLAUSE_STARTERS.test(cleanNext) ||
					(nextWord.startsWith("وَ") && currentPhraseLen >= 4 && cleanNext.length >= 3))
			) {
				cuts.push(i);
				lastCut = i;
				continue;
			}

			// Condition 3: Phrase reached maximum length (e.g. 6-7 words) without a clause marker
			if (currentPhraseLen >= 7 && remainingWords >= 3) {
				cuts.push(i);
				lastCut = i;
				continue;
			}
		}

		// Final boundary is always the last word
		cuts.push(n - 1);
		return cuts;
	}
}
