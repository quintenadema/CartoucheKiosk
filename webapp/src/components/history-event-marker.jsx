import { Target } from "lucide-react";

export default function HistoryEventMarker({ action, accent }) {
  if (action.action === "goal") {
    return (
      <span data-event-marker="goal" aria-hidden="true" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border bg-white/10" style={{ borderColor: accent }}>
        <Target className="h-4 w-4 text-white" strokeWidth={2} />
      </span>
    );
  }
  if (action.action === "card") {
    return <span data-event-marker="card" aria-hidden="true" className="h-4 w-3 shrink-0 rounded-[2px]" style={{ backgroundColor: accent }} />;
  }
  return null;
}
