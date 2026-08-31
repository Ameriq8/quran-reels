"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { TopNavbar } from "@/components/TopNavbar";
import { Mic, Search, Play, Pause, Star, Video } from "lucide-react";

export default function RecitersPage() {
	const [reciters, setReciters] = useState<any[]>([]);
	const [countryFilter, setCountryFilter] = useState("ALL");
	const [searchQuery, setSearchQuery] = useState("");
	const [favorites, setFavorites] = useState<string[]>([]);
	const [playingId, setPlayingId] = useState<string | null>(null);

	const audioRef = useRef<HTMLAudioElement | null>(null);

	useEffect(() => {
		const loadReciters = async () => {
			try {
				const r = await fetch("/api/reciters");
				if (r.ok) {
					const data = await r.json();
					setReciters(data.reciters || []);
				}
			} catch (e) {}
		};
		loadReciters();

		// Load favorites
		const saved = localStorage.getItem("fav_reciters");
		if (saved) {
			try {
				setFavorites(JSON.parse(saved));
			} catch (e) {}
		}
	}, []);

	const toggleFavorite = (id: string) => {
		let updated = [...favorites];
		if (updated.includes(id)) {
			updated = updated.filter((x) => x !== id);
		} else {
			updated.push(id);
		}
		setFavorites(updated);
		localStorage.setItem("fav_reciters", JSON.stringify(updated));
	};

	const handlePlayAudio = (reciterId: string) => {
		if (playingId === reciterId) {
			audioRef.current?.pause();
			setPlayingId(null);
		} else {
			if (!audioRef.current) {
				audioRef.current = new Audio();
				audioRef.current.onended = () => setPlayingId(null);
			}
			audioRef.current.src = `/api/reciters/${reciterId}/preview`;
			audioRef.current.play();
			setPlayingId(reciterId);
		}
	};

	const filtered = reciters.filter((r) => {
		// Country Tab
		if (countryFilter === "FAV") {
			if (!favorites.includes(r.id)) return false;
		} else if (countryFilter !== "ALL") {
			if (r.countryCode !== countryFilter) return false;
		}

		// Search
		if (searchQuery) {
			const q = searchQuery.toLowerCase();
			return r.nameArabic.toLowerCase().includes(q) || r.nameEnglish.toLowerCase().includes(q);
		}
		return true;
	});

	return (
		<>
			<TopNavbar title="كتالوج القراء • تلاوات خاشعة" />

			<div className="content-body">
				{/* Filter & Search Header */}
				<div
					className="glass-card"
					style={{
						display: "flex",
						flexDirection: "column",
						gap: "18px",
						marginBottom: "28px",
					}}
				>
					<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "20px", flexWrap: "wrap" }}>
						{/* Tabs */}
						<div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
							{[
								{ id: "ALL", label: "الكل" },
								{ id: "IQ", label: "🇮🇶 العراق" },
								{ id: "SA", label: "🇸🇦 الخليج" },
								{ id: "EG", label: "🇪🇬 مصر" },
								{ id: "FAV", label: "⭐ المفضلة" },
							].map((tab) => (
								<button
									key={tab.id}
									className={`btn btn-sm ${countryFilter === tab.id ? "btn-primary" : "btn-secondary"}`}
									onClick={() => setCountryFilter(tab.id)}
								>
									{tab.label}
								</button>
							))}
						</div>

						{/* Search */}
						<div style={{ position: "relative", minWidth: "300px" }}>
							<Search
								size={18}
								color="var(--text-dim)"
								style={{ position: "absolute", right: "14px", top: "50%", transform: "translateY(-50%)" }}
							/>
							<input
								type="text"
								className="form-control"
								placeholder="ابحث بالاسم (رعد الكردي، المنشاوي، Alafasy)..."
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								style={{ paddingRight: "42px" }}
							/>
						</div>
					</div>
				</div>

				{/* Reciters Grid */}
				<div
					style={{
						display: "grid",
						gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
						gap: "20px",
					}}
				>
					{filtered.map((r) => {
						const isFav = favorites.includes(r.id);
						const isPlaying = playingId === r.id;

						return (
							<div
								key={r.id}
								className="glass-card"
								style={{
									display: "flex",
									flexDirection: "column",
									justifyContent: "space-between",
									gap: "16px",
								}}
							>
								<div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
									<div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
										<span style={{ fontSize: "2.2rem" }}>
											{r.countryCode === "IQ" ? "🇮🇶" : r.countryCode === "SA" ? "🇸🇦" : "🇪🇬"}
										</span>
										<div>
											<h3 style={{ color: "#fff", fontSize: "1.05rem", marginBottom: "2px" }}>{r.nameArabic}</h3>
											<p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
												{r.countryArabic} • {r.qiraat || "حفص عن عاصم"}
											</p>
										</div>
									</div>

									<button
										onClick={() => toggleFavorite(r.id)}
										style={{ background: "none", border: "none", cursor: "pointer", color: isFav ? "#eab308" : "var(--text-dim)" }}
									>
										<Star size={20} fill={isFav ? "#eab308" : "none"} />
									</button>
								</div>

								<div style={{ display: "flex", gap: "8px" }}>
									<button
										className={`btn btn-sm ${isPlaying ? "btn-primary" : "btn-secondary"}`}
										onClick={() => handlePlayAudio(r.id)}
										style={{ flex: 1 }}
									>
										{isPlaying ? <Pause size={16} /> : <Play size={16} />}
										<span>{isPlaying ? "إيقاف التلاوة" : "استماع عينة"}</span>
									</button>

									<Link href={`/studio`} className="btn btn-outline btn-sm" style={{ flex: 1.2 }}>
										<Video size={16} />
										<span>إنشاء ريل 🎬</span>
									</Link>
								</div>
							</div>
						);
					})}
				</div>
			</div>
		</>
	);
}
