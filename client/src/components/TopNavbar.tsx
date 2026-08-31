"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sparkles, Dices, PlusCircle } from "lucide-react";

interface TopNavbarProps {
	title?: string;
}

export function TopNavbar({ title = "لوحة التحكم الرئيسية" }: TopNavbarProps) {
	const router = useRouter();
	const [isLoadingRandom, setIsLoadingRandom] = useState(false);

	const handleRandomAyah = async () => {
		try {
			setIsLoadingRandom(true);
			const res = await fetch("/api/reels/random-ayah");
			if (res.ok) {
				const data = await res.json();
				// Navigate to studio with query parameters
				router.push(`/studio?surah=${data.surah}&start=${data.verseStart}&count=${data.verseCount}`);
			}
		} catch (e) {
			console.error("Failed to pick random ayah:", e);
		} finally {
			setIsLoadingRandom(false);
		}
	};

	return (
		<header className="top-navbar">
			<div className="top-nav-title">
				<h1>{title}</h1>
			</div>

			<div className="top-nav-actions">
				<button
					className="btn btn-secondary btn-sm"
					onClick={handleRandomAyah}
					disabled={isLoadingRandom}
				>
					<Dices size={16} />
					<span>{isLoadingRandom ? "جاري الاختيار..." : "آية عشوائية 🎲"}</span>
				</button>

				<Link href="/studio" className="btn btn-primary btn-sm">
					<PlusCircle size={16} />
					<span>إنشاء ريل جديد +</span>
				</Link>
			</div>
		</header>
	);
}
