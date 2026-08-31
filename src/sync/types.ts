export interface IWord {
	id: number;
	position: number;
	text_uthmani: string;
	char_type_name: "word" | "end";
	translation?: {
		text: string;
		language_name?: string;
	};
	transliteration?: {
		text: string;
		language_name?: string;
	};
	audio_url?: string;
	startMs?: number;
	endMs?: number;
}

export interface TimedQuranSegment {
	id: string;
	surahNumber: number;
	ayahNumber: number;
	segmentIndex: number;
	totalSegments: number;

	startWordIndex: number;
	endWordIndex: number;
	words: IWord[];

	arabicText: string;
	translationText?: string;

	startTime: number; // in seconds (for ASS / FFmpeg)
	endTime: number;   // in seconds
	startMs: number;
	endMs: number;
	duration: number;

	isFirstSegment: boolean;
	isLastSegment: boolean;
	hasAyahMarker: boolean;
}

export type SyncMode = "auto" | "phrase" | "whole";
