"use client";

import React, { useEffect, useState } from "react";
import { TopNavbar } from "@/components/TopNavbar";
import {
	Settings,
	HardDrive,
	Trash2,
	Save,
	RefreshCw,
	Camera,
	Link2,
	ShieldCheck,
	Copy,
	CheckCircle2,
	LogOut,
} from "lucide-react";

interface InstagramStatus {
	configured: boolean;
	connected: boolean;
	appId: string;
	username?: string;
	userId?: string;
	tokenExpiresAt?: string;
	callbackUrl: string;
}

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
	const [instagramStatus, setInstagramStatus] = useState<InstagramStatus | null>(null);
	const [instagramAppId, setInstagramAppId] = useState("");
	const [instagramAppSecret, setInstagramAppSecret] = useState("");
	const [instagramBusy, setInstagramBusy] = useState(false);
	const [instagramMessage, setInstagramMessage] = useState("");
	const [callbackCopied, setCallbackCopied] = useState(false);

	const loadInstagramStatus = async () => {
		const res = await fetch("/api/instagram/status");
		if (!res.ok) throw new Error("تعذر قراءة حالة Instagram");
		const status: InstagramStatus = await res.json();
		setInstagramStatus(status);
		setInstagramAppId(status.appId || "");
	};

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
		loadInstagramStatus().catch((error) => setInstagramMessage(error.message));
		const params = new URLSearchParams(window.location.search);
		if (params.get("instagram") === "connected") setInstagramMessage("تم ربط حساب Instagram بنجاح");
		if (params.get("instagram_error")) setInstagramMessage(`فشل الربط: ${params.get("instagram_error")}`);
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

	const saveInstagramCredentials = async (event: React.FormEvent) => {
		event.preventDefault();
		setInstagramBusy(true);
		setInstagramMessage("");
		try {
			const res = await fetch("/api/instagram/settings", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ appId: instagramAppId, appSecret: instagramAppSecret }),
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || "تعذر حفظ البيانات");
			setInstagramStatus(data);
			setInstagramAppSecret("");
			setInstagramMessage("تم حفظ بيانات Meta بأمان على هذا الجهاز");
		} catch (error: any) {
			setInstagramMessage(error.message);
		} finally {
			setInstagramBusy(false);
		}
	};

	const disconnectInstagram = async () => {
		if (!confirm("سيتم فصل حساب Instagram من الأداة. هل تريد المتابعة؟")) return;
		setInstagramBusy(true);
		try {
			const res = await fetch("/api/instagram/disconnect", { method: "POST" });
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || "تعذر فصل الحساب");
			setInstagramStatus(data);
			setInstagramMessage("تم فصل الحساب، وبقيت بيانات التطبيق محفوظة لإعادة الربط");
		} catch (error: any) {
			setInstagramMessage(error.message);
		} finally {
			setInstagramBusy(false);
		}
	};

	const copyCallbackUrl = async () => {
		if (!instagramStatus?.callbackUrl) return;
		await navigator.clipboard.writeText(instagramStatus.callbackUrl);
		setCallbackCopied(true);
		setTimeout(() => setCallbackCopied(false), 2000);
	};

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

			<div className="content-body" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 360px), 1fr))", gap: "28px" }}>
				<div className="glass-card instagram-connect-card">
					<div className="instagram-connect-header">
						<div className="instagram-mark"><Camera size={24} /></div>
						<div>
							<h2>ربط Instagram والنشر المباشر</h2>
							<p>اربط حساب Creator مرة واحدة، وبعدها انشر الريل والكابشن من الاستوديو.</p>
						</div>
						<div className={`instagram-status-pill ${instagramStatus?.connected ? "is-connected" : ""}`}>
							{instagramStatus?.connected ? <CheckCircle2 size={16} /> : <Link2 size={16} />}
							<span>{instagramStatus?.connected ? `@${instagramStatus.username || "Instagram"}` : "غير مربوط"}</span>
						</div>
					</div>

					<div className="instagram-security-note">
						<ShieldCheck size={20} />
						<span>الـSecret والـToken يُحفظان مشفّرين لحساب Windows الحالي، ولا تظهر قيمتهما مرة ثانية.</span>
					</div>

					<form onSubmit={saveInstagramCredentials} className="instagram-credentials-grid">
						<div className="form-group" style={{ margin: 0 }}>
							<label htmlFor="instagram-app-id">Instagram App ID</label>
							<input
								id="instagram-app-id"
								className="form-control"
								inputMode="numeric"
								autoComplete="off"
								value={instagramAppId}
								onChange={(event) => setInstagramAppId(event.target.value)}
								placeholder="الرقم الظاهر في لوحة Meta"
							/>
						</div>
						<div className="form-group" style={{ margin: 0 }}>
							<label htmlFor="instagram-app-secret">Instagram App Secret</label>
							<input
								id="instagram-app-secret"
								type="password"
								className="form-control"
								autoComplete="new-password"
								value={instagramAppSecret}
								onChange={(event) => setInstagramAppSecret(event.target.value)}
								placeholder={instagramStatus?.configured ? "محفوظ — اتركه فارغًا للإبقاء عليه" : "الصق السر الجديد هنا"}
							/>
						</div>
						<button className="btn btn-secondary" type="submit" disabled={instagramBusy}>
							<Save size={17} />
							<span>{instagramBusy ? "جاري الحفظ..." : "حفظ بيانات Meta"}</span>
						</button>
					</form>

					<div className="instagram-callback-row">
						<div>
							<span className="instagram-step-label">رابط الرجوع المطلوب داخل Meta</span>
							<code dir="ltr">{instagramStatus?.callbackUrl || "http://localhost:3000/api/instagram/callback"}</code>
						</div>
						<button type="button" className="btn btn-outline btn-sm" onClick={copyCallbackUrl}>
							{callbackCopied ? <CheckCircle2 size={15} /> : <Copy size={15} />}
							<span>{callbackCopied ? "تم النسخ" : "نسخ الرابط"}</span>
						</button>
					</div>

					{instagramMessage && <div className="instagram-message">{instagramMessage}</div>}

					<div className="instagram-actions">
						<button
							type="button"
							className="btn btn-primary"
							disabled={!instagramStatus?.configured || instagramBusy || instagramStatus.connected}
							onClick={() => { window.location.href = "http://localhost:3000/api/instagram/connect"; }}
						>
							<Camera size={18} />
							<span>{instagramStatus?.connected ? "الحساب مربوط" : "ربط حساب Instagram"}</span>
						</button>
						<a className="btn btn-outline" href="https://developers.facebook.com/apps/" target="_blank" rel="noreferrer">
							فتح لوحة Meta
						</a>
						{instagramStatus?.connected && (
							<button type="button" className="btn btn-secondary" onClick={disconnectInstagram} disabled={instagramBusy}>
								<LogOut size={17} />
								<span>فصل الحساب</span>
							</button>
						)}
					</div>
				</div>

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

