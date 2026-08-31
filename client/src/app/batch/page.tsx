"use client";

import React, { useEffect, useState } from "react";
import { TopNavbar } from "@/components/TopNavbar";
import { Layers, Rocket, Check, AlertCircle } from "lucide-react";

export default function BatchPage() {
	const [surahs, setSurahs] = useState<any[]>([]);
	const [reciters, setReciters] = useState<any[]>([]);
	const [templates, setTemplates] = useState<any[]>([]);

	const [selectedSurah, setSelectedSurah] = useState(112); // Al-Ikhlas
	const [selectedReciter, setSelectedReciter] = useState("ea-dossari");
	const [selectedTemplate, setSelectedTemplate] = useState("mushaf-focus");
	const [chunkSize, setChunkSize] = useState(3); // Ayahs per reel

	const [isSubmitting, setIsSubmitting] = useState(false);
	const [resultMessage, setResultMessage] = useState<string | null>(null);

	useEffect(() => {
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
	}, []);

	const handleBatchGenerate = async (e: React.FormEvent) => {
		e.preventDefault();
		try {
			setIsSubmitting(true);
			setResultMessage(null);

			const res = await fetch("/api/batch/generate", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					surah: selectedSurah,
					reciterId: selectedReciter,
					templateId: selectedTemplate,
					chunkSize,
				}),
			});

			const data = await res.json();
			if (data.jobs) {
				setResultMessage(`✓ تمت إضافة ${data.jobs.length} مهام ريلز بنجاح إلى طابور الإنتاج المباشر!`);
			}
		} catch (err: any) {
			setResultMessage(`حدث خطأ: ${err.message}`);
		} finally {
			setIsSubmitting(false);
		}
	};

	const currentSurahObj = surahs.find((s) => s.id === selectedSurah);
	const totalVerses = currentSurahObj?.verses_count || 1;
	const estimatedReelsCount = Math.ceil(totalVerses / chunkSize);

	return (
		<>
			<TopNavbar title="الإنشاء المتعدد للريلز (Batch Generator)" />

			<div className="content-body" style={{ maxWidth: "800px" }}>
				<div className="glass-card">
					<div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
						<div className="stat-icon-wrap" style={{ background: "rgba(212, 175, 55, 0.15)", color: "var(--gold-light)" }}>
							<Layers size={24} />
						</div>
						<div>
							<h2 style={{ color: "#fff", fontSize: "1.2rem" }}>إنتاج سورة كاملة مقطعة إلى ريلز</h2>
							<p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
								تقسيم آلي للسورة إلى أجزاء متناسقة وتوليدها دفعة واحدة في طابور الرندر.
							</p>
						</div>
					</div>

					<form onSubmit={handleBatchGenerate} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
						<div className="form-group">
							<label>اختر السورة</label>
							<select
								className="form-control"
								value={selectedSurah}
								onChange={(e) => setSelectedSurah(parseInt(e.target.value, 10))}
							>
								{surahs.map((s) => (
									<option key={s.id} value={s.id}>
										{s.id} - سورة {s.name_arabic} ({s.name_simple}) • {s.verses_count} آية
									</option>
								))}
							</select>
						</div>

						<div className="form-group">
							<label>عدد الآيات في كل فيديو (Reel Chunk Size)</label>
							<select
								className="form-control"
								value={chunkSize}
								onChange={(e) => setChunkSize(parseInt(e.target.value, 10))}
							>
								<option value={1}>آية واحدة في كل ريل (1 Ayah per Reel)</option>
								<option value={2}>آيتان في كل ريل (2 Ayat per Reel)</option>
								<option value={3}>3 آيات في كل ريل (3 Ayat per Reel - مستحسن)</option>
								<option value={5}>5 آيات في كل ريل (5 Ayat per Reel)</option>
							</select>
						</div>

						<div className="form-group">
							<label>القارئ</label>
							<select
								className="form-control"
								value={selectedReciter}
								onChange={(e) => setSelectedReciter(e.target.value)}
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
								value={selectedTemplate}
								onChange={(e) => setSelectedTemplate(e.target.value)}
							>
								{templates.map((t) => (
									<option key={t.id} value={t.id}>
										{t.nameArabic}
									</option>
								))}
							</select>
						</div>

						<div style={{ background: "var(--bg-input)", padding: "16px", borderRadius: "var(--radius-md)", border: "1px solid var(--border-light)" }}>
							<div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
								<span style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>عدد الفيديوهات التي سيتم توليدها:</span>
								<strong style={{ color: "var(--gold-light)", fontSize: "1.1rem" }}>{estimatedReelsCount} فيديو</strong>
							</div>
							<span style={{ color: "var(--text-dim)", fontSize: "0.8rem" }}>
								(إجمالي {totalVerses} آيات مقسمة على دفعات من {chunkSize} آيات)
							</span>
						</div>

						{resultMessage && (
							<div
								style={{
									padding: "12px 16px",
									borderRadius: "var(--radius-md)",
									background: resultMessage.startsWith("✓") ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
									color: resultMessage.startsWith("✓") ? "var(--emerald)" : "#f87171",
									fontSize: "0.9rem",
								}}
							>
								{resultMessage}
							</div>
						)}

						<button
							type="submit"
							className="btn btn-primary btn-lg btn-block"
							disabled={isSubmitting}
							style={{ marginTop: "10px" }}
						>
							<Rocket size={18} />
							<span>{isSubmitting ? "جاري جدولة المهام..." : `🚀 بدء إنتاج ${estimatedReelsCount} ريلز دفعة واحدة`}</span>
						</button>
					</form>
				</div>
			</div>
		</>
	);
}
