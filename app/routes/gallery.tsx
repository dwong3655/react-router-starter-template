import type { Route } from "./+types/gallery";
import VoteButton from "../components/VoteButton";

export function meta({}: Route.MetaArgs) {
	return [{ title: "Collection — ArtDrop Spot" }];
}

export async function loader({ context }: Route.LoaderArgs) {
	const listed = await context.cloudflare.env.ART_BUCKET.list({
		include: ["customMetadata"],
	});

	const items = listed.objects
		.filter((obj) => !obj.key.startsWith("updates/") && obj.customMetadata?.status === "approved")
		.sort((a, b) => b.uploaded.getTime() - a.uploaded.getTime())
		.map((obj) => ({
			key: obj.key,
			title: obj.customMetadata?.title ?? "Untitled",
			artist: obj.customMetadata?.artist ?? "Unknown artist",
			votes: parseInt(obj.customMetadata?.votes ?? "0", 10),
			uploadedAt: obj.uploaded.toISOString(),
		}));

	return { items };
}

const COLORS = {
	bg: "#0A0A0A",
	bgPanel: "#1A1A1A",
	violet: "#FACC15",
	coral: "#FACC15",
	text: "#FFFFFF",
	textDim: "#9CA3AF",
	border: "#2E2E2E",
};

export default function Gallery({ loaderData }: Route.ComponentProps) {
	const { items } = loaderData;

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
					.ad-header { flex-wrap: wrap !important; gap: 14px !important; }
					.ad-nav { flex-wrap: wrap !important; gap: 10px 18px !important; }
					.ad-page-title { font-size: 26px !important; }
				}
			`}</style>

			{/* Header */}
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
					<Logo />
				</a>
				<nav className="ad-nav" style={{ display: "flex", alignItems: "center", gap: 32 }}>
					<a href="/upload" style={navLinkStyle}>
						Upload
					</a>
					<a href="/gallery" style={{ ...navLinkStyle, color: COLORS.violet }}>
						Collection
					</a>
					<a href="/updates" style={navLinkStyle}>
						Update log
					</a>
					<a href="/admin" style={{ ...navLinkStyle, color: COLORS.textDim, fontWeight: 500 }}>
						Sign in
					</a>
				</nav>
			</header>

			{/* Body */}
			<div style={{ maxWidth: 1200, margin: "0 auto", padding: "48px 32px" }}>
				<h1
					className="ad-page-title"
					style={{
						fontFamily: "'Archivo Black', sans-serif",
						fontSize: 32,
						margin: "0 0 8px",
					}}
				>
					Collection
				</h1>
				<p style={{ color: COLORS.textDim, fontSize: 15, marginBottom: 8 }}>
					Everything the community has dropped so far.
				</p>
				<a
					href="/upload"
					style={{
						display: "inline-block",
						marginBottom: 32,
						color: COLORS.violet,
						fontWeight: 600,
						fontSize: 14,
						textDecoration: "none",
					}}
				>
					+ Upload new art
				</a>

				{items.length === 0 && (
					<p style={{ color: COLORS.textDim }}>
						No artwork uploaded yet — be the first.
					</p>
				)}

				<div
					style={{
						display: "grid",
						gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
						gap: 24,
					}}
				>
					{items.map((item) => (
						<ArtCard
							key={item.key}
							title={item.title}
							artist={item.artist}
							imgKey={item.key}
							votes={item.votes}
							uploadedAt={item.uploadedAt}
						/>
					))}
				</div>
			</div>
		</div>
	);
}

function Logo() {
	return (
		<div style={{ display: "flex", alignItems: "center", gap: 10 }}>
			<img
				src="/artdropspot-logo.png"
				alt="ArtDrop Spot logo"
				style={{
					width: 30,
					height: 30,
					borderRadius: 8,
					flexShrink: 0,
					objectFit: "cover",
				}}
			/>
			<span
				style={{
					fontFamily: "'Archivo Black', sans-serif",
					fontSize: 17,
					letterSpacing: 0.3,
				}}
			>
				ArtDrop <span style={{ color: COLORS.violet }}>Spot</span>
			</span>
		</div>
	);
}

function ArtCard({
	title,
	artist,
	imgKey,
	votes,
	uploadedAt,
}: {
	title: string;
	artist: string;
	imgKey: string;
	votes: number;
	uploadedAt: string;
}) {
	return (
		<div>
			<div
				style={{
					aspectRatio: "1 / 1",
					borderRadius: 12,
					padding: 2,
					background: `linear-gradient(135deg, ${COLORS.violet}, ${COLORS.coral})`,
				}}
			>
				<div
					style={{
						width: "100%",
						height: "100%",
						borderRadius: 10,
						background: COLORS.bgPanel,
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						overflow: "hidden",
					}}
				>
					<img
						src={`/art/${imgKey}`}
						alt={title}
						style={{
							maxWidth: "100%",
							maxHeight: "100%",
							objectFit: "contain",
						}}
					/>
				</div>
			</div>
			<div
				style={{
					display: "flex",
					alignItems: "flex-start",
					justifyContent: "space-between",
					gap: 8,
					marginTop: 10,
				}}
			>
				<div>
					<p
						style={{
							margin: "0 2px",
							fontWeight: 600,
							fontSize: 14,
							color: COLORS.text,
						}}
					>
						{title}
					</p>
					<p style={{ margin: "2px 2px 0", fontSize: 12, color: COLORS.textDim }}>
						by {artist}
					</p>
					<p style={{ margin: "2px 2px 0", fontSize: 11, color: COLORS.textDim, opacity: 0.7 }}>
						{formatDate(uploadedAt)}
					</p>
				</div>
				<VoteButton itemKey={imgKey} initialVotes={votes} />
			</div>
		</div>
	);
}

function formatDate(iso: string): string {
	const d = new Date(iso);
	return d.toLocaleString(undefined, {
		year: "numeric",
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
	});
}

const navLinkStyle: React.CSSProperties = {
	color: COLORS.text,
	textDecoration: "none",
	fontWeight: 600,
	fontSize: 14,
};
