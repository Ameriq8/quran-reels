import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";

export const metadata: Metadata = {
	title: "استوديو ريلز القرآن • Quran Reels Studio",
	description: "استوديو احترافي لإنتاج مقاطع وريلز القرآن الكريم بدقة عالية ومزامنة صوتية كاملة",
};

export default function RootLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<html lang="ar" dir="rtl">
			<head>
				<link rel="preconnect" href="https://fonts.googleapis.com" />
				<link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
				<link
					href="https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Outfit:wght@300;400;500;600;700&family=Readex+Pro:wght@300;400;500;600;700&family=Scheherazade+New:wght@400;700&display=swap"
					rel="stylesheet"
				/>
			</head>
			<body>
				<div className="app-shell">
					<Sidebar />
					<div className="main-content">
						{children}
					</div>
				</div>
			</body>
		</html>
	);
}
