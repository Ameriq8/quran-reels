import fs from "fs/promises";
import { existsSync } from "fs";
import { extname, resolve } from "path";

const API_VERSION = "v23.0";
export const INSTAGRAM_CALLBACK_URL = "https://localhost:3443/api/instagram/callback";
const SCOPES = ["instagram_business_basic", "instagram_business_content_publish"];

interface InstagramConfig {
	appId?: string;
	appSecretProtected?: string;
	accessTokenProtected?: string;
	userId?: string;
	username?: string;
	tokenExpiresAt?: string;
	oauthState?: string;
	oauthStateExpiresAt?: string;
	publishedJobs?: Record<string, { mediaId: string; containerId: string; publishedAt: string }>;
}

export type InstagramPublication =
	| { status: "publishing"; startedAt: string }
	| { status: "published"; mediaId: string; containerId: string; publishedAt: string }
	| { status: "failed"; error: string };

export interface InstagramStatus {
	configured: boolean;
	connected: boolean;
	appId: string;
	username?: string;
	userId?: string;
	tokenExpiresAt?: string;
	callbackUrl: string;
}

type Fetcher = typeof fetch;

function runDpapi(script: string, value: string) {
	if (process.platform !== "win32") {
		throw new Error("حفظ بيانات Instagram الآمن متوفر حاليًا على Windows فقط");
	}
	const result = Bun.spawnSync({
		cmd: ["powershell.exe", "-NoProfile", "-NonInteractive", "-Command", script],
		stdin: Buffer.from(value, "utf8"),
		stdout: "pipe",
		stderr: "pipe",
	});
	if (result.exitCode !== 0) {
		throw new Error("تعذر حماية بيانات Instagram على هذا الجهاز");
	}
	return result.stdout.toString().trim();
}

function protectSecret(value: string) {
	return runDpapi(
		'Add-Type -AssemblyName System.Security; $v=[Console]::In.ReadToEnd(); $b=[Text.Encoding]::UTF8.GetBytes($v); $e=[Security.Cryptography.ProtectedData]::Protect($b,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser); [Convert]::ToBase64String($e)',
		value
	);
}

function unprotectSecret(value: string) {
	return runDpapi(
		'Add-Type -AssemblyName System.Security; $v=[Console]::In.ReadToEnd(); $b=[Convert]::FromBase64String($v); $d=[Security.Cryptography.ProtectedData]::Unprotect($b,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser); [Text.Encoding]::UTF8.GetString($d)',
		value
	);
}

async function metaJson(response: Response) {
	const body = await response.json().catch(() => ({})) as any;
	if (!response.ok) {
		throw new Error(body?.error?.message || body?.error_description || `Instagram API: HTTP ${response.status}`);
	}
	return body;
}

async function ensureCloudflared() {
	const executable = resolve("tools", "cloudflared.exe");
	if (existsSync(executable)) return executable;
	await fs.mkdir(resolve("tools"), { recursive: true });
	const download = Bun.spawn({
		cmd: ["curl.exe", "--location", "--fail", "--silent", "--show-error", "--output", executable, "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe"],
		stdout: "ignore",
		stderr: "pipe",
	});
	const [exitCode, error] = await Promise.all([download.exited, new Response(download.stderr).text()]);
	if (exitCode !== 0 || !existsSync(executable)) {
		throw new Error(error.trim() || "تعذر تجهيز الرفع المؤقت إلى Instagram");
	}
	return executable;
}

export function getReadyTunnelBaseUrl(log: string) {
	const url = log.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i)?.[0] || "";
	return url && log.includes("Registered tunnel connection") ? url : "";
}

async function exposeVideo(videoPath: string) {
	const cloudflared = await ensureCloudflared();
	const token = crypto.randomUUID().replaceAll("-", "");
	const route = `/${token}.mp4`;
	const video = Bun.file(videoPath);
	const server = Bun.serve({
		hostname: "127.0.0.1",
		port: 0,
		fetch(req) {
			const url = new URL(req.url);
			if (url.pathname !== route || (req.method !== "GET" && req.method !== "HEAD")) {
				return new Response(null, { status: 404 });
			}
			const headers = { "Content-Type": "video/mp4", "Content-Length": String(video.size), "Cache-Control": "no-store" };
			return req.method === "HEAD" ? new Response(null, { headers }) : new Response(video, { headers });
		},
	});
	const tempDir = resolve("tmp");
	await fs.mkdir(tempDir, { recursive: true });
	const logPath = resolve(tempDir, `instagram-tunnel-${token}.log`);
	const configPath = resolve(tempDir, `instagram-tunnel-${token}.yml`);
	await fs.writeFile(configPath, "", "utf8");
	const tunnel = Bun.spawn({
		cmd: [cloudflared, "tunnel", "--config", configPath, "--no-autoupdate", "--url", `http://127.0.0.1:${server.port}`, "--logfile", logPath],
		stdout: "ignore",
		stderr: "ignore",
	});
	const close = async () => {
		tunnel.kill();
		await Promise.race([tunnel.exited, Bun.sleep(2000)]);
		await server.stop(true);
		await Promise.all([fs.unlink(logPath).catch(() => {}), fs.unlink(configPath).catch(() => {})]);
	};

	try {
		let baseUrl = "";
		for (let attempt = 0; attempt < 120 && !baseUrl; attempt++) {
			if (tunnel.exitCode !== null) throw new Error("تعذر فتح قناة الرفع المؤقتة إلى Instagram");
			if (existsSync(logPath)) {
				baseUrl = getReadyTunnelBaseUrl(await fs.readFile(logPath, "utf8"));
			}
			if (!baseUrl) await Bun.sleep(250);
		}
		if (!baseUrl) throw new Error("تأخر تجهيز رابط الفيديو المؤقت؛ حاول مرة ثانية");
		return { url: `${baseUrl}${route}`, close };
	} catch (error) {
		await close();
		throw error;
	}
}

export function buildInstagramAuthorizationUrl(appId: string, state: string) {
	const params = new URLSearchParams({
		enable_fb_login: "0",
		force_authentication: "1",
		client_id: appId,
		redirect_uri: INSTAGRAM_CALLBACK_URL,
		response_type: "code",
		scope: SCOPES.join(","),
		state,
	});
	return `https://www.instagram.com/oauth/authorize?${params}`;
}

export async function publishInstagramReel(options: {
	accessToken: string;
	userId: string;
	videoPath: string;
	caption: string;
	fetcher?: Fetcher;
	wait?: (milliseconds: number) => Promise<void>;
	publicVideoUrl?: string;
}) {
	const fetcher = options.fetcher || fetch;
	const wait = options.wait || Bun.sleep;
	if (!existsSync(options.videoPath) || extname(options.videoPath).toLowerCase() !== ".mp4") {
		throw new Error("ملف الريل غير موجود أو ليس MP4");
	}
	if (options.caption.length > 2200) {
		throw new Error("وصف Instagram أطول من 2200 حرف");
	}

	const video = Bun.file(options.videoPath);
	if (video.size < 1 || video.size > 1024 * 1024 * 1024) {
		throw new Error("حجم الريل يجب أن يكون أقل من 1GB");
	}

	const exposed = options.publicVideoUrl ? null : await exposeVideo(options.videoPath);
	try {
		const createBody = new URLSearchParams({
			access_token: options.accessToken,
			media_type: "REELS",
			video_url: options.publicVideoUrl || exposed!.url,
			share_to_feed: "true",
			caption: options.caption,
		});
		const container = await metaJson(await fetcher(
			`https://graph.instagram.com/${API_VERSION}/${encodeURIComponent(options.userId)}/media`,
			{
				method: "POST",
				headers: { "Content-Type": "application/x-www-form-urlencoded" },
				body: createBody,
			}
		));
		if (!container.id) throw new Error("لم يُرجع Instagram معرّف رفع الفيديو");

		let status = "IN_PROGRESS";
		for (let attempt = 0; attempt < 30; attempt++) {
			const statusUrl = new URL(`https://graph.instagram.com/${API_VERSION}/${container.id}`);
			statusUrl.searchParams.set("fields", "status_code,status");
			statusUrl.searchParams.set("access_token", options.accessToken);
			const result = await metaJson(await fetcher(statusUrl));
			status = result.status_code || status;
			if (status === "FINISHED") break;
			if (status === "ERROR" || status === "EXPIRED") {
				throw new Error(result.status || "فشل Instagram في معالجة الفيديو");
			}
			await wait(5000);
		}
		if (status !== "FINISHED") {
			throw new Error("تأخر Instagram في معالجة الفيديو؛ حاول النشر مرة ثانية");
		}

		const publishBody = new URLSearchParams({
			access_token: options.accessToken,
			creation_id: container.id,
		});
		const published = await metaJson(await fetcher(
			`https://graph.instagram.com/${API_VERSION}/${encodeURIComponent(options.userId)}/media_publish`,
			{
				method: "POST",
				headers: { "Content-Type": "application/x-www-form-urlencoded" },
				body: publishBody,
			}
		));
		return { mediaId: String(published.id), containerId: String(container.id) };
	} finally {
		await exposed?.close();
	}
}

export class InstagramManager {
	private configFile = resolve("instagram_config.json");
	private publishingJobs = new Map<string, Promise<{ mediaId: string; containerId: string; alreadyPublished?: boolean }>>();
	private publicationStates = new Map<string, InstagramPublication>();

	private async load(): Promise<InstagramConfig> {
		if (!existsSync(this.configFile)) return {};
		try {
			return JSON.parse(await fs.readFile(this.configFile, "utf8"));
		} catch {
			throw new Error("ملف إعدادات Instagram تالف؛ احذف الربط وأعده");
		}
	}

	private async save(config: InstagramConfig) {
		await fs.writeFile(this.configFile, JSON.stringify(config, null, 2), "utf8");
	}

	async getStatus(): Promise<InstagramStatus> {
		const config = await this.load();
		return {
			configured: Boolean(config.appId && config.appSecretProtected),
			connected: Boolean(config.accessTokenProtected && config.userId),
			appId: config.appId || "",
			username: config.username,
			userId: config.userId,
			tokenExpiresAt: config.tokenExpiresAt,
			callbackUrl: INSTAGRAM_CALLBACK_URL,
		};
	}

	async getPublishedJobs() {
		return (await this.load()).publishedJobs || {};
	}

	async getPublications() {
		const published = await this.getPublishedJobs();
		const publications: Record<string, InstagramPublication> = {};
		for (const [jobId, result] of Object.entries(published)) {
			publications[jobId] = { status: "published", ...result };
		}
		for (const [jobId, state] of this.publicationStates) publications[jobId] = state;
		return publications;
	}

	async startPublish(jobId: string, videoPath: string, caption: string): Promise<InstagramPublication> {
		const previous = (await this.load()).publishedJobs?.[jobId];
		if (previous) return { status: "published", ...previous };
		const active = this.publicationStates.get(jobId);
		if (active?.status === "publishing") return active;

		const state: InstagramPublication = { status: "publishing", startedAt: new Date().toISOString() };
		this.publicationStates.set(jobId, state);
		void this.publish(jobId, videoPath, caption).then((result) => {
			this.publicationStates.set(jobId, {
				status: "published",
				mediaId: result.mediaId,
				containerId: result.containerId,
				publishedAt: new Date().toISOString(),
			});
		}).catch((error: any) => {
			this.publicationStates.set(jobId, {
				status: "failed",
				error: error?.message || "فشل النشر على Instagram",
			});
		});
		return state;
	}

	async saveCredentials(appId: string, appSecret?: string) {
		const cleanId = String(appId || "").trim();
		if (!/^\d{8,30}$/.test(cleanId)) throw new Error("Instagram App ID غير صحيح");
		const config = await this.load();
		const appChanged = Boolean(config.appId && config.appId !== cleanId);
		if (appChanged && !appSecret?.trim()) throw new Error("أدخل App Secret الجديد عند تغيير App ID");
		if (appChanged) {
			config.accessTokenProtected = undefined;
			config.userId = undefined;
			config.username = undefined;
			config.tokenExpiresAt = undefined;
		}
		config.appId = cleanId;
		if (appSecret?.trim()) {
			if (appSecret.trim().length < 16) throw new Error("Instagram App Secret غير صحيح");
			config.appSecretProtected = protectSecret(appSecret.trim());
		}
		if (!config.appSecretProtected) throw new Error("أدخل Instagram App Secret");
		await this.save(config);
		return this.getStatus();
	}

	async getAuthorizationUrl() {
		const config = await this.load();
		if (!config.appId || !config.appSecretProtected) {
			throw new Error("احفظ App ID وApp Secret أولًا");
		}
		config.oauthState = crypto.randomUUID();
		config.oauthStateExpiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
		await this.save(config);
		return buildInstagramAuthorizationUrl(config.appId, config.oauthState);
	}

	async finishAuthorization(code: string, state: string) {
		const config = await this.load();
		if (!config.oauthState || state !== config.oauthState || !config.oauthStateExpiresAt || Date.now() > Date.parse(config.oauthStateExpiresAt)) {
			throw new Error("جلسة ربط Instagram غير صالحة؛ ابدأ الربط مرة ثانية");
		}
		config.oauthState = undefined;
		config.oauthStateExpiresAt = undefined;
		await this.save(config);

		const appSecret = unprotectSecret(config.appSecretProtected!);
		const shortBody = new URLSearchParams({
			client_id: config.appId!,
			client_secret: appSecret,
			grant_type: "authorization_code",
			redirect_uri: INSTAGRAM_CALLBACK_URL,
			code,
		});
		const shortToken = await metaJson(await fetch("https://api.instagram.com/oauth/access_token", {
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body: shortBody,
		}));

		const exchangeUrl = new URL("https://graph.instagram.com/access_token");
		exchangeUrl.searchParams.set("grant_type", "ig_exchange_token");
		exchangeUrl.searchParams.set("client_secret", appSecret);
		exchangeUrl.searchParams.set("access_token", shortToken.access_token);
		const longToken = await metaJson(await fetch(exchangeUrl));
		const accessToken = String(longToken.access_token);

		const profileUrl = new URL(`https://graph.instagram.com/${API_VERSION}/me`);
		profileUrl.searchParams.set("fields", "user_id,username");
		profileUrl.searchParams.set("access_token", accessToken);
		const profile = await metaJson(await fetch(profileUrl));

		config.accessTokenProtected = protectSecret(accessToken);
		config.userId = String(profile.user_id || shortToken.user_id || profile.id);
		config.username = String(profile.username || "");
		config.tokenExpiresAt = new Date(Date.now() + Number(longToken.expires_in || 5184000) * 1000).toISOString();
		await this.save(config);
		return this.getStatus();
	}

	private async getValidToken(config: InstagramConfig) {
		if (!config.accessTokenProtected || !config.userId) throw new Error("اربط حساب Instagram أولًا");
		let token = unprotectSecret(config.accessTokenProtected);
		const expiresAt = Date.parse(config.tokenExpiresAt || "");
		if (Number.isFinite(expiresAt) && expiresAt - Date.now() < 7 * 24 * 60 * 60 * 1000) {
			if (expiresAt <= Date.now()) throw new Error("انتهى ربط Instagram؛ أعد ربط الحساب");
			const refreshUrl = new URL("https://graph.instagram.com/refresh_access_token");
			refreshUrl.searchParams.set("grant_type", "ig_refresh_token");
			refreshUrl.searchParams.set("access_token", token);
			const refreshed = await metaJson(await fetch(refreshUrl));
			token = String(refreshed.access_token || token);
			config.accessTokenProtected = protectSecret(token);
			config.tokenExpiresAt = new Date(Date.now() + Number(refreshed.expires_in || 5184000) * 1000).toISOString();
			await this.save(config);
		}
		return token;
	}

	async publish(jobId: string, videoPath: string, caption: string) {
		const config = await this.load();
		const previous = config.publishedJobs?.[jobId];
		if (previous) return { ...previous, alreadyPublished: true };
		const active = this.publishingJobs.get(jobId);
		if (active) return active;

		const publishing = (async () => {
			const accessToken = await this.getValidToken(config);
			const result = await publishInstagramReel({ accessToken, userId: config.userId!, videoPath, caption });
			const latest = await this.load();
			latest.publishedJobs ||= {};
			latest.publishedJobs[jobId] = { ...result, publishedAt: new Date().toISOString() };
			await this.save(latest);
			return result;
		})();
		this.publishingJobs.set(jobId, publishing);
		try {
			return await publishing;
		} finally {
			this.publishingJobs.delete(jobId);
		}
	}

	async disconnect() {
		const config = await this.load();
		config.accessTokenProtected = undefined;
		config.userId = undefined;
		config.username = undefined;
		config.tokenExpiresAt = undefined;
		await this.save(config);
		return this.getStatus();
	}
}
