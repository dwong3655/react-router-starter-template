import type { Route } from "./+types/home";

export function meta({}: Route.MetaArgs) {
	return [
		{ title: "ArtDrop Spot" },
		{ name: "description", content: "Upload and browse digital art." },
	];
}

export async function loader({ context }: Route.LoaderArgs) {
	const listed = await context.cloudflare.env.ART_BUCKET.list({
		include: ["customMetadata"],
	});

	const items = listed.objects
		.sort((a, b) => b.uploaded.getTime() - a.uploaded.getTime())
		.slice(0, 6)
		.map((obj) => ({
			key: obj.key,
			title: obj.customMetadata?.title ?? "Untitled",
		}));

	return { items };
}

export default function Home({ loaderData }: Route.ComponentProps) {
	const { items } = loaderData;

	return (
		<div style={{ fontFamily: "sans-serif", color: "#1a1a1a" }}>
			{/* Header */}
			<header
				style={{
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between",
					background: "#2b2b2b",
					color: "#fff",
					padding: "16px 24px",
				}}
			>
				<div style={{ display: "flex", alignItems: "center", gap: 10 }}>
					<span style={{ fontSize: 22 }}>🎨</span>
					<span style={{ fontSize: 20, fontWeight: 700 }}>
						ArtDrop <span style={{ fontWeight: 400 }}>SPOT</span>
					</span>
				</div>

				<nav style={{ display: "flex", alignItems: "center", gap: 28 }}>
					<a href="/upload" style={navLinkStyle}>
						UPLOAD
					</a>
					<a href="/gallery" style={navLinkStyle}>
						COLLECTION
					</a>
					<a href="/updates" style={navLinkStyle}>
						UPDATE LOG
					</a>
					<input
						type="search"
						placeholder="SEARCH"
						style={{
							padding: "8px 12px",
							borderRadius: 4,
							border: "none",
							width: 180,
						}}
					/>
				</nav>
			</header>

			{/* Body */}
			<div style={{ display: "flex", padding: 24, gap: 24 }}>
				{/* Main content */}
				<main style={{ flex: 1 }}>
					<h1 style={{ fontSize: 22, letterSpacing: 1, marginBottom: 20 }}>
						RECENT CREATIONS:
					</h1>

					{items.length === 0 ? (
						<p>No artwork uploaded yet.</p>
					) : (
						<div
							style={{
								display: "grid",
								gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
								gap: 24,
							}}
						>
							{items.map((item) => (
								<div key={item.key}>
									<div
										style={{
											border: "2px solid #1a1a1a",
											aspectRatio: "1 / 1",
											display: "flex",
											alignItems: "center",
											justifyContent: "center",
											background: "#fafafa",
											overflow: "hidden",
										}}
									>
										<img
											src={`/art/${item.key}`}
											alt={item.title}
											style={{
												maxWidth: "100%",
												maxHeight: "100%",
												objectFit: "contain",
											}}
										/>
									</div>
									<p
										style={{
											textAlign: "center",
											marginTop: 8,
											fontWeight: 600,
										}}
									>
										[{item.title}]
									</p>
								</div>
							))}
						</div>
					)}
				</main>

				{/* Sidebar */}
				<aside
					style={{
						width: 300,
						background: "#2b2b2b",
						color: "#fff",
						padding: 24,
						flexShrink: 0,
					}}
				>
					<div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
						<span style={{ fontSize: 22 }}>🎨</span>
						<span style={{ fontSize: 20, fontWeight: 700 }}>
							ArtDrop <span style={{ fontWeight: 400 }}>SPOT</span>
						</span>
					</div>

					<p style={{ fontSize: 13, lineHeight: 1.6, opacity: 0.85 }}>
						A place to upload and share digital art with the world. Drop
						your work, browse the collection, and see what's new.
					</p>

					<nav style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 24 }}>
						<a href="/upload" style={sidebarButtonStyle}>
							UPLOAD
						</a>
						<a href="/gallery" style={sidebarButtonStyle}>
							COLLECTION
						</a>
						<a href="/updates" style={sidebarButtonStyle}>
							UPDATE LOG
						</a>
					</nav>
				</aside>
			</div>
		</div>
	);
}

const navLinkStyle: React.CSSProperties = {
	color: "#fff",
	textDecoration: "none",
	fontWeight: 600,
	fontSize: 14,
	letterSpacing: 0.5,
};

const sidebarButtonStyle: React.CSSProperties = {
	background: "#fff",
	color: "#1a1a1a",
	textAlign: "center",
	padding: "12px 0",
	fontWeight: 700,
	letterSpacing: 0.5,
	textDecoration: "none",
	borderRadius: 2,
};
