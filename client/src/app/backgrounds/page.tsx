"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { TopNavbar } from "@/components/TopNavbar";
import { FolderOpen, Image as ImageIcon, Upload, Video } from "lucide-react";

export default function BackgroundsPage() {
	const [backgrounds, setBackgrounds] = useState<any[]>([]);
	const [activeCategory, setActiveCategory] = useState("all");
	const [isUploading, setIsUploading] = useState(false);
	const [folders, setFolders] = useState({ images: "", videos: "" });

	const fetchBackgrounds = async () => {
		try {
			const res = await fetch("/api/backgrounds");
			if (res.ok) {
				const list = await res.json();
				setBackgrounds(list);
			}
		} catch (e) {
			console.warn("Failed to fetch backgrounds:", e);
		}
	};

	useEffect(() => {
		fetchBackgrounds();
		fetch("/api/backgrounds/paths").then((res) => res.json()).then(setFolders).catch(console.warn);
	}, []);

	const openFolder = async (type: "images" | "videos") => {
		const res = await fetch("/api/backgrounds/open-folder", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ type }),
		});
		if (!res.ok) alert("تعذر فتح المجلد");
	};

	const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const files = e.target.files;
		if (!files || files.length === 0) return;

		try {
			setIsUploading(true);
			const formData = new FormData();
			formData.append("file", files[0]);
			const res = await fetch("/api/backgrounds/upload", {
				method: "POST",
				body: formData,
			});

			if (res.ok) fetchBackgrounds();
		} catch (err) {
			console.error("Upload error:", err);
		} finally {
			setIsUploading(false);
		}
	};

	const filtered = backgrounds.filter((bg) => {
		if (activeCategory === "all") return true;
		return bg.category === activeCategory;
	});

	return (
		<>
			<TopNavbar title="مكتبة الخلفيات والفيديوهات" />

			<div className="content-body">
				<div
					className="glass-card"
					style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "12px", marginBottom: "16px" }}
				>
					{[
						{ type: "images" as const, title: "مكان الصور", path: folders.images, icon: <ImageIcon size={20} /> },
						{ type: "videos" as const, title: "مكان الفيديوهات", path: folders.videos, icon: <Video size={20} /> },
					].map((folder) => (
						<div key={folder.type} style={{ padding: "14px", border: "1px solid var(--border)", borderRadius: "14px", background: "rgba(0,0,0,.18)" }}>
							<div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--gold)", marginBottom: "8px" }}>
								{folder.icon}<strong>{folder.title}</strong>
							</div>
							<code dir="ltr" style={{ display: "block", color: "var(--text-dim)", overflowWrap: "anywhere", marginBottom: "12px" }}>
								{folder.path || "جاري تحديد المسار..."}
							</code>
							<button className="btn btn-outline btn-sm" onClick={() => openFolder(folder.type)} disabled={!folder.path}>
								<FolderOpen size={16} /><span>فتح المجلد</span>
							</button>
						</div>
					))}
				</div>

				{/* Top Controls */}
				<div
					className="glass-card"
					style={{
						display: "flex",
						justifyContent: "space-between",
						alignItems: "center",
						marginBottom: "28px",
						gap: "20px",
						flexWrap: "wrap",
					}}
				>
					{/* Categories */}
					<div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
						{[
							{ id: "all", label: "الكل" },
							{ id: "إسلامية ومساجد", label: "🕌 مساجد وعمارة" },
							{ id: "مصحف وتفاصيل", label: "📖 مصحف وتفاصيل" },
							{ id: "أشخاص وقراءة", label: "👤 أشخاص وقراءة" },
							{ id: "طبيعة وسماء", label: "🌿 طبيعة وسماء" },
							{ id: "فيديوهات", label: "🎬 فيديوهات" },
						].map((tab) => (
							<button
								key={tab.id}
								className={`btn btn-sm ${activeCategory === tab.id ? "btn-primary" : "btn-secondary"}`}
								onClick={() => setActiveCategory(tab.id)}
							>
								{tab.label}
							</button>
						))}
					</div>

					{/* Upload Button */}
					<div>
						<label className="btn btn-outline btn-sm" style={{ cursor: "pointer" }}>
							<Upload size={16} />
							<span>{isUploading ? "جاري الرفع..." : "رفع صورة 📤"}</span>
							<input
								type="file"
								accept="image/jpeg,image/png,image/webp"
								onChange={handleUpload}
								style={{ display: "none" }}
								disabled={isUploading}
							/>
						</label>
					</div>
				</div>

				{/* Backgrounds Grid */}
				<div
					style={{
						display: "grid",
						gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
						gap: "20px",
					}}
				>
					{filtered.map((bg) => (
						<div
							key={bg.filename}
							className="glass-card"
							style={{
								padding: "0",
								overflow: "hidden",
								display: "flex",
								flexDirection: "column",
							}}
						>
							<div style={{ position: "relative", width: "100%", aspectRatio: "9/16", background: "#000" }}>
								{bg.isVideo ? (
									<video src={bg.url} muted preload="metadata" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
								) : (
									<img src={bg.url} alt={bg.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
								)}
							</div>

							<div style={{ padding: "14px", display: "flex", flexDirection: "column", gap: "10px" }}>
								<div>
									<h4 style={{ color: "#fff", fontSize: "0.92rem", marginBottom: "2px" }}>{bg.name}</h4>
									<span style={{ color: "var(--text-dim)", fontSize: "0.78rem" }}>{bg.resolution || "1080x1920"}</span>
								</div>

								<Link href={`/studio?background=${encodeURIComponent(bg.filename)}`} className="btn btn-primary btn-sm btn-block">
									<Video size={14} />
									<span>استخدام بالاستوديو</span>
								</Link>
							</div>
						</div>
					))}
				</div>
			</div>
		</>
	);
}
