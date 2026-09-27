import HistoryEventMarker from "./history-event-marker";

export default function HistoryTimelineRow({ action, minute, title, detail, accent }) {
  const teamEvent = action.action === "goal" || action.action === "card";
  const side = teamEvent && ["home", "away"].includes(action.side) ? action.side : "neutral";
  const neutral = side === "neutral";
  return (
    <li data-history-side={side} className="relative grid grid-cols-[minmax(0,1fr)_38px_minmax(0,1fr)] gap-x-2 pb-3 last:pb-0">
      <span aria-hidden="true" className="absolute bottom-0 left-1/2 top-0 w-px -translate-x-1/2 bg-white/20" />
      <time className="relative z-10 col-start-2 row-start-1 self-start rounded bg-[#103323] py-1 text-center text-[12px] font-bold tabular-nums text-white/65">{minute}</time>
      <div data-history-card className={`relative z-10 min-w-0 rounded-[12px] border border-white/10 bg-[#123526] px-3 py-2.5 ${neutral ? "col-span-3 col-start-1 row-start-2 mt-1 text-center" : side === "home" ? "col-start-1 row-start-1" : "col-start-3 row-start-1"}`}>
        <div className={`flex items-center gap-2 ${neutral ? "justify-center" : ""}`}>
          <HistoryEventMarker action={action} accent={accent} />
          <p className="min-w-0 break-words text-[13px] font-bold leading-tight text-white">{title}</p>
        </div>
        {!neutral || action.person_name ? <p className="mt-1.5 break-words text-[11px] font-medium leading-snug text-white/60">{detail}</p> : null}
      </div>
    </li>
  );
}
