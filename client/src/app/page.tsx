"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { TopNavbar } from "@/components/TopNavbar";
import { PlayerModal, type IPlayerJob } from "@/components/PlayerModal";
import {
	Film,
	CheckCircle,
	Clock,
	HardDrive,
	Play,
	Sparkles,
	Layers,
	ChevronLeft,
	Loader2,
} from "lucide-react";

export default function DashboardPage() {
	const [stats, setStats] = useState<any>({
		totalReels: 0,
		readyVideos: 0,
		completedCount: 0,
		totalDurationSeconds: 0,
		totalDurationFormatted: "0 د 0 ث",
		storageUsedMb: "0.00",
		storage: null,
	});
	const [queue, setQueue] = useState<any[]>([]);
	const [recentReels, setRecentReels] = useState<any[]>([]);
	const [surahs, setSurahs] = useState<any[]>([]);
	const [reciters, setReciters] = useState<any[]>([]);
	const [templates, setTemplates] = useState<any[]>([]);

	// Quick form state
	const [quickSurah, setQuickSurah] = useState(1);
	const [quickStart, setQuickStart] = useState(1);
	const [quickCount, setQuickCount] = useState(3);
	const [quickReciter, setQuickReciter] = useState("ea-dossari");
	const [quickTemplate, setQuickTemplate] = useState("mushaf-focus");
	const [isSubmitting, setIsSubmitting] = useState(false);

	// Player modal
	const [selectedJob, setSelectedJob] = useState<IPlayerJob | null>(null);

	const fetchDashboardData = async () => {
		try {
			const [statsRes, queueRes, histRes] = await Promise.all([
				fetch("/api/stats"),
				fetch("/api/reels/queue"),
				fetch("/api/reels/history"),
			]);

			if (statsRes.ok) {
				const statsData = await statsRes.json();
				setStats(statsData);
			}
			if (queueRes.ok) setQueue(await queueRes.json());
			if (histRes.ok) {
				const hist = await histRes.json();
				setRecentReels(hist.slice(0, 6));
			}
		} catch (e) {
			// Backend loading
		}
	};

	useEffect(() => {
		fetchDashboardData();
		const timer = setInterval(fetchDashboardData, 1000);

		// Load static dropdown data
		const loadMeta = async () => {
			try {
				const [sRes, rRes, tRes] = await Promise.all([
					fetch("/api/surahs"),
					fetch("/api/reciters"),
					fetch("/api/templates"),
				]);
				if (sRes.ok) setSurahs(await sRes.json());
				if (rRes.ok) {
					const d = await rRes.json();
					setReciters(d.reciters || []);
				}
				if (tRes.ok) setTemplates(await tRes.json());
			} catch (e) {}
		};
		loadMeta();

		return () => clearInterval(timer);
	}, []);

	const handleQuickGenerate = async (e: React.FormEvent) => {
		e.preventDefault();
		try {
			setIsSubmitting(true);
			const res = await fetch("/api/reels/create", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					surah: quickSurah,
					verseStart: quickStart,
					verseCount: quickCount,
					reciterId: quickReciter,
					templateId: quickTemplate,
					showTranslation: true,
					syncMode: "auto",
				}),
			});

			if (res.ok) {
				fetchDashboardData();
			}
		} catch (err) {
			console.error("Quick generate error:", err);
		} finally {
			setIsSubmitting(false);
		}
	};

	const formatDuration = (secs: number) => {
		if (!secs) return "0 د 0 ث";
		const mins = Math.floor(secs / 60);
		const s = Math.floor(secs % 60);
		return `${mins} د ${s} ث`;
	};

	return (
		<>
			<TopNavbar title="لوحة التحكم الرئيسية" />

			<div className="content-body">
				{/* 1. Real-time Stats Grid */}
				<div className="stats-grid">
					<div className="glass-card stat-card">
						<div className="stat-icon-wrap" style={{ background: "rgba(212, 175, 55, 0.15)", color: "var(--gold-light)" }}>
							<Film size={26} />
						</div>
						<div>
							<div className="stat-val">{stats.totalReels ?? 0}</div>
							<div className="stat-lbl">إجمالي الريلز المنتجة</div>
						</div>
					</div>

					<div className="glass-card stat-card">
						<div className="stat-icon-wrap" style={{ background: "rgba(16, 185, 129, 0.15)", color: "var(--emerald)" }}>
							<CheckCircle size={26} />
						</div>
						<div>
							<div className="stat-val">{stats.readyVideos ?? stats.completedCount ?? 0}</div>
							<div className="stat-lbl">فيديوهات جاهزة</div>
						</div>
					</div>

					<div className="glass-card stat-card">
						<div className="stat-icon-wrap" style={{ background: "rgba(59, 130, 246, 0.15)", color: "#93c5fd" }}>
							<Clock size={26} />
						</div>
						<div>
							<div className="stat-val">{stats.totalDurationFormatted || formatDuration(stats.totalDurationSeconds || 0)}</div>
							<div className="stat-lbl">إجمالي مدة المحتوى</div>
						</div>
					</div>

					<div className="glass-card stat-card">
						<div className="stat-icon-wrap" style={{ background: "rgba(168, 85, 247, 0.15)", color: "#c084fc" }}>
							<HardDrive size={26} />
						</div>
						<div>
							<div className="stat-val">{stats.storage?.totalFormatted || (stats.storageUsedMb ? `${stats.storageUsedMb} MB` : "0 MB")}</div>
							<div className="stat-lbl">مساحة التخزين المستخدمة</div>
						</div>
					</div>
				</div>

				{/* 2. Main Dashboard Split (Queue & Quick Generator) */}
				<div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: "28px", marginBottom: "36px" }}>
					{/* Live Render Queue */}
					<div className="glass-card">
						<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
							<div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
								<h2 style={{ fontSize: "1.2rem", fontWeight: 700, color: "#fff" }}>طابور الإنتاج المباشر</h2>
								<span className={`nav-badge ${queue.length > 0 ? "badge-emerald" : "badge-gold"}`}>
									{queue.length > 0 ? `${queue.length} قيد التشغيل` : "خامل"}
								</span>
							</div>
							<Link href="/history" className="btn-link" style={{ fontSize: "0.85rem", color: "var(--gold-light)", display: "flex", alignItems: "center", gap: "4px" }}>
								<span>سجل الفيديوهات</span>
								<ChevronLeft size={16} />
							</Link>
						</div>

						{queue.length === 0 ? (
							<div style={{ padding: "48px 20px", textAlign: "center", color: "var(--text-dim)" }}>
								<Layers size={40} style={{ margin: "0 auto 12px", opacity: 0.4 }} />
								<p>لا توجد عمليات رندر قيد الانتظار حالياً.</p>
								<Link href="/studio" className="btn btn-outline btn-sm" style={{ marginTop: "16px" }}>
									بدء إنشاء ريل جديد ←
								</Link>
							</div>
						) : (
							<div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
								{queue.map((job) => {
									const isProcessing = job.status === "processing";
									const pct = Math.max(isProcessing ? 5 : 0, job.progress || 0);

									return (
										<div
											key={job.id}
											style={{
												padding: "16px",
												borderRadius: "var(--radius-md)",
												background: isProcessing ? "linear-gradient(135deg, rgba(212, 175, 55, 0.08), rgba(16, 185, 129, 0.05))" : "var(--bg-input)",
												border: "1px solid var(--border-color)",
											}}
										>
											<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
												<div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
													{isProcessing ? <Loader2 size={16} className="spin" color="var(--gold-light)" /> : <span>⏳</span>}
													<strong style={{ color: "#fff", fontSize: "0.95rem" }}>
														سورة {job.surahNameArabic || job.options?.surah} • {job.reciterNameArabic || ""}
													</strong>
												</div>
												<strong style={{ color: isProcessing ? "var(--emerald)" : "var(--gold-light)", fontSize: "1.05rem" }}>
													{pct}%
												</strong>
											</div>

											<div className="progress-bar-wrap">
												<div className="progress-bar-fill" style={{ width: `${pct}%` }}></div>
											</div>

											<div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem", color: "var(--text-muted)" }}>
												<span>{job.stageTextArabic || "جاري المعالجة..."}</span>
												<span>{job.options?.verseCount ? `${job.options.verseCount} آيات` : ""}</span>
											</div>
										</div>
									);
								})}
							</div>
						)}
					</div>

					{/* Quick Create Card */}
					<div className="glass-card">
						<h2 style={{ fontSize: "1.15rem", fontWeight: 700, color: "#fff", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
							<Sparkles size={20} color="var(--gold-light)" />
							<span>إنشاء ريل سريع</span>
						</h2>

						<form onSubmit={handleQuickGenerate}>
							<div className="form-group">
								<label>السورة</label>
								<select
									className="form-control"
									value={quickSurah}
									onChange={(e) => setQuickSurah(parseInt(e.target.value, 10))}
								>
									{surahs.map((s) => (
										<option key={s.id} value={s.id}>
											{s.id} - سورة {s.name_arabic} ({s.name_simple})
										</option>
									))}
								</select>
							</div>

							<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
								<div className="form-group">
									<label>من الآية</label>
									<input
										type="number"
										min={1}
										className="form-control"
										value={quickStart}
										onChange={(e) => setQuickStart(parseInt(e.target.value, 10))}
									/>
								</div>
								<div className="form-group">
									<label>عدد الآيات</label>
									<input
										type="number"
										min={1}
										max={10}
										className="form-control"
										value={quickCount}
										onChange={(e) => setQuickCount(parseInt(e.target.value, 10))}
									/>
								</div>
							</div>

							<div className="form-group">
								<label>القارئ</label>
								<select
									className="form-control"
									value={quickReciter}
									onChange={(e) => setQuickReciter(e.target.value)}
								>
									{reciters.map((r) => (
										<option key={r.id} value={r.id}>
											{r.nameArabic} ({r.countryArabic})
										</option>
									))}
								</select>
							</div>

							<div className="form-group">
								<label>القالب</label>
								<select
									className="form-control"
									value={quickTemplate}
									onChange={(e) => setQuickTemplate(e.target.value)}
								>
									{templates.map((t) => (
										<option key={t.id} value={t.id}>
											{t.nameArabic}
										</option>
									))}
								</select>
							</div>

							<button
								type="submit"
								className="btn btn-primary btn-block"
								style={{ marginTop: "10px" }}
								disabled={isSubmitting}
							>
								<span>{isSubmitting ? "جاري الإرسال..." : "🚀 بدء الإنشاء الآن"}</span>
							</button>
						</form>
					</div>
				</div>

				{/* 3. Recent Reels Gallery */}
				<div className="glass-card">
					<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
						<h2 style={{ fontSize: "1.2rem", fontWeight: 700, color: "#fff" }}>أحدث الريلز المنتجة</h2>
						<Link href="/history" className="btn-link" style={{ fontSize: "0.85rem", color: "var(--gold-light)", display: "flex", alignItems: "center", gap: "4px" }}>
							<span>عرض جميع الفيديوهات</span>
							<ChevronLeft size={16} />
						</Link>
					</div>

					{recentReels.length === 0 ? (
						<div style={{ padding: "40px", textAlign: "center", color: "var(--text-dim)" }}>
							<Film size={36} style={{ margin: "0 auto 10px", opacity: 0.4 }} />
							<p>لم يتم إنتاج أي ريلز بعد. ابدأ بإنشاء أول فيديو الآن!</p>
						</div>
					) : (
						<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "20px" }}>
							{recentReels.map((job) => (
								<div
									key={job.id}
									style={{
										background: "var(--bg-input)",
										border: "1px solid var(--border-light)",
										borderRadius: "var(--radius-md)",
										overflow: "hidden",
										transition: "var(--transition-fast)",
										cursor: "pointer",
									}}
									onClick={() => setSelectedJob(job)}
								>
									<div style={{ position: "relative", width: "100%", aspectRatio: "9/16", background: "#000" }}>
										{job.thumbnailUrl && (
											<img
												src={job.thumbnailUrl}
												alt={job.surahNameArabic}
												style={{ width: "100%", height: "100%", objectFit: "cover" }}
											/>
										)}
										<div
											style={{
												position: "absolute",
												inset: 0,
												background: "rgba(0, 0, 0, 0.35)",
												display: "flex",
												alignItems: "center",
												justifyContent: "center",
											}}
										>
											<div
												style={{
													width: "44px",
													height: "44px",
													borderRadius: "50%",
													background: "rgba(212, 175, 55, 0.9)",
													color: "#000",
													display: "flex",
													alignItems: "center",
													justifyContent: "center",
												}}
											>
												<Play size={20} fill="#000" />
											</div>
										</div>
										<span
											style={{
												position: "absolute",
												bottom: "10px",
												left: "10px",
												background: "rgba(0, 0, 0, 0.75)",
												padding: "2px 8px",
												borderRadius: "6px",
												fontSize: "0.75rem",
												color: "#fff",
											}}
										>
											{job.duration?.toFixed(1)}s
										</span>
									</div>

									<div style={{ padding: "14px" }}>
										<h4 style={{ color: "#fff", fontSize: "0.95rem", marginBottom: "4px" }}>
											سورة {job.surahNameArabic} ({job.surahNameEnglish})
										</h4>
										<p style={{ color: "var(--text-muted)", fontSize: "0.82rem" }}>
											القارئ: {job.reciterNameArabic}
										</p>
									</div>
								</div>
							))}
						</div>
					)}
				</div>
			</div>

			<PlayerModal job={selectedJob} onClose={() => setSelectedJob(null)} />
		</>
	);
}
