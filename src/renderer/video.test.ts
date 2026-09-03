import { expect, test } from "bun:test";
import fs from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { TranslationSegmentService } from "../sync/TranslationSegmentService";
import { getBackgroundCandidates, VideoRenderer } from "./video";

function run(command: string[]) {
	const result = Bun.spawnSync({ cmd: command, stdout: "pipe", stderr: "pipe" });
	if (result.exitCode !== 0) throw new Error(result.stderr.toString());
	return result.stdout.toString();
}

test("keeps an English translation and numbered ayah marker in subtitles", async () => {
	const outputPath = join(tmpdir(), `quran-reels-${crypto.randomUUID()}.ass`);
	const segment: any = {
		ayahNumber: 1,
		arabicText: "بِسْمِ اللَّهِ",
		words: [{ translation: { text: "In the name of Allah" } }],
		startTime: 0,
		endTime: 2,
		isLastSegment: true,
	};
	new TranslationSegmentService().assignTranslations([segment]);

	try {
		await new VideoRenderer().generateAssSubtitles(
			{ name_arabic: "الفاتحة", name_simple: "Al-Fatihah" } as any,
			[{ verse: { verse_number: 1 } as any, audioPath: "", duration: 2, startTime: 0, endTime: 2, segments: [segment] }],
			"رعد الكردي",
			"mushaf-focus",
			{ showTranslation: true },
			outputPath
		);
		const subtitles = await fs.readFile(outputPath, "utf8");
		expect(subtitles).toContain("In the name of Allah");
		expect(subtitles).toContain("Style: AyahBadgeFrame");
		expect(subtitles).toContain("AyahBadgeFrame,,0,0,0,,{\\pos(540,1120)\\fade(150,150)}۝");
		expect(subtitles).toContain("AyahBadgeNumber,,0,0,0,,{\\pos(540,1120)\\fade(150,150)}١");
		expect(subtitles).not.toContain("۝١");
	} finally {
		await fs.unlink(outputPath).catch(() => {});
	}
});

test("video-only automation ignores image backgrounds", () => {
	expect(getBackgroundCandidates(["mosque.jpg", "legacy.mp4"], ["long.mp4", "notes.txt"], "video-auto"))
		.toEqual(["videos/long.mp4"]);
	expect(getBackgroundCandidates(["mosque.jpg", "legacy.mp4"], ["long.mp4", "notes.txt"], "image-auto"))
		.toEqual(["mosque.jpg"]);
});

test("uses only recitation audio and ends with it", async () => {
	const dir = await fs.mkdtemp(join(tmpdir(), "quran-reels-render-"));
	const background = join(dir, "background.mp4");
	const recitation = join(dir, "recitation.m4a");
	const subtitles = join(dir, "subtitles.ass");
	const output = join(dir, "output.mp4");

	try {
		run(["ffmpeg", "-y", "-f", "lavfi", "-i", "color=c=black:s=320x568:d=2", "-f", "lavfi", "-i", "sine=frequency=1000:duration=2", "-shortest", "-c:v", "libx264", "-c:a", "aac", background]);
		run(["ffmpeg", "-y", "-f", "lavfi", "-i", "sine=frequency=440:duration=1", "-c:a", "aac", recitation]);
		await new VideoRenderer().generateAssSubtitles(
			{ name_arabic: "الفاتحة", name_simple: "Al-Fatihah" } as any,
			[{ verse: { verse_number: 1, text_uthmani: "الْحَمْدُ لِلَّهِ" } as any, audioPath: "", duration: 1, startTime: 0, endTime: 1 }],
			"رعد الكردي",
			"mushaf-focus",
			{ showTranslation: false },
			subtitles
		);
		await new VideoRenderer().renderVideo({ backgroundImage: background, combinedAudioPath: recitation, assSubtitlesPath: subtitles, totalDuration: 1, overlayOpacity: 0.5, outputMp4Path: output });

		const duration = Number(run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", output]).trim());
		const audioStats = Bun.spawnSync({ cmd: ["ffmpeg", "-hide_banner", "-i", output, "-af", "astats=metadata=1:reset=0", "-f", "null", "-"], stdout: "pipe", stderr: "pipe" }).stderr.toString();
		const zeroCrossingRate = Number(audioStats.match(/Zero crossings rate: ([0-9.]+)/g)?.at(-1)?.split(": ")[1]);
		expect(duration).toBeGreaterThan(0.9);
		expect(duration).toBeLessThan(1.1);
		expect(zeroCrossingRate).toBeLessThan(0.03);
	} finally {
		await fs.rm(dir, { recursive: true, force: true });
	}
});
