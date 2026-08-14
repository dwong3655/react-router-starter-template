import type { Route } from "./+types/vote.$key";

export async function action({ request, params, context }: Route.ActionArgs) {
	const formData = await request.formData();
	const direction = formData.get("direction"); // "up" or "down"
	const key = params.key;

	if (!key) {
		return Response.json({ error: "Missing key" }, { status: 400 });
	}

	const object = await context.cloudflare.env.ART_BUCKET.get(key);
	if (!object) {
		return Response.json({ error: "Not found" }, { status: 404 });
	}

	const currentVotes = parseInt(object.customMetadata?.votes ?? "0", 10);
	const newVotes = Math.max(
		0,
		direction === "down" ? currentVotes - 1 : currentVotes + 1
	);

	await context.cloudflare.env.ART_BUCKET.put(key, object.body, {
		httpMetadata: object.httpMetadata,
		customMetadata: { ...object.customMetadata, votes: String(newVotes) },
	});

	return Response.json({ votes: newVotes });
}
