import type { Route } from "./+types/gallery";

export function meta({}: Route.MetaArgs) {
	return [{ title: "Art Gallery" }];
}

export async function loader({ context }: Route.LoaderArgs) {
	const listed = await context.cloudflare.env.ART_BUCKET.list();
	const keys = listed.objects
		.sort((a, b) => b.uploaded.getTime() - a.uploaded.getTime())
		.map((obj) => obj.key);

	return { keys };
}

export default function Gallery({ loaderData }: Route.ComponentProps) {
	const { keys } = loaderData;

	return (
		<div style={{ maxWidth: 960, margin: "40px auto", padding: 24 }}>
			<h1>Art Gallery</h1>
			<p>
				<a href="/upload">Upload new art</a>
			</p>

			{keys.length === 0 && <p>No artwork uploaded yet.</p>}

			<div
				style={{
					display: "grid",
					gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
					gap: 16,
					marginTop: 24,
				}}
			>
				{keys.map((key) => (
					<div
						key={key}
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
							src={`/art/${key}`}
							alt={key}
							style={{
								maxWidth: "100%",
								maxHeight: 260,
								objectFit: "contain",
								borderRadius: 4,
							}}
						/>
					</div>
				))}
			</div>
		</div>
	);
}
