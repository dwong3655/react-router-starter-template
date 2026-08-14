import { useState } from "react";

const COLORS = {
	violet: "#FACC15",
	textDim: "#9CA3AF",
	border: "#2E2E2E",
	bgPanel: "#1A1A1A",
};

export default function VoteButton({
	itemKey,
	initialVotes,
}: {
	itemKey: string;
	initialVotes: number;
}) {
	const [votes, setVotes] = useState(initialVotes);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [justClicked, setJustClicked] = useState(false);

	async function handleClick() {
		if (isSubmitting) return;
		setIsSubmitting(true);

		// Optimistic update
		setVotes((v) => v + 1);
		setJustClicked(true);

		try {
			const res = await fetch(`/vote/${itemKey}`, {
				method: "POST",
				body: new URLSearchParams({ direction: "up" }),
			});
			const data = await res.json<{ votes?: number }>();
			if (typeof data.votes === "number") {
				setVotes(data.votes);
			}
		} catch {
			// Revert on failure
			setVotes((v) => Math.max(0, v - 1));
		} finally {
			setIsSubmitting(false);
		}
	}

	return (
		<button
			onClick={(e) => {
				e.preventDefault();
				e.stopPropagation();
				handleClick();
			}}
			style={{
				display: "flex",
				alignItems: "center",
				gap: 6,
				background: justClicked ? COLORS.violet : COLORS.bgPanel,
				border: `1px solid ${justClicked ? COLORS.violet : COLORS.border}`,
				borderRadius: 999,
				padding: "6px 12px",
				cursor: "pointer",
				fontFamily: "'Inter', sans-serif",
				transition: "background 0.15s ease, border-color 0.15s ease",
			}}
		>
			<span
				style={{
					fontSize: 15,
					lineHeight: 1,
					filter: justClicked ? "none" : "grayscale(1) opacity(0.6)",
				}}
			>
				⭐
			</span>
			<span
				style={{
					fontSize: 13,
					fontWeight: 700,
					color: justClicked ? "#0A0A0A" : "#FFFFFF",
				}}
			>
				{votes}
			</span>
		</button>
	);
}
