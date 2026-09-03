import { expect, test } from "bun:test";
import fs from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { buildInstagramAuthorizationUrl, InstagramManager, INSTAGRAM_CALLBACK_URL, publishInstagramReel } from "./instagram";

test("uses the secure local Instagram callback", () => {
	const url = new URL(buildInstagramAuthorizationUrl("12345678", "state-1"));
	expect(INSTAGRAM_CALLBACK_URL).toBe("https://localhost:3443/api/instagram/callback");
	expect(url.searchParams.get("redirect_uri")).toBe(INSTAGRAM_CALLBACK_URL);
});

test("publishes a local MP4 through a temporary public URL", async () => {
	const dir = await fs.mkdtemp(join(tmpdir(), "quran-reels-instagram-"));
	const videoPath = join(dir, "reel.mp4");
	await fs.writeFile(videoPath, "fake mp4 data");
	const calls: { url: string; init?: RequestInit }[] = [];
	const responses = [
		{ id: "container-1" },
		{ id: "container-1", status_code: "FINISHED" },
		{ id: "media-1" },
	];

	try {
		const result = await publishInstagramReel({
			accessToken: "test-token",
			userId: "12345678",
			videoPath,
			caption: "اختبار",
			publicVideoUrl: "https://video.example/reel.mp4",
			fetcher: (async (input: any, init?: RequestInit) => {
				calls.push({ url: String(input), init });
				return Response.json(responses[calls.length - 1]);
			}) as typeof fetch,
			wait: async () => {},
		});

		expect(result.mediaId).toBe("media-1");
		expect(calls).toHaveLength(3);
		expect(String(calls[0].init?.body)).toContain("video_url=https%3A%2F%2Fvideo.example%2Freel.mp4");
		expect(calls[2].url).toContain("/media_publish");
	} finally {
		await fs.rm(dir, { recursive: true, force: true });
	}
});

test("continues an Instagram publication after acknowledging the request", async () => {
	const manager = new InstagramManager();
	let finish!: (result: { mediaId: string; containerId: string }) => void;
	(manager as any).load = async () => ({ publishedJobs: {} });
	(manager as any).publish = () => new Promise((resolve) => { finish = resolve as typeof finish; });

	expect((await manager.startPublish("job-1", "reel.mp4", "caption")).status).toBe("publishing");
	expect((await manager.getPublications())["job-1"].status).toBe("publishing");
	finish({ mediaId: "media-1", containerId: "container-1" });
	await Bun.sleep(0);
	expect((await manager.getPublications())["job-1"]).toMatchObject({ status: "published", mediaId: "media-1" });
});
