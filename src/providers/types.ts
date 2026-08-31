export type ReciterCountry = "IQ" | "SA" | "EG" | "KW" | "INTL";

export type ReciterProviderType = "quran-foundation" | "every-ayah" | "iraqi-provider" | "local";

export type ProviderHealth = "ONLINE" | "DEGRADED" | "OFFLINE" | "UNKNOWN";

export type ReciterAvailability = "FULL" | "PARTIAL" | "UNAVAILABLE" | "UNKNOWN";

export interface IReciter {
	id: string;
	nameArabic: string;
	nameEnglish: string;
	countryCode: ReciterCountry;
	countryArabic: string;
	countryEnglish: string;
	qiraat?: string;
	style?: string;
	provider: ReciterProviderType;
	providerRecitationId?: number | string;
	availability: ReciterAvailability;
	enabled: boolean;
	featured: boolean;
	priority: number;
	previewAudio?: string;
	availableSurahsCount?: number;
	sourceServer?: string;
}

export interface IAyahAudioSource {
	url: string;
	reciterId: string;
	surah: number;
	ayah: number;
	duration?: number;
}

export interface IReciterProvider {
	name: string;
	type: ReciterProviderType;
	getReciters(): Promise<IReciter[]>;
	getAyahAudio(reciterId: string, surah: number, ayah: number): Promise<IAyahAudioSource>;
	getPreviewAudio(reciterId: string): Promise<string>;
	isAvailable(reciterId: string, surah?: number, ayah?: number): Promise<boolean>;
	checkHealth(): Promise<ProviderHealth>;
}
