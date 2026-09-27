import { expect, test } from "bun:test";
import { visibleHistoryActions } from "../src/lib/live-history";

const event = (id, action_type, seconds_since_start = 2100) => ({ id, action_type, seconds_since_start });

test("hides pauses, resumes and internal events but retains goals and cards", () => {
  const actions = ["pause", "resume", "submit", "time-travel", "goal", "card-green"].map((type, i) => event(i, type));
  expect(visibleHistoryActions(actions).map(a => a.action_type)).toEqual(["card-green", "goal"]);
});

test("combines the screenshot's period pair without mutating source actions", () => {
  const actions = [event(4, "start-period"), event(1, "end-period"), event(2, "pause"), event(3, "resume")];
  const original = structuredClone(actions);
  expect(visibleHistoryActions(actions)).toEqual([event(4, "period-change")]);
  expect(actions).toEqual(original);
});

test("combines boundaries within the same displayed minute", () => {
  expect(visibleHistoryActions([event(1, "end-period", 2041), event(2, "start-period", 2100)])).toEqual([event(2, "period-change", 2100)]);
});

test("keeps standalone, different-minute, missing-time and interrupted boundaries", () => {
  for (const actions of [
    [event(1, "end-period")], [event(1, "start-period")],
    [event(1, "end-period", 2100), event(2, "start-period", 2101)],
    [event(1, "end-period", null), event(2, "start-period", null)],
    [event(1, "end-period"), event(2, "goal"), event(3, "start-period")],
    [event(1, "start-period"), event(2, "end-period")],
  ]) expect(visibleHistoryActions(actions)).toEqual([...actions].reverse());
});

test("handles multiple transitions newest first and an empty feed", () => {
  expect(visibleHistoryActions()).toEqual([]);
  expect(visibleHistoryActions([event(1, "end-period", 1050), event(2, "start-period", 1050), event(3, "end-period"), event(4, "start-period")]))
    .toEqual([event(4, "period-change"), event(2, "period-change", 1050)]);
});
