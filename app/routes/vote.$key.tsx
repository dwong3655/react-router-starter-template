import type { Route } from "./+types/vote.$key";

const RISING_STAR_THRESHOLD = 50;

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

	// Rising Stars membership is now LIVE, driven by the current vote
	// count (see rising-stars.tsx loader: votes >= 50). This piece can
	// enter and leave the gallery repeatedly as its count crosses the
	// threshold in either direction.
	//
	// featuredAt is purely informational — it's shown on the card as
	// "Featured <date>" — and refreshes every time the piece newly
	// crosses INTO the threshold from below (49 -> 50), so a re-entry
	// after dropping out looks like a fresh feature, not a stale one.
	// It intentionally does NOT get cleared when the piece drops out;
	// if it re-enters later, that old value would just get overwritten
	// on the next crossing anyway, and while it's out, the loader
	// ignores the field entirely (it never reads featuredAt for
	// filtering — only for display on already-included cards).
	const wasBelowThreshold = currentVotes < RISING_STAR_THRESHOLD;
	const isNowAtOrAboveThreshold = newVotes >= RISING_STAR_THRESHOLD;
	const justEntered = wasBelowThreshold && isNowAtOrAboveThreshold;
	const featuredAt = justEntered ? new Date().toISOString() : object.customMetadata?.featuredAt;

	await context.cloudflare.env.ART_BUCKET.put(key, object.body, {
		httpMetadata: object.httpMetadata,
		customMetadata: {
			...object.customMetadata,
			votes: String(newVotes),
			...(featuredAt ? { featuredAt } : {}),
		},
	});

	return Response.json({ votes: newVotes, featured: isNowAtOrAboveThreshold });
}
