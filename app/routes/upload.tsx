import type { Route } from "./+types/upload";
import { Form, useNavigation } from "react-router";
import { useRef, useState } from "react";

export function meta({}: Route.MetaArgs) {
	return [{ title: "Upload Art — ArtDrop Spot" }];
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
		customMetadata: { title, artist, status: "pending" },
	});

	return { success: true, key };
}

const COLORS = {
	bg: "#0B0B10",
	bgPanel: "#151420",
	violet: "#8B5CF6",
	coral: "#FF6B6B",
	text: "#F4F2F8",
	textDim: "#9C97AD",
	border: "#26243A",
};

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
					<Logo />
				</a>
				<nav style={{ display: "flex", alignItems: "center", gap: 32 }}>
					<a href="/upload" style={{ ...navLinkStyle, color: COLORS.violet }}>
						Upload
					</a>
					<a href="/gallery" style={navLinkStyle}>
						Collection
					</a>
					<a href="/updates" style={navLinkStyle}>
						Update log
					</a>
				</nav>
			</header>

			{/* Form */}
			<div style={{ maxWidth: 520, margin: "0 auto", padding: "56px 24px" }}>
				<h1
					style={{
						fontFamily: "'Archivo Black', sans-serif",
						fontSize: 32,
						margin: "0 0 8px",
					}}
				>
					Upload your art
				</h1>
				<p style={{ color: COLORS.textDim, fontSize: 15, marginBottom: 32 }}>
					Share your work with the ArtDrop community.
				</p>

				<Form method="post" encType="multipart/form-data">
					<label style={labelStyle}>
						Title
						<input
							type="text"
							name="title"
							required
							placeholder="Give your piece a name"
							style={inputStyle}
						/>
					</label>

					<label style={{ ...labelStyle, marginBottom: 20 }}>
						Artist name
						<input
							type="text"
							name="artist"
							required
							placeholder="Your name or handle"
							style={inputStyle}
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
							borderRadius: 14,
							padding: 2,
							marginBottom: 24,
							cursor: "pointer",
							background: isDragging
								? `linear-gradient(135deg, ${COLORS.violet}, ${COLORS.coral})`
								: COLORS.border,
							transition: "background 0.15s ease",
						}}
					>
						<div
							style={{
								borderRadius: 12,
								padding: "40px 24px",
								textAlign: "center",
								background: COLORS.bgPanel,
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
								<p style={{ margin: 0, fontWeight: 600 }}>
									Selected: {fileName}
								</p>
							) : (
								<>
									<p style={{ margin: "0 0 4px", fontWeight: 600 }}>
										Drag & drop your art here
									</p>
									<p style={{ margin: 0, color: COLORS.textDim, fontSize: 13 }}>
										or click to choose a file
									</p>
								</>
							)}
						</div>
					</div>

					<button
						type="submit"
						disabled={isSubmitting}
						style={{
							width: "100%",
							padding: "14px 0",
							borderRadius: 999,
							border: "none",
							background: isSubmitting ? COLORS.border : COLORS.violet,
							color: "#fff",
							fontWeight: 700,
							fontSize: 15,
							cursor: isSubmitting ? "default" : "pointer",
							fontFamily: "'Inter', sans-serif",
						}}
					>
						{isSubmitting ? "Uploading..." : "Upload"}
					</button>
				</Form>

				{actionData?.error && (
					<p
						style={{
							color: COLORS.coral,
							background: "rgba(255,107,107,0.1)",
							border: `1px solid ${COLORS.coral}`,
							borderRadius: 8,
							padding: "12px 14px",
							marginTop: 20,
							fontSize: 14,
						}}
					>
						{actionData.error}
					</p>
				)}

				{actionData?.success && (
					<p
						style={{
							color: "#4ADE80",
							background: "rgba(74,222,128,0.1)",
							border: "1px solid #4ADE80",
							borderRadius: 8,
							padding: "12px 14px",
							marginTop: 20,
							fontSize: 14,
						}}
					>
						Submitted! Your art is waiting for review and will appear in the
						collection once approved.
					</p>
				)}
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

const navLinkStyle: React.CSSProperties = {
	color: COLORS.text,
	textDecoration: "none",
	fontWeight: 600,
	fontSize: 14,
};

const labelStyle: React.CSSProperties = {
	display: "block",
	marginBottom: 16,
	fontSize: 13,
	fontWeight: 600,
	color: COLORS.textDim,
};

const inputStyle: React.CSSProperties = {
	display: "block",
	width: "100%",
	marginTop: 6,
	padding: "11px 12px",
	borderRadius: 8,
	border: `1px solid ${COLORS.border}`,
	background: COLORS.bgPanel,
	color: COLORS.text,
	fontSize: 14,
	fontFamily: "'Inter', sans-serif",
	boxSizing: "border-box",
};
