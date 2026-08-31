import { startServer } from "./server";

const PORT = parseInt(process.env.PORT || "3000", 10);

console.log("==================================================");
console.log("🕋 Quran Reels Studio • استوديو ريلز القرآن");
console.log("==================================================");

startServer(PORT);

console.log(`\n✨ Studio is live and ready!`);
console.log(`🌐 Open in your browser: http://localhost:${PORT}`);
console.log(`\n💡 Features:`);
console.log(`   - 🎙️ 25+ Reciters (Iraqi Reciters 🇮🇶 prioritized)`);
console.log(`   - 📱 9:16 Interactive Canvas Editor`);
console.log(`   - ⏳ Concurrency-Controlled Render Queue`);
console.log(`   - ⚡ Batch Generator for Full Surahs`);
console.log(`   - 📁 Complete Video History with Direct MP4 Downloads\n`);
