// Simple cookie-based admin session helper.
// Not a full auth system — appropriate for a single-admin site.

const COOKIE_NAME = "admin_session";

export function isAdminRequest(request: Request, adminPassword: string): boolean {
	const cookie = request.headers.get("Cookie") ?? "";
	const match = cookie.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
	if (!match) return false;
	return match[1] === expectedToken(adminPassword);
}

export function adminSessionCookie(adminPassword: string): string {
	const token = expectedToken(adminPassword);
	// 7 day session, HttpOnly + Secure so it can't be read/stolen via JS or sent over plain HTTP
	return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=604800`;
}

export function clearAdminSessionCookie(): string {
	return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

// Derives a stable, non-reversible token from the password so the raw
// password itself is never stored in the cookie.
function expectedToken(adminPassword: string): string {
	// djb2 hash — sufficient here since this only needs to be an opaque
	// session token derived from a secret the client never sees directly.
	let hash = 5381;
	for (let i = 0; i < adminPassword.length; i++) {
		hash = (hash * 33) ^ adminPassword.charCodeAt(i);
	}
	return (hash >>> 0).toString(16);
}
