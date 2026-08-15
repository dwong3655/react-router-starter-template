import type { Route } from "./+types/admin.login";
import { Form, redirect, useNavigation } from "react-router";
import { adminSessionCookie } from "../lib/admin-auth";

export function meta({}: Route.MetaArgs) {
	return [{ title: "Admin Login — ArtDrop Spot" }];
}

const MAX_ATTEMPTS = 2;
const LOCKOUT_MINUTES = 15;

function getClientIp(request: Request): string {
	return (
		request.headers.get("CF-Connecting-IP") ??
		request.headers.get("X-Forwarded-For") ??
		"unknown"
	);
}

async function getAttempts(
	bucket: R2Bucket,
	ip: string
): Promise<{ count: number; firstAttempt: number } | null> {
	const object = await bucket.get(`login-attempts/${ip}.json`);
	if (!object) return null;
	try {
		return await object.json<{ count: number; firstAttempt: number }>();
	} catch {
		return null;
	}
}

async function recordFailedAttempt(bucket: R2Bucket, ip: string) {
	const existing = await getAttempts(bucket, ip);
	const now = Date.now();

	const data =
		existing && now - existing.firstAttempt < LOCKOUT_MINUTES * 60 * 1000
			? { count: existing.count + 1, firstAttempt: existing.firstAttempt }
			: { count: 1, firstAttempt: now };

	await bucket.put(`login-attempts/${ip}.json`, JSON.stringify(data));
}

async function clearAttempts(bucket: R2Bucket, ip: string) {
	await bucket.delete(`login-attempts/${ip}.json`);
}

export async function action({ request, context }: Route.ActionArgs) {
	const bucket = context.cloudflare.env.ART_BUCKET;
	const ip = getClientIp(request);

	const attempts = await getAttempts(bucket, ip);
	const now = Date.now();

	if (attempts && attempts.count >= MAX_ATTEMPTS) {
		const elapsedMs = now - attempts.firstAttempt;
		const lockoutMs = LOCKOUT_MINUTES * 60 * 1000;
		if (elapsedMs < lockoutMs) {
			const minutesLeft = Math.ceil((lockoutMs - elapsedMs) / 60000);
			return {
				error: `Too many failed attempts. Try again in ${minutesLeft} minute${minutesLeft === 1 ? "" : "s"}.`,
			};
		}
	}

	const formData = await request.formData();
	const password = (formData.get("password") as string | null) ?? "";
	const adminPassword = context.cloudflare.env.ADMIN_PASSWORD;

	if (!adminPassword) {
		return { error: "Admin password is not configured on the server." };
	}

	if (password !== adminPassword) {
		await recordFailedAttempt(bucket, ip);
		return { error: "Incorrect password." };
	}

	await clearAttempts(bucket, ip);

	return redirect("/admin", {
		headers: { "Set-Cookie": adminSessionCookie(adminPassword) },
	});
}

const COLORS = {
	bg: "#0A0A0A",
	bgPanel: "#1A1A1A",
	violet: "#FACC15",
	coral: "#FACC15",
	text: "#FFFFFF",
	textDim: "#9CA3AF",
	border: "#2E2E2E",
};

export default function AdminLogin({ actionData }: Route.ComponentProps) {
	const navigation = useNavigation();
	const isSubmitting = navigation.state === "submitting";

	return (
		<div
			style={{
				fontFamily: "'Inter', sans-serif",
				background: COLORS.bg,
				color: COLORS.text,
				minHeight: "100vh",
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
			}}
		>
			<link
				rel="stylesheet"
				href="https://fonts.googleapis.com/css2?family=Archivo+Black&family=Inter:wght@400;500;600;700&display=swap"
			/>

			<div
				style={{
					width: 360,
					background: COLORS.bgPanel,
					border: `1px solid ${COLORS.border}`,
					borderRadius: 16,
					padding: 32,
				}}
			>
				<h1
					style={{
						fontFamily: "'Archivo Black', sans-serif",
						fontSize: 22,
						margin: "0 0 8px",
					}}
				>
					Admin Login
				</h1>
				<p style={{ color: COLORS.textDim, fontSize: 14, marginBottom: 24 }}>
					Enter the admin password to manage uploads.
				</p>

				<Form method="post">
					<input
						type="password"
						name="password"
						required
						autoFocus
						placeholder="Password"
						style={{
							display: "block",
							width: "100%",
							padding: "11px 12px",
							borderRadius: 8,
							border: `1px solid ${COLORS.border}`,
							background: COLORS.bg,
							color: COLORS.text,
							fontSize: 14,
							boxSizing: "border-box",
							marginBottom: 16,
						}}
					/>
					<button
						type="submit"
						disabled={isSubmitting}
						style={{
							width: "100%",
							padding: "12px 0",
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
						{isSubmitting ? "Checking..." : "Log in"}
					</button>
				</Form>

				{actionData?.error && (
					<p
						style={{
							color: COLORS.coral,
							background: "rgba(255,107,107,0.1)",
							border: `1px solid ${COLORS.coral}`,
							borderRadius: 8,
							padding: "10px 12px",
							marginTop: 16,
							fontSize: 14,
						}}
					>
						{actionData.error}
					</p>
				)}
			</div>
		</div>
	);
}
