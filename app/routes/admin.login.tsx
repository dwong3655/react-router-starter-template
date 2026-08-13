import type { Route } from "./+types/admin.login";
import { Form, redirect, useNavigation } from "react-router";
import { adminSessionCookie } from "../lib/admin-auth";

export function meta({}: Route.MetaArgs) {
	return [{ title: "Admin Login — ArtDrop Spot" }];
}

export async function action({ request, context }: Route.ActionArgs) {
	const formData = await request.formData();
	const password = (formData.get("password") as string | null) ?? "";
	const adminPassword = context.cloudflare.env.ADMIN_PASSWORD;

	if (!adminPassword) {
		return { error: "Admin password is not configured on the server." };
	}

	if (password !== adminPassword) {
		return { error: "Incorrect password." };
	}

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
