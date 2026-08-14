import type { Route } from "./+types/updates";

export function meta({}: Route.MetaArgs) {
	return [{ title: "Update Log — ArtDrop Spot" }];
}

export async function loader({ context }: Route.LoaderArgs) {
	const listed = await context.cloudflare.env.ART_BUCKET.list({
		prefix: "updates/",
	});

	const entries = await Promise.all(
		listed.objects
			.sort((a, b) => b.uploaded.getTime() - a.uploaded.getTime())
			.map(async (obj) => {
				const object = await context.cloudflare.env.ART_BUCKET.get(obj.key);
				if (!object) return null;
				const data = await object.json<{ message: string; postedAt: string }>();
				return { key: obj.key, ...data };
			})
	);

	return { entries: entries.filter((e): e is NonNullable<typeof e> => e !== null) };
}

const COLORS = {
	bg: "#0A0A0A",
	bgPanel: "#1A1A1A",
	violet: "#FACC15",
	text: "#FFFFFF",
	textDim: "#9CA3AF",
	border: "#2E2E2E",
};

export default function Updates({ loaderData }: Route.ComponentProps) {
	const { entries } = loaderData;

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
				}}
			>
				<a href="/" style={{ textDecoration: "none", color: "inherit" }}>
					<div style={{ display: "flex", alignItems: "center", gap: 10 }}>
						<div
							style={{
								width: 30,
								height: 30,
								borderRadius: 8,
								background: COLORS.violet,
								display: "flex",
								alignItems: "center",
								justifyContent: "center",
							}}
						>
							<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0A0A0A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
								<path d="M12 2.5C12 2.5 6 11 6 15.5a6 6 0 0 0 12 0C18 11 12 2.5 12 2.5Z" />
								<circle cx="12" cy="16" r="2" fill="#FACC15" stroke="none" />
							</svg>
						</div>
						<span style={{ fontFamily: "'Archivo Black', sans-serif", fontSize: 17 }}>
							ArtDrop <span style={{ color: COLORS.violet }}>Spot</span>
						</span>
					</div>
				</a>
				<nav style={{ display: "flex", alignItems: "center", gap: 32 }}>
					<a href="/upload" style={navLinkStyle}>Upload</a>
					<a href="/gallery" style={navLinkStyle}>Collection</a>
					<a href="/updates" style={{ ...navLinkStyle, color: COLORS.violet }}>Update log</a>
					<a href="/admin" style={{ ...navLinkStyle, color: COLORS.textDim, fontWeight: 500 }}>Sign in</a>
				</nav>
			</header>

			{/* Body */}
			<div style={{ maxWidth: 700, margin: "0 auto", padding: "48px 32px" }}>
				<h1
					style={{
						fontFamily: "'Archivo Black', sans-serif",
						fontSize: 32,
						margin: "0 0 8px",
					}}
				>
					Update Log
				</h1>
				<p style={{ color: COLORS.textDim, fontSize: 15, marginBottom: 40 }}>
					What's new at ArtDrop Spot.
				</p>

				{entries.length === 0 ? (
					<p style={{ color: COLORS.textDim }}>No updates posted yet.</p>
				) : (
					<div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
						{entries.map((entry) => (
							<div
								key={entry.key}
								style={{
									background: COLORS.bgPanel,
									border: `1px solid ${COLORS.border}`,
									borderRadius: 12,
									padding: 20,
								}}
							>
								<p
									style={{
										margin: "0 0 8px",
										fontSize: 13,
										color: COLORS.violet,
										fontWeight: 700,
									}}
								>
									{formatDate(entry.postedAt)}
								</p>
								<p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
									{entry.message}
								</p>
							</div>
						))}
					</div>
				)}
			</div>
		</div>
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

const navLinkStyle: React.CSSProperties = {
	color: COLORS.text,
	textDecoration: "none",
	fontWeight: 600,
	fontSize: 14,
};
