"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { TopNavbar } from "@/components/TopNavbar";
import { Palette, Check, Video, Type } from "lucide-react";

export default function TemplatesPage() {
	const [templates, setTemplates] = useState<any[]>([]);

	useEffect(() => {
		const loadTemplates = async () => {
			try {
				const r = await fetch("/api/templates");
				if (r.ok) setTemplates(await r.json());
			} catch (e) {}
		};
		loadTemplates();
	}, []);

	return (
		<>
			<TopNavbar title="قوالب التصميم والأنماط البصرية" />

			<div className="content-body">
				<div
					style={{
						display: "grid",
						gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 360px), 1fr))",
						gap: "24px",
					}}
				>
					{templates.map((tpl) => (
						<div
							key={tpl.id}
							className="glass-card"
							style={{
								display: "flex",
								flexDirection: "column",
								justifyContent: "space-between",
								gap: "20px",
							}}
						>
							<div>
								<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
									<h3 style={{ color: "#fff", fontSize: "1.15rem" }}>{tpl.nameArabic}</h3>
									<span className="nav-badge badge-gold">{tpl.nameEnglish}</span>
								</div>

								<p style={{ color: "var(--text-muted)", fontSize: "0.9rem", marginBottom: "16px" }}>
									{tpl.description}
								</p>

								{/* Template Specs */}
								<div style={{ background: "var(--bg-input)", padding: "14px", borderRadius: "var(--radius-md)", border: "1px solid var(--border-light)", display: "flex", flexDirection: "column", gap: "8px", fontSize: "0.85rem" }}>
									<div style={{ display: "flex", justifyContent: "space-between" }}>
										<span style={{ color: "var(--text-dim)" }}>الخط العربي:</span>
										<strong style={{ color: "#fff" }}>{tpl.arabicFont || tpl.fontFamily || "Scheherazade New"}</strong>
									</div>
									<div style={{ display: "flex", justifyContent: "space-between" }}>
										<span style={{ color: "var(--text-dim)" }}>حجم خط الآيات:</span>
										<strong style={{ color: "var(--gold-light)" }}>{tpl.arabicFontSize || tpl.fontSize || 68}px</strong>
									</div>
									<div style={{ display: "flex", justifyContent: "space-between" }}>
										<span style={{ color: "var(--text-dim)" }}>لون النص الأساسي:</span>
										<div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
											<div style={{ width: "12px", height: "12px", borderRadius: "50%", background: tpl.textColor }} />
											<strong style={{ color: "#fff" }}>{tpl.textColor}</strong>
										</div>
									</div>
									<div style={{ display: "flex", justifyContent: "space-between" }}>
										<span style={{ color: "var(--text-dim)" }}>تعتيم الخلفية:</span>
										<strong style={{ color: "#fff" }}>{(tpl.overlayOpacity * 100).toFixed(0)}%</strong>
									</div>
								</div>
							</div>

							<Link href={`/studio?template=${encodeURIComponent(tpl.id)}`} className="btn btn-primary btn-block">
								<Video size={16} />
								<span>تطبيق هذا القالب في الاستوديو</span>
							</Link>
						</div>
					))}
				</div>
			</div>
		</>
	);
}
