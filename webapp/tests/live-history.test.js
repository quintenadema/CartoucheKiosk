import { expect, test } from "bun:test";
import { periodStartLabel, visibleHistoryActions } from "../src/lib/live-history";

const event = (id, action_type, seconds_since_start = 2100) => ({ id, action_type, seconds_since_start });

test("combined quarter transitions show only the new quarter start", () => {
  const actions = [event(1, "start", 0), event(2, "end-period", 1050), event(3, "start-period", 1050),
    event(4, "end-period", 2100), event(5, "start-period", 2100), event(6, "end-period", 3150), event(7, "start-period", 3150)];
  const rows = visibleHistoryActions(actions);
  expect(rows.filter(a => a.action_type === "period-change").map(periodStartLabel)).toEqual(["Start Q4", "Start Q3", "Start Q2"]);
  expect(rows).toHaveLength(4);
  expect(actions.some(a => a.historyQuarter)).toBe(false);
});

test("a Q1 start at zero does not advance the next quarter to Q3", () => {
  const rows = visibleHistoryActions([event(1, "start", 0), event(2, "start-period", 0), event(3, "start-period", 1050)]);
  expect(rows.filter(a => a.action_type === "start-period").map(periodStartLabel)).toEqual(["Start Q2", "Start Q1"]);
});

test("partial history and invalid quarter numbers never guess a quarter", () => {
  expect(periodStartLabel(visibleHistoryActions([event(1, "start-period")])[0])).toBe("Nieuwe periode");
  for (const historyQuarter of [null, 0, 5, 2.5]) expect(periodStartLabel({ historyQuarter })).toBe("Nieuwe periode");
});

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
