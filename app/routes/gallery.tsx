import type { Route } from "./+types/gallery";

export function meta({}: Route.MetaArgs) {
	return [{ title: "Art Gallery" }];
}

export async function loader({ context }: Route.LoaderArgs) {
	const listed = await context.cloudflare.env.ART_BUCKET.list({
		include: ["customMetadata"],
	});

	const items = listed.objects
		.sort((a, b) => b.uploaded.getTime() - a.uploaded.getTime())
		.map((obj) => ({
			key: obj.key,
			title: obj.customMetadata?.title ?? "Untitled",
			artist: obj.customMetadata?.artist ?? "Unknown artist",
		}));

	return { items };
}

export default function Gallery({ loaderData }: Route.ComponentProps) {
	const { items } = loaderData;

	return (
		<div style={{ maxWidth: 960, margin: "40px auto", padding: 24 }}>
			<h1>Art Gallery</h1>
			<p>
				<a href="/upload">Upload new art</a>
			</p>

			{items.length === 0 && <p>No artwork uploaded yet.</p>}

			<div
				style={{
					display: "grid",
					gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
					gap: 16,
					marginTop: 24,
				}}
			>
				{items.map((item) => (
					<div key={item.key}>
						<div
							style={{
								background: "#111",
								borderRadius: 8,
								padding: 12,
								display: "flex",
								alignItems: "center",
								justifyContent: "center",
								minHeight: 220,
							}}
						>
							<img
								src={`/art/${item.key}`}
								alt={item.title}
								style={{
									maxWidth: "100%",
									maxHeight: 260,
									objectFit: "contain",
									borderRadius: 4,
								}}
							/>
						</div>
						<div style={{ marginTop: 8 }}>
							<div style={{ fontWeight: 600 }}>{item.title}</div>
							<div style={{ opacity: 0.7, fontSize: 14 }}>
								by {item.artist}
							</div>
						</div>
					</div>
				))}
			</div>
		</div>
	);
}
