import { STATUS_LABEL, type Status } from "@/lib/domain";

// Full class names are written out so Tailwind can see them. Colour is paired with a word,
// so status never depends on colour alone.
export const STATUS_STYLE: Record<Status, { chip: string; dot: string; stripe: string }> = {
  OPEN: { chip: "bg-[#e3edf7] text-[#244e7a]", dot: "bg-[#2f6aa3]", stripe: "border-l-[#2f6aa3]" },
  IN_REVIEW: { chip: "bg-[#fbeed0] text-[#7a4f00]", dot: "bg-[#c78a0a]", stripe: "border-l-[#c78a0a]" },
  APPROVED: { chip: "bg-[#dcf0e3] text-[#1b5e35]", dot: "bg-[#2a9156]", stripe: "border-l-[#2a9156]" },
  REJECTED: { chip: "bg-[#f7dfdf] text-[#8f2525]", dot: "bg-[#c23b3b]", stripe: "border-l-[#c23b3b]" },
  COMPLETED: { chip: "bg-[#e6e6ef] text-[#41415f]", dot: "bg-[#6b6b91]", stripe: "border-l-[#6b6b91]" },
};

export function StatusBadge({ status }: { status: Status }) {
  const s = STATUS_STYLE[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${s.chip}`}>
      <span className={`size-2 rounded-full ${s.dot}`} aria-hidden="true" />
      {STATUS_LABEL[status]}
    </span>
  );
}
