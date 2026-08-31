"use client";

import React, { useEffect, useState } from "react";
import { TopNavbar } from "@/components/TopNavbar";
import {
	Settings,
	HardDrive,
	Trash2,
	Save,
	RefreshCw,
} from "lucide-react";

export default function SettingsPage() {
	const [storage, setStorage] = useState<any>({
		audioCacheMb: "0.00",
		outputMb: "0.00",
		outputsMb: "0.00",
		assetsMb: "0.00",
		tempMb: "0.00",
		totalMb: "0.00",
		audioCacheFormatted: "0 MB",
		outputsFormatted: "0 MB",
		assetsFormatted: "0 MB",
		tempCacheFormatted: "0 MB",
		totalFormatted: "0 MB",
	});
	const [isCleaning, setIsCleaning] = useState(false);
	const [reciters, setReciters] = useState<any[]>([]);
	const [templates, setTemplates] = useState<any[]>([]);

	const [defaultReciter, setDefaultReciter] = useState("ea-dossari");
	const [defaultTemplate, setDefaultTemplate] = useState("mushaf-focus");
	const [iraqiFirst, setIraqiFirst] = useState(true);
	const [savedMessage, setSavedMessage] = useState(false);

	const fetchStorage = async () => {
		try {
			const res = await fetch("/api/settings/storage");
			if (res.ok) {
				const data = await res.json();
				setStorage(data);
			} else {
				const statsRes = await fetch("/api/stats");
				if (statsRes.ok) {
					const statsData = await statsRes.json();
					if (statsData.storage) {
						setStorage(statsData.storage);
					}
				}
			}
		} catch (e) {
			console.warn("Failed to fetch storage info:", e);
		}
	};

	useEffect(() => {
		fetchStorage();
		const loadMeta = async () => {
			try {
				const [rRes, tRes] = await Promise.all([
					fetch("/api/reciters"),
					fetch("/api/templates"),
				]);
				if (rRes.ok) {
					const d = await rRes.json();
					setReciters(d.reciters || []);
				}
				if (tRes.ok) setTemplates(await tRes.json());
			} catch (e) {}
		};
		loadMeta();

		// Load settings
		const saved = localStorage.getItem("studio_settings");
		if (saved) {
			try {
				const s = JSON.parse(saved);
				if (s.defaultReciter) setDefaultReciter(s.defaultReciter);
				if (s.defaultTemplate) setDefaultTemplate(s.defaultTemplate);
				if (typeof s.iraqiFirst === "boolean") setIraqiFirst(s.iraqiFirst);
			} catch (e) {}
		}
	}, []);

	const handleCleanTemp = async () => {
		if (!confirm("هل أنت متأكد من رغبتك في تفريغ مجلد الملفات المؤقتة؟")) return;
		try {
			setIsCleaning(true);
			await fetch("/api/settings/clean-temp", { method: "POST" });
			await fetchStorage();
		} catch (e) {
			console.error(e);
		} finally {
			setIsCleaning(false);
		}
	};

	const handleCleanAudio = async () => {
		if (!confirm("هل أنت متأكد من مسح كاش التلاوات الصوتية المحملة؟")) return;
		try {
			setIsCleaning(true);
			await fetch("/api/settings/clean-audio", { method: "POST" });
			await fetchStorage();
		} catch (e) {
			console.error(e);
		} finally {
			setIsCleaning(false);
		}
	};

	const handleSaveSettings = (e: React.FormEvent) => {
		e.preventDefault();
		const s = { defaultReciter, defaultTemplate, iraqiFirst };
		localStorage.setItem("studio_settings", JSON.stringify(s));
		setSavedMessage(true);
		setTimeout(() => setSavedMessage(false), 2500);
	};

	return (
		<>
			<TopNavbar title="الإعدادات وإدارة التخزين" />

			<div className="content-body" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: "28px" }}>
				{/* Storage Management Card */}
				<div className="glass-card">
					<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
						<div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
							<HardDrive size={22} color="var(--gold-light)" />
							<h2 style={{ color: "#fff", fontSize: "1.15rem", margin: 0 }}>إدارة مساحة التخزين المؤقتة</h2>
						</div>
						<button
							type="button"
							className="btn btn-outline btn-sm"
							onClick={fetchStorage}
							style={{ fontSize: "0.75rem", padding: "4px 8px" }}
							title="تحديث البيانات"
						>
							<RefreshCw size={13} className={isCleaning ? "spin" : ""} />
							<span>تحديث</span>
						</button>
					</div>

					<div style={{ display: "flex", flexDirection: "column", gap: "14px", marginBottom: "24px" }}>
						<div style={{ display: "flex", justifyContent: "space-between", padding: "12px", background: "var(--bg-input)", borderRadius: "var(--radius-md)" }}>
							<span style={{ color: "var(--text-muted)" }}>كاش التلاوات الصوتية (Audio Cache):</span>
							<strong style={{ color: "#fff" }}>{storage.audioCacheFormatted || `${storage.audioCacheMb || "0.00"} MB`}</strong>
						</div>

						<div style={{ display: "flex", justifyContent: "space-between", padding: "12px", background: "var(--bg-input)", borderRadius: "var(--radius-md)" }}>
							<span style={{ color: "var(--text-muted)" }}>فيديوهات الرندر المكتملة (Outputs):</span>
							<strong style={{ color: "#fff" }}>{storage.outputsFormatted || `${storage.outputMb || storage.outputsMb || "0.00"} MB`}</strong>
						</div>

						<div style={{ display: "flex", justifyContent: "space-between", padding: "12px", background: "var(--bg-input)", borderRadius: "var(--radius-md)" }}>
							<span style={{ color: "var(--text-muted)" }}>ملفات المعالجة المؤقتة (Temp):</span>
							<strong style={{ color: "#fff" }}>{storage.tempCacheFormatted || `${storage.tempMb || "0.00"} MB`}</strong>
						</div>

						<div style={{ display: "flex", justifyContent: "space-between", padding: "12px", background: "var(--bg-input)", borderRadius: "var(--radius-md)" }}>
							<span style={{ color: "var(--text-muted)" }}>مجلد الوسائط والخلفيات (Assets):</span>
							<strong style={{ color: "#fff" }}>{storage.assetsFormatted || `${storage.assetsMb || "0.00"} MB`}</strong>
						</div>

						<div style={{ display: "flex", justifyContent: "space-between", padding: "14px", background: "rgba(212, 175, 55, 0.1)", borderRadius: "var(--radius-md)", border: "1px solid var(--border-color)" }}>
							<span style={{ color: "var(--gold-light)", fontWeight: 600 }}>إجمالي المساحة المستخدمة:</span>
							<strong style={{ color: "var(--gold-light)", fontSize: "1.1rem" }}>{storage.totalFormatted || `${storage.totalMb || "0.00"} MB`}</strong>
						</div>
					</div>

					<div style={{ display: "flex", gap: "12px" }}>
						<button className="btn btn-secondary btn-sm" onClick={handleCleanTemp} disabled={isCleaning} style={{ flex: 1 }}>
							<Trash2 size={15} />
							<span>تنظيف الملفات المؤقتة</span>
						</button>

						<button className="btn btn-secondary btn-sm" onClick={handleCleanAudio} disabled={isCleaning} style={{ flex: 1 }}>
							<Trash2 size={15} />
							<span>مسح كاش الصوت</span>
						</button>
					</div>
				</div>

				{/* App Preferences */}
				<div className="glass-card">
					<div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
						<Settings size={22} color="var(--gold-light)" />
						<h2 style={{ color: "#fff", fontSize: "1.15rem", margin: 0 }}>تفضيلات الاستوديو الافتراضية</h2>
					</div>

					<form onSubmit={handleSaveSettings} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
						<div className="form-group">
							<label>القارئ الافتراضي عند فتح الاستوديو</label>
							<select
								className="form-control"
								value={defaultReciter}
								onChange={(e) => setDefaultReciter(e.target.value)}
							>
								{reciters.map((r) => (
									<option key={r.id} value={r.id}>
										{r.nameArabic} ({r.countryArabic})
									</option>
								))}
							</select>
						</div>

						<div className="form-group">
							<label>القالب الافتراضي</label>
							<select
								className="form-control"
								value={defaultTemplate}
								onChange={(e) => setDefaultTemplate(e.target.value)}
							>
								{templates.map((t) => (
									<option key={t.id} value={t.id}>
										{t.nameArabic}
									</option>
								))}
							</select>
						</div>

						<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0" }}>
							<span style={{ color: "#fff", fontSize: "0.92rem" }}>إعطاء الأولوية لقراء العراق 🇮🇶 في القوائم</span>
							<label className="switch">
								<input type="checkbox" checked={iraqiFirst} onChange={(e) => setIraqiFirst(e.target.checked)} />
								<span className="slider"></span>
							</label>
						</div>

						{savedMessage && (
							<div style={{ padding: "10px 14px", borderRadius: "var(--radius-md)", background: "rgba(16, 185, 129, 0.15)", color: "var(--emerald)", fontSize: "0.9rem" }}>
								✓ تم حفظ الإعدادات بنجاح!
							</div>
						)}

						<button type="submit" className="btn btn-primary btn-block" style={{ marginTop: "10px" }}>
							<Save size={16} />
							<span>حفظ التفضيلات</span>
						</button>
					</form>
				</div>
			</div>
		</>
	);
}

