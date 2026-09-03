"use client";

import React, { useEffect, useState } from "react";
import { X, Download, Copy, Check, Camera, Send } from "lucide-react";

export interface IPlayerJob {
	id: string;
	surahNameArabic?: string;
	surahNameEnglish?: string;
	reciterNameArabic?: string;
	duration?: number;
	outputFileName?: string;
	videoUrl?: string;
	options?: {
		surah: number;
		verseStart: number;
		verseCount: number;
	};
}

interface PlayerModalProps {
	job: IPlayerJob | null;
	onClose: () => void;
	initialInstagramMediaId?: string;
	initialInstagramError?: string;
}

export function buildInstagramCaption(job: IPlayerJob) {
	const rawSurah = job.surahNameArabic ? job.surahNameArabic.replace(/^سورة\s+/, "") : `القرآن`;
	const surahName = `سورة ${rawSurah}`;
	const cleanSurahTag = rawSurah.replace(/[\s\-]/g, "_");
	const reciterName = job.reciterNameArabic || "تلاوة خاشعة";
	const cleanReciterTag = reciterName.replace(/[\s\-]/g, "_");
	const firstAyah = job.options?.verseStart || 1;
	const verseCount = job.options?.verseCount || 1;
	const lastAyah = firstAyah + verseCount - 1;
	const verseRangeStr = verseCount > 1 ? `الآيات (${firstAyah} - ${lastAyah})` : `الآية (${firstAyah})`;

	return `✨ تلاوة خاشعة تأخذك إلى عالم من الطمأنينة والسكينة 🌿
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

🔔 فعّل التنبيهات ليصلك كل يوم مقطع جديد من روائع التلاوات الخاشعة.

.
.
#قرآن #قرآن_كريم #تلاوة_خاشعة #سورة_${cleanSurahTag} #${cleanReciterTag} #تلاوات_قرانية #طمأنينة #راحة_نفسية #أدعية #أذكار #صدقة_جارية #أجر_لي_ولك #اسلاميات #اكسبلور #اكسبلور_فولو #ريلز #ريلز_قران
#quran #quranrecitation #islam #islamicreels #quranquotes #islamicreminders #reels #explore #foryou #fyp #viralreels #Khair_qur`;
}

export async function publishInstagramJob(jobId: string, caption: string) {
	const response = await fetch("http://127.0.0.1:3000/api/instagram/publish", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ jobId, caption }),
	});
	const text = await response.text();
	let result: any = {};
	try { result = JSON.parse(text); } catch {}
	if (!response.ok) throw new Error(result.error || "تعذر إكمال النشر على Instagram");
	if (result.status === "published") return result;

	for (let attempt = 0; attempt < 180; attempt++) {
		await new Promise((resolve) => setTimeout(resolve, 2000));
		const statusResponse = await fetch(`http://127.0.0.1:3000/api/instagram/publication?jobId=${encodeURIComponent(jobId)}`, { cache: "no-store" });
		const status = await statusResponse.json();
		if (status.status === "published") return status;
		if (status.status === "failed") throw new Error(status.error || "فشل النشر على Instagram");
	}
	throw new Error("استمر النشر بالخلفية أكثر من المتوقع؛ راجع سجل الريلز بعد قليل");
}

export function PlayerModal({ job, onClose, initialInstagramMediaId, initialInstagramError }: PlayerModalProps) {
	const [copied, setCopied] = useState(false);
	const [caption, setCaption] = useState("");
	const [publishing, setPublishing] = useState(false);
	const [instagramMediaId, setInstagramMediaId] = useState(initialInstagramMediaId || "");
	const [instagramError, setInstagramError] = useState(initialInstagramError || "");

	useEffect(() => {
		if (!job) return;
		setCaption(buildInstagramCaption(job));
		setInstagramMediaId(initialInstagramMediaId || "");
		setInstagramError(initialInstagramError || "");
	}, [job?.id, initialInstagramMediaId, initialInstagramError]);

	if (!job) return null;

	const rawSurah = job.surahNameArabic ? job.surahNameArabic.replace(/^سورة\s+/, "") : `القرآن`;
	const surahName = `سورة ${rawSurah}`;
	const reciterName = job.reciterNameArabic || "تلاوة خاشعة";

	const handleCopy = () => {
		navigator.clipboard.writeText(caption);
		setCopied(true);
		setTimeout(() => setCopied(false), 2500);
	};

	const handlePublish = async () => {
		if (!confirm("سيُنشر هذا الريل الآن مباشرة على حساب Instagram المربوط. متابعة؟")) return;
		setPublishing(true);
		setInstagramError("");
		try {
			const result = await publishInstagramJob(job.id, caption);
			setInstagramMediaId(result.mediaId);
		} catch (error: any) {
			setInstagramError(error.message);
		} finally {
			setPublishing(false);
		}
	};

	return (
		<div className="modal-backdrop" onClick={onClose}>
			<div className="modal-card modal-player" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "860px" }}>
				<div className="modal-header">
					<h3>مشاهدة الريل • {surahName} ({reciterName})</h3>
					<button className="btn btn-secondary btn-sm" onClick={onClose}>
						<X size={18} />
					</button>
				</div>

				<div className="modal-body" style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: "24px", alignItems: "center" }}>
					<div className="phone-mockup" style={{ width: "300px", height: "533px", borderRadius: "24px" }}>
						<video
							src={job.videoUrl}
							controls
							loop
							playsInline
							style={{ width: "100%", height: "100%", objectFit: "cover" }}
						/>
					</div>

					<div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
						<div style={{ background: "var(--bg-input)", padding: "16px", borderRadius: "var(--radius-md)", border: "1px solid var(--border-light)" }}>
							<h4 style={{ color: "#fff", marginBottom: "6px" }}>تفاصيل الفيديو:</h4>
							<p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
								⏱️ المدة: <strong>{job.duration?.toFixed(1)} ثانية</strong>
							</p>
							<p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
								📱 الأبعاد: <strong>1080x1920 (9:16 Shorts/Reels)</strong>
							</p>
						</div>

						<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
							<a
								href={job.videoUrl}
								download={job.outputFileName || "quran_reel.mp4"}
								className="btn btn-primary"
								style={{ width: "100%", fontSize: "0.9rem" }}
							>
								<Download size={18} />
								<span>تحميل MP4</span>
							</a>

							<button className="btn btn-secondary" onClick={handleCopy} style={{ width: "100%", fontSize: "0.9rem" }}>
								{copied ? <Check size={18} color="var(--emerald)" /> : <Copy size={18} />}
								<span>{copied ? "✓ تم النسخ!" : "نسخ الوصف 📋"}</span>
							</button>
						</div>

						<button
							type="button"
							className="btn btn-primary btn-block"
							onClick={handlePublish}
							disabled={publishing || Boolean(instagramMediaId)}
						>
							{instagramMediaId ? <Check size={18} /> : publishing ? <Send size={18} /> : <Camera size={18} />}
							<span>{instagramMediaId ? "تم النشر على Instagram" : publishing ? "جاري الرفع والنشر..." : "نشر الريل على Instagram"}</span>
						</button>
						{instagramError && (
							<div role="alert" style={{ padding: "10px 12px", borderRadius: "var(--radius-md)", background: "rgba(239, 68, 68, 0.12)", color: "#fca5a5", fontSize: "0.84rem" }}>
								{instagramError}
							</div>
						)}

						<div className="form-group" style={{ margin: 0 }}>
							<label style={{ fontSize: "0.82rem" }}>معاينة وصف الفيديو والهاشتاجات (Caption):</label>
							<textarea
								className="form-control"
								rows={6}
								value={caption}
								onChange={(event) => setCaption(event.target.value)}
								maxLength={2200}
								style={{ fontSize: "0.82rem", resize: "vertical", whiteSpace: "pre-wrap", lineHeight: 1.5 }}
							/>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
