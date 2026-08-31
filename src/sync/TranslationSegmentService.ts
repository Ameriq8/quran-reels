import type { TimedQuranSegment } from "./types";

export class TranslationSegmentService {
	/**
	 * Clean word translation text
	 */
	static cleanWordTranslation(text: string): string {
		if (!text) return "";
		return text
			.replace(/\s+/g, " ")
			.trim();
	}

	/**
	 * Assign phrase-level translation to each TimedQuranSegment
	 */
	assignTranslations(
		segments: TimedQuranSegment[],
		fullVerseTranslation?: string
	): TimedQuranSegment[] {
		if (segments.length === 0) return segments;

		// Single segment gets the full translation
		if (segments.length === 1) {
			segments[0].translationText = fullVerseTranslation || "";
			return segments;
		}

		// Try building phrase translation from word-by-word data
		let hasWordTranslations = true;
		for (const seg of segments) {
			const hasWordTrans = seg.words.some((w) => w.translation?.text);
			if (!hasWordTrans) {
				hasWordTranslations = false;
				break;
			}
		}

		if (hasWordTranslations) {
			for (let sIdx = 0; sIdx < segments.length; sIdx++) {
				const seg = segments[sIdx];
				const rawPhrase = seg.words
					.map((w) => TranslationSegmentService.cleanWordTranslation(w.translation?.text || ""))
					.filter(Boolean)
					.join(" ");

				let formatted = rawPhrase;
				if (sIdx === 0 && formatted.length > 0) {
					formatted = formatted.charAt(0).toUpperCase() + formatted.slice(1);
				}
				if (sIdx === segments.length - 1 && formatted.length > 0 && !/[.!?]$/.test(formatted)) {
					formatted += ".";
				}

				seg.translationText = formatted;
			}
			return segments;
		}

		// Fallback: Clause split on punctuation in fullVerseTranslation
		if (fullVerseTranslation) {
			const clauses = fullVerseTranslation
				.split(/(?<=[,;.\-—])\s+/)
				.map((c) => c.trim())
				.filter(Boolean);

			if (clauses.length === segments.length) {
				for (let i = 0; i < segments.length; i++) {
					segments[i].translationText = clauses[i];
				}
				return segments;
			}
		}

		// Fallback 2: Proportional word split of full translation
		if (fullVerseTranslation) {
			const tWords = fullVerseTranslation.split(" ");
			const totalQuranWords = segments.reduce((sum, s) => sum + s.words.length, 0) || 1;

			let currentTIdx = 0;
			for (let i = 0; i < segments.length; i++) {
				const fraction = segments[i].words.length / totalQuranWords;
				const takeCount =
					i === segments.length - 1
						? tWords.length - currentTIdx
						: Math.max(2, Math.round(fraction * tWords.length));

				const phraseWords = tWords.slice(currentTIdx, currentTIdx + takeCount);
				segments[i].translationText = phraseWords.join(" ");
				currentTIdx += takeCount;
			}
		}

		return segments;
	}
}
