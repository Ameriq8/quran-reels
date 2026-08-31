/**
 * Quran Reels Studio — Client Application
 */

const state = {
	surahs: [],
	reciters: [],
	favorites: [],
	backgrounds: [],
	templates: [],
	settings: {},
	currentView: "dashboard",
	
	// Studio Editor State
	selectedSurah: 1,
	verseStart: 1,
	verseEnd: 7,
	selectedReciter: null,
	selectedTemplate: "mushaf-focus",
	selectedBackground: null,
	showTranslation: true,
	showSurahHeader: true,
	showReciterTag: true,
	
	// Preview data cache
	cachedVerses: [],
	cachedChapter: null,

	// Audio preview
	playingAudioUrl: null,
};

// DOM Elements
const elements = {
	views: document.querySelectorAll(".view"),
	navItems: document.querySelectorAll(".nav-item"),
	pageTitle: document.getElementById("page-title"),
	
	// Dashboard
	statTotalReels: document.getElementById("stat-total-reels"),
	statCompletedReels: document.getElementById("stat-completed-reels"),
	statTotalDuration: document.getElementById("stat-total-duration"),
	statStorageUsed: document.getElementById("stat-storage-used"),
	quickSurahSelect: document.getElementById("quick-surah-select"),
	quickVerseStart: document.getElementById("quick-verse-start"),
	quickVerseCount: document.getElementById("quick-verse-count"),
	quickReciterSelect: document.getElementById("quick-reciter-select"),
	quickTemplateSelect: document.getElementById("quick-template-select"),
	quickGenerateBtn: document.getElementById("quick-generate-btn"),
	queueJobsContainer: document.getElementById("queue-jobs-container"),
	queueStatusBadge: document.getElementById("queue-status-badge"),
	dashboardRecentReels: document.getElementById("dashboard-recent-reels"),
	
	// Studio View
	studioSurahSelect: document.getElementById("studio-surah-select"),
	studioVerseStart: document.getElementById("studio-verse-start"),
	studioVerseEnd: document.getElementById("studio-verse-end"),
	presetChips: document.querySelectorAll(".preset-chip"),
	selReciterAvatar: document.getElementById("sel-reciter-avatar"),
	selReciterName: document.getElementById("sel-reciter-name"),
	selReciterInfo: document.getElementById("sel-reciter-info"),
	previewAudioBtn: document.getElementById("preview-audio-btn"),
	openReciterModalBtn: document.getElementById("open-reciter-modal-btn"),
	templateOptionsContainer: document.getElementById("template-options-container"),
	bgMiniCarousel: document.getElementById("bg-mini-carousel"),
	openBgModalBtn: document.getElementById("open-bg-modal-btn"),
	toggleTranslation: document.getElementById("toggle-translation"),
	toggleSurahHeader: document.getElementById("toggle-surah-header"),
	toggleReciterTag: document.getElementById("toggle-reciter-tag"),
	studioSyncMode: document.getElementById("studio-sync-mode"),
	btnPreviewSegments: document.getElementById("btn-preview-segments"),
	segmentsCountBadge: document.getElementById("segments-count-badge"),
	estimatedDurationText: document.getElementById("estimated-duration-text"),
	studioRenderBtn: document.getElementById("studio-render-btn"),
	studioProgressBox: document.getElementById("studio-progress-box"),
	studioProgressFill: document.getElementById("studio-progress-fill"),
	studioProgressText: document.getElementById("studio-progress-text"),
	studioProgressPercent: document.getElementById("studio-progress-percent"),
	reelPreviewCanvas: document.getElementById("reel-preview-canvas"),
	
	// Modals & Drawers
	reciterModal: document.getElementById("reciter-modal"),
	closeReciterModal: document.getElementById("close-reciter-modal"),
	modalReciterSearch: document.getElementById("modal-reciter-search"),
	modalReciterTabs: document.getElementById("modal-reciter-tabs"),
	modalRecitersContainer: document.getElementById("modal-reciters-container"),
	bgModal: document.getElementById("bg-modal"),
	closeBgModal: document.getElementById("close-bg-modal"),
	modalBgContainer: document.getElementById("modal-bg-container"),
	videoPlayerModal: document.getElementById("video-player-modal"),
	closePlayerModal: document.getElementById("close-player-modal"),
	segmentsPreviewModal: document.getElementById("segments-preview-modal"),
	closeSegmentsModal: document.getElementById("close-segments-modal"),
	segmentsPreviewList: document.getElementById("segments-preview-list"),
	
	bgModal: document.getElementById("bg-modal"),
	closeBgModal: document.getElementById("close-bg-modal"),
	modalBgContainer: document.getElementById("modal-bg-container"),
	
	videoPlayerModal: document.getElementById("video-player-modal"),
	closePlayerModal: document.getElementById("close-player-modal"),
	playerVideoElement: document.getElementById("player-video-element"),
	playerModalTitle: document.getElementById("player-modal-title"),
	playerDownloadBtn: document.getElementById("player-download-btn"),
	copyCaptionBtn: document.getElementById("copy-caption-btn"),
	captionTextArea: document.getElementById("caption-text-area"),
	
	// Global Audio
	globalPreviewAudio: document.getElementById("global-preview-audio"),
	randomAyahBtn: document.getElementById("random-ayah-btn"),
	headerCreateBtn: document.getElementById("header-create-btn"),
	mobileMenuBtn: document.getElementById("mobile-menu-btn"),
	sidebar: document.querySelector(".sidebar"),
};

// ==================== INITIALIZATION ====================

async function initApp() {
	setupNavigation();
	setupModals();
	setupEventListeners();

	await Promise.all([
		fetchSurahs(),
		fetchReciters(),
		fetchBackgrounds(),
		fetchTemplates(),
		fetchSettings(),
		fetchStats(),
		fetchHistory(),
	]);

	populateDropdowns();
	renderTemplates();
	renderBackgroundsMini();
	renderRecitersCatalog();
	renderBackgroundsGallery();
	
	// Set default selection
	if (state.reciters.length > 0) {
		const defaultReciterId = state.settings.defaultReciter || "iq-raad-alkurdi";
		state.selectedReciter = state.reciters.find((r) => r.id === defaultReciterId) || state.reciters[0];
		updateReciterCardUI();
	}
	if (state.backgrounds.length > 0) {
		state.selectedBackground = state.backgrounds[0].filename;
	}

	await updateStudioVerses();
	startQueuePolling();
}

// ==================== NAVIGATION ====================

function setupNavigation() {
	elements.navItems.forEach((btn) => {
		btn.addEventListener("click", () => {
			const viewName = btn.dataset.view;
			switchView(viewName);
			if (window.innerWidth < 768) {
				elements.sidebar.classList.remove("mobile-open");
			}
		});
	});

	document.getElementById("goto-reels-btn")?.addEventListener("click", () => switchView("reels"));
	elements.headerCreateBtn?.addEventListener("click", () => switchView("create"));
	elements.mobileMenuBtn?.addEventListener("click", () => elements.sidebar.classList.toggle("mobile-open"));
}

function switchView(viewName) {
	state.currentView = viewName;
	
	elements.navItems.forEach((item) => {
		item.classList.toggle("active", item.dataset.view === viewName);
	});

	elements.views.forEach((v) => {
		v.classList.toggle("active", v.id === `view-${viewName}`);
	});

	const titles = {
		dashboard: "لوحة التحكم الرئيسية",
		create: "استوديو إنشاء الريل (Create Studio)",
		reels: "مكتبة الريلز المكتملة",
		reciters: "قائمة القراء (العراق والعالم الإسلامي)",
		backgrounds: "مكتبة الخلفيات الإسلامية والطبيعية",
		templates: "القوالب وأنماط التصميم",
		batch: "الإنشاء المتعدد للسور الكاملة",
		settings: "الإعدادات وإدارة التخزين",
	};

	elements.pageTitle.textContent = titles[viewName] || "استوديو ريلز القرآن";

	if (viewName === "dashboard") {
		fetchStats();
		fetchHistory();
	} else if (viewName === "reels") {
		fetchHistory();
	} else if (viewName === "create") {
		renderCanvasPreview();
	}
}

// ==================== API FETCHERS ====================

async function fetchSurahs() {
	try {
		const res = await fetch("/api/surahs");
		state.surahs = await res.json();
	} catch (e) {
		console.error("Failed to fetch surahs:", e);
	}
}

async function fetchReciters(country = "ALL", q = "") {
	try {
		let url = `/api/reciters?country=${country}`;
		if (q) url += `&q=${encodeURIComponent(q)}`;
		const res = await fetch(url);
		const data = await res.json();
		state.reciters = data.reciters || [];
		state.favorites = data.favorites || [];
	} catch (e) {
		console.error("Failed to fetch reciters:", e);
	}
}

async function fetchBackgrounds() {
	try {
		const res = await fetch("/api/backgrounds");
		state.backgrounds = await res.json();
	} catch (e) {
		console.error("Failed to fetch backgrounds:", e);
	}
}

async function fetchTemplates() {
	try {
		const res = await fetch("/api/templates");
		state.templates = await res.json();
	} catch (e) {
		console.error("Failed to fetch templates:", e);
	}
}

async function fetchSettings() {
	try {
		const res = await fetch("/api/settings");
		state.settings = await res.json();
	} catch (e) {
		console.error("Failed to fetch settings:", e);
	}
}

async function fetchStats() {
	try {
		const res = await fetch("/api/stats");
		const data = await res.json();
		elements.statTotalReels.textContent = data.totalReels;
		elements.statCompletedReels.textContent = data.completedCount;
		elements.statTotalDuration.textContent = data.totalDurationFormatted;
		elements.statStorageUsed.textContent = data.storage?.totalFormatted || "0 MB";

		if (elements.storageAudioCache) {
			elements.storageAudioCache.textContent = data.storage?.audioCacheFormatted || "0 MB";
			elements.storageOutputs.textContent = data.storage?.outputsFormatted || "0 MB";
			elements.storageAssets.textContent = data.storage?.assetsFormatted || "0 MB";
			elements.storageTemp.textContent = data.storage?.tempCacheFormatted || "0 MB";
		}
	} catch (e) {
		console.error("Failed to fetch stats:", e);
	}
}

async function fetchHistory() {
	try {
		const res = await fetch("/api/reels/history");
		const jobs = await res.json();
		renderHistory(jobs);
		renderRecentReelsDashboard(jobs);
		elements.navReelsCount.textContent = jobs.filter((j) => j.status === "completed").length;
	} catch (e) {
		console.error("Failed to fetch history:", e);
	}
}

// ==================== DROPDOWNS & UI POPULATION ====================

function populateDropdowns() {
	// Surah Dropdowns
	const surahOptions = state.surahs.map(
		(s) => `<option value="${s.id}">${s.id} — سورة ${s.name_arabic} (${s.name_simple}) • ${s.verses_count} آيات</option>`
	).join("");

	elements.quickSurahSelect.innerHTML = surahOptions;
	elements.studioSurahSelect.innerHTML = surahOptions;
	elements.batchSurahSelect.innerHTML = surahOptions;

	// Reciter Dropdowns
	const reciterOptions = state.reciters.map(
		(r) => `<option value="${r.id}">${r.countryCode === "IQ" ? "🇮🇶 " : ""}${r.nameArabic} (${r.qiraat || "حفص"})</option>`
	).join("");

	elements.quickReciterSelect.innerHTML = reciterOptions;
	elements.batchReciterSelect.innerHTML = reciterOptions;
	elements.settingDefaultReciter.innerHTML = reciterOptions;

	// Template Dropdown
	const templateOptions = state.templates.map(
		(t) => `<option value="${t.id}">${t.nameArabic}</option>`
	).join("");

	elements.batchTemplateSelect.innerHTML = templateOptions;
	elements.settingDefaultTemplate.innerHTML = templateOptions;
}

function renderTemplates() {
	elements.templateOptionsContainer.innerHTML = state.templates.map((t) => `
		<div class="template-card-mini ${t.id === state.selectedTemplate ? "active" : ""}" data-id="${t.id}">
			<h5>${t.nameArabic}</h5>
			<span>${t.nameEnglish}</span>
		</div>
	`).join("");

	// Full view
	elements.templatesFullContainer.innerHTML = state.templates.map((t) => `
		<div class="card">
			<div class="card-header">
				<h3>${t.nameArabic}</h3>
				<span class="badge new-badge">${t.nameEnglish}</span>
			</div>
			<p style="color: var(--text-muted); margin-bottom: 14px;">قالب مصمم خصيصاً بنسب تباين عالية وخطوط مريحة للعين.</p>
			<button class="btn btn-sm btn-outline select-template-btn" data-id="${t.id}">استخدام هذا القالب في الاستوديو</button>
		</div>
	`).join("");

	document.querySelectorAll(".template-card-mini").forEach((el) => {
		el.addEventListener("click", () => {
			state.selectedTemplate = el.dataset.id;
			document.querySelectorAll(".template-card-mini").forEach((c) => c.classList.remove("active"));
			el.classList.add("active");
			renderCanvasPreview();
		});
	});

	document.querySelectorAll(".select-template-btn").forEach((el) => {
		el.addEventListener("click", () => {
			state.selectedTemplate = el.dataset.id;
			switchView("create");
			document.querySelectorAll(".template-card-mini").forEach((c) => c.classList.toggle("active", c.dataset.id === state.selectedTemplate));
			renderCanvasPreview();
		});
	});
}

function renderBackgroundsMini() {
	elements.bgMiniCarousel.innerHTML = state.backgrounds.slice(0, 10).map((bg) => `
		<div class="bg-thumbnail-mini ${bg.filename === state.selectedBackground ? "active" : ""}" data-filename="${bg.filename}">
			<img src="${bg.url}" loading="lazy" alt="${bg.name}">
		</div>
	`).join("");

	document.querySelectorAll(".bg-thumbnail-mini").forEach((el) => {
		el.addEventListener("click", () => {
			state.selectedBackground = el.dataset.filename;
			document.querySelectorAll(".bg-thumbnail-mini").forEach((b) => b.classList.remove("active"));
			el.classList.add("active");
			renderCanvasPreview();
		});
	});
}

function renderBackgroundsGallery(category = "ALL") {
	const filtered = category === "ALL"
		? state.backgrounds
		: state.backgrounds.filter((b) => b.category === category);

	elements.backgroundsGalleryGrid.innerHTML = filtered.map((bg) => `
		<div class="bg-card-item" data-filename="${bg.filename}">
			<img src="${bg.url}" loading="lazy" alt="${bg.name}">
			<div class="bg-overlay-label">${bg.name}</div>
		</div>
	`).join("");

	document.querySelectorAll(".bg-card-item").forEach((el) => {
		el.addEventListener("click", () => {
			state.selectedBackground = el.dataset.filename;
			switchView("create");
			renderBackgroundsMini();
			renderCanvasPreview();
		});
	});
}

function renderRecitersCatalog(list = state.reciters) {
	elements.recitersCatalogGrid.innerHTML = list.map((r) => `
		<div class="reciter-card">
			<div class="reciter-card-top">
				<div class="reciter-avatar">${r.countryCode === "IQ" ? "🇮🇶" : r.countryCode === "SA" ? "🇸🇦" : "🇪🇬"}</div>
				<div class="reciter-details">
					<h4>${r.nameArabic}</h4>
					<p>${r.countryArabic} • ${r.qiraat || "حفص عن عاصم"}</p>
				</div>
			</div>
			<div class="reciter-card-meta">
				<div>النمط: <strong>${r.style || "مرتل"}</strong></div>
				<div>الحالة: <span class="status-indicator online">● ${r.availability === "FULL" ? "متاح كاملاً" : "متاح جزئياً"}</span></div>
			</div>
			<div class="reciter-card-btns">
				<button class="btn btn-sm btn-secondary reciter-play-preview" data-id="${r.id}">▶ استماع</button>
				<button class="btn btn-sm btn-primary reciter-select-btn" data-id="${r.id}">اختيار القارئ ✓</button>
			</div>
		</div>
	`).join("");

	attachReciterCardListeners();
}

function attachReciterCardListeners() {
	document.querySelectorAll(".reciter-select-btn").forEach((btn) => {
		btn.addEventListener("click", () => {
			const id = btn.dataset.id;
			state.selectedReciter = state.reciters.find((r) => r.id === id);
			updateReciterCardUI();
			closeAllModals();
			switchView("create");
			renderCanvasPreview();
		});
	});

	document.querySelectorAll(".reciter-play-preview").forEach((btn) => {
		btn.addEventListener("click", (e) => {
			e.stopPropagation();
			const id = btn.dataset.id;
			playReciterAudioPreview(id, btn);
		});
	});
}

function updateReciterCardUI() {
	if (!state.selectedReciter) return;
	const r = state.selectedReciter;
	elements.selReciterAvatar.textContent = r.countryCode === "IQ" ? "🇮🇶" : r.countryCode === "SA" ? "🇸🇦" : "🇪🇬";
	elements.selReciterName.textContent = r.nameArabic;
	elements.selReciterInfo.textContent = `${r.countryArabic} • ${r.qiraat || "حفص عن عاصم"} • ${r.style || "تلاوة خاشعة"}`;
}

// ==================== AUDIO PREVIEW PLAYER ====================

function playReciterAudioPreview(reciterId, buttonElement) {
	const audio = elements.globalPreviewAudio;
	const previewUrl = `/api/reciters/${reciterId}/preview`;

	if (state.playingAudioUrl === previewUrl && !audio.paused) {
		audio.pause();
		buttonElement.textContent = "▶ استماع";
		state.playingAudioUrl = null;
		return;
	}

	document.querySelectorAll(".reciter-play-preview").forEach((b) => (b.textContent = "▶ استماع"));
	buttonElement.textContent = "⏳ تحميل...";

	audio.src = previewUrl;
	audio.play().then(() => {
		buttonElement.textContent = "⏸ إيقاف";
		state.playingAudioUrl = previewUrl;
	}).catch((err) => {
		console.warn("Audio preview playback failed:", err);
		buttonElement.textContent = "▶ استماع";
	});

	audio.onended = () => {
		buttonElement.textContent = "▶ استماع";
		state.playingAudioUrl = null;
	};
}

// ==================== STUDIO VERSES & ESTIMATION ====================

async function updateStudioVerses() {
	const surahId = parseInt(elements.studioSurahSelect.value || "1", 10);
	const start = parseInt(elements.studioVerseStart.value || "1", 10);
	const end = parseInt(elements.studioVerseEnd.value || "5", 10);
	const count = Math.max(1, end - start + 1);

	try {
		const res = await fetch(`/api/verses?surah=${surahId}&from=${start}&count=${count}&translation=131`);
		const data = await res.json();
		state.cachedChapter = data.chapter;
		state.cachedVerses = data.verses;

		// Estimated Duration
		const estimatedSecs = count * 6.2; // approx 6.2s per ayah
		elements.estimatedDurationText.textContent = `حوالي ${Math.round(estimatedSecs)} ثانية (${count} آيات)`;

		renderCanvasPreview();
		updateSegmentsBadgeAndData();
	} catch (e) {
		console.error("Failed to load studio verses:", e);
	}
}

async function updateSegmentsBadgeAndData() {
	if (!elements.segmentsCountBadge) return;
	const surah = parseInt(elements.studioSurahSelect?.value || "1", 10);
	const start = parseInt(elements.studioVerseStart?.value || "1", 10);
	const end = parseInt(elements.studioVerseEnd?.value || "5", 10);
	const count = Math.max(1, end - start + 1);
	const syncMode = elements.studioSyncMode?.value || "auto";

	try {
		const res = await fetch("/api/quran/segments-preview", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ surah, verseStart: start, verseCount: count, syncMode }),
		});

		const data = await res.json();
		state.currentSegments = data.segments || [];
		
		const num = state.currentSegments.length;
		if (num <= 1) {
			elements.segmentsCountBadge.textContent = "مقطع واحد كامل";
		} else {
			elements.segmentsCountBadge.textContent = `${num} مقاطع متزامنة`;
		}
	} catch (e) {
		console.warn("Could not preview segments:", e);
	}
}

function renderSegmentsPreviewModal() {
	if (!elements.segmentsPreviewList) return;
	const segs = state.currentSegments || [];

	if (segs.length === 0) {
		elements.segmentsPreviewList.innerHTML = `<div class="empty-state"><p>لا توجد مقاطع متزامنة لهذه الآيات.</p></div>`;
		return;
	}

	elements.segmentsPreviewList.innerHTML = segs.map((seg, idx) => `
		<div class="segment-preview-card">
			<div class="segment-card-header">
				<span class="segment-num-badge">المقطع ${idx + 1} من ${segs.length} • الآية ${seg.ayahNumber}</span>
				<span class="segment-time-badge">${formatSecondsToDisplay(seg.startTime)} → ${formatSecondsToDisplay(seg.endTime)} (${seg.duration.toFixed(1)} ثانية)</span>
			</div>
			<div class="segment-arabic-text">
				<span class="quran-verse-phrase">${seg.arabicText}</span>
				${seg.hasAyahMarker ? `<span class="segment-marker-tag"><span class="marker-icon">۝</span><span>نهاية الآية ﴿${toArabicNumber(seg.ayahNumber)}﴾</span></span>` : ""}
			</div>
			${seg.translationText ? `<div class="segment-trans-text">${seg.translationText}</div>` : ""}
		</div>
	`).join("");
}

function formatSecondsToDisplay(sec) {
	const mins = Math.floor(sec / 60);
	const s = Math.floor(sec % 60);
	const ms = Math.floor((sec % 1) * 100);
	return `${mins.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}.${ms.toString().padStart(2, "0")}`;
}

// ==================== LIVE 9:16 CANVAS PREVIEW ====================

function renderCanvasPreview() {
	const canvas = elements.reelPreviewCanvas;
	if (!canvas) return;
	const ctx = canvas.getContext("2d");

	// Canvas dimensions (1080x1920)
	const W = 1080;
	const H = 1920;

	// 1. Draw Background
	const bgObj = state.backgrounds.find((b) => b.filename === state.selectedBackground);
	if (bgObj) {
		const img = new Image();
		img.crossOrigin = "anonymous";
		img.src = bgObj.url;
		img.onload = () => drawPreviewScene(ctx, img, W, H);
	} else {
		// Fallback dark gradient
		const grad = ctx.createLinearGradient(0, 0, 0, H);
		grad.addColorStop(0, "#0f172a");
		grad.addColorStop(1, "#020617");
		ctx.fillStyle = grad;
		ctx.fillRect(0, 0, W, H);
		drawPreviewText(ctx, W, H);
	}
}

function drawPreviewScene(ctx, img, W, H) {
	// Draw cropped & scaled background
	ctx.drawImage(img, 0, 0, W, H);

	// 2. Dark contrast overlay
	ctx.fillStyle = "rgba(0, 0, 0, 0.46)";
	ctx.fillRect(0, 0, W, H);

	drawPreviewText(ctx, W, H);
}

function drawPreviewText(ctx, W, H) {
	const chapter = state.cachedChapter;
	const verses = state.cachedVerses;
	const reciter = state.selectedReciter;

	if (!chapter || !verses || verses.length === 0) return;

	ctx.textAlign = "center";

	// 3. Surah Header (Arabic Surah Only)
	if (state.showSurahHeader) {
		ctx.font = "bold 58px Arial, 'Readex Pro', sans-serif";
		ctx.fillStyle = "#ffffff";
		ctx.shadowColor = "rgba(0, 0, 0, 0.8)";
		ctx.shadowBlur = 12;
		ctx.fillText(`سورة ${chapter.name_arabic}`, W / 2, 210);
	}

	// 4. Reciter Tag (Enlarged)
	if (state.showReciterTag && reciter) {
		ctx.font = "bold 38px Arial, 'Readex Pro', sans-serif";
		ctx.fillStyle = "#e0e0e0";
		ctx.shadowColor = "rgba(0, 0, 0, 0.8)";
		ctx.shadowBlur = 10;
		ctx.fillText(`القارئ: ${reciter.nameArabic}`, W / 2, 285);
	}

	// 5. Arabic Verse Text (Centered, Scheherazade New font)
	const currentVerse = verses[0];
	ctx.font = "bold 74px 'Scheherazade New', 'Amiri', serif";
	ctx.fillStyle = "#ffffff";
	ctx.shadowColor = "rgba(0, 0, 0, 0.9)";
	ctx.shadowBlur = 16;

	// Line wrapping for Arabic
	const words = currentVerse.text_uthmani.split(" ");
	let lines = [];
	let curLine = "";
	for (const w of words) {
		if ((curLine + " " + w).length > 28) {
			lines.push(curLine.trim());
			curLine = w;
		} else {
			curLine += " " + w;
		}
	}
	if (curLine) lines.push(curLine.trim());

	let startY = 920 - (lines.length * 45);
	for (const line of lines) {
		ctx.fillText(line, W / 2, startY);
		startY += 95;
	}

	// 6. English Translation Subtitle (Non-bold, 42px)
	if (state.showTranslation && currentVerse.translations?.[0]?.text) {
		ctx.font = "42px 'Segoe UI', Arial, sans-serif";
		ctx.fillStyle = "#f0f0f0";
		ctx.shadowColor = "rgba(0, 0, 0, 0.95)";
		ctx.shadowBlur = 10;

		const transWords = currentVerse.translations[0].text.split(" ");
		let tLines = [];
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

	// 7. Instagram Branding
	ctx.font = "bold 36px 'Readex Pro', Arial, sans-serif";
	ctx.fillStyle = "#ffffff";
	ctx.shadowColor = "rgba(0, 0, 0, 0.85)";
	ctx.shadowBlur = 10;
	ctx.fillText("📸 noor.alerta", W / 2, 1800);
}

function toArabicNumber(num) {
	const arabicNumerals = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];
	return num.toString().split("").map((d) => arabicNumerals[parseInt(d, 10)] || d).join("");
}

// ==================== GENERATE REEL & QUEUE ====================

async function triggerReelGeneration(options) {
	try {
		elements.studioRenderBtn.disabled = true;
		elements.studioProgressBox.classList.remove("hidden");
		elements.studioProgressFill.style.width = "5%";
		elements.studioProgressText.textContent = "جاري إرسال الطلب إلى الطابور...";
		elements.studioProgressPercent.textContent = "5%";

		const res = await fetch("/api/reels/create", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(options),
		});

		const job = await res.json();
		if (job.error) throw new Error(job.error);

		// Switch to high-frequency live polling
		pollJobProgress(job.id);
	} catch (e) {
		alert("حدث خطأ أثناء بدء الإنشاء: " + e.message);
		elements.studioRenderBtn.disabled = false;
		elements.studioProgressBox.classList.add("hidden");
	}
}

function pollJobProgress(jobId) {
	const timer = setInterval(async () => {
		try {
			const res = await fetch("/api/reels/queue");
			const queue = await res.json();
			const job = queue.find((j) => j.id === jobId);

			if (job) {
				const pct = Math.max(5, job.progress || 0);
				elements.studioProgressFill.style.width = `${pct}%`;
				elements.studioProgressText.textContent = job.stageTextArabic || "جاري المعالجة...";
				elements.studioProgressPercent.textContent = `${pct}%`;

				if (job.status === "completed") {
					clearInterval(timer);
					elements.studioProgressFill.style.width = "100%";
					elements.studioProgressPercent.textContent = "100%";
					elements.studioProgressText.textContent = "✨ تم إنشاء الريل بنجاح!";
					elements.studioRenderBtn.disabled = false;

					setTimeout(() => {
						elements.studioProgressBox.classList.add("hidden");
						openPlayerModal(job);
						fetchStats();
						fetchHistory();
					}, 1000);
				} else if (job.status === "failed") {
					clearInterval(timer);
					elements.studioProgressText.textContent = `❌ فشل الإنشاء: ${job.error}`;
					elements.studioRenderBtn.disabled = false;
				}
			} else {
				// Job might have finished and left queue, check history
				const hRes = await fetch("/api/reels/history");
				const history = await hRes.json();
				const finishedJob = history.find((j) => j.id === jobId);
				if (finishedJob && finishedJob.status === "completed") {
					clearInterval(timer);
					elements.studioProgressFill.style.width = "100%";
					elements.studioProgressPercent.textContent = "100%";
					elements.studioProgressText.textContent = "✨ تم إنشاء الريل بنجاح!";
					elements.studioRenderBtn.disabled = false;

					setTimeout(() => {
						elements.studioProgressBox.classList.add("hidden");
						openPlayerModal(finishedJob);
						fetchStats();
						fetchHistory();
					}, 1000);
				}
			}
		} catch (e) {
			console.warn("Queue polling error:", e);
		}
	}, 400);
}

function startQueuePolling() {
	setInterval(async () => {
		try {
			const res = await fetch("/api/reels/queue");
			const queue = await res.json();
			renderActiveQueueUI(queue);
		} catch (e) {
			console.warn("Queue monitor error:", e);
		}
	}, 500);
}

function renderActiveQueueUI(queue) {
	if (!elements.queueJobsContainer) return;
	if (!queue || queue.length === 0) {
		elements.queueStatusBadge.textContent = "خامل";
		elements.queueStatusBadge.className = "badge";
		elements.queueJobsContainer.innerHTML = `<div class="empty-state"><p>لا توجد عمليات رندر قيد الانتظار حالياً.</p></div>`;
		return;
	}

	const processingCount = queue.filter((j) => j.status === "processing").length;
	elements.queueStatusBadge.textContent = `${queue.length} قيد التشغيل`;
	elements.queueStatusBadge.className = "badge new-badge";

	elements.queueJobsContainer.innerHTML = queue.map((job) => {
		const isProcessing = job.status === "processing";
		const pct = Math.max(isProcessing ? 5 : 0, job.progress || 0);

		return `
			<div class="${isProcessing ? "queue-item-active" : "queue-item-queued"}">
				<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
					<div style="display: flex; align-items: center; gap: 8px;">
						<span style="font-size: 0.9rem;">${isProcessing ? "⚙️" : "⏳"}</span>
						<strong style="font-size: 0.95rem; color: #fff;">سورة ${job.surahNameArabic || job.options.surah} • ${job.reciterNameArabic || ""}</strong>
					</div>
					<strong style="color: ${isProcessing ? "var(--emerald)" : "var(--gold-light)"}; font-size: 1rem;">${pct}%</strong>
				</div>
				<div class="progress-bar-wrap" style="height: 8px; margin-bottom: 6px;">
					<div class="progress-bar-fill" style="width: ${pct}%;"></div>
				</div>
				<div style="display: flex; justify-content: space-between; font-size: 0.8rem; color: var(--text-muted);">
					<span>${job.stageTextArabic || (isProcessing ? "جاري المعالجة..." : "في قائمة الانتظار")}</span>
					<span>${job.options.verseCount ? `${job.options.verseCount} آيات` : ""}</span>
				</div>
			</div>
		`;
	}).join("");
}

// ==================== HISTORY & RECENT REELS ====================

function renderHistory(jobs) {
	const completed = jobs.filter((j) => j.status === "completed");
	elements.historyCountText.textContent = `${completed.length} فيديو`;

	if (completed.length === 0) {
		elements.historyReelsContainer.innerHTML = `
			<div class="empty-state" style="grid-column: 1/-1; text-align: center; padding: 48px;">
				<p>لم يتم إنتاج أي ريلز حتى الآن. ابدأ بإنشاء أول مقطع قرآني من صفحة "إنشاء ريل"!</p>
			</div>
		`;
		return;
	}

	elements.historyReelsContainer.innerHTML = completed.map((job) => `
		<div class="reel-item-card">
			<div class="reel-thumb-box" onclick='window.appOpenPlayer(${JSON.stringify(job)})'>
				<img src="${job.thumbnailUrl || "/assets/Quran-on-Wooden-Surface.png"}" alt="${job.surahNameArabic}">
				<div class="play-badge">▶</div>
			</div>
			<div class="reel-item-info">
				<h4>سورة ${job.surahNameArabic || ""} (${job.surahNameEnglish || ""})</h4>
				<p>🎙️ ${job.reciterNameArabic || "القارئ"} • ${Math.round(job.duration || 0)} ثانية</p>
				<p style="font-size: 0.75rem;">📅 ${new Date(job.createdAt).toLocaleDateString("ar-EG")}</p>
			</div>
			<div class="reel-item-actions">
				<a href="${job.videoUrl}" download class="btn btn-sm btn-primary">⬇ تحميل</a>
				<button class="btn btn-sm btn-outline" onclick='window.appOpenPlayer(${JSON.stringify(job)})'>مشاهدة</button>
				<button class="btn btn-sm btn-secondary" onclick='window.appDeleteReel("${job.id}")'>🗑️</button>
			</div>
		</div>
	`).join("");
}

function renderRecentReelsDashboard(jobs) {
	const recent = jobs.filter((j) => j.status === "completed").slice(0, 4);
	if (recent.length === 0) {
		elements.dashboardRecentReels.innerHTML = `<p style="color: var(--text-muted); font-size: 0.85rem;">لا توجد ريلز منتجة بعد.</p>`;
		return;
	}

	elements.dashboardRecentReels.innerHTML = recent.map((job) => `
		<div class="recent-reel-mini-card" onclick='window.appOpenPlayer(${JSON.stringify(job)})' style="display: flex; gap: 12px; align-items: center; padding: 10px; background: var(--bg-input); border-radius: var(--radius-md); cursor: pointer; margin-bottom: 8px;">
			<div style="width: 48px; height: 72px; border-radius: 6px; overflow: hidden; background: #000; flex-shrink: 0;">
				<img src="${job.thumbnailUrl || "/assets/Quran-on-Wooden-Surface.png"}" style="width: 100%; height: 100%; object-fit: cover;">
			</div>
			<div>
				<h5 style="font-size: 0.95rem; color: #fff;">سورة ${job.surahNameArabic || ""}</h5>
				<p style="font-size: 0.8rem; color: var(--text-muted);">${job.reciterNameArabic || ""} • ${Math.round(job.duration || 0)}ث</p>
			</div>
		</div>
	`).join("");
}

// Global functions for inline HTML calls
window.appOpenPlayer = (job) => openPlayerModal(job);
window.appDeleteReel = async (id) => {
	if (confirm("هل أنت متأكد من رغبتك في حذف هذا الريل نهائياً؟")) {
		await fetch(`/api/reels/${id}`, { method: "DELETE" });
		fetchStats();
		fetchHistory();
	}
};

// ==================== VIDEO PLAYER MODAL & CAPTION HELPER ====================

function openPlayerModal(job) {
	elements.playerVideoElement.src = job.videoUrl;
	elements.playerModalTitle.textContent = `سورة ${job.surahNameArabic || ""} • ${job.reciterNameArabic || ""}`;
	elements.playerDownloadBtn.href = job.videoUrl;

	// Generate Social Caption (Algorithm Optimized)
	const rawSurah = job.surahNameArabic ? job.surahNameArabic.replace(/^سورة\s+/, "") : "القرآن";
	const surahName = `سورة ${rawSurah}`;
	const cleanSurahTag = rawSurah.replace(/[\s\-]/g, "_");
	const reciterName = job.reciterNameArabic || "تلاوة خاشعة";
	const cleanReciterTag = reciterName.replace(/[\s\-]/g, "_");
	const firstA = job.options?.verseStart || 1;
	const verseCount = job.options?.verseCount || 1;
	const lastA = firstA + verseCount - 1;
	const verseRangeStr = verseCount > 1 ? `الآيات (${firstA} - ${lastA})` : `الآية (${firstA})`;

	const caption = `✨ تلاوة خاشعة تأخذك إلى عالم من الطمأنينة والسكينة 🌿
قال الله تعالى: ﴿ أَلَا بِذِكْرِ اللَّهِ تَطْمَئِنُّ الْقُلُوبُ ﴾

📖 ${surahName} | ${verseRangeStr}
🎙️ بصوت القارئ: ${reciterName}
🎧 استمع بقلبك وارتدِ السماعات لتجربة خاشعة 🤍

━━━━━━━━━━━━━━━━━━━
💡 شاركنا الأجر وتفاعل مع المقطع لدعم النشر:
💬 اكتب شيئاً تؤجر عليه في التعليقات (سبحان الله، أستغفر الله، لا إله إلا الله)
❤️ اضغط إعجاب إذا لامست هذه التلاوة قلبك
📌 احفظ المقطع عندك للرجوع إليه والاستماع وقت الحاجة
↗️ شارك المقطع مع من تحب (الدال على الخير كفاعله 🌿)
━━━━━━━━━━━━━━━━━━━

👤 الحساب الرسمي: @noor.alerta
🔔 فعّل التنبيهات ليصلك كل يوم مقطع جديد من روائع التلاوات الخاشعة.

.
.
#قرآن #قرآن_كريم #تلاوة_خاشعة #سورة_${cleanSurahTag} #${cleanReciterTag} #تلاوات_قرانية #طمأنينة #راحة_نفسية #أدعية #أذكار #صدقة_جارية #أجر_لي_ولك #اسلاميات #اكسبلور #اكسبلور_فولو #ريلز #ريلز_قران
#quran #quranrecitation #islam #islamicreels #quranquotes #islamicreminders #reels #explore #foryou #fyp #viralreels #reelsinstagram #nooralerta`;

	elements.captionTextArea.value = caption;
	elements.videoPlayerModal.classList.remove("hidden");
}

// ==================== MODALS LOGIC ====================

function setupModals() {
	elements.closeReciterModal.addEventListener("click", closeAllModals);
	elements.closeBgModal.addEventListener("click", closeAllModals);
	elements.closePlayerModal.addEventListener("click", () => {
		elements.playerVideoElement.pause();
		closeAllModals();
	});

	elements.openReciterModalBtn.addEventListener("click", () => {
		renderRecitersModalList();
		elements.reciterModal.classList.remove("hidden");
	});

	elements.openBgModalBtn.addEventListener("click", () => {
		renderBgModalList();
		elements.bgModal.classList.remove("hidden");
	});

	// Close on background click
	document.querySelectorAll(".modal-backdrop").forEach((m) => {
		m.addEventListener("click", (e) => {
			if (e.target === m) closeAllModals();
		});
	});
}

function closeAllModals() {
	document.querySelectorAll(".modal-backdrop").forEach((m) => m.classList.add("hidden"));
	if (elements.playerVideoElement) elements.playerVideoElement.pause();
}

function renderRecitersModalList(country = "ALL", query = "") {
	let list = state.reciters;
	if (country && country !== "ALL") {
		if (country === "FAV") list = list.filter((r) => state.favorites.includes(r.id));
		else list = list.filter((r) => r.countryCode === country);
	}
	if (query) {
		const q = query.toLowerCase();
		list = list.filter((r) => r.nameArabic.includes(q) || r.nameEnglish.toLowerCase().includes(q));
	}

	elements.modalRecitersContainer.innerHTML = list.map((r) => `
		<div class="reciter-card" style="margin-bottom: 12px;">
			<div class="reciter-card-top">
				<div class="reciter-avatar">${r.countryCode === "IQ" ? "🇮🇶" : r.countryCode === "SA" ? "🇸🇦" : "🇪🇬"}</div>
				<div class="reciter-details">
					<h4>${r.nameArabic}</h4>
					<p>${r.countryArabic} • ${r.qiraat || "حفص عن عاصم"}</p>
				</div>
			</div>
			<div class="reciter-card-btns">
				<button class="btn btn-sm btn-secondary reciter-play-preview" data-id="${r.id}">▶ استماع</button>
				<button class="btn btn-sm btn-primary reciter-select-btn" data-id="${r.id}">اختيار القارئ ✓</button>
			</div>
		</div>
	`).join("");

	attachReciterCardListeners();
}

function renderBgModalList() {
	elements.modalBgContainer.innerHTML = state.backgrounds.map((bg) => `
		<div class="bg-card-item" data-filename="${bg.filename}" style="aspect-ratio: 9/16; border-radius: 8px; overflow: hidden; cursor: pointer;">
			<img src="${bg.url}" loading="lazy" style="width: 100%; height: 100%; object-fit: cover;">
		</div>
	`).join("");

	elements.modalBgContainer.querySelectorAll(".bg-card-item").forEach((el) => {
		el.addEventListener("click", () => {
			state.selectedBackground = el.dataset.filename;
			renderBackgroundsMini();
			renderCanvasPreview();
			closeAllModals();
		});
	});
}

// ==================== EVENT LISTENERS ====================

function setupEventListeners() {
	// Surah & Verse change
	elements.studioSurahSelect.addEventListener("change", () => {
		elements.studioVerseStart.value = 1;
		elements.studioVerseEnd.value = 5;
		updateStudioVerses();
	});

	elements.studioVerseStart.addEventListener("input", updateStudioVerses);
	elements.studioVerseEnd.addEventListener("input", updateStudioVerses);

	// Quick Verse Chips
	elements.presetChips.forEach((chip) => {
		chip.addEventListener("click", () => {
			elements.presetChips.forEach((c) => c.classList.remove("active"));
			chip.classList.add("active");
			const count = chip.dataset.count;
			const start = parseInt(elements.studioVerseStart.value || "1", 10);
			if (count === "all") {
				elements.studioVerseEnd.value = state.cachedChapter?.verses_count || 7;
			} else {
				elements.studioVerseEnd.value = start + parseInt(count, 10) - 1;
			}
			updateStudioVerses();
		});
	});

	// Toggles
	elements.toggleTranslation.addEventListener("change", (e) => {
		state.showTranslation = e.target.checked;
		renderCanvasPreview();
	});
	elements.toggleSurahHeader.addEventListener("change", (e) => {
		state.showSurahHeader = e.target.checked;
		renderCanvasPreview();
	});
	elements.toggleReciterTag.addEventListener("change", (e) => {
		state.showReciterTag = e.target.checked;
		renderCanvasPreview();
	});

	// Audio preview button in Studio
	elements.previewAudioBtn.addEventListener("click", () => {
		if (state.selectedReciter) {
			playReciterAudioPreview(state.selectedReciter.id, elements.previewAudioBtn);
		}
	});

	// Phrase Sync Mode Change
	elements.studioSyncMode?.addEventListener("change", () => {
		updateSegmentsBadgeAndData();
	});

	// Segments Preview Button
	elements.btnPreviewSegments?.addEventListener("click", () => {
		renderSegmentsPreviewModal();
		elements.segmentsPreviewModal.classList.remove("hidden");
	});

	elements.closeSegmentsModal?.addEventListener("click", () => {
		elements.segmentsPreviewModal.classList.add("hidden");
	});

	// Studio Render Action
	elements.studioRenderBtn.addEventListener("click", () => {
		const surahId = parseInt(elements.studioSurahSelect.value, 10);
		const start = parseInt(elements.studioVerseStart.value, 10);
		const end = parseInt(elements.studioVerseEnd.value, 10);
		const count = Math.max(1, end - start + 1);

		triggerReelGeneration({
			surah: surahId,
			verseStart: start,
			verseCount: count,
			reciterId: state.selectedReciter?.id || "iq-raad-alkurdi",
			templateId: state.selectedTemplate,
			background: state.selectedBackground,
			showTranslation: state.showTranslation,
			showSurahArabic: state.showSurahHeader,
			showReciter: state.showReciterTag,
			syncMode: elements.studioSyncMode?.value || "auto",
		});
	});

	// Quick Generate in Dashboard
	elements.quickGenerateBtn.addEventListener("click", () => {
		const surahId = parseInt(elements.quickSurahSelect.value, 10);
		const start = parseInt(elements.quickVerseStart.value, 10);
		const count = parseInt(elements.quickVerseCount.value, 10);
		const reciterId = elements.quickReciterSelect.value;
		const templateId = elements.quickTemplateSelect.value;

		triggerReelGeneration({
			surah: surahId,
			verseStart: start,
			verseCount: count,
			reciterId,
			templateId,
			background: state.selectedBackground,
			showTranslation: true,
			syncMode: "auto",
		});
	});

	// Random Ayah
	elements.randomAyahBtn.addEventListener("click", async () => {
		try {
			const res = await fetch("/api/reels/random-ayah");
			const data = await res.json();
			elements.studioSurahSelect.value = data.surah;
			elements.studioVerseStart.value = data.verseStart;
			elements.studioVerseEnd.value = data.verseStart + data.verseCount - 1;
			switchView("create");
			updateStudioVerses();
		} catch (e) {
			console.error("Failed to pick random ayah:", e);
		}
	});

	// Copy Social Caption
	elements.copyCaptionBtn.addEventListener("click", () => {
		elements.captionTextArea.select();
		navigator.clipboard.writeText(elements.captionTextArea.value);
		elements.copyCaptionBtn.textContent = "✓ تم النسخ بنجاح!";
		setTimeout(() => (elements.copyCaptionBtn.textContent = "📋 نسخ العنوان ووصف النشر والهاشتاقات"), 2000);
	});

	// Search Reciters
	elements.recitersSearchInput?.addEventListener("input", (e) => {
		fetchReciters("ALL", e.target.value).then(() => renderRecitersCatalog());
	});

	// Reciter Country Tabs
	elements.reciterCountryTabs?.addEventListener("click", (e) => {
		if (e.target.tagName === "BUTTON") {
			elements.reciterCountryTabs.querySelectorAll("button").forEach((b) => b.classList.remove("active"));
			e.target.classList.add("active");
			const country = e.target.dataset.country;
			fetchReciters(country).then(() => renderRecitersCatalog());
		}
	});

	// Modal Reciter Country Tabs
	elements.modalReciterTabs?.addEventListener("click", (e) => {
		if (e.target.tagName === "BUTTON") {
			elements.modalReciterTabs.querySelectorAll("button").forEach((b) => b.classList.remove("active"));
			e.target.classList.add("active");
			const country = e.target.dataset.country;
			renderRecitersModalList(country, elements.modalReciterSearch.value);
		}
	});

	elements.modalReciterSearch?.addEventListener("input", (e) => {
		renderRecitersModalList("ALL", e.target.value);
	});

	// Background Upload
	elements.bgUploadInput?.addEventListener("change", async (e) => {
		const file = e.target.files[0];
		if (!file) return;

		const fd = new FormData();
		fd.append("file", file);

		try {
			const res = await fetch("/api/backgrounds/upload", { method: "POST", body: fd });
			const data = await res.json();
			if (data.success) {
				alert("تم رفع الخلفية بنجاح!");
				await fetchBackgrounds();
				state.selectedBackground = data.filename;
				renderBackgroundsMini();
				renderBackgroundsGallery();
				renderCanvasPreview();
			}
		} catch (err) {
			alert("فشل رفع الخلفية: " + err.message);
		}
	});

	// Batch Generate Action
	elements.batchGenerateBtn?.addEventListener("click", async () => {
		const surah = elements.batchSurahSelect.value;
		const mode = document.querySelector("input[name='batch-mode']:checked").value;
		const reciterId = elements.batchReciterSelect.value;
		const templateId = elements.batchTemplateSelect.value;

		try {
			elements.batchGenerateBtn.disabled = true;
			const res = await fetch("/api/reels/batch", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					surah,
					mode,
					reciterId,
					templateId,
					ayahStep: mode === "single_ayah" ? 1 : 3,
					showTranslation: true,
				}),
			});
			const data = await res.json();
			alert(`تمت إضافة ${data.count} ريل إلى طابور الإنتاج بنجاح!`);
			elements.batchGenerateBtn.disabled = false;
			switchView("dashboard");
		} catch (err) {
			alert("فشل إنشاء المجموعة: " + err.message);
			elements.batchGenerateBtn.disabled = false;
		}
	});

	// Clean Storage
	elements.cleanTempBtn?.addEventListener("click", async () => {
		await fetch("/api/storage/clean", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ type: "temp" }),
		});
		alert("تم تنظيف الملفات المؤقتة بنجاح!");
		fetchStats();
	});

	elements.cleanAudioBtn?.addEventListener("click", async () => {
		if (confirm("هل أنت متأكد من مسح كاش التلاوات الصوتية؟ سيتم إعادة تحميلها عند الحاجة.")) {
			await fetch("/api/storage/clean", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ type: "audio" }),
			});
			alert("تم مسح كاش التلاوات بنجاح!");
			fetchStats();
		}
	});
}

// Start App
document.addEventListener("DOMContentLoaded", initApp);
