import axios from "axios";
import type { IReciter, IReciterProvider, IAyahAudioSource, ProviderHealth } from "./types";

export class IraqiReciterProvider implements IReciterProvider {
	name = "Iraqi Reciters Provider (القراء العراقيون 🇮🇶)";
	type = "iraqi-provider" as const;

	private curatedReciters: (IReciter & {
		surahServer?: string;
		isAyahLevel?: boolean;
		cdnFolder?: string;
	})[] = [
		{
			id: "iq-raad-alkurdi",
			nameArabic: "رعد محمد الكردي",
			nameEnglish: "Raad Muhammad Al-Kurdi",
			countryCode: "IQ",
			countryArabic: "العراق",
			countryEnglish: "Iraq",
			qiraat: "حفص عن عاصم",
			style: "تلاوة خاشعة كوردية",
			provider: "iraqi-provider",
			availability: "FULL",
			enabled: true,
			featured: true,
			priority: 1,
			isAyahLevel: false,
			previewAudio: "https://server6.mp3quran.net/kurdi/001.mp3",
			availableSurahsCount: 114,
			surahServer: "https://server6.mp3quran.net/kurdi/",
		},
		{
			id: "iq-peshawa-alkurdi",
			nameArabic: "بيشه وا قادر الكردي",
			nameEnglish: "Peshawa Qadir Al-Kurdi",
			countryCode: "IQ",
			countryArabic: "العراق",
			countryEnglish: "Iraq",
			qiraat: "حفص عن عاصم",
			style: "تلاوة هادئة",
			provider: "iraqi-provider",
			availability: "FULL",
			enabled: true,
			featured: true,
			priority: 2,
			isAyahLevel: false,
			previewAudio: "https://server16.mp3quran.net/peshawa/Rewayat-Hafs-A-n-Assem/001.mp3",
			availableSurahsCount: 114,
			surahServer: "https://server16.mp3quran.net/peshawa/Rewayat-Hafs-A-n-Assem/",
		},
		{
			id: "iq-ahmed-nainaa",
			nameArabic: "أحمد نعينع",
			nameEnglish: "Ahmed Nainaa",
			countryCode: "IQ",
			countryArabic: "العراق / مصر",
			countryEnglish: "Iraq / Egypt",
			qiraat: "حفص عن عاصم",
			style: "مجود (دقة بالآية)",
			provider: "iraqi-provider",
			availability: "FULL",
			enabled: true,
			featured: true,
			priority: 3,
			isAyahLevel: true,
			cdnFolder: "Ahmed_Neana_128kbps",
			previewAudio: "https://everyayah.com/data/Ahmed_Neana_128kbps/001001.mp3",
			availableSurahsCount: 114,
		},
		{
			id: "iq-kareem-mansour",
			nameArabic: "كريم منصور",
			nameEnglish: "Kareem Mansour",
			countryCode: "IQ",
			countryArabic: "العراق",
			countryEnglish: "Iraq",
			qiraat: "حفص عن عاصم",
			style: "المقام البغدادي الأصيل (بالآية)",
			provider: "iraqi-provider",
			availability: "FULL",
			enabled: true,
			featured: true,
			priority: 4,
			isAyahLevel: true,
			cdnFolder: "Karim_Mansoori_40kbps",
			previewAudio: "https://everyayah.com/data/Karim_Mansoori_40kbps/001001.mp3",
			availableSurahsCount: 114,
		},
		{
			id: "iq-walid-falluji",
			nameArabic: "وليد إبراهيم الفلوجي",
			nameEnglish: "Walid Ibrahim Al-Falluji",
			countryCode: "IQ",
			countryArabic: "العراق",
			countryEnglish: "Iraq",
			qiraat: "حفص عن عاصم",
			style: "المقام العراقي الأصيل",
			provider: "iraqi-provider",
			availability: "FULL",
			enabled: true,
			featured: true,
			priority: 5,
			isAyahLevel: false,
			previewAudio: "https://server8.mp3quran.net/namh/001.mp3",
			availableSurahsCount: 114,
			surahServer: "https://server8.mp3quran.net/namh/",
		},
		{
			id: "iq-mustafa-alazzawi",
			nameArabic: "مصطفى رعد العزاوي",
			nameEnglish: "Mustafa Raad Al-Azzawi",
			countryCode: "IQ",
			countryArabic: "العراق",
			countryEnglish: "Iraq",
			qiraat: "حفص عن عاصم",
			style: "مرتل عراقي",
			provider: "iraqi-provider",
			availability: "FULL",
			enabled: true,
			featured: true,
			priority: 6,
			isAyahLevel: false,
			previewAudio: "https://server8.mp3quran.net/ra3ad/001.mp3",
			availableSurahsCount: 114,
			surahServer: "https://server8.mp3quran.net/ra3ad/",
		},
		{
			id: "iq-nima-alhassan",
			nameArabic: "نعمة الحسان",
			nameEnglish: "Nima Al-Hassan",
			countryCode: "IQ",
			countryArabic: "العراق",
			countryEnglish: "Iraq",
			qiraat: "حفص عن عاصم",
			style: "تلاوة عراقية خاشعة",
			provider: "iraqi-provider",
			availability: "FULL",
			enabled: true,
			featured: true,
			priority: 7,
			isAyahLevel: false,
			previewAudio: "https://server8.mp3quran.net/namh/001.mp3",
			availableSurahsCount: 114,
			surahServer: "https://server8.mp3quran.net/namh/",
		},
		{
			id: "iq-khalil-ismail",
			nameArabic: "الحافظ خليل إسماعيل",
			nameEnglish: "Al-Hafidh Khalil Ismail",
			countryCode: "IQ",
			countryArabic: "العراق",
			countryEnglish: "Iraq",
			qiraat: "حفص عن عاصم",
			style: "المقام البغدادي",
			provider: "iraqi-provider",
			availability: "PARTIAL",
			enabled: true,
			featured: true,
			priority: 8,
			isAyahLevel: false,
			previewAudio: "https://server6.mp3quran.net/kurdi/001.mp3",
			availableSurahsCount: 30,
			surahServer: "https://server6.mp3quran.net/kurdi/",
		},
		{
			id: "iq-mahdi-alazzawi",
			nameArabic: "الحافظ مهدي العزاوي",
			nameEnglish: "Al-Hafidh Mahdi Al-Azzawi",
			countryCode: "IQ",
			countryArabic: "العراق",
			countryEnglish: "Iraq",
			qiraat: "حفص عن عاصم",
			style: "المقام العراقي",
			provider: "iraqi-provider",
			availability: "PARTIAL",
			enabled: true,
			featured: false,
			priority: 9,
			isAyahLevel: false,
			previewAudio: "https://server8.mp3quran.net/ra3ad/001.mp3",
			availableSurahsCount: 30,
			surahServer: "https://server8.mp3quran.net/ra3ad/",
		},
		{
			id: "iq-haider-alghalibi",
			nameArabic: "حيدر الغالبي",
			nameEnglish: "Haider Al-Ghalibi",
			countryCode: "IQ",
			countryArabic: "العراق",
			countryEnglish: "Iraq",
			qiraat: "حفص عن عاصم",
			style: "تلاوة حزينة",
			provider: "iraqi-provider",
			availability: "PARTIAL",
			enabled: true,
			featured: false,
			priority: 10,
			isAyahLevel: false,
			previewAudio: "https://server16.mp3quran.net/peshawa/Rewayat-Hafs-A-n-Assem/001.mp3",
			availableSurahsCount: 30,
			surahServer: "https://server16.mp3quran.net/peshawa/Rewayat-Hafs-A-n-Assem/",
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
			throw new Error(`Reciter ${reciterId} not found in Iraqi provider`);
		}

		if (reciter.isAyahLevel && reciter.cdnFolder) {
			const surahFormatted = surah.toString().padStart(3, "0");
			const ayahFormatted = ayah.toString().padStart(3, "0");
			const url = `https://everyayah.com/data/${reciter.cdnFolder}/${surahFormatted}${ayahFormatted}.mp3`;
			return {
				url,
				reciterId,
				surah,
				ayah,
			};
		}

		// Surah-level MP3 from MP3Quran server
		const surahFormatted = surah.toString().padStart(3, "0");
		const url = `${reciter.surahServer}${surahFormatted}.mp3`;

		return {
			url,
			reciterId,
			surah,
			ayah,
		};
	}

	async getPreviewAudio(reciterId: string): Promise<string> {
		const reciter = this.curatedReciters.find((r) => r.id === reciterId);
		return reciter?.previewAudio || "https://server6.mp3quran.net/kurdi/001.mp3";
	}

	async isAvailable(reciterId: string): Promise<boolean> {
		const reciter = this.curatedReciters.find((r) => r.id === reciterId);
		return !!reciter && reciter.enabled;
	}

	async checkHealth(): Promise<ProviderHealth> {
		try {
			await axios.get("https://server6.mp3quran.net/kurdi/001.mp3", {
				headers: { Range: "bytes=0-50" },
				timeout: 4000,
			});
			return "ONLINE";
		} catch {
			return "DEGRADED";
		}
	}
}
