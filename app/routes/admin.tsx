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

export async function loader({ request, context }: Route.LoaderArgs) {
	const adminPassword = context.cloudflare.env.ADMIN_PASSWORD;
	if (!adminPassword || !isAdminRequest(request, adminPassword)) {
		throw redirect("/admin/login");
	}

	const listed = await context.cloudflare.env.ART_BUCKET.list({
		include: ["customMetadata"],
	});

	const all = listed.objects
		.filter((obj) => !obj.key.startsWith("updates/"))
		.sort((a, b) => b.uploaded.getTime() - a.uploaded.getTime())
		.map((obj) => ({
			key: obj.key,
			title: obj.customMetadata?.title ?? "Untitled",
			artist: obj.customMetadata?.artist ?? "Unknown",
			status: obj.customMetadata?.status ?? "pending",
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

	return {
		pending: all.filter((i) => i.status === "pending"),
		approved: all.filter((i) => i.status === "approved"),
		updates: updates.filter((u): u is NonNullable<typeof u> => u !== null),
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

type Tab = "pending" | "gallery" | "updates";

export default function Admin({ loaderData, actionData }: Route.ComponentProps) {
	const { pending, approved, updates } = loaderData;
	const navigation = useNavigation();
	const isBusy = navigation.state !== "idle";
	const [tab, setTab] = useState<Tab>("pending");

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
			</div>
		</div>
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
