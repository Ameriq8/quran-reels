import { serve } from "bun";
import fs from "fs/promises";
import { existsSync, createReadStream } from "fs";
import { join, resolve, extname } from "path";
import { QuranApi } from "../api/quran";
import type { IChapter } from "../api/types";
import { ReciterRegistry } from "../providers/ReciterRegistry";
import { RenderQueue, type IRenderJob, type IRenderJobOptions } from "../queue/RenderQueue";
import { TEMPLATES } from "../renderer/video";
import { StorageManager } from "../utils/storage";
import { resolveWithin } from "../utils/path";
import { InstagramManager } from "../integrations/instagram";

async function handleInstagramCallback(url: URL, instagramManager: InstagramManager) {
	try {
		const error = url.searchParams.get("error_description") || url.searchParams.get("error");
		if (error) throw new Error(error);
		const code = url.searchParams.get("code") || "";
		const state = url.searchParams.get("state") || "";
		if (!code) throw new Error("لم يصل رمز الربط من Instagram");
		await instagramManager.finishAuthorization(code, state);
		return Response.redirect("http://localhost:3001/settings?instagram=connected", 302);
	} catch (error: any) {
		return Response.redirect(`http://localhost:3001/settings?instagram_error=${encodeURIComponent(error.message || "فشل الربط")}`, 302);
	}
}

function startInstagramCallbackServer(instagramManager: InstagramManager) {
	const certPath = resolve("instagram_tls/localhost-cert.pem");
	const keyPath = resolve("instagram_tls/localhost-key.pem");
	if (!existsSync(certPath) || !existsSync(keyPath)) {
		console.warn("Instagram HTTPS callback is disabled: local certificate files are missing");
		return;
	}
	serve({
		port: 3443,
		hostname: "127.0.0.1",
		tls: { cert: Bun.file(certPath), key: Bun.file(keyPath) },
		fetch(req) {
			const url = new URL(req.url);
			if (req.method === "GET" && url.pathname === "/api/instagram/callback") {
				return handleInstagramCallback(url, instagramManager);
			}
			return new Response("Not found", { status: 404 });
		},
	});
	console.log("🔒 Instagram callback is ready on https://localhost:3443");
}

function isTrustedLocalMutation(req: Request) {
	const origin = req.headers.get("origin");
	return !origin || /^http:\/\/(localhost|127\.0\.0\.1):300[01]$/.test(origin);
}

function instagramJson(req: Request, data: unknown, init?: ResponseInit) {
	const response = Response.json(data, init);
	const origin = req.headers.get("origin");
	if (origin && isTrustedLocalMutation(req)) {
		response.headers.set("Access-Control-Allow-Origin", origin);
		response.headers.set("Vary", "Origin");
	}
	return response;
}

export function pickRandomAyah(
	chapters: Pick<IChapter, "id" | "verses_count">[],
	random: () => number = () => crypto.getRandomValues(new Uint32Array(1))[0] / 0x100000000,
	verseCount: number = 1
) {
	const totalStarts = chapters.reduce((sum, chapter) => sum + Math.max(0, chapter.verses_count - verseCount + 1), 0);
	if (!totalStarts) throw new Error("No Quran chapter can fit that many verses");
	let offset = Math.floor(random() * totalStarts);

	for (const chapter of chapters) {
		const starts = Math.max(0, chapter.verses_count - verseCount + 1);
		if (offset < starts) {
			return { surah: chapter.id, verseStart: offset + 1, verseCount };
		}
		offset -= starts;
	}

	throw new Error("No Quran chapters available");
}

export function buildAutomaticRenderOptions(
	chapters: Pick<IChapter, "id" | "verses_count">[],
	reciterIds: string[],
	templateIds: string[],
	backgrounds: string[],
	verseCount: number,
	random: () => number = () => crypto.getRandomValues(new Uint32Array(1))[0] / 0x100000000
): IRenderJobOptions {
	if (!reciterIds.length || !templateIds.length) throw new Error("Automatic reels need reciters and templates");
	const pick = <T>(items: T[]) => items[Math.floor(random() * items.length)];
	const ayahs = pickRandomAyah(chapters, random, verseCount);
	return {
		...ayahs,
		reciterId: pick(reciterIds),
		templateId: pick(templateIds),
		background: backgrounds.length ? pick(backgrounds) : undefined,
		backgroundStartSeconds: 0,
		syncMode: "auto",
		showTranslation: true,
		showSurahArabic: true,
		showReciter: true,
		showBranding: true,
	};
}

interface AutomaticReelState {
	enabled: boolean;
	stage: "idle" | "selecting" | "rendering" | "publishing" | "stopping" | "failed";
	verseCount: number;
	completedCount: number;
	message: string;
	currentJobId?: string;
	currentSummary?: string;
	lastError?: string;
	updatedAt: string;
}

function buildAutomaticCaption(job: IRenderJob) {
	const firstAyah = job.options.verseStart;
	const lastAyah = firstAyah + job.options.verseCount - 1;
	return [
		"✨ تلاوة خاشعة من كتاب الله",
		`📖 سورة ${job.surahNameArabic || job.surahNameEnglish || job.options.surah} — الآيات (${firstAyah}-${lastAyah})`,
		`🎙️ بصوت القارئ: ${job.reciterNameArabic || job.options.reciterId}`,
		"🎧 استمع بقلبك وشارك الأجر",
		"",
		"#القرآن #قرآن #تلاوة #اسلام #quran #quranrecitation #reels #Khair_qur",
	].join("\n");
}

export function startServer(port: number = 3000) {
	const quranApi = new QuranApi();
	const reciterRegistry = new ReciterRegistry();
	const renderQueue = new RenderQueue();
	const storageManager = new StorageManager();
	const instagramManager = new InstagramManager();
	startInstagramCallbackServer(instagramManager);
	const automaticStateFile = resolve("cache", "automatic-reels.json");
	let automaticState: AutomaticReelState = {
		enabled: false,
		stage: "idle",
		verseCount: 5,
		completedCount: 0,
		message: "التشغيل التلقائي متوقف",
		updatedAt: new Date().toISOString(),
	};
	let automaticLoop: Promise<void> | null = null;

	const saveAutomaticState = async () => {
		automaticState.updatedAt = new Date().toISOString();
		await fs.mkdir(resolve("cache"), { recursive: true });
		await fs.writeFile(automaticStateFile, JSON.stringify(automaticState, null, 2), "utf8");
	};

	const updateAutomaticState = async (changes: Partial<AutomaticReelState>) => {
		automaticState = { ...automaticState, ...changes };
		await saveAutomaticState();
	};

	const runAutomaticLoop = async () => {
		while (automaticState.enabled) {
			try {
				await updateAutomaticState({
					stage: "selecting",
					message: "جاري اختيار قارئ وآيات وخلفية وقالب عشوائياً...",
					currentJobId: undefined,
					currentSummary: undefined,
					lastError: undefined,
				});
				const [chapters, reciters, files] = await Promise.all([
					quranApi.getChapters(),
					reciterRegistry.getAllReciters(false),
					fs.readdir(resolve("assets")),
				]);
				if (!automaticState.enabled) break;
				const options = buildAutomaticRenderOptions(
					chapters,
					reciters.map((reciter) => reciter.id),
					Object.keys(TEMPLATES),
					files.filter((file) => /\.(png|jpe?g|webp|mp4|webm|mov)$/i.test(file)),
					automaticState.verseCount
				);
				const reciter = reciters.find((item) => item.id === options.reciterId);
				const job = renderQueue.addJob(options);
				await updateAutomaticState({
					stage: "rendering",
					currentJobId: job.id,
					currentSummary: `سورة ${options.surah}، الآيات ${options.verseStart}-${options.verseStart + options.verseCount - 1}، ${reciter?.nameArabic || options.reciterId}`,
					message: "جاري إنشاء الريل العشوائي...",
				});

				while (job.status === "queued" || job.status === "processing") {
					await Bun.sleep(1000);
				}
				if (job.status !== "completed") {
					throw new Error(job.error || "فشل إنشاء الريل العشوائي");
				}
				if (!automaticState.enabled) break;
				const videoPath = job.outputFileName ? resolveWithin("output", job.outputFileName) : null;
				if (!videoPath || !existsSync(videoPath)) throw new Error("ملف الريل الناتج غير موجود");
				await updateAutomaticState({ stage: "publishing", message: "اكتمل الفيديو؛ جاري نشره على Instagram..." });
				try {
					await instagramManager.publish(job.id, videoPath, buildAutomaticCaption(job));
				} catch (error: any) {
					await updateAutomaticState({
						enabled: false,
						stage: "failed",
						lastError: error.message || "فشل النشر على Instagram",
						message: "توقف التشغيل التلقائي لأن النشر على Instagram فشل",
					});
					break;
				}
				await updateAutomaticState({
					completedCount: automaticState.completedCount + 1,
					message: "تم النشر على Instagram؛ جاري بدء ريل جديد...",
				});
				await Bun.sleep(1500);
			} catch (error: any) {
				if (!automaticState.enabled) break;
				await updateAutomaticState({
					stage: "failed",
					lastError: error.message || "فشلت دورة التشغيل التلقائي",
					message: "تعذرت الدورة الحالية؛ ستتم إعادة المحاولة بعد 15 ثانية...",
				});
				for (let second = 0; second < 15 && automaticState.enabled; second++) await Bun.sleep(1000);
			}
		}
		if (automaticState.stage !== "failed" || !automaticState.lastError) {
			await updateAutomaticState({ stage: "idle", message: "تم إيقاف التشغيل التلقائي", currentJobId: undefined });
		}
	};

	const ensureAutomaticLoop = () => {
		if (automaticLoop) return;
		automaticLoop = runAutomaticLoop().finally(() => {
			automaticLoop = null;
			if (automaticState.enabled) ensureAutomaticLoop();
		});
	};

	const automaticStateReady = (async () => {
		try {
			if (existsSync(automaticStateFile)) {
				automaticState = { ...automaticState, ...JSON.parse(await fs.readFile(automaticStateFile, "utf8")) };
				if (automaticState.enabled) {
					automaticState.message = "جاري استئناف التشغيل التلقائي...";
					ensureAutomaticLoop();
				} else {
					automaticState.stage = "idle";
					automaticState.message = "التشغيل التلقائي متوقف";
					automaticState.currentJobId = undefined;
				}
			}
		} catch (error) {
			console.warn("Could not restore automatic reel state:", error);
		}
	})();

	const mimeTypes: Record<string, string> = {
		".html": "text/html; charset=utf-8",
		".css": "text/css; charset=utf-8",
		".js": "application/javascript; charset=utf-8",
		".json": "application/json; charset=utf-8",
		".png": "image/png",
		".jpg": "image/jpeg",
		".jpeg": "image/jpeg",
		".webp": "image/webp",
		".mp4": "video/mp4",
		".webm": "video/webm",
		".mov": "video/quicktime",
		".mp3": "audio/mpeg",
		".svg": "image/svg+xml",
	};

	console.log(`🚀 Starting Quran Reels Studio Web Server on http://localhost:${port}`);

	return serve({
		port,
		hostname: "127.0.0.1",
		async fetch(req) {
			const url = new URL(req.url);
			const pathname = url.pathname;
			const method = req.method;

			// Enable CORS
			if (method === "OPTIONS") {
				const origin = req.headers.get("origin");
				if (!isTrustedLocalMutation(req)) return new Response(null, { status: 403 });
				return new Response(null, {
					headers: {
						"Access-Control-Allow-Origin": origin || "http://localhost:3001",
						"Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
						"Access-Control-Allow-Headers": "Content-Type",
					},
				});
			}

			try {
				// ==================== REST API ROUTES ====================

				if (pathname === "/api/automation/status" && method === "GET") {
					await automaticStateReady;
					return Response.json(automaticState);
				}

				if (pathname === "/api/automation/start" && method === "POST") {
					await automaticStateReady;
					if (!isTrustedLocalMutation(req)) return Response.json({ error: "Untrusted request" }, { status: 403 });
					if (!(await instagramManager.getStatus()).connected) {
						return instagramJson(req, { error: "اربط حساب Instagram أولاً" }, { status: 400 });
					}
					const body = await req.json();
					const verseCount = Number(body.verseCount);
					if (!Number.isInteger(verseCount) || verseCount < 1 || verseCount > 10) {
						return instagramJson(req, { error: "عدد الآيات للتشغيل التلقائي يجب أن يكون بين 1 و10" }, { status: 400 });
					}
					await updateAutomaticState({
						enabled: true,
						stage: "selecting",
						verseCount,
						lastError: undefined,
						message: "تم تشغيل الإنشاء والنشر التلقائي على Instagram",
					});
					ensureAutomaticLoop();
					return instagramJson(req, automaticState);
				}

				if (pathname === "/api/automation/stop" && method === "POST") {
					await automaticStateReady;
					if (!isTrustedLocalMutation(req)) return Response.json({ error: "Untrusted request" }, { status: 403 });
					await updateAutomaticState({
						enabled: false,
						stage: automaticLoop ? "stopping" : "idle",
						message: automaticLoop ? "سيتم الإيقاف بعد انتهاء العملية الحالية" : "التشغيل التلقائي متوقف",
					});
					return instagramJson(req, automaticState);
				}

				if (pathname === "/api/instagram/status" && method === "GET") {
					return Response.json(await instagramManager.getStatus());
				}

				if (pathname === "/api/instagram/settings" && method === "POST") {
					if (!isTrustedLocalMutation(req)) return Response.json({ error: "Untrusted request" }, { status: 403 });
					const body = await req.json();
					return Response.json(await instagramManager.saveCredentials(body.appId, body.appSecret));
				}

				if (pathname === "/api/instagram/connect" && method === "GET") {
					return Response.redirect(await instagramManager.getAuthorizationUrl(), 302);
				}

				if (pathname === "/api/instagram/callback" && method === "GET") {
					return handleInstagramCallback(url, instagramManager);
				}

				if (pathname === "/api/instagram/disconnect" && method === "POST") {
					if (!isTrustedLocalMutation(req)) return Response.json({ error: "Untrusted request" }, { status: 403 });
					return Response.json(await instagramManager.disconnect());
				}

				if (pathname === "/api/instagram/publish" && method === "POST") {
					if (!isTrustedLocalMutation(req)) return Response.json({ error: "Untrusted request" }, { status: 403 });
					try {
						const body = await req.json();
						const job = renderQueue.getJob(String(body.jobId || ""));
						if (!job || job.status !== "completed" || !job.outputFileName) {
							return instagramJson(req, { error: "الريل المكتمل غير موجود" }, { status: 404 });
						}
						const videoPath = resolveWithin("output", job.outputFileName);
						if (!videoPath || !existsSync(videoPath)) {
							return instagramJson(req, { error: "ملف الريل غير موجود" }, { status: 404 });
						}
						const result = await instagramManager.startPublish(job.id, videoPath, String(body.caption || ""));
						return instagramJson(req, { success: true, ...result }, { status: result.status === "publishing" ? 202 : 200 });
					} catch (error: any) {
						return instagramJson(req, { error: error.message || "فشل النشر على Instagram" }, { status: 500 });
					}
				}

				if (pathname === "/api/instagram/publication" && method === "GET") {
					const jobId = url.searchParams.get("jobId") || "";
					const publication = (await instagramManager.getPublications())[jobId];
					return instagramJson(req, publication || { status: "idle" });
				}

				// 1. Dashboard Statistics
				if (pathname === "/api/stats" && method === "GET") {
					const allJobs = renderQueue.getAllJobs();
					const completed = allJobs.filter((j) => j.status === "completed");
					const processing = allJobs.filter((j) => j.status === "processing");
					const queued = allJobs.filter((j) => j.status === "queued");
					const failed = allJobs.filter((j) => j.status === "failed");

					const totalDurationSecs = completed.reduce(
						(sum, j) => sum + (j.duration || 0),
						0
					);
					const storageStats = await storageManager.getStorageStats();

					return Response.json({
						totalReels: allJobs.length,
						readyVideos: completed.length,
						completedCount: completed.length,
						processingCount: processing.length,
						queuedCount: queued.length,
						activeQueue: processing.length + queued.length,
						failedCount: failed.length,
						totalDurationSeconds: Math.round(totalDurationSecs),
						totalDurationFormatted: `${Math.floor(totalDurationSecs / 60)} د ${Math.round(totalDurationSecs % 60)} ث`,
						storageUsedMb: storageStats.totalMb,
						storage: storageStats,
					});
				}

				// 2. Surah List
				if (pathname === "/api/surahs" && method === "GET") {
					return Response.json(await quranApi.getChapters());
				}

				// 3. Verse Canonical Text & Translation (for live preview)
				if (pathname === "/api/verses" && method === "GET") {
					const surah = parseInt(url.searchParams.get("surah") || url.searchParams.get("chapter") || "1", 10);
					const from = parseInt(url.searchParams.get("from") || "1", 10);
					const count = parseInt(url.searchParams.get("count") || "5", 10);
					const transId = parseInt(url.searchParams.get("translation") || "85", 10);

					const verses = await quranApi.getVerses(surah, from, count, transId);
					const chapter = await quranApi.getChapter(surah);
					return Response.json({ chapter, verses });
				}

				// 4. Reciters Catalog
				if (pathname === "/api/reciters" && method === "GET") {
					const settings = await storageManager.getSettings();
					const query = url.searchParams.get("q") || "";
					const country = url.searchParams.get("country");
					const favoritesOnly = url.searchParams.get("favorites") === "true";

					let reciters = await reciterRegistry.getAllReciters(settings.iraqiFirst);
					const favs = reciterRegistry.getFavorites();
					const recent = reciterRegistry.getRecentReciters();

					if (country && country !== "ALL") {
						reciters = reciters.filter((r) => r.countryCode === country);
					}

					if (favoritesOnly) {
						reciters = reciters.filter((r) => favs.includes(r.id));
					}

					if (query) {
						const normQ = ReciterRegistry.normalizeSearchText(query);
						reciters = reciters.filter(
							(r) =>
								ReciterRegistry.normalizeSearchText(r.nameArabic).includes(normQ) ||
								ReciterRegistry.normalizeSearchText(r.nameEnglish).includes(normQ)
						);
					}

					return Response.json({
						reciters: reciters.map((r) => ({
							...r,
							nameArabic: r.style ? `${r.nameArabic} (${r.style})` : r.nameArabic,
							isFavorite: favs.includes(r.id),
							isRecent: recent.includes(r.id),
						})),
						favorites: favs,
						recent,
					});
				}

				// 5. Toggle Favorite Reciter
				if (pathname === "/api/reciters/favorite" && method === "POST") {
					const body = await req.json();
					const isFav = reciterRegistry.toggleFavorite(body.id);
					return Response.json({ id: body.id, isFavorite: isFav });
				}

				// 6. Reciter Audio Preview Proxy
				if (pathname.startsWith("/api/reciters/") && pathname.endsWith("/preview") && method === "GET") {
					const reciterId = pathname.split("/")[3];
					const reciter = await reciterRegistry.getReciterById(reciterId);
					if (!reciter) {
						return new Response("Reciter not found", { status: 404 });
					}
					const provider = reciterRegistry.getProviderForReciter(reciter);
					const previewUrl = await provider.getPreviewAudio(reciter.id);
					return Response.redirect(previewUrl, 302);
				}

				// 7. Backgrounds Gallery
				if (pathname === "/api/backgrounds" && method === "GET") {
					const assetsDir = resolve("assets");
					const files = await fs.readdir(assetsDir);
					const backgrounds = files
						.filter((f) => /\.(png|jpe?g|webp|mp4|webm|mov)$/i.test(f))
						.map((f) => {
							const isVideo = /\.(mp4|webm|mov)$/i.test(f);
							let category = "إسلامية ومساجد";
							if (/child|girl|man|boy|father|person|woman/i.test(f)) category = "أشخاص وقراءة";
							if (/bench|table|surface|rug|lighted|candle/i.test(f)) category = "مصحف وتفاصيل";
							if (/nature|sea|sky|mountain|rain/i.test(f)) category = "طبيعة وسماء";

							return {
								filename: f,
								url: `/assets/${encodeURIComponent(f)}`,
								isVideo,
								category,
								name: f.replace(/\.[^/.]+$/, "").replace(/-/g, " "),
							};
						});
					return Response.json(backgrounds);
				}

				// 8. Upload Background
				if (pathname === "/api/backgrounds/upload" && method === "POST") {
					const formData = await req.formData();
					const file = formData.get("file") as File | null;
					if (!file) {
						return Response.json({ error: "No file uploaded" }, { status: 400 });
					}
					if (!/\.(png|jpe?g|webp|mp4|webm|mov)$/i.test(file.name)) {
						return Response.json({ error: "Unsupported background format" }, { status: 415 });
					}

					const cleanName = `custom_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
					const targetPath = join(resolve("assets"), cleanName);
					const arrayBuffer = await file.arrayBuffer();
					await fs.writeFile(targetPath, Buffer.from(arrayBuffer));

					return Response.json({
						success: true,
						filename: cleanName,
						url: `/assets/${encodeURIComponent(cleanName)}`,
					});
				}

				// 9. Templates List
				if (pathname === "/api/templates" && method === "GET") {
					return Response.json(Object.values(TEMPLATES));
				}

				// 9.5 Preview Phrase Segments
				if (pathname === "/api/quran/segments-preview" && method === "POST") {
					const body = await req.json();
					const surah = parseInt(body.surah, 10) || 1;
					const verseStart = parseInt(body.verseStart, 10) || 1;
					const verseCount = parseInt(body.verseCount, 10) || 1;
					const syncMode = body.syncMode || "auto";
					const translationId = body.translationId || 85;

					const { QuranPhraseSegmenter } = await import("../sync/QuranPhraseSegmenter");
					const { TranslationSegmentService } = await import("../sync/TranslationSegmentService");

					const segmenter = new QuranPhraseSegmenter();
					const translationService = new TranslationSegmentService();
					const verses = await quranApi.getVerses(surah, verseStart, verseCount, translationId);

					const allSegments: any[] = [];
					let currentTimeline = 0;

					for (const v of verses) {
						const estimatedDuration = Math.max(3.5, (v.words?.length || 4) * 1.4);
						const rawWords = (v.words || []) as any[];
						const segs = segmenter.segmentAyah(
							surah,
							v.verse_number,
							rawWords,
							estimatedDuration,
							currentTimeline,
							v.audio?.segments,
							syncMode
						);

						translationService.assignTranslations(segs, v.translations?.[0]?.text);
						allSegments.push(...segs);
						currentTimeline += estimatedDuration;
					}

					return Response.json({
						surah,
						verseStart,
						verseCount,
						syncMode,
						segments: allSegments,
					});
				}

				// 10. Create Reel Job
				if (pathname === "/api/reels/create" && method === "POST") {
					const body: IRenderJobOptions = await req.json();
					if (!body.surah || !body.reciterId) {
						return Response.json({ error: "Missing required fields" }, { status: 400 });
					}
					const job = renderQueue.addJob(body);
					return Response.json(job);
				}

				// 11. Batch Create Reels
				if (pathname === "/api/reels/batch" && method === "POST") {
					const body = await req.json();
					const surahId = parseInt(body.surah, 10);
					const mode = body.mode || "by_ayah_count"; // "by_ayah_count" or "single_ayah" or "by_duration"
					const ayahStep = parseInt(body.ayahStep || "2", 10);

					const chapter = await quranApi.getChapter(surahId);
					const totalVerses = chapter.verses_count;
					const createdJobs = [];

					for (let start = 1; start <= totalVerses; start += ayahStep) {
						const count = Math.min(ayahStep, totalVerses - start + 1);
						const job = renderQueue.addJob({
							surah: surahId,
							verseStart: start,
							verseCount: count,
							reciterId: body.reciterId,
							templateId: body.templateId,
							background: body.background,
							showTranslation: body.showTranslation,
							translationId: body.translationId,
						});
						createdJobs.push(job);
					}

					return Response.json({ count: createdJobs.length, jobs: createdJobs });
				}

				// 12. Queue & History
				if (pathname === "/api/reels/queue" && method === "GET") {
					return Response.json(renderQueue.getQueue());
				}

				if (pathname === "/api/reels/history" && method === "GET") {
					const published = await instagramManager.getPublications();
					return Response.json(renderQueue.getAllJobs().map((job) => ({
						...job,
						instagramPublication: published[job.id],
					})));
				}

				if (pathname.startsWith("/api/reels/") && method === "DELETE") {
					if (!isTrustedLocalMutation(req)) return Response.json({ error: "Untrusted request" }, { status: 403 });
					const jobId = pathname.split("/")[3];
					const success = await renderQueue.deleteJob(jobId);
					return Response.json({ success }, { status: success ? 200 : 404 });
				}

				// 13. Random Ayah Picker
				if (pathname === "/api/reels/random-ayah" && method === "GET") {
					const chapters = await quranApi.getChapters();
					const verseCount = Math.max(1, Math.min(286, Number(url.searchParams.get("count")) || 1));
					const selection = pickRandomAyah(chapters, Math.random, verseCount);
					return Response.json({
						...selection,
						chapter: chapters.find((chapter) => chapter.id === selection.surah),
					});
				}

				// 14. Settings & Storage
				if (pathname === "/api/settings" && method === "GET") {
					const settings = await storageManager.getSettings();
					return Response.json(settings);
				}

				if (pathname === "/api/settings" && method === "POST") {
					const body = await req.json();
					const updated = await storageManager.saveSettings(body);
					return Response.json(updated);
				}

				// 14.5 Storage Stats & Clean Endpoints
				if ((pathname === "/api/settings/storage" || pathname === "/api/storage/stats") && method === "GET") {
					const storageStats = await storageManager.getStorageStats();
					return Response.json(storageStats);
				}

				if (pathname === "/api/settings/clean-temp" && method === "POST") {
					const cleaned = await storageManager.cleanTempFiles();
					return Response.json({ success: true, cleaned });
				}

				if (pathname === "/api/settings/clean-audio" && method === "POST") {
					await storageManager.cleanAudioCache();
					return Response.json({ success: true });
				}

				if (pathname === "/api/storage/clean" && method === "POST") {
					const body = await req.json().catch(() => ({}));
					if (body.type === "temp") {
						const cleaned = await storageManager.cleanTempFiles();
						return Response.json({ success: true, cleaned });
					}
					if (body.type === "audio") {
						await storageManager.cleanAudioCache();
						return Response.json({ success: true });
					}
					return Response.json({ success: false }, { status: 400 });
				}

				// ==================== STATIC FILE SERVING ====================

				// Serve generated MP4 videos and thumbnails
				if (pathname.startsWith("/output/")) {
					const filename = decodeURIComponent(pathname.replace("/output/", ""));
					const filePath = resolveWithin("output", filename);
					if (filePath && existsSync(filePath)) {
						const ext = extname(filePath).toLowerCase();
						const contentType = mimeTypes[ext] || "application/octet-stream";
						const file = Bun.file(filePath);
						return new Response(file, {
							headers: { "Content-Type": contentType },
						});
					}
					return new Response("Not found", { status: 404 });
				}

				// Serve assets (background images & videos)
				if (pathname.startsWith("/assets/")) {
					const filename = decodeURIComponent(pathname.replace("/assets/", ""));
					const filePath = resolveWithin("assets", filename);
					if (filePath && existsSync(filePath)) {
						const ext = extname(filePath).toLowerCase();
						const contentType = mimeTypes[ext] || "application/octet-stream";
						const file = Bun.file(filePath);
						return new Response(file, {
							headers: {
								"Content-Type": contentType,
								"Cache-Control": "public, max-age=86400",
							},
						});
					}
					return new Response("Not found", { status: 404 });
				}

				// Root API health check
				if (pathname === "/" && method === "GET") {
					return Response.json({
						status: "ok",
						name: "Quran Reels Studio API Server",
						version: "2.0.0",
						endpoints: {
							stats: "/api/stats",
							surahs: "/api/surahs",
							verses: "/api/verses",
							reciters: "/api/reciters",
							backgrounds: "/api/backgrounds",
							templates: "/api/templates",
							reelsQueue: "/api/reels/queue",
							reelsHistory: "/api/reels/history",
							settings: "/api/settings",
						},
					});
				}

				return Response.json({ error: "Endpoint not found" }, { status: 404 });
			} catch (err: any) {
				console.error(`HTTP Error [${method} ${pathname}]:`, err);
				return Response.json({ error: err.message || "Internal server error" }, { status: 500 });
			}
		},
	});
}
