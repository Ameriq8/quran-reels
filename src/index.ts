import { startServer } from "./server";

const PORT = parseInt(process.env.PORT || "3000", 10);

console.log("==================================================");
console.log("🕋 Quran Reels Studio • استوديو ريلز القرآن");
console.log("==================================================");

startServer(PORT);

console.log(`\n✨ Quran Reels API Backend is live and ready on port ${PORT}!`);
console.log(`🌐 API Base URL: http://localhost:${PORT}`);
console.log(`💻 Next.js Client URL: http://localhost:3001\n`);
