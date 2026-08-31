export interface IChapter {
	id: number;
	revelation_place: string;
	revelation_order: number;
	bismillah_pre: boolean;
	name_simple: string;
	name_complex: string;
	name_arabic: string;
	verses_count: number;
	pages: number[];
	translated_name: {
		language_name: string;
		name: string;
	};
}

export interface IReciter {
	id: number;
	reciter_name: string;
	style?: string;
	translated_name: {
		name: string;
		language_name: string;
	};
}

export interface IVerse {
	id: number;
	verse_number: number;
	verse_key: string;
	hizb_number: number;
	rub_el_hizb_number: number;
	ruku_number: number;
	manzil_number: number;
	sajdah_number: null | number;
	page_number: number;
	juz_number: number;
	text_uthmani: string;
	text_imlaei?: string;
	words?: {
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
	}[];
	translations?: {
		id: number;
		resource_id: number;
		text: string;
	}[];
	audio?: {
		url: string;
		duration: number;
		segments?: [number, number, number, number][];
	};
}

export interface IVerseAudioFile {
	verse_key: string;
	url: string;
	duration?: number;
	segments?: [number, number, number, number][];
}

export interface IChapterAudioResponse {
	audio_files: IVerseAudioFile[];
}

export interface IConfig {
	surah: number;
	verse_start: number;
	verse_count: number;
	reciter_id: number;
	translation_id: number;
	show_translation: boolean;
	background?: string;
	output_dir: string;
	font_size?: number;
	translation_font_size?: number;
	arabic_font?: string;
	translation_font?: string;
}
