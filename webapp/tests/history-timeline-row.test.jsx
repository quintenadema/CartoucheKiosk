import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import HistoryTimelineRow from "../src/components/history-timeline-row";

function render(action) {
  return renderToStaticMarkup(<HistoryTimelineRow action={action} minute="35′" title="Event" detail="Player name" accent="#e5bd45" />);
}

test("goals and cards follow the team side, not the event type", () => {
  for (const action of ["goal", "card"]) {
    expect(render({ action, side: "home" })).toContain('data-history-side="home"');
    expect(render({ action, side: "home" })).toContain("col-start-1 row-start-1");
    expect(render({ action, side: "away" })).toContain('data-history-side="away"');
    expect(render({ action, side: "away" })).toContain("col-start-3 row-start-1");
  }
});

test("match-wide events and unknown sides span both columns", () => {
  for (const action of [{ action: "match", action_type: "period-change", side: "home" }, { action: "goal", side: null }]) {
    expect(render(action)).toContain('data-history-side="neutral"');
    expect(render(action)).toContain("col-span-3");
  }
});

test("names and labels can wrap and event markers remain distinct", () => {
  const goal = render({ action: "goal", side: "home" });
  expect(goal).toContain("break-words");
  expect(goal).not.toContain("truncate");
  expect(goal).toContain('data-event-marker="goal"');
  expect(render({ action: "card", side: "away" })).toContain('data-event-marker="card"');
});
