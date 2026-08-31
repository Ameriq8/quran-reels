"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
	LayoutDashboard,
	Video,
	FolderCheck,
	Mic,
	Image as ImageIcon,
	Palette,
	Layers,
	Settings,
} from "lucide-react";

export function Sidebar() {
	const pathname = usePathname();
	const [activeQueueCount, setActiveQueueCount] = useState(0);
	const [completedCount, setCompletedCount] = useState(0);

	useEffect(() => {
		const pollStats = async () => {
			try {
				const qRes = await fetch("/api/reels/queue");
				if (qRes.ok) {
					const queue = await qRes.json();
					setActiveQueueCount(queue.length || 0);
				}

				const hRes = await fetch("/api/reels/history");
				if (hRes.ok) {
					const hist = await hRes.json();
					setCompletedCount(hist.length || 0);
				}
			} catch (e) {
				// Server starting or offline
			}
		};

		pollStats();
		const timer = setInterval(pollStats, 2000);
		return () => clearInterval(timer);
	}, []);

	const navItems = [
		{ href: "/", label: "الرئيسية", icon: LayoutDashboard },
		{ href: "/studio", label: "إنشاء ريل", icon: Video, badge: "جديد", badgeClass: "badge-gold" },
		{ href: "/history", label: "الريلز المكتملة", icon: FolderCheck, count: completedCount },
		{ href: "/reciters", label: "القراء (العراق 🇮🇶 والعالم)", icon: Mic },
		{ href: "/backgrounds", label: "مكتبة الخلفيات", icon: ImageIcon },
		{ href: "/templates", label: "القوالب والتصميم", icon: Palette },
		{ href: "/batch", label: "الإنشاء المتعدد (Batch)", icon: Layers },
		{ href: "/settings", label: "الإعدادات والتخزين", icon: Settings },
	];

	return (
		<aside className="sidebar">
			<div className="sidebar-header">
				<span className="brand-icon">🕋</span>
				<div className="brand-info">
					<h2>استوديو ريلز القرآن</h2>
					<span>Quran Reels Studio v2</span>
				</div>
			</div>

			<nav className="sidebar-nav">
				{navItems.map((item) => {
					const Icon = item.icon;
					const isActive = pathname === item.href;

					return (
						<Link
							key={item.href}
							href={item.href}
							className={`nav-link ${isActive ? "active" : ""}`}
						>
							<Icon size={20} />
							<span>{item.label}</span>
							{item.badge && <span className={`nav-badge ${item.badgeClass}`}>{item.badge}</span>}
							{typeof item.count === "number" && item.count > 0 && (
								<span className="nav-badge badge-emerald">{item.count}</span>
							)}
						</Link>
					);
				})}
			</nav>

			<div className="sidebar-footer">
				<div>
					<span className="status-dot"></span>
					<span>حالة النظام: متصل</span>
				</div>
				{activeQueueCount > 0 && (
					<span className="nav-badge badge-gold">
						{activeQueueCount} قيد المعالجة
					</span>
				)}
			</div>
		</aside>
	);
}
