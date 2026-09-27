import { findRange, normalise } from "../passage";

const PAGE = "Results\nAdults who drank two or more cups of coffee per day had an 18% lower incidence of\nheart disease than adults who drank none.\nDaily coffee consumption was associated with a lower risk of heart disease.";

describe("findRange", () => {
  it("finds a passage across line breaks and different casing", () => {
    const range = findRange(PAGE, "daily coffee consumption was ASSOCIATED with a lower risk");
    expect(range).not.toBeNull();
    const [start, end] = range!;
    expect(normalise(PAGE).slice(start, end)).toBe("Daily coffee consumption was associated with a lower risk");
  });

  it("falls back to a shorter prefix when the tail was edited", () => {
    const range = findRange(PAGE, "Daily coffee consumption was associated with a lower risk of stroke in older adults");
    expect(range).not.toBeNull();
    expect(normalise(PAGE).slice(range![0], range![1]).toLowerCase()).toContain("daily coffee consumption");
  });

  it("returns null when the passage is not on the page", () => {
    expect(findRange(PAGE, "Tea drinkers showed no measurable difference in outcomes")).toBeNull();
  });

  it("refuses fragments too short to be meaningful", () => {
    expect(findRange(PAGE, "coffee")).toBeNull();
  });
});
