import type { Route } from "./+types/upload";
import { Form, useNavigation } from "react-router";

export function meta({}: Route.MetaArgs) {
	return [{ title: "Upload Art" }];
}

export async function action({ request, context }: Route.ActionArgs) {
	const formData = await request.formData();
	const file = formData.get("artwork") as File | null;

	if (!file || file.size === 0) {
		return { error: "Please choose a file to upload." };
	}

	if (!file.type.startsWith("image/")) {
		return { error: "Only image files are allowed." };
	}

	const MAX_SIZE = 10 * 1024 * 1024; // 10MB
	if (file.size > MAX_SIZE) {
		return { error: "File is too large (max 10MB)." };
	}

	// Build a unique key so uploads don't overwrite each other
	const ext = file.name.split(".").pop();
	const key = `${Date.now()}-${crypto.randomUUID()}.${ext}`;

	await context.cloudflare.env.ART_BUCKET.put(key, file.stream(), {
		httpMetadata: { contentType: file.type },
	});

	return { success: true, key };
}

export default function Upload({ actionData }: Route.ComponentProps) {
	const navigation = useNavigation();
	const isSubmitting = navigation.state === "submitting";

	return (
		<div style={{ maxWidth: 480, margin: "60px auto", padding: 24 }}>
			<h1>Upload Your Art</h1>

			<Form method="post" encType="multipart/form-data">
				<input
					type="file"
					name="artwork"
					accept="image/*"
					required
					style={{ display: "block", marginBottom: 16 }}
				/>
				<button type="submit" disabled={isSubmitting}>
					{isSubmitting ? "Uploading..." : "Upload"}
				</button>
			</Form>

			{actionData?.error && (
				<p style={{ color: "red", marginTop: 16 }}>{actionData.error}</p>
			)}

			{actionData?.success && (
				<p style={{ color: "green", marginTop: 16 }}>
					Uploaded! <a href="/gallery">View gallery</a>
				</p>
			)}
		</div>
	);
}
