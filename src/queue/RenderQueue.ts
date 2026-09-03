import fs from "fs/promises";
import { existsSync } from "fs";
import { join, resolve } from "path";
import { QuranApi } from "../api/quran";
import { VideoRenderer, type IVerseRenderData, TEMPLATES } from "../renderer/video";
import { ReciterRegistry } from "../providers/ReciterRegistry";
import { QuranPhraseSegmenter } from "../sync/QuranPhraseSegmenter";
import { TranslationSegmentService } from "../sync/TranslationSegmentService";
import type { IVerse, IChapter } from "../api/types";
import type { SyncMode, TimedQuranSegment } from "../sync/types";

export interface IRenderJobOptions {
	surah: number;
	verseStart: number;
	verseCount: number;
	reciterId: string;
	templateId?: string;
	background?: string;
	backgroundStartSeconds?: number;
	showTranslation?: boolean;
	translationId?: number;
	showSurahArabic?: boolean;
	showSurahEnglish?: boolean;
	showAyahRange?: boolean;
	showReciter?: boolean;
	showBranding?: boolean;
	customFontSize?: number;
	syncMode?: SyncMode;
}

export type JobStage =
	| "queued"
	| "preparing_verses"
	| "downloading_audio"
	| "generating_subtitles"
	| "rendering_video"
	| "completed"
	| "failed";

export interface IRenderJob {
	id: string;
	options: IRenderJobOptions;
	status: "queued" | "processing" | "completed" | "failed";
	stage: JobStage;
	stageTextArabic: string;
	progress: number;
	error?: string;
	surahNameArabic?: string;
	surahNameEnglish?: string;
	reciterNameArabic?: string;
	duration?: number;
	outputFileName?: string;
	outputMp4Path?: string;
	thumbnailPath?: string;
	videoUrl?: string;
	thumbnailUrl?: string;
	createdAt: string;
	completedAt?: string;
	segmentsCount?: number;
}

export function getSurahAudioWindow(
	allVerses: IVerse[],
	verseStart: number,
	verseCount: number,
	totalDuration: number
) {
	// ponytail: Surah-level sources have no ayah timestamps; proportional Quran.com timings are the ceiling until a reciter-specific timing API is available.
	const weights = allVerses.map((verse) => verse.audio?.segments?.at(-1)?.[3] || Math.max(1, verse.text_uthmani.length));
	const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
	const startIndex = Math.max(0, verseStart - 1);
	const selectedWeights = weights.slice(startIndex, startIndex + Math.max(1, verseCount));
	const secondsPerWeight = totalDuration / totalWeight;

	return {
		startSeconds: weights.slice(0, startIndex).reduce((sum, weight) => sum + weight, 0) * secondsPerWeight,
		durationSeconds: selectedWeights.reduce((sum, weight) => sum + weight, 0) * secondsPerWeight,
		verseDurations: selectedWeights.map((weight) => weight * secondsPerWeight),
	};
}

export function pickRandomBackgroundStart(
	backgroundDuration: number,
	reelDuration: number,
	random: () => number = () => crypto.getRandomValues(new Uint32Array(1))[0] / 0x100000000
) {
	return Number((Math.max(0, backgroundDuration - reelDuration) * random()).toFixed(2));
}

export class RenderQueue {
	private jobs: Map<string, IRenderJob> = new Map();
	private queue: string[] = [];
	private isProcessing = false;
	private maxConcurrency = 1;
	private historyFile = resolve("output", "history.json");

	private api = new QuranApi();
	private renderer = new VideoRenderer();
	private reciterRegistry = new ReciterRegistry();
	private segmenter = new QuranPhraseSegmenter();
	private translationService = new TranslationSegmentService();

	constructor() {
		this.loadHistory().catch(() => {});
	}

	async loadHistory() {
		try {
			if (existsSync(this.historyFile)) {
				const content = await fs.readFile(this.historyFile, "utf-8");
				const list: IRenderJob[] = JSON.parse(content);
				for (const job of list) {
					this.jobs.set(job.id, job);
				}
			}
		} catch (e) {
			console.warn("Could not load history.json:", e);
		}
	}

	async saveHistory() {
		try {
			const outDir = resolve("output");
			await fs.mkdir(outDir, { recursive: true });
			const completedJobs = Array.from(this.jobs.values())
				.filter((j) => j.status === "completed" || j.status === "failed")
				.slice(-100);
			await fs.writeFile(this.historyFile, JSON.stringify(completedJobs, null, 2), "utf-8");
		} catch (e) {
			console.warn("Could not save history.json:", e);
		}
	}

	addJob(options: IRenderJobOptions): IRenderJob {
		const id = `job_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
		const job: IRenderJob = {
			id,
			options,
			status: "queued",
			stage: "queued",
			stageTextArabic: "في قائمة الانتظار",
			progress: 0,
			createdAt: new Date().toISOString(),
		};

		this.jobs.set(id, job);
		this.queue.push(id);
		this.processNext();
		return job;
	}

	getJob(id: string): IRenderJob | undefined {
		return this.jobs.get(id);
	}

	getAllJobs(): IRenderJob[] {
		return Array.from(this.jobs.values()).sort(
			(a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
		);
	}

	getQueue(): IRenderJob[] {
		const active = Array.from(this.jobs.values()).filter(
			(j) => j.status === "processing" || j.status === "queued"
		);
		return active.sort(
			(a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
		);
	}

	async deleteJob(id: string): Promise<boolean> {
		const job = this.jobs.get(id);
		if (!job) return false;

		if (job.outputMp4Path && existsSync(job.outputMp4Path)) {
			await fs.unlink(job.outputMp4Path).catch(() => {});
		}
		if (job.thumbnailPath && existsSync(job.thumbnailPath)) {
			await fs.unlink(job.thumbnailPath).catch(() => {});
		}

		this.jobs.delete(id);
		this.queue = this.queue.filter((qId) => qId !== id);
		await this.saveHistory();
		return true;
	}

	private async processNext() {
		if (this.isProcessing || this.queue.length === 0) return;
		this.isProcessing = true;

		const jobId = this.queue.shift()!;
		const job = this.jobs.get(jobId);

		if (!job) {
			this.isProcessing = false;
			this.processNext();
			return;
		}

		try {
			await this.executeJob(job);
		} catch (error: any) {
			console.error(`Job ${job.id} failed:`, error);
			job.status = "failed";
			job.stage = "failed";
			job.stageTextArabic = "فشل إنشاء الريل";
			job.error = error.message || "حدث خطأ أثناء معالجة الفيديو";
		} finally {
			await this.saveHistory();
			this.isProcessing = false;
			this.processNext();
		}
	}

	private async executeJob(job: IRenderJob) {
		job.status = "processing";
		const opt = job.options;
		const syncMode = opt.syncMode || "auto";

		// 1. Preparing verses
		job.stage = "preparing_verses";
		job.stageTextArabic = "جاري تجهيز بيانات السورة والآيات...";
		job.progress = 10;

		const chapter = await this.api.getChapter(opt.surah);
		job.surahNameArabic = chapter.name_arabic;
		job.surahNameEnglish = chapter.name_simple;

		const reciter = await this.reciterRegistry.getReciterById(opt.reciterId);
		if (!reciter) {
			throw new Error(`القارئ المحدد غير متوفر: ${opt.reciterId}`);
		}
		job.reciterNameArabic = reciter.nameArabic;

		const verses = await this.api.getVerses(
			opt.surah,
			opt.verseStart,
			opt.verseCount,
			opt.translationId || 85
		);

		if (verses.length === 0) {
			throw new Error(`لم يتم العثور على آيات للسورة ${opt.surah}`);
		}

		// 2. Downloading & probing audio
		job.stage = "downloading_audio";
		job.stageTextArabic = "جاري تحميل التلاوة الصوتية...";
		job.progress = 20;

		const verseRenderList: IVerseRenderData[] = [];
		const tempDir = resolve("cache", "temp");
		await fs.mkdir(tempDir, { recursive: true });
		const tempAudioPath = join(tempDir, `audio_${job.id}.mp3`);

		const isAyahLevel = (reciter as any).isAyahLevel !== false;

		if (isAyahLevel) {
			let currentTimeline = 0;
			for (let i = 0; i < verses.length; i++) {
				const verse = verses[i];
				job.stageTextArabic = `تحميل التلاوة: الآية ${verse.verse_number} (${i + 1}/${verses.length})...`;
				job.progress = Math.round(20 + ((i + 1) / verses.length) * 25);

				const localAudioPath = await this.reciterRegistry.downloadAndCacheAudio(
					reciter,
					opt.surah,
					verse.verse_number
				);

				const duration = await this.renderer.getAudioDuration(localAudioPath);

				// Perform Phrase-level Segmentation
				const rawWords = (verse.words || []) as any[];
				const segments = this.segmenter.segmentAyah(
					opt.surah,
					verse.verse_number,
					rawWords,
					duration,
					currentTimeline,
					verse.audio?.segments,
					syncMode
				);

				this.translationService.assignTranslations(
					segments,
					verse.translations?.[0]?.text
				);

				console.log(
					`[QURAN SYNC] Surah: ${opt.surah}, Ayah: ${verse.verse_number}, Duration: ${duration.toFixed(2)}s, Segments: ${segments.length}`
				);

				verseRenderList.push({
					verse,
					audioPath: localAudioPath,
					duration,
					startTime: currentTimeline,
					endTime: currentTimeline + duration,
					segments,
				});

				currentTimeline += duration;
			}

			await this.renderer.combineAudios(
				verseRenderList.map((v) => v.audioPath),
				tempAudioPath
			);
		} else {
			const surahAudioPath = await this.reciterRegistry.downloadAndCacheSurahAudio(
				reciter,
				opt.surah
			);
			const totalSurahDuration = await this.renderer.getAudioDuration(surahAudioPath);
			const allVerses = opt.verseStart === 1 && verses.length === chapter.verses_count
				? verses
				: await this.api.getVerses(opt.surah, 1, chapter.verses_count, opt.translationId || 85);
			const audioWindow = getSurahAudioWindow(allVerses, opt.verseStart, opt.verseCount, totalSurahDuration);
			await this.renderer.extractAudioSegment(surahAudioPath, tempAudioPath, audioWindow.startSeconds, audioWindow.durationSeconds);
			let currentTimeline = 0;

			for (let index = 0; index < verses.length; index++) {
				const verse = verses[index];
				const verseDuration = audioWindow.verseDurations[index];

				const rawWords = (verse.words || []) as any[];
				const segments = this.segmenter.segmentAyah(
					opt.surah,
					verse.verse_number,
					rawWords,
					verseDuration,
					currentTimeline,
					verse.audio?.segments,
					syncMode
				);

				this.translationService.assignTranslations(
					segments,
					verse.translations?.[0]?.text
				);

				verseRenderList.push({
					verse,
					audioPath: tempAudioPath,
					duration: verseDuration,
					startTime: currentTimeline,
					endTime: currentTimeline + verseDuration,
					segments,
				});

				currentTimeline += verseDuration;
			}
		}

		const totalDuration = verseRenderList[verseRenderList.length - 1].endTime;
		job.duration = totalDuration;
		job.segmentsCount = verseRenderList.reduce((sum, v) => sum + (v.segments?.length || 1), 0);

		// 3. Generating subtitles
		job.stage = "generating_subtitles";
		job.stageTextArabic = "جاري تنسيق الخطوط وتزامن المقاطع...";
		job.progress = 50;

		const tempAssPath = join(tempDir, `sub_${job.id}.ass`);
		const templateId = opt.templateId || "mushaf-focus";

		await this.renderer.generateAssSubtitles(
			chapter,
			verseRenderList,
			reciter.nameArabic,
			templateId,
			{
				showTranslation: opt.showTranslation,
				showSurahArabic: opt.showSurahArabic,
				showSurahEnglish: opt.showSurahEnglish,
				showAyahRange: opt.showAyahRange,
				showReciter: opt.showReciter,
				showBranding: opt.showBranding,
				customFontSize: opt.customFontSize,
			},
			tempAssPath
		);

		// 4. Rendering Video with FFmpeg
		job.stage = "rendering_video";
		job.stageTextArabic = "جاري إنتاج الفيديو بواسطة FFmpeg (0%)...";
		job.progress = 52;

		const outDir = resolve("output");
		await fs.mkdir(outDir, { recursive: true });

		const firstAyah = verseRenderList[0].verse.verse_number;
		const lastAyah = verseRenderList[verseRenderList.length - 1].verse.verse_number;
		const safeSurah = chapter.name_simple.replace(/[^a-zA-Z0-9_-]/g, "_");
		const outputFileName = `Surah_${chapter.id.toString().padStart(3, "0")}_${safeSurah}_Ayah_${firstAyah}-${lastAyah}_${Date.now().toString().slice(-4)}.mp4`;
		const outputMp4Path = join(outDir, outputFileName);
		const thumbnailName = outputFileName.replace(".mp4", ".jpg");
		const thumbnailPath = join(outDir, thumbnailName);

		const backgroundImage = await this.renderer.getBackground(opt.background);
		const backgroundStartSeconds = /\.(mp4|webm|mov)$/i.test(backgroundImage) && opt.backgroundStartSeconds === -1
			? pickRandomBackgroundStart(await this.renderer.getAudioDuration(backgroundImage), totalDuration)
			: opt.backgroundStartSeconds;
		job.options.backgroundStartSeconds = backgroundStartSeconds;
		const template = TEMPLATES[templateId] || TEMPLATES["mushaf-focus"];

		await this.renderer.renderVideo({
			backgroundImage,
			backgroundStartSeconds,
			combinedAudioPath: tempAudioPath,
			assSubtitlesPath: tempAssPath,
			totalDuration,
			overlayOpacity: template.overlayOpacity,
			outputMp4Path,
			onProgress: (renderPct) => {
				const overall = Math.round(52 + (renderPct * 0.46));
				job.progress = Math.min(98, Math.max(52, overall));
				job.stageTextArabic = `جاري معالجة الإطارات بالـ FFmpeg (${Math.round(renderPct)}%)...`;
			},
		});

		// Generate thumbnail
		await this.renderer.generateThumbnail(outputMp4Path, thumbnailPath);

		// Cleanup temp files
		await fs.unlink(tempAssPath).catch(() => {});
		await fs.unlink(tempAudioPath).catch(() => {});

		// Update completed job details
		job.status = "completed";
		job.stage = "completed";
		job.stageTextArabic = "اكتمل الإنتاج بنجاح";
		job.progress = 100;
		job.outputFileName = outputFileName;
		job.outputMp4Path = outputMp4Path;
		job.thumbnailPath = thumbnailPath;
		job.videoUrl = `/output/${outputFileName}`;
		job.thumbnailUrl = `/output/${thumbnailName}`;
		job.completedAt = new Date().toISOString();

		this.reciterRegistry.addRecentReciter(reciter.id);
	}
}
