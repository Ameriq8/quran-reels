"use client";

import React, { useEffect, useRef, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { TopNavbar } from "@/components/TopNavbar";
import { PlayerModal, buildInstagramCaption, publishInstagramJob, type IPlayerJob } from "@/components/PlayerModal";
import {
	Sparkles,
	Volume2,
	Eye,
	Rocket,
	Check,
	Sliders,
	Layers,
	RefreshCw,
	X,
	Play,
	Pause,
	BookOpen,
	Clock,
	Image as ImageIcon,
	Dices,
	Search,
	Upload,
	Camera,
	Repeat2,
	Square,
} from "lucide-react";

interface AutomaticReelStatus {
	enabled: boolean;
	stage: string;
	verseCount: number;
	completedCount: number;
	message: string;
	currentSummary?: string;
	lastError?: string;
}

function toArabicNumerals(num: number | string): string {
	const arabicNumerals = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];
	return num
		.toString()
		.split("")
		.map((d) => arabicNumerals[parseInt(d, 10)] || d)
		.join("");
}

export default function StudioPage() {
	return (
		<Suspense fallback={<div style={{ padding: "40px", color: "var(--text-muted)" }}>جاري تحميل استوديو الريلز...</div>}>
			<StudioContent />
		</Suspense>
	);
}

function StudioContent() {
	const searchParams = useSearchParams();

	const [surahs, setSurahs] = useState<any[]>([]);
	const [reciters, setReciters] = useState<any[]>([]);
	const [templates, setTemplates] = useState<any[]>([]);
	const [backgrounds, setBackgrounds] = useState<any[]>([]);

	// Form State
	const [selectedSurah, setSelectedSurah] = useState<number>(1);
	const [verseStart, setVerseStart] = useState<number>(1);
	const [verseEnd, setVerseEnd] = useState<number>(5);
	const [selectedReciter, setSelectedReciter] = useState<any>(null);
	const [selectedTemplate, setSelectedTemplate] = useState<string>("mushaf-focus");
	const [selectedBg, setSelectedBg] = useState<string>("auto");
	const [backgroundStartSeconds, setBackgroundStartSeconds] = useState(0);
	const [syncMode, setSyncMode] = useState<string>("auto");
	const [showTranslation, setShowTranslation] = useState<boolean>(true);
	const [showSurahHeader, setShowSurahHeader] = useState<boolean>(true);
	const [showReciterTag, setShowReciterTag] = useState<boolean>(true);

	// Preview Cache
	const [cachedChapter, setCachedChapter] = useState<any>(null);
	const [cachedVerses, setCachedVerses] = useState<any[]>([]);
	const [currentSegments, setCurrentSegments] = useState<any[]>([]);

	// Modals & Progress
	const [showReciterModal, setShowReciterModal] = useState(false);
	const [showSegmentsModal, setShowSegmentsModal] = useState(false);
	const [showBgModal, setShowBgModal] = useState(false);
	const [bgCategoryFilter, setBgCategoryFilter] = useState("all");
	const [bgSearchQuery, setBgSearchQuery] = useState("");
	const [isUploadingBackground, setIsUploadingBackground] = useState(false);
	const [isRendering, setIsRendering] = useState(false);
	const [renderProgress, setRenderProgress] = useState(0);
	const [renderStageText, setRenderStageText] = useState("");
	const [completedJob, setCompletedJob] = useState<IPlayerJob | null>(null);
	const [instagramConnected, setInstagramConnected] = useState(false);
	const [instagramUsername, setInstagramUsername] = useState("");
	const [publishToInstagram, setPublishToInstagram] = useState(false);
	const [instagramCaption, setInstagramCaption] = useState("");
	const [instagramMediaId, setInstagramMediaId] = useState("");
	const [instagramPublishError, setInstagramPublishError] = useState("");
	const [automaticStatus, setAutomaticStatus] = useState<AutomaticReelStatus>({
		enabled: false,
		stage: "idle",
		verseCount: 5,
		completedCount: 0,
		message: "التشغيل التلقائي متوقف",
	});
	const [automaticBusy, setAutomaticBusy] = useState(false);

	// Audio Preview
	const [isPlayingAudio, setIsPlayingAudio] = useState(false);
	const audioRef = useRef<HTMLAudioElement | null>(null);
	const canvasRef = useRef<HTMLCanvasElement | null>(null);
	const backgroundVideoRef = useRef<HTMLVideoElement | null>(null);

	// Initialize from query or defaults
	useEffect(() => {
		const surahParam = searchParams.get("surah");
		const startParam = searchParams.get("start");
		const countParam = searchParams.get("count");
		const reciterParam = searchParams.get("reciter");
		const templateParam = searchParams.get("template");
		const backgroundParam = searchParams.get("background");
		let savedSettings: Record<string, string> = {};
		try {
			savedSettings = JSON.parse(localStorage.getItem("studio_settings") || "{}");
		} catch {}

		if (surahParam) setSelectedSurah(parseInt(surahParam, 10));
		if (startParam) setVerseStart(parseInt(startParam, 10));
		if (countParam) setVerseEnd((parseInt(startParam || "1", 10)) + parseInt(countParam, 10) - 1);
		setSelectedTemplate(templateParam || savedSettings.defaultTemplate || "mushaf-focus");
		if (backgroundParam) setSelectedBg(backgroundParam);

		// Fetch metadata
		const loadMeta = async () => {
			try {
				const [sRes, rRes, tRes, bRes, iRes, aRes] = await Promise.all([
					fetch("/api/surahs"),
					fetch("/api/reciters"),
					fetch("/api/templates"),
					fetch("/api/backgrounds"),
					fetch("/api/instagram/status"),
					fetch("/api/automation/status"),
				]);
				if (sRes.ok) setSurahs(await sRes.json());
				if (rRes.ok) {
					const d = await rRes.json();
					const list = d.reciters || [];
					setReciters(list);
					if (list.length > 0) {
						const preferredId = reciterParam || savedSettings.defaultReciter || "ea-dossari";
						setSelectedReciter((prev: any) => prev || list.find((r: any) => r.id === preferredId) || list[0]);
					}
				}
				if (tRes.ok) setTemplates(await tRes.json());
				if (bRes.ok) {
					const bgs = await bRes.json();
					setBackgrounds(bgs);
					if (bgs.length > 0) setSelectedBg((prev) => prev || bgs[0].filename);
				}
				if (iRes.ok) {
					const instagram = await iRes.json();
					setInstagramConnected(Boolean(instagram.connected));
					setInstagramUsername(instagram.username || "");
				}
				if (aRes.ok) setAutomaticStatus(await aRes.json());
			} catch (e) {}
		};
		loadMeta();
	}, [searchParams]);

	useEffect(() => {
		const timer = setInterval(async () => {
			try {
				const response = await fetch("/api/automation/status", { cache: "no-store" });
				if (response.ok) setAutomaticStatus(await response.json());
			} catch {}
		}, 1500);
		return () => clearInterval(timer);
	}, []);

	useEffect(() => {
		if (!selectedReciter?.id) return;
		try {
			const settings = JSON.parse(localStorage.getItem("studio_settings") || "{}");
			localStorage.setItem("studio_settings", JSON.stringify({ ...settings, defaultReciter: selectedReciter.id }));
		} catch {
			localStorage.setItem("studio_settings", JSON.stringify({ defaultReciter: selectedReciter.id }));
		}
	}, [selectedReciter?.id]);

	useEffect(() => setBackgroundStartSeconds(0), [selectedBg]);

	// Fetch Verses & Segments whenever selection changes
	useEffect(() => {
		const count = Math.max(1, verseEnd - verseStart + 1);
		let cancelled = false;

		const loadVersesAndSegments = async () => {
			try {
				const vRes = await fetch(`/api/verses?surah=${selectedSurah}&chapter=${selectedSurah}&from=${verseStart}&count=${count}&translation=85`);
				if (vRes.ok) {
					const data = await vRes.json();
					if (cancelled) return;
					setCachedChapter(data.chapter);
					setCachedVerses(data.verses || []);
				}

				const sRes = await fetch("/api/quran/segments-preview", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						surah: selectedSurah,
						verseStart,
						verseCount: count,
						syncMode,
					}),
				});
				if (sRes.ok) {
					const sData = await sRes.json();
					if (cancelled) return;
					setCurrentSegments(sData.segments || []);
				}
			} catch (e) {}
		};

		loadVersesAndSegments();
		return () => { cancelled = true; };
	}, [selectedSurah, verseStart, verseEnd, syncMode]);

	// Redraw 9:16 Canvas
	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		const W = 1080;
		const H = 1920;

		const bgToUse = selectedBg === "auto" ? (backgrounds[0]?.filename || "Quran-on-Wooden-Surface.png") : selectedBg;
		const bgObj = backgrounds.find((b) => b.filename === bgToUse);
		const paintBackground = (source: CanvasImageSource) => {
			ctx.drawImage(source, 0, 0, W, H);
			ctx.fillStyle = "rgba(0, 0, 0, 0.48)";
			ctx.fillRect(0, 0, W, H);
			drawPreviewText(ctx, W, H);
		};
		if (bgObj) {
			if (bgObj.isVideo) {
				const video = document.createElement("video");
				video.crossOrigin = "anonymous";
				video.muted = true;
				video.src = bgObj.url;
				video.onloadeddata = () => {
					video.currentTime = Math.min(backgroundStartSeconds, Math.max(0, video.duration - 0.1));
					if (backgroundStartSeconds === 0) paintBackground(video);
				};
				video.onseeked = () => paintBackground(video);
			} else {
				const img = new Image();
				img.crossOrigin = "anonymous";
				img.src = bgObj.url;
				img.onload = () => paintBackground(img);
			}
		} else {
			const grad = ctx.createLinearGradient(0, 0, 0, H);
			grad.addColorStop(0, "#0f172a");
			grad.addColorStop(1, "#020617");
			ctx.fillStyle = grad;
			ctx.fillRect(0, 0, W, H);
			drawPreviewText(ctx, W, H);
		}
	}, [
		cachedChapter,
		cachedVerses,
		selectedReciter,
		selectedBg,
		backgroundStartSeconds,
		showTranslation,
		showSurahHeader,
		showReciterTag,
		backgrounds,
	]);

	const drawPreviewText = (ctx: CanvasRenderingContext2D, W: number, H: number) => {
		if (!cachedChapter || cachedVerses.length === 0) return;
		ctx.textAlign = "center";

		// 1. Header (Arabic Surah Only)
		if (showSurahHeader) {
			ctx.font = "bold 58px 'Readex Pro', 'Segoe UI', Arial, sans-serif";
			ctx.fillStyle = "#ffffff";
			ctx.shadowColor = "rgba(0, 0, 0, 0.8)";
			ctx.shadowBlur = 12;
			ctx.fillText(`سورة ${cachedChapter.name_arabic}`, W / 2, 210);
		}

		// 2. Reciter Tag (Enlarged)
		if (showReciterTag && selectedReciter) {
			ctx.font = "bold 38px 'Readex Pro', 'Segoe UI', Arial, sans-serif";
			ctx.fillStyle = "#e0e0e0";
			ctx.shadowColor = "rgba(0, 0, 0, 0.8)";
			ctx.shadowBlur = 10;
			ctx.fillText(`القارئ: ${selectedReciter.nameArabic}`, W / 2, 285);
		}

		// 3. Verse Arabic with Scheherazade New Font
		const currentVerse = cachedVerses[0];
		ctx.font = "bold 74px 'Scheherazade New', 'Amiri', serif";
		ctx.fillStyle = "#ffffff";
		ctx.shadowColor = "rgba(0, 0, 0, 0.9)";
		ctx.shadowBlur = 16;

		const words = currentVerse.text_uthmani.split(" ");
		const lines: string[] = [];
		let curLine = "";
		for (const w of words) {
			if ((curLine + " " + w).length > 26) {
				lines.push(curLine.trim());
				curLine = w;
			} else {
				curLine += " " + w;
			}
		}
		if (curLine) lines.push(curLine.trim());

		let startY = 920 - lines.length * 48;
		for (const line of lines) {
			ctx.fillText(line, W / 2, startY);
			startY += 105;
		}

		// 4. Translation Subtitle (Non-bold, 42px)
		if (showTranslation && currentVerse.translations?.[0]?.text) {
			ctx.font = "42px 'Outfit', 'Segoe UI', Arial, sans-serif";
			ctx.fillStyle = "#f0f0f0";
			ctx.shadowColor = "rgba(0, 0, 0, 0.95)";
			ctx.shadowBlur = 10;

			const transWords = currentVerse.translations[0].text.split(" ");
			const tLines: string[] = [];
			let tCur = "";
			for (const tw of transWords) {
				if ((tCur + " " + tw).length > 32) {
					tLines.push(tCur.trim());
					tCur = tw;
				} else {
					tCur += " " + tw;
				}
			}
			if (tCur) tLines.push(tCur.trim());

			let tY = 1600;
			for (const tl of tLines) {
				ctx.fillText(tl, W / 2, tY);
				tY += 60;
			}
		}

		// 5. Instagram Branding
		ctx.font = "bold 36px 'Readex Pro', 'Segoe UI', Arial, sans-serif";
		ctx.fillStyle = "#ffffff";
		ctx.shadowColor = "rgba(0, 0, 0, 0.85)";
		ctx.shadowBlur = 10;
		ctx.direction = "ltr";
		ctx.fillText("📸 @Khair_qur", W / 2, 1800);
	};

	const handleAudioToggle = () => {
		if (!selectedReciter) return;
		if (isPlayingAudio) {
			audioRef.current?.pause();
			setIsPlayingAudio(false);
		} else {
			if (!audioRef.current) {
				audioRef.current = new Audio();
				audioRef.current.onended = () => setIsPlayingAudio(false);
			}
			audioRef.current.src = `/api/reciters/${selectedReciter.id}/preview`;
			audioRef.current.play();
			setIsPlayingAudio(true);
		}
	};

	const handleBackgroundUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
		const input = event.currentTarget;
		const file = input.files?.[0];
		if (!file) return;

		try {
			setIsUploadingBackground(true);
			const formData = new FormData();
			formData.append("file", file);
			const uploadResponse = await fetch("/api/backgrounds/upload", { method: "POST", body: formData });
			const upload = await uploadResponse.json();
			if (!uploadResponse.ok) throw new Error(upload.error || "فشل رفع الفيديو");

			const backgroundsResponse = await fetch("/api/backgrounds");
			if (!backgroundsResponse.ok) throw new Error("تم الرفع لكن تعذر تحديث المكتبة");
			setBackgrounds(await backgroundsResponse.json());
			setSelectedBg(upload.filename);
		} catch (error: any) {
			alert(error.message || "فشل رفع الفيديو");
		} finally {
			setIsUploadingBackground(false);
			input.value = "";
		}
	};

	const handleRandomReciter = () => {
		const choices = reciters.filter((reciter) => reciter.id !== selectedReciter?.id);
		if (!choices.length) return;
		audioRef.current?.pause();
		setIsPlayingAudio(false);
		const random = crypto.getRandomValues(new Uint32Array(1))[0];
		setSelectedReciter(choices[random % choices.length]);
	};

	const handleRandomAyahs = async () => {
		try {
			const response = await fetch(`/api/reels/random-ayah?count=${count}`);
			const selection = await response.json();
			if (!response.ok) throw new Error(selection.error || "تعذر اختيار آيات عشوائية");
			setSelectedSurah(selection.surah);
			setVerseStart(selection.verseStart);
			setVerseEnd(selection.verseStart + count - 1);
		} catch (error: any) {
			alert(error.message || "تعذر اختيار آيات عشوائية");
		}
	};

	const handleAutomaticToggle = async () => {
		if (!automaticStatus.enabled && !confirm("سيستمر إنشاء الريلز ونشرها على Instagram واحداً بعد الآخر حتى تضغط إيقاف. هل تريد التشغيل؟")) return;
		setAutomaticBusy(true);
		try {
			const response = await fetch(automaticStatus.enabled ? "/api/automation/stop" : "/api/automation/start", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ verseCount: count }),
			});
			const status = await response.json();
			if (!response.ok) throw new Error(status.error || "تعذر تغيير التشغيل التلقائي");
			setAutomaticStatus(status);
		} catch (error: any) {
			alert(error.message || "تعذر تغيير التشغيل التلقائي");
		} finally {
			setAutomaticBusy(false);
		}
	};

	const handleStartRender = async () => {
		try {
			setInstagramMediaId("");
			setInstagramPublishError("");
			setIsRendering(true);
			setRenderProgress(5);
			setRenderStageText("جاري إرسال المهمة لطابور الرندر...");

			const count = Math.max(1, verseEnd - verseStart + 1);
			const res = await fetch("/api/reels/create", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					surah: selectedSurah,
					verseStart,
					verseCount: count,
					reciterId: selectedReciter?.id || "ea-dossari",
					templateId: selectedTemplate,
					background: selectedBg,
					backgroundStartSeconds,
					syncMode,
					showTranslation,
					showSurahArabic: showSurahHeader,
					showReciter: showReciterTag,
				}),
			});

			const job = await res.json();
			if (job.error) throw new Error(job.error);

			// Real-time polling
			const timer = setInterval(async () => {
				try {
					const qRes = await fetch("/api/reels/queue");
					if (!qRes.ok) return;
					const queue = await qRes.json();
					const active = queue.find((j: any) => j.id === job.id);

					if (active) {
						setRenderProgress(active.progress || 5);
						setRenderStageText(active.stageTextArabic || "جاري المعالجة...");
					} else {
						// Finished, fetch history
						const hRes = await fetch("/api/reels/history");
						if (!hRes.ok) return;
						const hist = await hRes.json();
						const finished = hist.find((j: any) => j.id === job.id);
						if (finished) {
							clearInterval(timer);
							if (finished.status === "completed") {
								setRenderProgress(100);
								let publishedDirectly = false;
								if (publishToInstagram) {
									setRenderStageText("جاري رفع الريل ونشره على Instagram...");
									try {
										const publishResult = await publishInstagramJob(
											finished.id,
											instagramCaption.trim() || buildInstagramCaption(finished)
										);
										setInstagramMediaId(publishResult.mediaId || "published");
										setRenderStageText("تم إنشاء الريل ونشره على Instagram");
										publishedDirectly = true;
									} catch (error: any) {
										setInstagramPublishError(error.message);
										setRenderStageText("تم إنشاء الريل، لكن تعذر نشره على Instagram");
									}
								} else {
									setRenderStageText("✨ تم إنتاج الريل بنجاح!");
								}
								setIsRendering(false);
								if (!publishedDirectly) setCompletedJob(finished);
							} else {
								setIsRendering(false);
								alert("فشل الإنشاء: " + (finished.error || "خطأ أثناء المعالجة"));
							}
						}
					}
				} catch (e) {
					console.warn("Poll error:", e);
				}
			}, 600);
		} catch (err: any) {
			alert("فشل بدء الإنشاء: " + err.message);
			setIsRendering(false);
		}
	};

	const count = Math.max(1, verseEnd - verseStart + 1);
	const selectedBackground = backgrounds.find((background) => background.filename === selectedBg);

	return (
		<>
			<TopNavbar title="استوديو إنتاج ريلز القرآن" />

			<div className="content-body studio-grid">
				{/* Left Column: 5 Steps Flow */}
				<div style={{ display: "flex", flexDirection: "column", gap: "24px", minWidth: 0 }}>
					{/* Step 1: Surah & Verses */}
					<div className="glass-card">
						<h3 style={{ fontSize: "1.1rem", color: "#fff", marginBottom: "16px", display: "flex", alignItems: "center", gap: "10px" }}>
							<span style={{ width: "28px", height: "28px", borderRadius: "50%", background: "var(--gold-primary)", color: "#000", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "0.9rem", fontWeight: "bold" }}>1</span>
							<span>السورة والآيات</span>
						</h3>

						<div className="form-group">
							<label>اختر السورة الكريمة</label>
							<select
								className="form-control"
								value={selectedSurah}
								onChange={(e) => {
									const newId = parseInt(e.target.value, 10);
									setSelectedSurah(newId);
									setVerseStart(1);
									const sObj = surahs.find((s) => s.id === newId);
									const maxV = sObj?.verses_count || 5;
									setVerseEnd(Math.min(5, maxV));
								}}
							>
								{surahs.map((s) => (
									<option key={s.id} value={s.id}>
										{s.id} - سورة {s.name_arabic} ({s.name_simple}) • {s.verses_count} آية
									</option>
								))}
							</select>
						</div>

						<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
							<div className="form-group">
								<label>من الآية</label>
								<input
									type="number"
									min={1}
									max={cachedChapter?.verses_count || 286}
									className="form-control"
									value={verseStart}
									onChange={(e) => setVerseStart(Math.max(1, parseInt(e.target.value, 10) || 1))}
								/>
							</div>
							<div className="form-group">
								<label>إلى الآية</label>
								<input
									type="number"
									min={verseStart}
									max={cachedChapter?.verses_count || 286}
									className="form-control"
									value={verseEnd}
									onChange={(e) => setVerseEnd(Math.min(cachedChapter?.verses_count || 286, Math.max(verseStart, parseInt(e.target.value, 10) || 1)))}
								/>
							</div>
						</div>

						{/* Quick Chips */}
						<div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "14px" }}>
							{[1, 3, 5, 7].map((num) => (
								<button
									key={num}
									type="button"
									className={`btn btn-sm ${count === num ? "btn-primary" : "btn-secondary"}`}
									onClick={() => {
										const maxV = cachedChapter?.verses_count || 286;
										setVerseEnd(Math.min(maxV, verseStart + num - 1));
									}}
								>
									{num} آيات
								</button>
							))}
							<button
								type="button"
								className="btn btn-sm btn-secondary"
								onClick={() => {
									setVerseStart(1);
									setVerseEnd(cachedChapter?.verses_count || 10);
								}}
							>
								السورة كاملة 📖
							</button>
						</div>

						{/* Live Quran Verses Display with Scheherazade New */}
						{cachedVerses.length > 0 && (
							<div
								style={{
									padding: "16px 18px",
									background: "rgba(10, 14, 23, 0.85)",
									borderRadius: "var(--radius-md)",
									border: "1px solid rgba(212, 175, 55, 0.25)",
								}}
							>
								<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
									<span style={{ fontSize: "0.9rem", color: "var(--gold-light)", display: "flex", alignItems: "center", gap: "6px", fontWeight: 600 }}>
										<BookOpen size={16} />
										<span>نصوص الآيات المحددة ({cachedVerses.length} من أصل {count} آيات):</span>
									</span>
									<span style={{ fontSize: "0.78rem", color: "var(--text-dim)" }}>
										من الآية {verseStart} إلى {verseEnd}
									</span>
								</div>

								<div className="custom-scrollbar" style={{ display: "flex", flexDirection: "column", gap: "10px", maxHeight: "420px", overflowY: "auto", paddingLeft: "4px" }}>
									{cachedVerses.map((v) => (
										<div
											key={v.id || v.verse_number}
											style={{
												padding: "12px 16px",
												background: "rgba(255, 255, 255, 0.03)",
												borderRadius: "10px",
												borderRight: "3px solid var(--gold-primary)",
											}}
										>
											<div
												className="quran-text"
												style={{
													fontFamily: "'Scheherazade New', 'Amiri', serif",
													fontSize: "1.45rem",
													lineHeight: 2.2,
													color: "#ffffff",
													textAlign: "right",
												}}
											>
												{v.text_uthmani}{" "}
												<span style={{ color: "var(--gold-light)", fontSize: "1.25rem", fontFamily: "'Scheherazade New', serif" }}>
													﴿{toArabicNumerals(v.verse_number)}﴾
												</span>
											</div>
											{v.translations?.[0]?.text && (
												<p dir="ltr" style={{ color: "var(--text-muted)", fontSize: "0.82rem", marginTop: "6px", textAlign: "left", fontFamily: "'Outfit', sans-serif" }}>
													{v.translations[0].text}
												</p>
											)}
										</div>
									))}
								</div>
							</div>
						)}
					</div>

					{/* Step 2: Reciter */}
					<div className="glass-card">
						<h3 style={{ fontSize: "1.1rem", color: "#fff", marginBottom: "16px", display: "flex", alignItems: "center", gap: "10px" }}>
							<span style={{ width: "28px", height: "28px", borderRadius: "50%", background: "var(--gold-primary)", color: "#000", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "0.9rem", fontWeight: "bold" }}>2</span>
							<span>القارئ والتلاوة</span>
						</h3>

						<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--bg-input)", padding: "16px", borderRadius: "var(--radius-md)", border: "1px solid var(--border-light)" }}>
							<div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
								<div style={{ width: "44px", height: "44px", borderRadius: "10px", background: "rgba(212, 175, 55, 0.15)", border: "1px solid rgba(212, 175, 55, 0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.5rem" }}>
									{selectedReciter?.countryCode === "IQ" ? "🇮🇶" : selectedReciter?.countryCode === "SA" ? "🇸🇦" : selectedReciter?.countryCode === "EG" ? "🇪🇬" : "🎙️"}
								</div>
								<div>
									<h4 style={{ color: "#fff", fontSize: "1.05rem" }}>{selectedReciter?.nameArabic || "جاري التحميل..."}</h4>
									<p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
										{selectedReciter?.countryArabic} • {selectedReciter?.qiraat || "حفص عن عاصم"} • تلاوة خاشعة
									</p>
								</div>
							</div>

							<div style={{ display: "flex", gap: "8px" }}>
								<button type="button" className="btn btn-secondary btn-sm" onClick={handleAudioToggle}>
									{isPlayingAudio ? <Pause size={16} /> : <Play size={16} />}
									<span>{isPlayingAudio ? "إيقاف" : "استماع"}</span>
								</button>
								<button type="button" className="btn btn-outline btn-sm" onClick={() => setShowReciterModal(true)}>
									تغيير القارئ ↻
								</button>
							</div>
						</div>
					</div>

					{/* Step 3: Template & Background */}
					<div className="glass-card">
						<h3 style={{ fontSize: "1.1rem", color: "#fff", marginBottom: "16px", display: "flex", alignItems: "center", gap: "10px" }}>
							<span style={{ width: "28px", height: "28px", borderRadius: "50%", background: "var(--gold-primary)", color: "#000", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "0.9rem", fontWeight: "bold" }}>3</span>
							<span>القالب والخلفية</span>
						</h3>

						<div className="form-group">
							<label>نمط القالب والتصميم</label>
							<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "10px" }}>
								{templates.map((tpl) => (
									<div
										key={tpl.id}
										onClick={() => setSelectedTemplate(tpl.id)}
										style={{
											padding: "12px",
											borderRadius: "var(--radius-md)",
											background: selectedTemplate === tpl.id ? "rgba(212, 175, 55, 0.15)" : "var(--bg-input)",
											border: selectedTemplate === tpl.id ? "1.5px solid var(--gold-primary)" : "1px solid var(--border-light)",
											cursor: "pointer",
											textAlign: "center",
										}}
									>
										<strong style={{ color: "#fff", fontSize: "0.88rem", display: "block", marginBottom: "4px" }}>
											{tpl.nameArabic}
										</strong>
										<span style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>{tpl.nameEnglish}</span>
									</div>
								))}
							</div>
						</div>

						<div className="form-group">
							<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: "8px" }}>
								<label style={{ margin: 0 }}>
									الخلفية الحالية:{" "}
									<strong style={{ color: selectedBg === "auto" ? "var(--emerald)" : "var(--gold-light)" }}>
										{selectedBg === "auto" ? "🎲 تلقائي (اختيار عشوائي عند الإنتاج)" : backgrounds.find((b) => b.filename === selectedBg)?.name || selectedBg}
									</strong>
								</label>
								<div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
									<label className="btn btn-primary btn-sm" style={{ cursor: isUploadingBackground ? "wait" : "pointer", padding: "4px 10px", fontSize: "0.8rem", gap: "4px" }}>
										<Upload size={14} />
										<span>{isUploadingBackground ? "جاري رفع الفيديو..." : "رفع فيديو من جهازي"}</span>
										<input
											type="file"
											accept="video/mp4,video/webm,video/quicktime"
											onChange={handleBackgroundUpload}
											disabled={isUploadingBackground}
											style={{ display: "none" }}
										/>
									</label>
									<button
										type="button"
										className="btn btn-outline btn-sm"
										onClick={() => setShowBgModal(true)}
										style={{ padding: "4px 10px", fontSize: "0.8rem", gap: "4px" }}
									>
										<ImageIcon size={14} />
										<span>تصفح كل الخلفيات ({backgrounds.length}+) 🖼️</span>
									</button>
								</div>
							</div>

							<div style={{ display: "flex", gap: "10px", overflowX: "auto", paddingBottom: "10px", scrollbarWidth: "thin" }}>
								{/* Auto Random Option */}
								<div
									onClick={() => setSelectedBg("auto")}
									style={{
										minWidth: "85px",
										height: "120px",
										borderRadius: "10px",
										background: selectedBg === "auto" ? "linear-gradient(135deg, rgba(212, 175, 55, 0.35), rgba(16, 185, 129, 0.25))" : "var(--bg-input)",
										border: selectedBg === "auto" ? "2px solid var(--gold-primary)" : "1px solid var(--border-light)",
										cursor: "pointer",
										display: "flex",
										flexDirection: "column",
										alignItems: "center",
										justifyContent: "center",
										gap: "6px",
										padding: "8px",
										textAlign: "center",
										boxShadow: selectedBg === "auto" ? "0 0 15px rgba(212, 175, 55, 0.3)" : "none",
										transition: "all 0.2s",
									}}
								>
									<Dices size={24} color={selectedBg === "auto" ? "var(--gold-light)" : "var(--text-muted)"} />
									<strong style={{ fontSize: "0.78rem", color: selectedBg === "auto" ? "#fff" : "var(--text-muted)", lineHeight: 1.2 }}>
										تلقائي
									</strong>
									<span style={{ fontSize: "0.68rem", color: "var(--emerald)", background: "rgba(16, 185, 129, 0.15)", padding: "1px 6px", borderRadius: "6px" }}>
										عشوائي 🎲
									</span>
								</div>

								{/* All Backgrounds */}
								{backgrounds.map((bg) => (
									<div
										key={bg.filename}
										onClick={() => setSelectedBg(bg.filename)}
										title={bg.name}
										style={{
											minWidth: "80px",
											height: "120px",
											borderRadius: "10px",
											overflow: "hidden",
											border: selectedBg === bg.filename ? "2.5px solid var(--gold-primary)" : "1px solid var(--border-light)",
											cursor: "pointer",
											position: "relative",
											boxShadow: selectedBg === bg.filename ? "0 0 15px rgba(212, 175, 55, 0.35)" : "none",
											transition: "transform 0.15s, border-color 0.15s",
										}}
									>
										{bg.isVideo ? (
											<video src={bg.url} muted preload="metadata" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
										) : (
											<img src={bg.url} alt={bg.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
										)}
										{selectedBg === bg.filename && (
											<div style={{ position: "absolute", top: "4px", right: "4px", background: "var(--gold-primary)", color: "#000", width: "18px", height: "18px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.7rem", fontWeight: "bold" }}>
												✓
											</div>
										)}
										<div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "linear-gradient(transparent, rgba(0,0,0,0.85))", padding: "6px 4px 2px", fontSize: "0.65rem", color: "#fff", textAlign: "center", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
											{bg.name}
										</div>
									</div>
								))}
							</div>

							{selectedBackground?.isVideo && (
								<div style={{ marginTop: "12px", padding: "12px", borderRadius: "var(--radius-md)", background: "var(--bg-input)", border: "1px solid var(--border-light)" }}>
									<video
										ref={backgroundVideoRef}
										src={selectedBackground.url}
										controls
										muted
										playsInline
										preload="metadata"
										onLoadedMetadata={(event) => {
											event.currentTarget.currentTime = Math.min(backgroundStartSeconds, Math.max(0, event.currentTarget.duration - 0.1));
										}}
										onPause={(event) => setBackgroundStartSeconds(Number(event.currentTarget.currentTime.toFixed(2)))}
										onSeeked={(event) => setBackgroundStartSeconds(Number(event.currentTarget.currentTime.toFixed(2)))}
										style={{ width: "100%", maxHeight: "280px", borderRadius: "10px", background: "#000" }}
									/>
									<p style={{ margin: "8px 0 0", color: "var(--text-muted)", fontSize: "0.82rem", lineHeight: 1.7 }}>
										حرّك الفيديو إلى نقطة البداية المطلوبة ثم أوقفه. البداية الحالية: {backgroundStartSeconds.toFixed(2)} ثانية، والنهاية تُحدَّد تلقائياً حسب طول التلاوة. صوت الفيديو الأصلي مكتوم.
									</p>
								</div>
							)}
						</div>
					</div>

					{/* Step 4: Text Synchronization */}
					<div className="glass-card">
						<h3 style={{ fontSize: "1.1rem", color: "#fff", marginBottom: "16px", display: "flex", alignItems: "center", gap: "10px" }}>
							<span style={{ width: "28px", height: "28px", borderRadius: "50%", background: "var(--gold-primary)", color: "#000", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "0.9rem", fontWeight: "bold" }}>4</span>
							<span>مزامنة النص القرآني والترجمة</span>
						</h3>

						<div className="form-group">
							<label>وضع المزامنة الصوتية (Synchronization Mode)</label>
							<select
								className="form-control"
								value={syncMode}
								onChange={(e) => setSyncMode(e.target.value)}
							>
								<option value="auto">✨ تلقائي (تقسيم المقاطع المتناسقة ذكياً - مستحسن)</option>
								<option value="phrase">⚡ مقاطع متزامنة (Phrase-Level Sync)</option>
								<option value="whole">📜 الآية كاملة (Whole Ayah)</option>
							</select>
						</div>

						<button
							type="button"
							className="btn btn-outline btn-block"
							style={{ marginBottom: "16px", borderStyle: "dashed" }}
							onClick={() => setShowSegmentsModal(true)}
						>
							<Eye size={18} />
							<span>معاينة المقاطع المتزامنة والترجمة ({currentSegments.length > 1 ? `${currentSegments.length} مقاطع` : "مقطع واحد"})</span>
						</button>

						<div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
							<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
								<span style={{ color: "#fff", fontSize: "0.92rem" }}>إظهار الترجمة الإنجليزية (English Subtitles)</span>
								<label className="switch">
									<input type="checkbox" checked={showTranslation} onChange={(e) => setShowTranslation(e.target.checked)} />
									<span className="slider"></span>
								</label>
							</div>

							<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
								<span style={{ color: "#fff", fontSize: "0.92rem" }}>إظهار شريط السورة بالأعلى</span>
								<label className="switch">
									<input type="checkbox" checked={showSurahHeader} onChange={(e) => setShowSurahHeader(e.target.checked)} />
									<span className="slider"></span>
								</label>
							</div>

							<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
								<span style={{ color: "#fff", fontSize: "0.92rem" }}>إظهار اسم القارئ</span>
								<label className="switch">
									<input type="checkbox" checked={showReciterTag} onChange={(e) => setShowReciterTag(e.target.checked)} />
									<span className="slider"></span>
								</label>
							</div>
						</div>
					</div>

					{/* Step 5: Start Render */}
					<div className="glass-card">
						<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
							<span style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>⏱️ المدة التقديرية للريل:</span>
							<strong style={{ color: "var(--gold-light)", fontSize: "1.1rem" }}>
								حوالي {Math.round(count * 6.2)} ثانية ({count} آيات)
							</strong>
						</div>

						<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "16px" }}>
							<button type="button" className="btn btn-secondary" onClick={handleRandomReciter} disabled={isRendering || reciters.length < 2}>
								<Dices size={18} />
								<span>قارئ عشوائي</span>
							</button>
							<button type="button" className="btn btn-secondary" onClick={handleRandomAyahs} disabled={isRendering || !surahs.length}>
								<Dices size={18} />
								<span>آيات عشوائية ({count})</span>
							</button>
						</div>

						<div className={`automatic-reels-card ${automaticStatus.enabled ? "is-running" : ""}`}>
							<div className="automatic-reels-head">
								<div className="automatic-reels-title">
									<span className="automatic-reels-orbit" aria-hidden="true"><Repeat2 size={20} /></span>
									<div>
										<strong>التشغيل التلقائي المستمر</strong>
										<span>Instagram فقط • يتكرر إلى أن توقفه</span>
									</div>
								</div>
								<button
									type="button"
									className={`btn btn-sm ${automaticStatus.enabled ? "btn-secondary" : "btn-primary"}`}
									disabled={automaticBusy || (!instagramConnected && !automaticStatus.enabled)}
									onClick={handleAutomaticToggle}
								>
									{automaticStatus.enabled ? <Square size={15} /> : <Play size={16} />}
									<span>{automaticBusy ? "لحظة..." : automaticStatus.enabled ? "إيقاف" : "تشغيل تلقائي"}</span>
								</button>
							</div>
							<p>كل دورة تختار قارئاً وآيات وخلفية وقالباً عشوائياً، ثم تنشئ الريل وتنشره على Instagram وتبدأ التالي.</p>
							{!instagramConnected && <a className="automatic-reels-link" href="/settings">اربط حساب Instagram أولاً من الإعدادات</a>}
							<div className="automatic-reels-status" aria-live="polite">
								<span className={`automatic-reels-dot ${automaticStatus.enabled ? "is-live" : ""}`} />
								<div>
									<strong>{automaticStatus.message}</strong>
									{automaticStatus.currentSummary && <small>{automaticStatus.currentSummary}</small>}
									{automaticStatus.lastError && <small className="automatic-reels-error">{automaticStatus.lastError}</small>}
								</div>
								<span className="automatic-reels-count">نُشر {automaticStatus.completedCount}</span>
							</div>
						</div>

						<div className={`instagram-publish-option ${publishToInstagram ? "is-enabled" : ""}`}>
							<div className="instagram-publish-heading">
								<div><Camera size={20} /><span>النشر المباشر على Instagram</span></div>
								<label className="switch" title={instagramConnected ? "نشر تلقائي بعد الإنشاء" : "اربط الحساب من الإعدادات أولًا"}>
									<input
										type="checkbox"
										checked={publishToInstagram}
										disabled={!instagramConnected || isRendering || automaticStatus.enabled}
										onChange={(event) => setPublishToInstagram(event.target.checked)}
									/>
									<span className="slider"></span>
								</label>
							</div>
							{instagramConnected ? (
								<p>مربوط بالحساب <strong>@{instagramUsername || "Instagram"}</strong>. عند التفعيل يُنشر الريل تلقائيًا بعد اكتمال الرندر.</p>
							) : (
								<p>الحساب غير مربوط. <a href="/settings">افتح الإعدادات لربط Instagram</a></p>
							)}
							{publishToInstagram && (
								<div className="form-group" style={{ margin: "12px 0 0" }}>
									<label htmlFor="instagram-caption">الكابشن (اختياري)</label>
									<textarea
										id="instagram-caption"
										className="form-control"
										rows={4}
										maxLength={2200}
										value={instagramCaption}
										onChange={(event) => setInstagramCaption(event.target.value)}
										placeholder="اتركه فارغًا حتى تُنشئ الأداة كابشن مناسب للسورة والقارئ تلقائيًا"
									/>
									<small style={{ color: "var(--text-dim)" }}>{instagramCaption.length}/2200</small>
								</div>
							)}
							{instagramMediaId && <div className="instagram-message">تم نشر الريل مباشرة على Instagram بنجاح ✅</div>}
						</div>

						{isRendering && (
							<div style={{ background: "var(--bg-input)", padding: "16px", borderRadius: "var(--radius-md)", border: "1px solid var(--border-color)", marginBottom: "16px" }}>
								<div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
									<span style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>{renderStageText}</span>
									<strong style={{ color: "var(--emerald)", fontSize: "0.95rem" }}>{renderProgress}%</strong>
								</div>
								<div className="progress-bar-wrap">
									<div className="progress-bar-fill" style={{ width: `${renderProgress}%` }}></div>
								</div>
							</div>
						)}

						<button
							type="button"
							className="btn btn-primary btn-lg btn-block"
							disabled={isRendering || automaticStatus.enabled}
							onClick={handleStartRender}
						>
							<Rocket size={20} />
							<span>{isRendering ? "جاري المعالجة بواسطة FFmpeg..." : "🚀 بدء إنشاء الريل (1080x1920 MP4)"}</span>
						</button>
					</div>
				</div>

				{/* Right Column: 9:16 Canvas Phone Frame Preview */}
				<div className="studio-preview-col">
					<div style={{ textAlign: "center", marginBottom: "12px" }}>
						<h3 style={{ fontSize: "1.05rem", color: "#fff" }}>معاينة الشاشة الرأسية (9:16)</h3>
						<span style={{ fontSize: "0.78rem", color: "var(--text-dim)" }}>تحديث حي ومباشر للمحتوى والتصميم</span>
					</div>

					<div className="phone-mockup">
						<canvas ref={canvasRef} width={1080} height={1920} />
					</div>
				</div>
			</div>

			{/* Reciters Selector Modal */}
			{showReciterModal && (
				<div className="modal-backdrop" onClick={() => setShowReciterModal(false)}>
					<div className="modal-card modal-lg" onClick={(e) => e.stopPropagation()}>
						<div className="modal-header">
							<h3>🎙️ اختيار القارئ (قراء العراق والعالم)</h3>
							<button className="btn btn-secondary btn-sm" onClick={() => setShowReciterModal(false)}>
								<X size={18} />
							</button>
						</div>
						<div className="modal-body" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "14px" }}>
							{reciters.map((r) => (
								<div
									key={r.id}
									style={{
										padding: "16px",
										borderRadius: "var(--radius-md)",
										background: selectedReciter?.id === r.id ? "rgba(212, 175, 55, 0.15)" : "var(--bg-input)",
										border: selectedReciter?.id === r.id ? "1.5px solid var(--gold-primary)" : "1px solid var(--border-light)",
										display: "flex",
										justifyContent: "space-between",
										alignItems: "center",
									}}
								>
									<div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
										<span style={{ fontSize: "1.5rem" }}>{r.countryCode === "IQ" ? "🇮🇶" : r.countryCode === "SA" ? "🇸🇦" : "🇪🇬"}</span>
										<div>
											<h4 style={{ color: "#fff", fontSize: "0.95rem" }}>{r.nameArabic}</h4>
											<p style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>{r.countryArabic} • {r.style || "مرتل"}</p>
										</div>
									</div>
									<button
										type="button"
										className="btn btn-primary btn-sm"
										onClick={() => {
											setSelectedReciter(r);
											setShowReciterModal(false);
										}}
									>
										اختيار ✓
									</button>
								</div>
							))}
						</div>
					</div>
				</div>
			)}

			{/* Backgrounds Selector Modal */}
			{showBgModal && (
				<div className="modal-backdrop" onClick={() => setShowBgModal(false)}>
					<div className="modal-card modal-lg" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "920px" }}>
						<div className="modal-header">
							<div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
								<ImageIcon size={22} color="var(--gold-light)" />
								<h3 style={{ color: "#fff" }}>مكتبة الخلفيات الكاملة ({backgrounds.length}+ خلفية)</h3>
							</div>
							<button className="btn btn-secondary btn-sm" onClick={() => setShowBgModal(false)}>
								<X size={18} />
							</button>
						</div>

						<div className="modal-body" style={{ maxHeight: "75vh", overflowY: "auto", padding: "20px 24px" }}>
							{/* Filter and Search */}
							<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px", marginBottom: "20px", flexWrap: "wrap" }}>
								{/* Category Tabs */}
								<div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
									{[
										{ id: "all", label: "الكل" },
										{ id: "مصحف وتفاصيل", label: "📖 مصحف وتفاصيل" },
										{ id: "أشخاص وقراءة", label: "👤 أشخاص وقراءة" },
										{ id: "طبيعة وسماء", label: "🌿 طبيعة وسماء" },
										{ id: "إسلامية ومساجد", label: "🕌 مساجد وعمارة" },
									].map((cat) => (
										<button
											key={cat.id}
											type="button"
											className={`btn btn-sm ${bgCategoryFilter === cat.id ? "btn-primary" : "btn-secondary"}`}
											onClick={() => setBgCategoryFilter(cat.id)}
											style={{ padding: "5px 12px", fontSize: "0.82rem" }}
										>
											{cat.label}
										</button>
									))}
								</div>

								{/* Search */}
								<div style={{ position: "relative", minWidth: "220px" }}>
									<Search size={16} color="var(--text-dim)" style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)" }} />
									<input
										type="text"
										className="form-control"
										placeholder="بحث في الخلفيات..."
										value={bgSearchQuery}
										onChange={(e) => setBgSearchQuery(e.target.value)}
										style={{ padding: "8px 36px 8px 12px", fontSize: "0.85rem" }}
									/>
								</div>
							</div>

							{/* Auto Random Banner */}
							<div
								onClick={() => {
									setSelectedBg("auto");
									setShowBgModal(false);
								}}
								style={{
									padding: "14px 18px",
									borderRadius: "var(--radius-md)",
									background: selectedBg === "auto" ? "linear-gradient(135deg, rgba(212, 175, 55, 0.25), rgba(16, 185, 129, 0.2))" : "rgba(255, 255, 255, 0.04)",
									border: selectedBg === "auto" ? "1.5px solid var(--gold-primary)" : "1px solid var(--border-light)",
									display: "flex",
									justifyContent: "space-between",
									alignItems: "center",
									cursor: "pointer",
									marginBottom: "20px",
									transition: "all 0.2s",
								}}
							>
								<div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
									<div style={{ width: "42px", height: "42px", borderRadius: "10px", background: "rgba(212, 175, 55, 0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
										<Dices size={24} color="var(--gold-light)" />
									</div>
									<div>
										<h4 style={{ color: "#fff", fontSize: "0.95rem" }}>🎲 تعيين الخلفية: تلقائي وعشوائي (Auto Random)</h4>
										<p style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>
											يقوم النظام باختيار خلفية عشوائية وتلقائية مناسبة من المكتبة عند إنشاء كل ريل.
										</p>
									</div>
								</div>
								<button type="button" className={`btn btn-sm ${selectedBg === "auto" ? "btn-primary" : "btn-outline"}`}>
									{selectedBg === "auto" ? "محدد حالياً ✓" : "اختيار التلقائي 🎲"}
								</button>
							</div>

							{/* Grid of Backgrounds */}
							<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(135px, 1fr))", gap: "14px" }}>
								{backgrounds
									.filter((b) => {
										if (bgCategoryFilter !== "all" && b.category !== bgCategoryFilter) return false;
										if (bgSearchQuery && !b.name.toLowerCase().includes(bgSearchQuery.toLowerCase())) return false;
										return true;
									})
									.map((bg) => (
										<div
											key={bg.filename}
											onClick={() => {
												setSelectedBg(bg.filename);
												setShowBgModal(false);
											}}
											style={{
												borderRadius: "12px",
												overflow: "hidden",
												background: "var(--bg-input)",
												border: selectedBg === bg.filename ? "2.5px solid var(--gold-primary)" : "1px solid var(--border-light)",
												cursor: "pointer",
												display: "flex",
												flexDirection: "column",
												position: "relative",
												boxShadow: selectedBg === bg.filename ? "0 0 15px rgba(212, 175, 55, 0.35)" : "none",
												transition: "transform 0.15s, border-color 0.15s",
											}}
										>
											<div style={{ height: "180px", position: "relative", overflow: "hidden" }}>
												{bg.isVideo ? (
													<video src={bg.url} muted preload="metadata" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
												) : (
													<img src={bg.url} alt={bg.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
												)}
												{selectedBg === bg.filename && (
													<div style={{ position: "absolute", top: "6px", right: "6px", background: "var(--gold-primary)", color: "#000", width: "22px", height: "22px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.8rem", fontWeight: "bold" }}>
														✓
													</div>
												)}
												<span style={{ position: "absolute", bottom: "6px", right: "6px", background: "rgba(0,0,0,0.7)", color: "var(--gold-light)", fontSize: "0.68rem", padding: "2px 6px", borderRadius: "4px" }}>
													{bg.category || "عام"}
												</span>
											</div>
											<div style={{ padding: "8px", textAlign: "center", background: "rgba(0,0,0,0.4)" }}>
												<p style={{ color: "#fff", fontSize: "0.75rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", margin: 0 }}>
													{bg.name}
												</p>
											</div>
										</div>
									))}
							</div>
						</div>
					</div>
				</div>
			)}

			{/* Segments Preview Modal */}
			{showSegmentsModal && (
				<div className="modal-backdrop" onClick={() => setShowSegmentsModal(false)}>
					<div className="modal-card modal-lg" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "860px" }}>
						<div className="modal-header">
							<div>
								<h3 style={{ color: "#fff", display: "flex", alignItems: "center", gap: "8px" }}>
									<span>🔍 تفاصيل مقاطع التلاوة المتزامنة</span>
									<span style={{ fontSize: "0.8rem", color: "var(--gold-light)", background: "rgba(212, 175, 55, 0.15)", padding: "2px 8px", borderRadius: "12px", border: "1px solid rgba(212, 175, 55, 0.3)" }}>
										Phrase-Level Quran Sync
									</span>
								</h3>
							</div>
							<button className="btn btn-secondary btn-sm" onClick={() => setShowSegmentsModal(false)}>
								<X size={18} />
							</button>
						</div>

						<div className="modal-body" style={{ maxHeight: "75vh", overflowY: "auto", padding: "20px 24px" }}>
							<div style={{ background: "rgba(10, 14, 23, 0.6)", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: "var(--radius-md)", padding: "12px 16px", marginBottom: "20px", display: "flex", alignItems: "center", gap: "10px" }}>
								<span style={{ fontSize: "1.2rem" }}>💡</span>
								<p style={{ color: "var(--text-muted)", fontSize: "0.88rem", margin: 0, lineHeight: 1.5 }}>
									تُقسّم الآيات الطويلة إلى مقاطع صوتية متناسقة تتزامن بدقة مع تلاوة القارئ وترجمتها الإنجليزية، وتظهر علامة نهاية الآية ﴿...﴾ في خاتمة الآية فقط.
								</p>
							</div>

							<div className="segments-list-container" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
								{currentSegments.map((seg, idx) => (
									<div
										key={seg.id || idx}
										className="segment-preview-card"
										style={{
											background: "rgba(15, 23, 42, 0.75)",
											backdropFilter: "blur(12px)",
											border: "1px solid rgba(212, 175, 55, 0.22)",
											borderRadius: "16px",
											padding: "18px 20px",
											boxShadow: "0 4px 20px rgba(0, 0, 0, 0.35)",
											display: "flex",
											flexDirection: "column",
											gap: "12px",
										}}
									>
										{/* Card Header with Badges */}
										<div
											className="segment-card-header"
											style={{
												display: "flex",
												justifyContent: "space-between",
												alignItems: "center",
												flexWrap: "wrap",
												gap: "8px",
												borderBottom: "1px solid rgba(255, 255, 255, 0.07)",
												paddingBottom: "10px",
											}}
										>
											<div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
												<span
													className="segment-num-badge"
													style={{
														display: "inline-flex",
														alignItems: "center",
														gap: "6px",
														padding: "4px 12px",
														borderRadius: "9999px",
														background: "rgba(212, 175, 55, 0.15)",
														border: "1px solid rgba(212, 175, 55, 0.4)",
														color: "var(--gold-light)",
														fontSize: "0.85rem",
														fontWeight: 600,
													}}
												>
													✨ المقطع {idx + 1} من {currentSegments.length} • الآية {seg.ayahNumber}
												</span>

												{seg.totalSegments > 1 && (
													<span
														style={{
															fontSize: "0.75rem",
															color: "var(--text-muted)",
															background: "rgba(255, 255, 255, 0.06)",
															padding: "2px 8px",
															borderRadius: "10px",
														}}
													>
														{seg.hasAyahMarker ? "خاتمة الآية 🏁" : `عبارة ${seg.segmentIndex + 1} من ${seg.totalSegments}`}
													</span>
												)}
											</div>

											<span
												className="segment-time-badge"
												style={{
													display: "inline-flex",
													alignItems: "center",
													gap: "6px",
													padding: "4px 12px",
													borderRadius: "9999px",
													background: "rgba(59, 130, 246, 0.15)",
													border: "1px solid rgba(59, 130, 246, 0.35)",
													color: "#93c5fd",
													fontSize: "0.82rem",
													fontWeight: 500,
													direction: "ltr",
													fontFamily: "monospace",
												}}
											>
												⏱️ {seg.startTime?.toFixed(2)}s → {seg.endTime?.toFixed(2)}s ({seg.duration?.toFixed(1)}s)
											</span>
										</div>

										{/* Arabic Quranic Verse Text in Scheherazade New */}
										<div
											className="segment-arabic-text"
											style={{
												fontFamily: "'Scheherazade New', 'Amiri', serif",
												fontSize: "1.75rem",
												lineHeight: 2.2,
												color: "#ffffff",
												textAlign: "right",
												display: "flex",
												alignItems: "center",
												justifyContent: "space-between",
												flexWrap: "wrap",
												gap: "12px",
												padding: "4px 0",
											}}
										>
											<span className="quran-verse-phrase" style={{ fontFamily: "'Scheherazade New', 'Amiri', serif" }}>
												{seg.arabicText}
											</span>

											{seg.hasAyahMarker ? (
												<span
													className="segment-marker-tag"
													style={{
														display: "inline-flex",
														alignItems: "center",
														gap: "6px",
														padding: "4px 12px",
														borderRadius: "10px",
														background: "rgba(16, 185, 129, 0.15)",
														border: "1px solid rgba(16, 185, 129, 0.4)",
														color: "#34d399",
														fontSize: "0.85rem",
														fontFamily: "'Readex Pro', sans-serif",
														fontWeight: 500,
														whiteSpace: "nowrap",
													}}
												>
													<span style={{ fontFamily: "'Scheherazade New', serif", fontSize: "1.25rem", color: "var(--gold-light)" }}>
														﴿{toArabicNumerals(seg.ayahNumber)}﴾
													</span>
													<span>نهاية الآية</span>
												</span>
											) : (
												<span
													style={{
														display: "inline-flex",
														alignItems: "center",
														gap: "4px",
														padding: "3px 10px",
														borderRadius: "8px",
														background: "rgba(255, 255, 255, 0.05)",
														color: "var(--text-dim)",
														fontSize: "0.78rem",
														fontFamily: "'Readex Pro', sans-serif",
														whiteSpace: "nowrap",
													}}
												>
													⋯ يتبع
												</span>
											)}
										</div>

										{/* English Translation with strict LTR direction */}
										{seg.translationText && (
											<div
												className="segment-trans-text"
												dir="ltr"
												style={{
													direction: "ltr",
													textAlign: "left",
													fontSize: "0.92rem",
													color: "#cbd5e1",
													lineHeight: 1.6,
													background: "rgba(0, 0, 0, 0.35)",
													padding: "10px 14px",
													borderRadius: "10px",
													borderLeft: "3px solid var(--gold-primary)",
													fontFamily: "'Outfit', sans-serif",
												}}
											>
												"{seg.translationText}"
											</div>
										)}
									</div>
								))}
							</div>
						</div>
					</div>
				</div>
			)}

			<PlayerModal
				job={completedJob}
				onClose={() => setCompletedJob(null)}
				initialInstagramMediaId={instagramMediaId}
				initialInstagramError={instagramPublishError}
			/>
		</>
	);
}
