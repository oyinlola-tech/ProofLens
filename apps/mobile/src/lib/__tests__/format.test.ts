import { CLAIM_STATUS_LABEL, greeting, plain, timeAgo, truncate, VERDICT_LABEL, verdictColors } from "../format";
import { themes } from "../theme";

describe("truncate", () => {
  it("leaves short text alone", () => {
    expect(truncate("Coffee prevents heart disease.", 140)).toBe("Coffee prevents heart disease.");
  });
  it("collapses whitespace before measuring", () => {
    expect(truncate("  a \n\n b   c ", 140)).toBe("a b c");
  });
  it("cuts long text to the limit and ends with an ellipsis", () => {
    const out = truncate("x".repeat(300), 50);
    expect(out).toHaveLength(50);
    expect(out.endsWith("…")).toBe(true);
  });
});

describe("timeAgo", () => {
  const now = new Date("2026-09-27T12:00:00Z").getTime();
  const ago = (ms: number) => new Date(now - ms).toISOString();
  it.each([
    [20 * 1000, "Just now"],
    [12 * 60 * 1000, "12 min ago"],
    [3 * 3600 * 1000, "3 h ago"],
    [30 * 3600 * 1000, "Yesterday"],
  ])("formats %d ms as %s", (ms, expected) => {
    expect(timeAgo(ago(ms), now)).toBe(expected);
  });
  it("falls back to a date after two days", () => {
    expect(timeAgo(ago(5 * 24 * 3600 * 1000), now)).toMatch(/2026/);
  });
  it("returns an empty string for an unreadable date", () => {
    expect(timeAgo("not a date", now)).toBe("");
  });
});

describe("greeting", () => {
  it.each([
    [0, "Good morning"],
    [11, "Good morning"],
    [12, "Good afternoon"],
    [17, "Good afternoon"],
    [18, "Good evening"],
    [23, "Good evening"],
  ])("hour %d gives %s", (hour, expected) => {
    expect(greeting(hour)).toBe(expected);
  });
});

describe("plain", () => {
  it("removes emphasis markers and keeps the words", () => {
    expect(plain("The claim that coffee *prevents* heart disease")).toBe("The claim that coffee prevents heart disease");
    expect(plain("This is **not** established")).toBe("This is not established");
    expect(plain("the `dose` column")).toBe("the dose column");
  });
  it("does not touch arithmetic or lone asterisks", () => {
    expect(plain("2 * 3 = 6")).toBe("2 * 3 = 6");
    expect(plain("p < 0.05*")).toBe("p < 0.05*");
  });
});

describe("verdict presentation", () => {
  it("gives every verdict its own colour pair in both themes", () => {
    for (const theme of [themes.light, themes.dark]) {
      const seen = new Set(Object.keys(VERDICT_LABEL).map((v) => verdictColors(theme, v as keyof typeof VERDICT_LABEL).fg));
      expect(seen.size).toBe(4);
    }
  });
  it("uses neutral colours when there is no verdict", () => {
    expect(verdictColors(themes.light, null)).toEqual({ fg: themes.light.inkSecondary, bg: themes.light.surfaceMuted });
  });
  it("does not call a merely checked claim supported", () => {
    // The backend marks supported and partially supported claims alike as "verified".
    expect(CLAIM_STATUS_LABEL.verified).not.toMatch(/supported/i);
  });
});

describe("themes", () => {
  it("define the same tokens in light and dark", () => {
    expect(Object.keys(themes.dark).sort()).toEqual(Object.keys(themes.light).sort());
  });
});
