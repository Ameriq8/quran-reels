import { describe, expect, test } from "bun:test";
import { resolve } from "path";
import { ReciterRegistry } from "../providers/ReciterRegistry";
import { getSurahAudioWindow } from "../queue/RenderQueue";
import { resolveWithin } from "../utils/path";
import { buildAutomaticRenderOptions, pickRandomAyah } from "./index";

// Regression checks for issues found during the local QA pass on 2026-09-03.
describe("server regressions", () => {
	test("keeps public files inside their configured directory", () => {
		expect(resolveWithin("assets", "../package.json")).toBeNull();
		expect(resolveWithin("assets", "..\\package.json")).toBeNull();
		expect(resolveWithin("assets", "cover.mp4")).toBe(resolve("assets", "cover.mp4"));
	});

	test("selects each ayah with one global uniform offset", () => {
		const chapters = [
			{ id: 1, verses_count: 2 },
			{ id: 2, verses_count: 3 },
		];

		expect(pickRandomAyah(chapters, () => 0)).toEqual({ surah: 1, verseStart: 1, verseCount: 1 });
		expect(pickRandomAyah(chapters, () => 0.4)).toEqual({ surah: 2, verseStart: 1, verseCount: 1 });
		expect(pickRandomAyah(chapters, () => 0.999)).toEqual({ surah: 2, verseStart: 3, verseCount: 1 });
	});

	test("keeps the requested verse count inside a random surah", () => {
		const chapters = [{ id: 1, verses_count: 7 }, { id: 2, verses_count: 10 }];
		expect(pickRandomAyah(chapters, () => 0.999, 5)).toEqual({ surah: 2, verseStart: 6, verseCount: 5 });
	});

	test("builds every automatic reel from fresh random choices", () => {
		const values = [0.999, 0.5, 0, 0.75];
		const options = buildAutomaticRenderOptions(
			[{ id: 1, verses_count: 7 }, { id: 2, verses_count: 10 }],
			["reader-a", "reader-b"],
			["template-a", "template-b"],
			["background-a.jpg", "background-b.mp4"],
			5,
			() => values.shift() ?? 0
		);

		expect(options).toMatchObject({
			surah: 2,
			verseStart: 6,
			verseCount: 5,
			reciterId: "reader-b",
			templateId: "template-a",
			background: "background-b.mp4",
			showTranslation: true,
		});
	});

	test("crops selected ayahs from a surah-level recording", () => {
		const verses = [2, 3, 5].map((weight, index) => ({
			verse_number: index + 1,
			text_uthmani: "x",
			audio: { url: "", duration: weight, segments: [[0, 0, 0, weight]] },
		})) as any;

		expect(getSurahAudioWindow(verses, 2, 1, 100)).toEqual({
			startSeconds: 20,
			durationSeconds: 30,
			verseDurations: [30],
		});
	});

	test("hides duplicate catalog entries without breaking direct reciter lookup", async () => {
		const registry = new ReciterRegistry();
		const reciters = await registry.getAllReciters(false);
		const keys = reciters.map((reciter) => `${reciter.nameArabic}|${reciter.style || ""}`);

		expect(new Set(keys).size).toBe(keys.length);
		expect((await registry.getReciterById("ea-shatri"))?.id).toBe("ea-shatri");
	});
});
