import { exec, spawn } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import { existsSync } from "fs";
import { join, resolve } from "path";
import type { IChapter, IVerse, IConfig } from "../api/types";
import type { TimedQuranSegment } from "../sync/types";
import { resolveWithin } from "../utils/path";

const execAsync = promisify(exec);
const MEDIA_FILE = /\.(png|jpe?g|webp|mp4|webm|mov)$/i;
const VIDEO_FILE = /\.(mp4|webm|mov)$/i;

export function getBackgroundCandidates(rootFiles: string[], videoFiles: string[], configuredBg: string = "auto") {
	const nestedVideos = videoFiles.filter((file) => VIDEO_FILE.test(file)).map((file) => `videos/${file}`);
	if (configuredBg === "video-auto") return nestedVideos;
	if (configuredBg === "auto") return [...rootFiles.filter((file) => MEDIA_FILE.test(file)), ...nestedVideos];
	return [configuredBg];
}

export interface IVerseRenderData {
	verse: IVerse;
	audioPath: string;
	duration: number;
	startTime: number;
	endTime: number;
	segments?: TimedQuranSegment[];
}

export interface ITemplate {
	id: string;
	nameArabic: string;
	nameEnglish: string;
	arabicFont: string;
	translationFont: string;
	arabicFontSize: number;
	translationFontSize: number;
	primaryColor: string; // ASS format &H00BBGGRR&
	accentColor: string;
	outlineColor: string;
	shadowColor: string;
	overlayOpacity: number; // 0 to 1
	cardBorder?: boolean;
}

export const TEMPLATES: Record<string, ITemplate> = {
	"mushaf-focus": {
		id: "mushaf-focus",
		nameArabic: "تركيز المصحف (أخضر وذهبي)",
		nameEnglish: "Mushaf Focus",
		arabicFont: "Scheherazade New",
		translationFont: "Segoe UI",
		arabicFontSize: 68,
		translationFontSize: 42,
		primaryColor: "&H00FFFFFF&", // White
		accentColor: "&H00D4AF37&", // Gold
		outlineColor: "&H00000000&",
		shadowColor: "&H90000000&",
		overlayOpacity: 0.50,
	},
	"classic-dark": {
		id: "classic-dark",
		nameArabic: "كلاسيكي داكن (فخم)",
		nameEnglish: "Classic Dark",
		arabicFont: "Scheherazade New",
		translationFont: "Segoe UI",
		arabicFontSize: 66,
		translationFontSize: 42,
		primaryColor: "&H00FFFFFF&",
		accentColor: "&H00E0E0E0&",
		outlineColor: "&H00000000&",
		shadowColor: "&H90000000&",
		overlayOpacity: 0.45,
	},
	"gold-luxury": {
		id: "gold-luxury",
		nameArabic: "ذهبي ملكي",
		nameEnglish: "Gold Luxury",
		arabicFont: "Scheherazade New",
		translationFont: "Segoe UI",
		arabicFontSize: 70,
		translationFontSize: 42,
		primaryColor: "&H00E6FFFF&", // Warm white
		accentColor: "&H0037AFD4&", // Gold
		outlineColor: "&H00000000&",
		shadowColor: "&HA0000000&",
		overlayOpacity: 0.55,
	},
	"nature-ambient": {
		id: "nature-ambient",
		nameArabic: "طبيعي هادئ",
		nameEnglish: "Nature & Ambient",
		arabicFont: "Scheherazade New",
		translationFont: "Segoe UI",
		arabicFontSize: 64,
		translationFontSize: 42,
		primaryColor: "&H00FFFFFF&",
		accentColor: "&H00E8F0D0&",
		outlineColor: "&H00000000&",
		shadowColor: "&H80000000&",
		overlayOpacity: 0.40,
	},
	"cinematic": {
		id: "cinematic",
		nameArabic: "سينمائي واسع",
		nameEnglish: "Cinematic",
		arabicFont: "Scheherazade New",
		translationFont: "Segoe UI",
		arabicFontSize: 66,
		translationFontSize: 42,
		primaryColor: "&H00F0F0F0&",
		accentColor: "&H00C0D8FF&",
		outlineColor: "&H00000000&",
		shadowColor: "&H90000000&",
		overlayOpacity: 0.48,
	},
	"minimal": {
		id: "minimal",
		nameArabic: "بسيط ومختصر",
		nameEnglish: "Minimal",
		arabicFont: "Scheherazade New",
		translationFont: "Segoe UI",
		arabicFontSize: 66,
		translationFontSize: 42,
		primaryColor: "&H00FFFFFF&",
		accentColor: "&H00D0D0D0&",
		outlineColor: "&H00000000&",
		shadowColor: "&H60000000&",
		overlayOpacity: 0.35,
	}
};

export class VideoRenderer {
	/**
	 * Get duration of an audio file using ffprobe
	 */
	async getAudioDuration(filePath: string): Promise<number> {
		try {
			const { stdout } = await execAsync(
				`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`
			);
			const duration = parseFloat(stdout.trim());
			return isNaN(duration) ? 3.0 : duration;
		} catch (error) {
			console.warn(`Could not probe duration for ${filePath}, falling back to 3.0s`);
			return 3.0;
		}
	}

	/**
	 * Pick a background image or resolve configured path
	 */
	async getBackground(configuredBg?: string): Promise<string> {
		const assetsDir = resolve("assets");
		if (configuredBg && configuredBg !== "auto" && configuredBg !== "video-auto") {
			const directPath = resolveWithin(assetsDir, configuredBg);
			if (directPath && existsSync(directPath)) return directPath;
		}

		const [files, videoFiles] = await Promise.all([
			fs.readdir(assetsDir),
			fs.readdir(join(assetsDir, "videos")).catch(() => []),
		]);
		const candidates = getBackgroundCandidates(files, videoFiles, configuredBg);

		if (candidates.length === 0) {
			throw new Error(configuredBg === "video-auto" ? "لا توجد فيديوهات في assets/videos" : "لا توجد خلفيات في assets");
		}

		return join(assetsDir, candidates[Math.floor(Math.random() * candidates.length)]);
	}

	/**
	 * Format time in seconds to ASS subtitle format (H:MM:SS.CC)
	 */
	private formatAssTime(seconds: number): string {
		const safeSec = Math.max(0, seconds);
		const hrs = Math.floor(safeSec / 3600);
		const mins = Math.floor((safeSec % 3600) / 60);
		const secs = Math.floor(safeSec % 60);
		const centis = Math.floor((safeSec % 1) * 100);

		return `${hrs}:${mins.toString().padStart(2, "0")}:${secs
			.toString()
			.padStart(2, "0")}.${centis.toString().padStart(2, "0")}`;
	}

	/**
	 * Convert Arabic number to Eastern Arabic numerals (١, ٢, ٣...)
	 */
	private toArabicNumber(num: number): string {
		const arabicNumerals = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];
		return num
			.toString()
			.split("")
			.map((d) => arabicNumerals[parseInt(d, 10)] || d)
			.join("");
	}

	/**
	 * Wrap Arabic text to lines of a maximum character width
	 */
	private wrapArabicText(text: string, maxLen: number = 32): string {
		const words = text.split(" ");
		const lines: string[] = [];
		let currentLine = "";

		for (const word of words) {
			if ((currentLine + " " + word).trim().length > maxLen) {
				if (currentLine) lines.push(currentLine.trim());
				currentLine = word;
			} else {
				currentLine = (currentLine + " " + word).trim();
			}
		}
		if (currentLine) lines.push(currentLine.trim());
		return lines.join("\\N");
	}

	/**
	 * Wrap English translation text
	 */
	private wrapEnglishText(text: string, maxLen: number = 40): string {
		const words = text.split(" ");
		const lines: string[] = [];
		let currentLine = "";

		for (const word of words) {
			if ((currentLine + " " + word).trim().length > maxLen) {
				if (currentLine) lines.push(currentLine.trim());
				currentLine = word;
			} else {
				currentLine = (currentLine + " " + word).trim();
			}
		}
		if (currentLine) lines.push(currentLine.trim());
		return lines.join("\\N");
	}

	/**
	 * Generate ASS subtitle file with phrase-level synchronized dialogues
	 */
	async generateAssSubtitles(
		chapter: IChapter,
		verseData: IVerseRenderData[],
		reciterName: string,
		templateId: string = "mushaf-focus",
		options: {
			showTranslation?: boolean;
			showSurahArabic?: boolean;
			showSurahEnglish?: boolean;
			showAyahRange?: boolean;
			showReciter?: boolean;
			showBranding?: boolean;
			customFontSize?: number;
		},
		outputPath: string
	): Promise<string> {
		const template = TEMPLATES[templateId] || TEMPLATES["mushaf-focus"];
		const totalDuration = verseData[verseData.length - 1].endTime;
		const surahArabic = `سورة ${chapter.name_arabic}`;
		const surahEnglish = chapter.name_simple;
		const firstVerse = verseData[0].verse.verse_number;
		const lastVerse = verseData[verseData.length - 1].verse.verse_number;
		const verseRangeStr =
			firstVerse === lastVerse
				? `Ayah ${firstVerse}`
				: `Ayat ${firstVerse} - ${lastVerse}`;

		const headerStartTime = this.formatAssTime(0);
		const headerEndTime = this.formatAssTime(totalDuration);

		const arabicFontSize = options.customFontSize || template.arabicFontSize;
		const transFontSize = 42;

		let assContent = `[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
ScaledBorderAndShadow: yes
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: HeaderTitle,${template.arabicFont},56,${template.primaryColor},&H000000FF,${template.outlineColor},${template.shadowColor},-1,0,0,0,100,100,0,0,1,3,2,8,40,40,210,1
Style: ReciterTag,${template.arabicFont},38,&H00E0E0E0,&H000000FF,${template.outlineColor},${template.shadowColor},-1,0,0,0,100,100,0,0,1,3,2,8,40,40,285,1
Style: ArabicVerse,${template.arabicFont},${arabicFontSize},${template.primaryColor},&H000000FF,${template.outlineColor},${template.shadowColor},-1,0,0,0,100,100,0,0,1,4,3,5,60,60,100,1
Style: AyahBadgeFrame,${template.arabicFont},96,${template.accentColor},&H000000FF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,0,0,5,0,0,0,1
Style: AyahBadgeNumber,${template.arabicFont},26,&H00000000,&H000000FF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,0,0,5,0,0,0,1
Style: TranslationText,${template.translationFont},${transFontSize},&H00F0F0F0,&H000000FF,${template.outlineColor},${template.shadowColor},0,0,0,0,100,100,0,0,1,3,2,2,70,70,280,1
Style: BrandingTag,${template.translationFont},36,&H00F0F0F0,&H000000FF,${template.outlineColor},${template.shadowColor},-1,0,0,0,100,100,0,0,1,2,2,2,40,40,130,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

		// Header events - Arabic Surah only
		if (options.showSurahArabic !== false) {
			assContent += `Dialogue: 0,${headerStartTime},${headerEndTime},HeaderTitle,,0,0,0,,{\\fade(300,300)}${surahArabic}\n`;
		}

		if (options.showReciter !== false && reciterName) {
			const reciterTag = `القارئ: ${reciterName}`;
			assContent += `Dialogue: 0,${headerStartTime},${headerEndTime},ReciterTag,,0,0,0,,{\\fade(300,300)}${reciterTag}\n`;
		}

		if (options.showBranding !== false) {
			assContent += `Dialogue: 0,${headerStartTime},${headerEndTime},BrandingTag,,0,0,0,,{\\fade(300,300)}{\\fnSegoe UI Emoji\\c&H00D4AF37&}📸 {\\fn${template.translationFont}\\c&H00E0E0E0&}@Khair_qur\n`;
		}

		const appendAyahBadge = (start: string, end: string, ayahNumber: number) => {
			assContent += `Dialogue: 2,${start},${end},AyahBadgeFrame,,0,0,0,,{\\pos(540,1120)\\fade(150,150)}۝\n`;
			assContent += `Dialogue: 3,${start},${end},AyahBadgeNumber,,0,0,0,,{\\pos(540,1120)\\fade(150,150)}${this.toArabicNumber(ayahNumber)}\n`;
		};

		// Phrase & Verse events
		for (const item of verseData) {
			if (item.segments && item.segments.length > 0) {
				// Phrase-level synchronized rendering
				for (const seg of item.segments) {
					const startStr = this.formatAssTime(seg.startTime);
					const endStr = this.formatAssTime(seg.endTime);
					const wrappedArabic = this.wrapArabicText(seg.arabicText, 32);

					assContent += `Dialogue: 1,${startStr},${endStr},ArabicVerse,,0,0,0,,{\\fade(150,150)}${wrappedArabic}\n`;
					if (seg.isLastSegment) appendAyahBadge(startStr, endStr, seg.ayahNumber);

					if (options.showTranslation !== false && seg.translationText) {
						const wrappedTrans = this.wrapEnglishText(seg.translationText, 34);
						assContent += `Dialogue: 1,${startStr},${endStr},TranslationText,,0,0,0,,{\\fade(150,150)}${wrappedTrans}\n`;
					}
				}
			} else {
				// Whole Ayah fallback
				const startStr = this.formatAssTime(item.startTime);
				const endStr = this.formatAssTime(item.endTime);
				const wrappedArabic = this.wrapArabicText(item.verse.text_uthmani, 32);

				assContent += `Dialogue: 1,${startStr},${endStr},ArabicVerse,,0,0,0,,{\\fade(200,200)}${wrappedArabic}\n`;
				appendAyahBadge(startStr, endStr, item.verse.verse_number);

				if (options.showTranslation !== false && item.verse.translations?.[0]?.text) {
					const wrappedTrans = this.wrapEnglishText(
						item.verse.translations[0].text,
						34
					);
					assContent += `Dialogue: 1,${startStr},${endStr},TranslationText,,0,0,0,,{\\fade(200,200)}${wrappedTrans}\n`;
				}
			}
		}

		await fs.writeFile(outputPath, assContent, "utf-8");
		return outputPath;
	}

	/**
	 * Concatenate all verse audios into one temporary audio track
	 */
	async combineAudios(audioPaths: string[], outputPath: string): Promise<void> {
		if (audioPaths.length === 1) {
			await fs.copyFile(audioPaths[0], outputPath);
			return;
		}

		const listFilePath = outputPath + ".txt";
		const fileListContent = audioPaths
			.map((p) => `file '${p.replace(/\\/g, "/")}'`)
			.join("\n");

		await fs.writeFile(listFilePath, fileListContent, "utf-8");

		try {
			const cmd = `ffmpeg -y -f concat -safe 0 -i "${listFilePath}" -c copy "${outputPath}"`;
			await execAsync(cmd);
		} finally {
			await fs.unlink(listFilePath).catch(() => {});
		}
	}

	async extractAudioSegment(inputPath: string, outputPath: string, startSeconds: number, durationSeconds: number): Promise<void> {
		const cmd = `ffmpeg -y -ss ${Math.max(0, startSeconds).toFixed(3)} -i "${inputPath}" -t ${Math.max(0.1, durationSeconds).toFixed(3)} -vn -c:a libmp3lame -q:a 2 "${outputPath}"`;
		await execAsync(cmd);
	}

	/**
	 * Render the final 1080x1920 MP4 Video using FFmpeg with real-time progress callbacks
	 */
	async renderVideo(options: {
		backgroundImage: string;
		backgroundStartSeconds?: number;
		combinedAudioPath: string;
		assSubtitlesPath: string;
		totalDuration: number;
		overlayOpacity: number;
		outputMp4Path: string;
		onProgress?: (progressPercent: number) => void;
	}): Promise<string> {
		const bg = options.backgroundImage.replace(/\\/g, "/");
		const audio = options.combinedAudioPath.replace(/\\/g, "/");
		const escapedAss = options.assSubtitlesPath.replace(/\\/g, "/").replace(/:/g, "\\:");
		const out = options.outputMp4Path.replace(/\\/g, "/");
		const opacity = options.overlayOpacity.toFixed(2);
		const isVideoBg = /\.(mp4|webm|mov)$/i.test(bg);

		const filterComplex = `[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,drawbox=x=0:y=0:w=iw:h=ih:color=black@${opacity}:t=fill,ass='${escapedAss}'[v]`;

		const args: string[] = [
			"-y",
			"-progress", "pipe:1",
			"-nostats",
		];

		if (isVideoBg) {
			args.push(
				"-stream_loop", "-1",
				"-ss", Math.max(0, options.backgroundStartSeconds || 0).toFixed(2),
				"-i", bg,
				"-i", audio
			);
		} else {
			args.push("-loop", "1", "-i", bg, "-i", audio);
		}

		args.push(
			"-filter_complex", filterComplex,
			"-map", "[v]",
			"-map", "1:a",
			"-c:v", "libx264",
			"-preset", "veryfast",
			"-crf", "22",
			"-c:a", "aac",
			"-b:a", "192k",
			"-pix_fmt", "yuv420p",
			"-shortest",
			"-movflags", "+faststart",
			out
		);

		return new Promise((resolvePromise, rejectPromise) => {
			const proc = spawn("ffmpeg", args);

			proc.stdout.on("data", (chunk) => {
				const lines = chunk.toString().split("\n");
				for (const line of lines) {
					const [key, value] = line.split("=");
					if (key === "out_time_us" || key === "out_time_ms") {
						const us = parseInt(value, 10);
						if (!isNaN(us)) {
							const currentSeconds = us / 1000000;
							const pct = Math.min(100, Math.max(0, (currentSeconds / options.totalDuration) * 100));
							if (options.onProgress) {
								options.onProgress(pct);
							}
						}
					}
				}
			});

			let stderrOutput = "";
			proc.stderr.on("data", (chunk) => {
				stderrOutput += chunk.toString();
			});

			proc.on("close", (code) => {
				if (code === 0) {
					if (options.onProgress) options.onProgress(100);
					resolvePromise(options.outputMp4Path);
				} else {
					console.error("FFmpeg render failed with code:", code, stderrOutput.slice(-800));
					rejectPromise(new Error(`FFmpeg error (code ${code}): ${stderrOutput.slice(-300)}`));
				}
			});

			proc.on("error", (err) => {
				rejectPromise(err);
			});
		});
	}

	/**
	 * Generate video thumbnail (single JPG frame at 1s)
	 */
	async generateThumbnail(videoPath: string, thumbnailPath: string): Promise<string> {
		const vid = videoPath.replace(/\\/g, "/");
		const thumb = thumbnailPath.replace(/\\/g, "/");
		const cmd = `ffmpeg -y -ss 00:00:01 -i "${vid}" -vframes 1 -q:v 2 "${thumb}"`;
		try {
			await execAsync(cmd);
		} catch (e) {
			console.warn("Could not generate thumbnail:", e);
		}
		return thumbnailPath;
	}
}
