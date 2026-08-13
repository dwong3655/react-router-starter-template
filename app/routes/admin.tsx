import type { Route } from "./+types/admin";
import { Form, redirect, useNavigation } from "react-router";
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
		.sort((a, b) => b.uploaded.getTime() - a.uploaded.getTime())
		.map((obj) => ({
			key: obj.key,
			title: obj.customMetadata?.title ?? "Untitled",
			artist: obj.customMetadata?.artist ?? "Unknown",
			status: obj.customMetadata?.status ?? "pending",
		}));

	return {
		pending: all.filter((i) => i.status === "pending"),
		approved: all.filter((i) => i.status === "approved"),
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
	bg: "#0B0B10",
	bgPanel: "#151420",
	violet: "#8B5CF6",
	coral: "#FF6B6B",
	text: "#F4F2F8",
	textDim: "#9C97AD",
	border: "#26243A",
	green: "#4ADE80",
};

export default function Admin({ loaderData }: Route.ComponentProps) {
	const { pending, approved } = loaderData;
	const navigation = useNavigation();
	const isBusy = navigation.state !== "idle";

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

			<header
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
						<div
							style={{
								width: 30,
								height: 30,
								borderRadius: 8,
								background: `linear-gradient(135deg, ${COLORS.violet}, ${COLORS.coral})`,
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
						marginBottom: 32,
					}}
				>
					Admin Dashboard
				</h1>

				{/* Pending */}
				<section style={{ marginBottom: 48 }}>
					<h2 style={sectionHeaderStyle}>
						Pending review{" "}
						<span style={{ color: COLORS.textDim, fontWeight: 400 }}>
							({pending.length})
						</span>
					</h2>

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
												Reject
											</button>
										</Form>
									</div>
								</div>
							))}
						</div>
					)}
				</section>

				{/* Live gallery */}
				<section>
					<h2 style={sectionHeaderStyle}>
						Live gallery{" "}
						<span style={{ color: COLORS.textDim, fontWeight: 400 }}>
							({approved.length})
						</span>
					</h2>

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
			</div>
		</div>
	);
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

const sectionHeaderStyle: React.CSSProperties = {
	fontFamily: "'Archivo Black', sans-serif",
	fontSize: 18,
	marginBottom: 16,
};

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
