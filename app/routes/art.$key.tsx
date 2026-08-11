import type { Route } from "./+types/art.$key";

export async function loader({ params, context }: Route.LoaderArgs) {
	const object = await context.cloudflare.env.ART_BUCKET.get(params.key);

	if (!object) {
		throw new Response("Not found", { status: 404 });
	}

	const headers = new Headers();
	object.writeHttpMetadata(headers);
	headers.set("etag", object.httpEtag);
	headers.set("cache-control", "public, max-age=31536000, immutable");

	return new Response(object.body, { headers });
}
