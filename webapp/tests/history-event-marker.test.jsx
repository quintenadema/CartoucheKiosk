import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import HistoryEventMarker from "../src/components/history-event-marker";

test("all goal types use a circular target, never a card marker", () => {
  for (const action_type of ["goal", "goal-pc", "goal-ps", "shootout"]) {
    const html = renderToStaticMarkup(<HistoryEventMarker action={{ action: "goal", action_type }} accent="#e5bd45" />);
    expect(html).toContain('data-event-marker="goal"');
    expect(html).toContain("lucide-target");
    expect(html).toContain("rounded-full");
    expect(html).not.toContain('data-event-marker="card"');
  }
});

test("cards keep rectangular markers and their colour", () => {
  for (const accent of ["#dc2626", "#f5c518", "#20a464"]) {
    const html = renderToStaticMarkup(<HistoryEventMarker action={{ action: "card" }} accent={accent} />);
    expect(html).toContain('data-event-marker="card"');
    expect(html).toContain(`background-color:${accent}`);
    expect(html).not.toContain("<svg");
  }
});

test("period updates do not get a scoring or card marker", () => {
  expect(renderToStaticMarkup(<HistoryEventMarker action={{ action: "match", action_type: "period-change" }} accent="#789487" />)).toBe("");
});
