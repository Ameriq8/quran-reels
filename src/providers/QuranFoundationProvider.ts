import axios from "axios";
import type { IReciter, IReciterProvider, IAyahAudioSource, ProviderHealth } from "./types";

export class QuranFoundationProvider implements IReciterProvider {
	name = "Quran Foundation (Quran.com)";
	type = "quran-foundation" as const;
	private baseUrl = "https://api.quran.com/api/v4";
	private audioBaseUrl = "https://verses.quran.com/";

	// Known verified Quran Foundation Recitation IDs (Ayah-by-Ayah)
	private curatedReciters: IReciter[] = [
		{
			id: "qf-alafasy",
			nameArabic: "مشاري راشد العفاسي",
			nameEnglish: "Mishari Rashid Al-Afasy",
			countryCode: "KW",
			countryArabic: "الكويت",
			countryEnglish: "Kuwait",
			qiraat: "حفص عن عاصم",
			style: "مرتل",
			provider: "quran-foundation",
			providerRecitationId: 7,
			availability: "FULL",
			enabled: true,
			featured: true,
			priority: 10,
			previewAudio: "https://verses.quran.com/Alafasy/mp3/001001.mp3",
			availableSurahsCount: 114,
		},
		{
			id: "qf-abdulbasit-murattal",
			nameArabic: "عبد الباسط عبد الصمد",
			nameEnglish: "Abdul Basit Abdul Samad",
			countryCode: "EG",
			countryArabic: "مصر",
			countryEnglish: "Egypt",
			qiraat: "حفص عن عاصم",
			style: "مرتل",
			provider: "quran-foundation",
			providerRecitationId: 2,
			availability: "FULL",
			enabled: true,
			featured: true,
			priority: 20,
			previewAudio: "https://verses.quran.com/AbdulBaset/Murattal/mp3/001001.mp3",
			availableSurahsCount: 114,
		},
		{
			id: "qf-abdulbasit-mujawwad",
			nameArabic: "عبد الباسط عبد الصمد",
			nameEnglish: "Abdul Basit Abdul Samad (Mujawwad)",
			countryCode: "EG",
			countryArabic: "مصر",
			countryEnglish: "Egypt",
			qiraat: "حفص عن عاصم",
			style: "مجود",
			provider: "quran-foundation",
			providerRecitationId: 1,
			availability: "FULL",
			enabled: true,
			featured: false,
			priority: 25,
			previewAudio: "https://verses.quran.com/AbdulBaset/Mujawwad/mp3/001001.mp3",
			availableSurahsCount: 114,
		},
		{
			id: "qf-husary",
			nameArabic: "محمود خليل الحصري",
			nameEnglish: "Mahmoud Khalil Al-Husary",
			countryCode: "EG",
			countryArabic: "مصر",
			countryEnglish: "Egypt",
			qiraat: "حفص عن عاصم",
			style: "مرتل",
			provider: "quran-foundation",
			providerRecitationId: 6,
			availability: "FULL",
			enabled: true,
			featured: true,
			priority: 30,
			previewAudio: "https://verses.quran.com/Husary/mp3/001001.mp3",
			availableSurahsCount: 114,
		},
		{
			id: "qf-shatri",
			nameArabic: "أبو بكر الشاطري",
			nameEnglish: "Abu Bakr Al-Shatri",
			countryCode: "SA",
			countryArabic: "السعودية",
			countryEnglish: "Saudi Arabia",
			qiraat: "حفص عن عاصم",
			style: "مرتل",
			provider: "quran-foundation",
			providerRecitationId: 4,
			availability: "FULL",
			enabled: true,
			featured: false,
			priority: 40,
			previewAudio: "https://verses.quran.com/Shatri/mp3/001001.mp3",
			availableSurahsCount: 114,
		},
		{
			id: "qf-sudais",
			nameArabic: "عبد الرحمن السديس",
			nameEnglish: "Abdur-Rahman As-Sudais",
			countryCode: "SA",
			countryArabic: "السعودية",
			countryEnglish: "Saudi Arabia",
			qiraat: "حفص عن عاصم",
			style: "مرتل",
			provider: "quran-foundation",
			providerRecitationId: 3,
			availability: "FULL",
			enabled: true,
			featured: true,
			priority: 35,
			previewAudio: "https://verses.quran.com/Sudais/mp3/001001.mp3",
			availableSurahsCount: 114,
		},
		{
			id: "qf-shuraym",
			nameArabic: "سعود الشريم",
			nameEnglish: "Sa'ud Ash-Shuraym",
			countryCode: "SA",
			countryArabic: "السعودية",
			countryEnglish: "Saudi Arabia",
			qiraat: "حفص عن عاصم",
			style: "مرتل",
			provider: "quran-foundation",
			providerRecitationId: 10,
			availability: "FULL",
			enabled: true,
			featured: false,
			priority: 45,
			previewAudio: "https://verses.quran.com/Shuraym/mp3/001001.mp3",
			availableSurahsCount: 114,
		}
	];

	async getReciters(): Promise<IReciter[]> {
		return this.curatedReciters;
	}

	async getAyahAudio(
		reciterId: string,
		surah: number,
		ayah: number
	): Promise<IAyahAudioSource> {
		const reciter = this.curatedReciters.find((r) => r.id === reciterId);
		if (!reciter) {
			throw new Error(`Reciter ${reciterId} not found in Quran Foundation provider`);
		}

		const recitationId = reciter.providerRecitationId;
		const response = await axios.get<{
			audio_files: { verse_key: string; url: string }[];
		}>(`${this.baseUrl}/recitations/${recitationId}/by_chapter/${surah}`, {
			timeout: 10000,
		});

		const verseKey = `${surah}:${ayah}`;
		const audioFile = response.data.audio_files.find((a) => a.verse_key === verseKey);

		if (!audioFile) {
			throw new Error(`Ayah audio not available for ${verseKey} by ${reciter.nameArabic}`);
		}

		const fullUrl = audioFile.url.startsWith("http")
			? audioFile.url
			: `${this.audioBaseUrl}${audioFile.url}`;

		return {
			url: fullUrl,
			reciterId,
			surah,
			ayah,
		};
	}

	async getPreviewAudio(reciterId: string): Promise<string> {
		const reciter = this.curatedReciters.find((r) => r.id === reciterId);
		return reciter?.previewAudio || "https://verses.quran.com/Alafasy/mp3/001001.mp3";
	}

	async isAvailable(reciterId: string, surah?: number, ayah?: number): Promise<boolean> {
		const reciter = this.curatedReciters.find((r) => r.id === reciterId);
		return !!reciter && reciter.enabled;
	}

	async checkHealth(): Promise<ProviderHealth> {
		try {
			await axios.get(`${this.baseUrl}/resources/recitations?language=ar`, {
				timeout: 4000,
			});
			return "ONLINE";
		} catch {
			return "DEGRADED";
		}
	}
}
