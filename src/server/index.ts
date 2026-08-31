import { serve } from "bun";
import fs from "fs/promises";
import { existsSync, createReadStream } from "fs";
import { join, resolve, extname } from "path";
import { QuranApi } from "../api/quran";
import { ReciterRegistry } from "../providers/ReciterRegistry";
import { RenderQueue, type IRenderJobOptions } from "../queue/RenderQueue";
import { TEMPLATES } from "../renderer/video";
import { StorageManager } from "../utils/storage";

export function startServer(port: number = 3000) {
	const quranApi = new QuranApi();
	const reciterRegistry = new ReciterRegistry();
	const renderQueue = new RenderQueue();
	const storageManager = new StorageManager();

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
		".mp3": "audio/mpeg",
		".svg": "image/svg+xml",
	};

	console.log(`🚀 Starting Quran Reels Studio Web Server on http://localhost:${port}`);

	return serve({
		port,
		async fetch(req) {
			const url = new URL(req.url);
			const pathname = url.pathname;
			const method = req.method;

			// Enable CORS
			if (method === "OPTIONS") {
				return new Response(null, {
					headers: {
						"Access-Control-Allow-Origin": "*",
						"Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
						"Access-Control-Allow-Headers": "Content-Type",
					},
				});
			}

			try {
				// ==================== REST API ROUTES ====================

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
					// We can fetch from Quran.com or use cached list of 114 Surahs
					const chapters = [];
					for (let i = 1; i <= 114; i++) {
						// Lightweight list
						chapters.push({ id: i });
					}
					// For rich data, we query Quran.com API
					const { data } = await quranApi["client"].get("/chapters?language=ar");
					return Response.json(data.chapters);
				}

				// 3. Verse Canonical Text & Translation (for live preview)
				if (pathname === "/api/verses" && method === "GET") {
					const surah = parseInt(url.searchParams.get("surah") || url.searchParams.get("chapter") || "1", 10);
					const from = parseInt(url.searchParams.get("from") || "1", 10);
					const count = parseInt(url.searchParams.get("count") || "5", 10);
					const transId = parseInt(url.searchParams.get("translation") || "131", 10);

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
						.filter((f) => /\.(png|jpe?g|webp|mp4)$/i.test(f))
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
					const translationId = body.translationId || 131;

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
					return Response.json(renderQueue.getAllJobs());
				}

				if (pathname.startsWith("/api/reels/") && method === "DELETE") {
					const jobId = pathname.split("/")[3];
					const success = await renderQueue.deleteJob(jobId);
					return Response.json({ success });
				}

				// 13. Random Ayah Picker
				if (pathname === "/api/reels/random-ayah" && method === "GET") {
					const randomSurah = Math.floor(Math.random() * 114) + 1;
					const chapter = await quranApi.getChapter(randomSurah);
					const randomAyah = Math.floor(Math.random() * Math.max(1, chapter.verses_count - 3)) + 1;
					const count = Math.min(3, chapter.verses_count - randomAyah + 1);

					return Response.json({
						surah: randomSurah,
						verseStart: randomAyah,
						verseCount: count,
						chapter,
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
					const filePath = join(resolve("output"), filename);
					if (existsSync(filePath)) {
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
					const filePath = join(resolve("assets"), filename);
					if (existsSync(filePath)) {
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

				// Serve public web frontend files
				let publicPath = join(resolve("public"), pathname === "/" ? "index.html" : pathname.slice(1));
				if (!existsSync(publicPath)) {
					publicPath = join(resolve("public"), "index.html"); // SPA fallback
				}

				if (existsSync(publicPath)) {
					const ext = extname(publicPath).toLowerCase();
					const contentType = mimeTypes[ext] || "text/html; charset=utf-8";
					const file = Bun.file(publicPath);
					return new Response(file, {
						headers: { "Content-Type": contentType },
					});
				}

				return new Response("Not found", { status: 404 });
			} catch (err: any) {
				console.error(`HTTP Error [${method} ${pathname}]:`, err);
				return Response.json({ error: err.message || "Internal server error" }, { status: 500 });
			}
		},
	});
}
