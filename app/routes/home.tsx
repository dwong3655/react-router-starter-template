import type { Route } from "./+types/home";
import VoteButton from "../components/VoteButton";

export function meta({}: Route.MetaArgs) {
	return [
		{ title: "ArtDrop Spot" },
		{ name: "description", content: "Drop your art. Get discovered." },
	];
}

export async function loader({ context }: Route.LoaderArgs) {
	const listed = await context.cloudflare.env.ART_BUCKET.list({
		include: ["customMetadata"],
	});

	const items = listed.objects
		.filter((obj) => obj.customMetadata?.status === "approved")
		.sort((a, b) => b.uploaded.getTime() - a.uploaded.getTime())
		.slice(0, 6)
		.map((obj) => ({
			key: obj.key,
			title: obj.customMetadata?.title ?? "Untitled",
			artist: obj.customMetadata?.artist ?? "Unknown",
			votes: parseInt(obj.customMetadata?.votes ?? "0", 10),
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

export default function Home({ loaderData }: Route.ComponentProps) {
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

			{/* Header */}
			<header
				style={{
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between",
					padding: "18px 32px",
					borderBottom: `1px solid ${COLORS.border}`,
					position: "sticky",
					top: 0,
					background: "rgba(11,11,16,0.9)",
					backdropFilter: "blur(8px)",
					zIndex: 10,
				}}
			>
				<Logo />

				<nav style={{ display: "flex", alignItems: "center", gap: 32 }}>
					<a href="/upload" style={navLinkStyle}>
						Upload
					</a>
					<a href="/gallery" style={navLinkStyle}>
						Collection
					</a>
					<a href="/updates" style={navLinkStyle}>
						Update log
					</a>
					<a href="/admin" style={{ ...navLinkStyle, color: COLORS.textDim, fontWeight: 500 }}>
						Sign in
					</a>
					<input
						type="search"
						placeholder="Search art..."
						style={{
							padding: "9px 14px",
							borderRadius: 8,
							border: `1px solid ${COLORS.border}`,
							background: COLORS.bgPanel,
							color: COLORS.text,
							width: 200,
							fontSize: 14,
							fontFamily: "'Inter', sans-serif",
						}}
					/>
				</nav>
			</header>

			{/* Hero */}
			<section
				style={{
					padding: "72px 32px 56px",
					textAlign: "center",
					borderBottom: `1px solid ${COLORS.border}`,
				}}
			>
				<h1
					style={{
						fontFamily: "'Archivo Black', sans-serif",
						fontSize: "clamp(36px, 6vw, 64px)",
						lineHeight: 1.05,
						margin: "0 0 16px",
						background: `linear-gradient(90deg, ${COLORS.text}, ${COLORS.violet})`,
						WebkitBackgroundClip: "text",
						WebkitTextFillColor: "transparent",
						backgroundClip: "text",
					}}
				>
					DROP YOUR ART.
					<br />
					GET DISCOVERED.
				</h1>
				<p
					style={{
						color: COLORS.textDim,
						fontSize: 16,
						maxWidth: 480,
						margin: "0 auto 28px",
						lineHeight: 1.6,
					}}
				>
					A space for digital artists to share their work, build a
					following, and see what everyone else is making.
				</p>
				<a href="/upload" style={ctaButtonStyle}>
					Upload your art
				</a>
			</section>

			{/* Body */}
			<div
				style={{
					display: "flex",
					gap: 32,
					padding: "48px 32px",
					maxWidth: 1200,
					margin: "0 auto",
					flexWrap: "wrap",
				}}
			>
				{/* Main content */}
				<main style={{ flex: "1 1 600px" }}>
					<h2
						style={{
							fontFamily: "'Archivo Black', sans-serif",
							fontSize: 22,
							letterSpacing: 0.5,
							marginBottom: 24,
						}}
					>
						RECENT CREATIONS
					</h2>

					{items.length === 0 ? (
						<p style={{ color: COLORS.textDim }}>
							No artwork uploaded yet — be the first.
						</p>
					) : (
						<div
							style={{
								display: "grid",
								gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
								gap: 20,
							}}
						>
							{items.map((item) => (
								<a
									key={item.key}
									href="/gallery"
									style={{ textDecoration: "none", color: "inherit" }}
								>
									<ArtCard title={item.title} artist={item.artist} imgKey={item.key} votes={item.votes} />
								</a>
							))}
						</div>
					)}
				</main>

				{/* Sidebar */}
				<aside
					style={{
						width: 280,
						flexShrink: 0,
						background: COLORS.bgPanel,
						border: `1px solid ${COLORS.border}`,
						borderRadius: 16,
						padding: 28,
						height: "fit-content",
					}}
				>
					<Logo />
					<p
						style={{
							fontSize: 14,
							lineHeight: 1.6,
							color: COLORS.textDim,
							margin: "16px 0 24px",
						}}
					>
						Upload your digital art, browse what the community is making, and
						get your work seen.
					</p>

					<nav style={{ display: "flex", flexDirection: "column", gap: 10 }}>
						<a href="/upload" style={sidebarButtonStyle(true)}>
							Upload
						</a>
						<a href="/gallery" style={sidebarButtonStyle(false)}>
							Collection
						</a>
						<a href="/updates" style={sidebarButtonStyle(false)}>
							Update log
						</a>
					</nav>
				</aside>
			</div>
		</div>
	);
}

function Logo() {
	return (
		<div style={{ display: "flex", alignItems: "center", gap: 10 }}>
			<div
				style={{
					width: 30,
					height: 30,
					borderRadius: 8,
					background: `linear-gradient(135deg, ${COLORS.violet}, ${COLORS.coral})`,
					flexShrink: 0,
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
}: {
	title: string;
	artist: string;
	imgKey: string;
	votes: number;
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
				</div>
				<VoteButton itemKey={imgKey} initialVotes={votes} />
			</div>
		</div>
	);
}

const navLinkStyle: React.CSSProperties = {
	color: COLORS.text,
	textDecoration: "none",
	fontWeight: 600,
	fontSize: 14,
};

const ctaButtonStyle: React.CSSProperties = {
	display: "inline-block",
	background: COLORS.violet,
	color: "#fff",
	textDecoration: "none",
	fontWeight: 700,
	fontSize: 15,
	padding: "13px 28px",
	borderRadius: 999,
};

function sidebarButtonStyle(primary: boolean): React.CSSProperties {
	return {
		display: "block",
		textAlign: "center",
		padding: "12px 0",
		fontWeight: 700,
		fontSize: 14,
		textDecoration: "none",
		borderRadius: 8,
		background: primary ? COLORS.violet : "transparent",
		color: primary ? "#fff" : COLORS.text,
		border: primary ? "none" : `1px solid ${COLORS.border}`,
	};
}
