import type { Route } from "./+types/upload";
import { Form, useNavigation } from "react-router";
import { useRef, useState } from "react";

export function meta({}: Route.MetaArgs) {
	return [{ title: "Upload Art" }];
}

export async function action({ request, context }: Route.ActionArgs) {
	const formData = await request.formData();
	const file = formData.get("artwork") as File | null;
	const title = (formData.get("title") as string | null)?.trim() ?? "";
	const artist = (formData.get("artist") as string | null)?.trim() ?? "";

	const missing: string[] = [];
	if (!title) missing.push("Title");
	if (!artist) missing.push("Artist Name");
	if (!file || file.size === 0) missing.push("Image file");

	if (missing.length > 0) {
		return {
			error: `Please provide the following before uploading: ${missing.join(", ")}.`,
		};
	}

	if (!file!.type.startsWith("image/")) {
		return { error: "Only image files are allowed." };
	}

	const MAX_SIZE = 10 * 1024 * 1024; // 10MB
	if (file!.size > MAX_SIZE) {
		return { error: "File is too large (max 10MB)." };
	}

	// Build a unique key so uploads don't overwrite each other
	const ext = file!.name.split(".").pop();
	const key = `${Date.now()}-${crypto.randomUUID()}.${ext}`;

	await context.cloudflare.env.ART_BUCKET.put(key, file!.stream(), {
		httpMetadata: { contentType: file!.type },
		customMetadata: { title, artist },
	});

	return { success: true, key };
}

export default function Upload({ actionData }: Route.ComponentProps) {
	const navigation = useNavigation();
	const isSubmitting = navigation.state === "submitting";

	const fileInputRef = useRef<HTMLInputElement>(null);
	const [fileName, setFileName] = useState<string | null>(null);
	const [isDragging, setIsDragging] = useState(false);

	function handleFiles(files: FileList | null) {
		if (files && files.length > 0) {
			setFileName(files[0].name);
			if (fileInputRef.current) {
				fileInputRef.current.files = files;
			}
		}
	}

	return (
		<div style={{ maxWidth: 480, margin: "60px auto", padding: 24 }}>
			<h1>Upload Your Art</h1>

			<Form method="post" encType="multipart/form-data">
				<label style={{ display: "block", marginBottom: 12 }}>
					Title
					<input
						type="text"
						name="title"
						required
						style={{ display: "block", width: "100%", marginTop: 4, padding: 8 }}
					/>
				</label>

				<label style={{ display: "block", marginBottom: 16 }}>
					Artist Name
					<input
						type="text"
						name="artist"
						required
						style={{ display: "block", width: "100%", marginTop: 4, padding: 8 }}
					/>
				</label>

				<div
					onDragOver={(e) => {
						e.preventDefault();
						setIsDragging(true);
					}}
					onDragLeave={() => setIsDragging(false)}
					onDrop={(e) => {
						e.preventDefault();
						setIsDragging(false);
						handleFiles(e.dataTransfer.files);
					}}
					onClick={() => fileInputRef.current?.click()}
					style={{
						border: `2px dashed ${isDragging ? "#4f8cff" : "#666"}`,
						borderRadius: 8,
						padding: 32,
						textAlign: "center",
						cursor: "pointer",
						marginBottom: 16,
						background: isDragging ? "rgba(79,140,255,0.08)" : "transparent",
					}}
				>
					<input
						ref={fileInputRef}
						type="file"
						name="artwork"
						accept="image/*"
						required
						onChange={(e) => handleFiles(e.target.files)}
						style={{ display: "none" }}
					/>
					{fileName ? (
						<p>Selected: {fileName}</p>
					) : (
						<p>Drag & drop an image here, or click to choose a file</p>
					)}
				</div>

				<button type="submit" disabled={isSubmitting}>
					{isSubmitting ? "Uploading..." : "Upload"}
				</button>
			</Form>

			{actionData?.error && (
				<p
					style={{
						color: "#ff6b6b",
						background: "rgba(255,107,107,0.1)",
						border: "1px solid #ff6b6b",
						borderRadius: 6,
						padding: "10px 12px",
						marginTop: 16,
					}}
				>
					{actionData.error}
				</p>
			)}

			{actionData?.success && (
				<p style={{ color: "green", marginTop: 16 }}>
					Uploaded! <a href="/gallery">View gallery</a>
				</p>
			)}
		</div>
	);
}
