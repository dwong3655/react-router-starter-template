import type { Route } from "./+types/admin";
import { Form, redirect, useNavigation } from "react-router";
import { useState } from "react";
import {
	isAdminRequest,
	clearAdminSessionCookie,
} from "../lib/admin-auth";

export function meta({}: Route.MetaArgs) {
	return [{ title: "Admin Dashboard — ArtDrop Spot" }];
}

const ZONE_ID = "0d16819701df0e04eda695a47d5da7bd";

type SiteStats = {
	totalRequests: number;
	uniqueVisitors: number;
	topCountries: { country: string; requests: number }[];
	error?: string;
};

async function fetchSiteStats(apiToken: string | undefined, rangeHours: number): Promise<SiteStats> {
	if (!apiToken) {
		return { totalRequests: 0, uniqueVisitors: 0, topCountries: [], error: "Analytics not configured." };
	}

	const until = new Date();
	const since = new Date(until.getTime() - rangeHours * 60 * 60 * 1000);
	const sinceDate = since.toISOString().slice(0, 10);
	const untilDate = until.toISOString().slice(0, 10);

	// Daily rollups (httpRequests1dGroups) have longer retention than the
	// per-request adaptive dataset, so a single query safely covers 24h/7d/30d.
	const query = `
		query GetStats($zoneTag: string, $since: string, $until: string) {
			viewer {
				zones(filter: { zoneTag: $zoneTag }) {
					httpRequests1dGroups(
						limit: 31
						orderBy: [date_ASC]
						filter: { date_geq: $since, date_leq: $until }
					) {
						dimensions { date }
						sum {
							requests
							countryMap {
								requests
								clientCountryName
							}
						}
						uniq { uniques }
					}
				}
			}
		}
	`;

	try {
		const res = await fetch("https://api.cloudflare.com/client/v4/graphql", {
			method: "POST",
			headers: {
				Authorization: `Bearer ${apiToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				query,
				variables: {
					zoneTag: ZONE_ID,
					since: sinceDate,
					until: untilDate,
				},
			}),
		});

		const json = await res.json<any>();

		if (json.errors && json.errors.length > 0) {
			return {
				totalRequests: 0,
				uniqueVisitors: 0,
				topCountries: [],
				error: json.errors[0]?.message ?? "Failed to load analytics.",
			};
		}

		const days = json?.data?.viewer?.zones?.[0]?.httpRequests1dGroups ?? [];

		let totalRequests = 0;
		let uniqueVisitors = 0;
		const countryTotals = new Map<string, number>();

		for (const day of days) {
			totalRequests += day?.sum?.requests ?? 0;
			uniqueVisitors += day?.uniq?.uniques ?? 0;
			for (const row of day?.sum?.countryMap ?? []) {
				const country = row.clientCountryName ?? "Unknown";
				countryTotals.set(country, (countryTotals.get(country) ?? 0) + (row.requests ?? 0));
			}
		}

		const topCountries = [...countryTotals.entries()]
			.map(([country, requests]) => ({ country, requests }))
			.sort((a, b) => b.requests - a.requests)
			.slice(0, 10);

		return { totalRequests, uniqueVisitors, topCountries };
	} catch {
		return {
			totalRequests: 0,
			uniqueVisitors: 0,
			topCountries: [],
			error: "Could not reach Cloudflare Analytics.",
		};
	}
}

export async function loader({ request, context }: Route.LoaderArgs) {
	const adminPassword = context.cloudflare.env.ADMIN_PASSWORD;
	if (!adminPassword || !isAdminRequest(request, adminPassword)) {
		throw redirect("/admin/login");
	}

	const url = new URL(request.url);
	const rangeParam = url.searchParams.get("range");
	const rangeHours = rangeParam === "7d" ? 24 * 7 : rangeParam === "30d" ? 24 * 30 : 24;
	const range: "24h" | "7d" | "30d" =
		rangeParam === "7d" ? "7d" : rangeParam === "30d" ? "30d" : "24h";

	const listed = await context.cloudflare.env.ART_BUCKET.list({
		include: ["customMetadata"],
	});

	const all = listed.objects
		.filter((obj) => !obj.key.startsWith("updates/") && !obj.key.startsWith("login-attempts/") && !obj.key.startsWith("board/") && !obj.key.startsWith("board-last-post/"))
		.sort((a, b) => b.uploaded.getTime() - a.uploaded.getTime())
		.map((obj) => ({
			key: obj.key,
			title: obj.customMetadata?.title ?? "Untitled",
			artist: obj.customMetadata?.artist ?? "Unknown",
			status: obj.customMetadata?.status ?? "pending",
			votes: parseInt(obj.customMetadata?.votes ?? "0", 10),
		}));

	const updatesListed = await context.cloudflare.env.ART_BUCKET.list({
		prefix: "updates/",
	});

	const updates = await Promise.all(
		updatesListed.objects
			.sort((a, b) => b.uploaded.getTime() - a.uploaded.getTime())
			.map(async (obj) => {
				const object = await context.cloudflare.env.ART_BUCKET.get(obj.key);
				if (!object) return null;
				const data = await object.json<{ message: string; postedAt: string }>();
				return { key: obj.key, ...data };
			})
	);

	const stats = await fetchSiteStats(context.cloudflare.env.CLOUDFLARE_API_TOKEN, rangeHours);

	const boardListed = await context.cloudflare.env.ART_BUCKET.list({
		prefix: "board/",
	});

	const boardPosts = await Promise.all(
		boardListed.objects
			.sort((a, b) => b.uploaded.getTime() - a.uploaded.getTime())
			.map(async (obj) => {
				const object = await context.cloudflare.env.ART_BUCKET.get(obj.key);
				if (!object) return null;
				const data = await object.json<{
					handle: string;
					message: string;
					emoji: string;
					postedAt: string;
				}>();
				return { key: obj.key, ...data };
			})
	);

	return {
		pending: all.filter((i) => i.status === "pending"),
		approved: all.filter((i) => i.status === "approved"),
		updates: updates.filter((u): u is NonNullable<typeof u> => u !== null),
		boardPosts: boardPosts.filter((p): p is NonNullable<typeof p> => p !== null),
		stats,
		range,
	};
}

export async function action({ request, context }: Route.ActionArgs) {
	const adminPassword = context.cloudflare.env.ADMIN_PASSWORD;
	if (!adminPassword || !isAdminRequest(request, adminPassword)) {
		throw redirect("/admin/login");
	}

	const formData = await request.formData();
	const intent = formData.get("intent");
	const key = formData.get("key") as string | null;

	if (intent === "logout") {
		return redirect("/admin/login", {
			headers: { "Set-Cookie": clearAdminSessionCookie() },
		});
	}

	if (intent === "post-update") {
		const message = (formData.get("message") as string | null)?.trim();
		if (!message) {
			return { error: "Update message can't be empty." };
		}
		const postedAt = new Date().toISOString();
		const updateKey = `updates/${Date.now()}-${crypto.randomUUID()}.json`;
		await context.cloudflare.env.ART_BUCKET.put(
			updateKey,
			JSON.stringify({ message, postedAt })
		);
		return { success: true };
	}

	if (intent === "delete-update") {
		if (!key) return { error: "Missing update key." };
		await context.cloudflare.env.ART_BUCKET.delete(key);
		return { success: true };
	}

	if (intent === "delete-board-post") {
		if (!key) return { error: "Missing post key." };
		await context.cloudflare.env.ART_BUCKET.delete(key);
		return { success: true };
	}

	if (!key) {
		return { error: "Missing item key." };
	}

	if (intent === "approve") {
		const object = await context.cloudflare.env.ART_BUCKET.get(key);
		if (object) {
			await context.cloudflare.env.ART_BUCKET.put(key, object.body, {
				httpMetadata: object.httpMetadata,
				customMetadata: { ...object.customMetadata, status: "approved" },
			});
		}
		return { success: true };
	}

	if (intent === "reject" || intent === "delete") {
		await context.cloudflare.env.ART_BUCKET.delete(key);
		return { success: true };
	}

	if (intent === "reset-votes") {
		const object = await context.cloudflare.env.ART_BUCKET.get(key);
		if (object) {
			await context.cloudflare.env.ART_BUCKET.put(key, object.body, {
				httpMetadata: object.httpMetadata,
				customMetadata: { ...object.customMetadata, votes: "0" },
			});
		}
		return { success: true };
	}

	return { error: "Unknown action." };
}

const COLORS = {
	bg: "#0A0A0A",
	bgPanel: "#1A1A1A",
	violet: "#FACC15",
	coral: "#FACC15",
	text: "#FFFFFF",
	textDim: "#9CA3AF",
	border: "#2E2E2E",
	green: "#4ADE80",
};

type Tab = "pending" | "gallery" | "updates" | "board" | "stats";

export default function Admin({ loaderData, actionData }: Route.ComponentProps) {
	const { pending, approved, updates, boardPosts, stats, range } = loaderData;
	const navigation = useNavigation();
	const isBusy = navigation.state !== "idle";
	const [tab, setTab] = useState<Tab>(() => {
		if (typeof window === "undefined") return "pending";
		const params = new URLSearchParams(window.location.search);
		const t = params.get("tab");
		return t === "gallery" || t === "updates" || t === "board" || t === "stats" ? t : "pending";
	});

	return (
		<div
			style={{
				fontFamily: "'Inter', sans-serif",
				background: COLORS.bg,
				color: COLORS.text,
				minHeight: "100vh",
			}}
		>
			<link
				rel="stylesheet"
				href="https://fonts.googleapis.com/css2?family=Archivo+Black&family=Inter:wght@400;500;600;700&display=swap"
			/>
			<style>{`
				@media (max-width: 640px) {
					.ad-header { flex-wrap: wrap !important; gap: 12px !important; }
					.ad-tabs { overflow-x: auto !important; white-space: nowrap !important; }
				}
			`}</style>

			<header
				className="ad-header"
				style={{
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between",
					padding: "18px 32px",
					borderBottom: `1px solid ${COLORS.border}`,
				}}
			>
				<a href="/" style={{ textDecoration: "none", color: "inherit" }}>
					<div style={{ display: "flex", alignItems: "center", gap: 10 }}>
						<img
							src="/artdropspot-logo.png"
							alt="ArtDrop Spot logo"
							style={{
								width: 30,
								height: 30,
								borderRadius: 8,
								objectFit: "cover",
							}}
						/>
						<span
							style={{
								fontFamily: "'Archivo Black', sans-serif",
								fontSize: 17,
							}}
						>
							ArtDrop <span style={{ color: COLORS.violet }}>Spot</span>
						</span>
					</div>
				</a>

				<Form method="post">
					<input type="hidden" name="intent" value="logout" />
					<button
						type="submit"
						style={{
							background: "transparent",
							border: `1px solid ${COLORS.border}`,
							color: COLORS.text,
							padding: "8px 16px",
							borderRadius: 8,
							cursor: "pointer",
							fontSize: 13,
							fontFamily: "'Inter', sans-serif",
						}}
					>
						Log out
					</button>
				</Form>
			</header>

			<div style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 32px" }}>
				<h1
					style={{
						fontFamily: "'Archivo Black', sans-serif",
						fontSize: 28,
						marginBottom: 24,
					}}
				>
					Admin Dashboard
				</h1>

				{/* Tabs */}
				<div
					className="ad-tabs"
					style={{
						display: "flex",
						gap: 8,
						marginBottom: 32,
						borderBottom: `1px solid ${COLORS.border}`,
					}}
				>
					<TabButton active={tab === "pending"} onClick={() => setTab("pending")}>
						Pending review ({pending.length})
					</TabButton>
					<TabButton active={tab === "gallery"} onClick={() => setTab("gallery")}>
						Live gallery ({approved.length})
					</TabButton>
					<TabButton active={tab === "updates"} onClick={() => setTab("updates")}>
						Update log ({updates.length})
					</TabButton>
					<TabButton active={tab === "board"} onClick={() => setTab("board")}>
						Board posts ({boardPosts.length})
					</TabButton>
					<TabButton active={tab === "stats"} onClick={() => setTab("stats")}>
						Site stats
					</TabButton>
				</div>

				{/* Pending tab */}
				{tab === "pending" && (
					<section>
						{pending.length === 0 ? (
							<p style={{ color: COLORS.textDim, fontSize: 14 }}>
								Nothing waiting for review.
							</p>
						) : (
							<div style={gridStyle}>
								{pending.map((item) => (
									<div key={item.key} style={cardStyle}>
										<ThumbBox imgKey={item.key} title={item.title} />
										<p style={itemTitleStyle}>{item.title}</p>
										<p style={itemArtistStyle}>by {item.artist}</p>
										<p style={itemVotesStyle}>⭐ {item.votes} votes</p>
										<div style={{ display: "flex", gap: 8, marginTop: 10 }}>
											<Form method="post" style={{ flex: 1 }}>
												<input type="hidden" name="intent" value="approve" />
												<input type="hidden" name="key" value={item.key} />
												<button
													type="submit"
													disabled={isBusy}
													style={{ ...actionButtonStyle, background: COLORS.green, color: "#0B0B10" }}
												>
													Approve
												</button>
											</Form>
											<Form method="post" style={{ flex: 1 }}>
												<input type="hidden" name="intent" value="reject" />
												<input type="hidden" name="key" value={item.key} />
												<button
													type="submit"
													disabled={isBusy}
													style={{ ...actionButtonStyle, background: "transparent", color: COLORS.coral, border: `1px solid ${COLORS.coral}` }}
												>
													Delete
												</button>
											</Form>
										</div>
										<Form method="post" style={{ marginTop: 8 }}>
											<input type="hidden" name="intent" value="reset-votes" />
											<input type="hidden" name="key" value={item.key} />
											<button
												type="submit"
												disabled={isBusy || item.votes === 0}
												style={{
													...actionButtonStyle,
													width: "100%",
													background: "transparent",
													color: COLORS.textDim,
													border: `1px solid ${COLORS.border}`,
													cursor: item.votes === 0 ? "default" : "pointer",
												}}
											>
												Reset votes
											</button>
										</Form>
									</div>
								))}
							</div>
						)}
					</section>
				)}

				{/* Live gallery tab */}
				{tab === "gallery" && (
					<section>
						{approved.length === 0 ? (
							<p style={{ color: COLORS.textDim, fontSize: 14 }}>
								Nothing published yet.
							</p>
						) : (
							<div style={gridStyle}>
								{approved.map((item) => (
									<div key={item.key} style={cardStyle}>
										<ThumbBox imgKey={item.key} title={item.title} />
										<p style={itemTitleStyle}>{item.title}</p>
										<p style={itemArtistStyle}>by {item.artist}</p>
										<p style={itemVotesStyle}>⭐ {item.votes} votes</p>
										<Form method="post" style={{ marginTop: 10 }}>
											<input type="hidden" name="intent" value="delete" />
											<input type="hidden" name="key" value={item.key} />
											<button
												type="submit"
												disabled={isBusy}
												style={{ ...actionButtonStyle, width: "100%", background: "transparent", color: COLORS.coral, border: `1px solid ${COLORS.coral}` }}
											>
												Delete
											</button>
										</Form>
										<Form method="post" style={{ marginTop: 8 }}>
											<input type="hidden" name="intent" value="reset-votes" />
											<input type="hidden" name="key" value={item.key} />
											<button
												type="submit"
												disabled={isBusy || item.votes === 0}
												style={{
													...actionButtonStyle,
													width: "100%",
													background: "transparent",
													color: COLORS.textDim,
													border: `1px solid ${COLORS.border}`,
													cursor: item.votes === 0 ? "default" : "pointer",
												}}
											>
												Reset votes
											</button>
										</Form>
									</div>
								))}
							</div>
						)}
					</section>
				)}

				{/* Update log tab */}
				{tab === "updates" && (
					<section>
						<Form method="post" style={{ marginBottom: 32 }}>
							<input type="hidden" name="intent" value="post-update" />
							<textarea
								name="message"
								required
								placeholder="Write an update for the site's changelog..."
								rows={4}
								style={{
									width: "100%",
									padding: "12px 14px",
									borderRadius: 8,
									border: `1px solid ${COLORS.border}`,
									background: COLORS.bgPanel,
									color: COLORS.text,
									fontSize: 14,
									fontFamily: "'Inter', sans-serif",
									resize: "vertical",
									boxSizing: "border-box",
									marginBottom: 12,
								}}
							/>
							<button
								type="submit"
								disabled={isBusy}
								style={{
									padding: "10px 24px",
									borderRadius: 999,
									border: "none",
									background: COLORS.violet,
									color: "#0A0A0A",
									fontWeight: 700,
									fontSize: 14,
									cursor: isBusy ? "default" : "pointer",
									fontFamily: "'Inter', sans-serif",
								}}
							>
								Post update
							</button>
						</Form>

						{actionData?.error && (
							<p style={{ color: "#FF6B6B", fontSize: 14, marginBottom: 20 }}>
								{actionData.error}
							</p>
						)}

						{updates.length === 0 ? (
							<p style={{ color: COLORS.textDim, fontSize: 14 }}>
								No updates posted yet.
							</p>
						) : (
							<div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
								{updates.map((entry) => (
									<div
										key={entry.key}
										style={{
											...cardStyle,
											display: "flex",
											justifyContent: "space-between",
											alignItems: "flex-start",
											gap: 16,
										}}
									>
										<div>
											<p style={{ margin: "0 0 6px", fontSize: 12, color: COLORS.violet, fontWeight: 700 }}>
												{formatDate(entry.postedAt)}
											</p>
											<p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
												{entry.message}
											</p>
										</div>
										<Form method="post">
											<input type="hidden" name="intent" value="delete-update" />
											<input type="hidden" name="key" value={entry.key} />
											<button
												type="submit"
												disabled={isBusy}
												style={{
													...actionButtonStyle,
													width: "auto",
													padding: "6px 14px",
													background: "transparent",
													color: COLORS.coral,
													border: `1px solid ${COLORS.coral}`,
													whiteSpace: "nowrap",
												}}
											>
												Delete
											</button>
										</Form>
									</div>
								))}
							</div>
						)}
					</section>
				)}

				{/* Board posts tab */}
				{tab === "board" && (
					<section>
						{boardPosts.length === 0 ? (
							<p style={{ color: COLORS.textDim, fontSize: 14 }}>
								No bulletin board posts yet.
							</p>
						) : (
							<div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
								{boardPosts.map((post) => (
									<div
										key={post.key}
										style={{
											...cardStyle,
											display: "flex",
											gap: 12,
											alignItems: "flex-start",
										}}
									>
										<span style={{ fontSize: 22, flexShrink: 0 }}>{post.emoji}</span>
										<div style={{ flex: 1, minWidth: 0 }}>
											<div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
												<span style={{ fontWeight: 700, fontSize: 14 }}>{post.handle}</span>
												<span style={{ fontSize: 11, color: COLORS.textDim }}>
													{formatDate(post.postedAt)}
												</span>
											</div>
											<p style={{ margin: "4px 0 0", fontSize: 14, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
												{post.message}
											</p>
										</div>
										<Form method="post">
											<input type="hidden" name="intent" value="delete-board-post" />
											<input type="hidden" name="key" value={post.key} />
											<button
												type="submit"
												disabled={isBusy}
												style={{
													...actionButtonStyle,
													width: "auto",
													padding: "6px 14px",
													background: "transparent",
													color: COLORS.coral,
													border: `1px solid ${COLORS.coral}`,
													whiteSpace: "nowrap",
												}}
											>
												Delete
											</button>
										</Form>
									</div>
								))}
							</div>
						)}
					</section>
				)}

				{/* Site stats tab */}
				{tab === "stats" && (
					<section>
						<div
							style={{
								display: "flex",
								alignItems: "center",
								justifyContent: "space-between",
								flexWrap: "wrap",
								gap: 12,
								marginBottom: 24,
							}}
						>
							<p style={{ color: COLORS.textDim, fontSize: 14, margin: 0 }}>
								Traffic via Cloudflare Analytics.
							</p>

							<Form method="get">
								<input type="hidden" name="tab" value="stats" />
								<select
									name="range"
									defaultValue={range}
									onChange={(e) => e.currentTarget.form?.submit()}
									style={{
										padding: "8px 12px",
										borderRadius: 8,
										border: `1px solid ${COLORS.border}`,
										background: COLORS.bgPanel,
										color: COLORS.text,
										fontSize: 13,
										fontFamily: "'Inter', sans-serif",
										cursor: "pointer",
									}}
								>
									<option value="24h">Previous 24 hours</option>
									<option value="7d">Previous 7 days</option>
									<option value="30d">Previous 30 days</option>
								</select>
							</Form>
						</div>

						{stats.error ? (
							<p style={{ color: "#FF6B6B", fontSize: 14 }}>{stats.error}</p>
						) : (
							<>
								<div
									style={{
										display: "grid",
										gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
										gap: 16,
										marginBottom: 32,
									}}
								>
									<StatCard
										label="Total Requests"
										value={stats.totalRequests.toLocaleString()}
										icon={<RequestsIcon />}
									/>
								<StatCard
										label={range === "24h" ? "Unique Visitors" : "Visits"}
										value={stats.uniqueVisitors.toLocaleString()}
										icon={<VisitorsIcon />}
									/>
								</div>

								<h2
									style={{
										fontFamily: "'Archivo Black', sans-serif",
										fontSize: 16,
										marginBottom: 16,
									}}
								>
									Top Countries
								</h2>

								{stats.topCountries.length === 0 ? (
									<p style={{ color: COLORS.textDim, fontSize: 14 }}>
										No traffic recorded in this period.
									</p>
								) : (
									<div style={cardStyle}>
										{stats.topCountries.map((row, i) => (
											<div
												key={row.country + i}
												style={{
													display: "flex",
													justifyContent: "space-between",
													padding: "10px 4px",
													borderBottom:
														i < stats.topCountries.length - 1
															? `1px solid ${COLORS.border}`
															: "none",
													fontSize: 14,
												}}
											>
												<span>{row.country}</span>
												<span style={{ color: COLORS.textDim }}>
													{row.requests.toLocaleString()} requests
												</span>
											</div>
										))}
									</div>
								)}
							</>
						)}
					</section>
				)}
			</div>
		</div>
	);
}

function StatCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
	return (
		<div style={{ ...cardStyle, display: "flex", alignItems: "center", gap: 14 }}>
			<div
				style={{
					width: 44,
					height: 44,
					borderRadius: 10,
					background: "rgba(250,204,21,0.12)",
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					flexShrink: 0,
				}}
			>
				{icon}
			</div>
			<div>
				<p style={{ margin: 0, fontSize: 12, color: COLORS.textDim, textTransform: "uppercase", letterSpacing: 0.5 }}>
					{label}
				</p>
				<p style={{ margin: "4px 0 0", fontSize: 26, fontWeight: 700, fontFamily: "'Archivo Black', sans-serif" }}>
					{value}
				</p>
			</div>
		</div>
	);
}

function RequestsIcon() {
	return (
		<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={COLORS.violet} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
			<path d="M3 12h4l3 8 4-16 3 8h4" />
		</svg>
	);
}

function VisitorsIcon() {
	return (
		<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={COLORS.violet} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
			<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
			<circle cx="9" cy="7" r="4" />
			<path d="M23 21v-2a4 4 0 0 0-3-3.87" />
			<path d="M16 3.13a4 4 0 0 1 0 7.75" />
		</svg>
	);
}

function TabButton({
	active,
	onClick,
	children,
}: {
	active: boolean;
	onClick: () => void;
	children: React.ReactNode;
}) {
	return (
		<button
			onClick={onClick}
			style={{
				background: "none",
				border: "none",
				borderBottom: active ? `2px solid ${COLORS.violet}` : "2px solid transparent",
				color: active ? COLORS.text : COLORS.textDim,
				padding: "10px 4px",
				marginRight: 24,
				marginBottom: -1,
				fontSize: 14,
				fontWeight: 700,
				cursor: "pointer",
				fontFamily: "'Inter', sans-serif",
			}}
		>
			{children}
		</button>
	);
}

function formatDate(iso: string): string {
	const d = new Date(iso);
	return d.toLocaleString(undefined, {
		year: "numeric",
		month: "long",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
	});
}

function ThumbBox({ imgKey, title }: { imgKey: string; title: string }) {
	return (
		<div
			style={{
				aspectRatio: "1 / 1",
				borderRadius: 8,
				background: COLORS.bg,
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				overflow: "hidden",
			}}
		>
			<img
				src={`/art/${imgKey}`}
				alt={title}
				style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
			/>
		</div>
	);
}

const gridStyle: React.CSSProperties = {
	display: "grid",
	gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
	gap: 20,
};

const cardStyle: React.CSSProperties = {
	background: COLORS.bgPanel,
	border: `1px solid ${COLORS.border}`,
	borderRadius: 12,
	padding: 12,
};

const itemTitleStyle: React.CSSProperties = {
	margin: "10px 2px 0",
	fontWeight: 600,
	fontSize: 14,
};

const itemArtistStyle: React.CSSProperties = {
	margin: "2px 2px 0",
	fontSize: 12,
	color: COLORS.textDim,
};

const itemVotesStyle: React.CSSProperties = {
	margin: "6px 2px 0",
	fontSize: 12,
	color: COLORS.textDim,
};

const actionButtonStyle: React.CSSProperties = {
	width: "100%",
	padding: "8px 0",
	borderRadius: 6,
	border: "none",
	fontWeight: 700,
	fontSize: 13,
	cursor: "pointer",
	fontFamily: "'Inter', sans-serif",
};
