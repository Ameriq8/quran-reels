"use client";

import React, { useEffect, useState } from "react";
import { TopNavbar } from "@/components/TopNavbar";
import { PlayerModal, type IPlayerJob } from "@/components/PlayerModal";
import { Film, Search, Download, Trash2, Play, Copy, Check } from "lucide-react";

export default function HistoryPage() {
	const [history, setHistory] = useState<any[]>([]);
	const [searchQuery, setSearchQuery] = useState("");
	const [selectedJob, setSelectedJob] = useState<IPlayerJob | null>(null);

	const fetchHistory = async () => {
		try {
			const res = await fetch("/api/reels/history");
			if (res.ok) {
				const list = await res.json();
				setHistory(list);
			}
		} catch (e) {
			console.warn("Failed to fetch history:", e);
		}
	};

	useEffect(() => {
		fetchHistory();
		const timer = setInterval(fetchHistory, 3000);
		return () => clearInterval(timer);
	}, []);

	const filtered = history.filter((job) => {
		if (!searchQuery) return true;
		const q = searchQuery.toLowerCase();
		return (
			job.surahNameArabic?.toLowerCase().includes(q) ||
			job.surahNameEnglish?.toLowerCase().includes(q) ||
			job.reciterNameArabic?.toLowerCase().includes(q)
		);
	});

	return (
		<>
			<TopNavbar title="سجل الريلز المكتملة" />

			<div className="content-body">
				{/* Top Bar Filter */}
				<div
					className="glass-card"
					style={{
						display: "flex",
						justifyContent: "space-between",
						alignItems: "center",
						marginBottom: "28px",
						gap: "20px",
					}}
				>
					<div style={{ position: "relative", flex: 1, maxWidth: "450px" }}>
						<Search
							size={18}
							color="var(--text-dim)"
							style={{ position: "absolute", right: "14px", top: "50%", transform: "translateY(-50%)" }}
						/>
						<input
							type="text"
							className="form-control"
							placeholder="ابحث بالسورة أو القارئ..."
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							style={{ paddingRight: "42px" }}
						/>
					</div>

					<div style={{ color: "var(--text-muted)", fontSize: "0.95rem" }}>
						إجمالي الفيديوهات: <strong style={{ color: "#fff" }}>{history.length}</strong> فيديو
					</div>
				</div>

				{/* Gallery Grid */}
				{filtered.length === 0 ? (
					<div className="glass-card" style={{ padding: "60px 20px", textAlign: "center", color: "var(--text-dim)" }}>
						<Film size={48} style={{ margin: "0 auto 16px", opacity: 0.4 }} />
						<h3 style={{ color: "#fff", marginBottom: "8px" }}>لا توجد فيديوهات مطابقة</h3>
						<p>قم بإنشاء ريلز جديدة لتظهر هنا في السجل الكامل.</p>
					</div>
				) : (
					<div
						style={{
							display: "grid",
							gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
							gap: "24px",
						}}
					>
						{filtered.map((job) => (
							<div
								key={job.id}
								className="glass-card"
								style={{
									padding: "0",
									overflow: "hidden",
									display: "flex",
									flexDirection: "column",
								}}
							>
								{/* Thumbnail & Play */}
								<div
									style={{
										position: "relative",
										width: "100%",
										aspectRatio: "9/16",
										background: "#000",
										cursor: "pointer",
									}}
									onClick={() => setSelectedJob(job)}
								>
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
											background: "rgba(0,0,0,0.3)",
											display: "flex",
											alignItems: "center",
											justifyContent: "center",
										}}
									>
										<div
											style={{
												width: "50px",
												height: "50px",
												borderRadius: "50%",
												background: "rgba(212, 175, 55, 0.9)",
												display: "flex",
												alignItems: "center",
												justifyContent: "center",
												boxShadow: "0 0 15px rgba(212, 175, 55, 0.4)",
											}}
										>
											<Play size={24} fill="#000" color="#000" />
										</div>
									</div>

									<span
										style={{
											position: "absolute",
											bottom: "10px",
											left: "10px",
											background: "rgba(0,0,0,0.8)",
											padding: "3px 8px",
											borderRadius: "6px",
											fontSize: "0.75rem",
											color: "#fff",
										}}
									>
										{job.duration?.toFixed(1)}s
									</span>
								</div>

								{/* Info & Actions */}
								<div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "12px", flex: 1 }}>
									<div>
										<h4 style={{ color: "#fff", fontSize: "1rem", marginBottom: "4px" }}>
											سورة {job.surahNameArabic} ({job.surahNameEnglish})
										</h4>
										<p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
											القارئ: {job.reciterNameArabic}
										</p>
									</div>

									<div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "8px", marginTop: "auto" }}>
										<a
											href={job.videoUrl}
											download={job.outputFileName || "reel.mp4"}
											className="btn btn-primary btn-sm"
										>
											<Download size={15} />
											<span>تحميل MP4</span>
										</a>
										<button
											className="btn btn-secondary btn-sm"
											onClick={() => setSelectedJob(job)}
											title="مشاهدة الفيديو"
										>
											<Play size={15} />
										</button>
									</div>
								</div>
							</div>
						))}
					</div>
				)}
			</div>

			<PlayerModal job={selectedJob} onClose={() => setSelectedJob(null)} />
		</>
	);
}
