import { describe, expect, it } from "vitest";
import {
  formatCount,
  formatCurrency,
  formatDate,
  formatDateTime,
  formatShortInr,
} from "./format";

describe("cached formatters give the same text as toLocaleString", () => {
  const iso = "2026-11-22T09:05:00.000Z";

  it("formats currency", () => {
    expect(formatCurrency(500000, "INR")).toBe(
      (500000).toLocaleString("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0,
      })
    );
  });

  it("formats date and time", () => {
    expect(formatDateTime(iso)).toBe(
      new Date(iso).toLocaleString("en-IN", {
        day: "numeric",
        month: "short",
        hour: "numeric",
        minute: "2-digit",
      })
    );
  });

  it("formats a date", () => {
    expect(formatDate(iso)).toBe(
      new Date(iso).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    );
  });

  it("formats counts in Indian grouping", () => {
    expect(formatCount(1284512)).toBe("12,84,512");
  });
});

describe("formatShortInr", () => {
  it("uses lakhs and crores like Indian sales teams do", () => {
    expect(formatShortInr(98_000)).toBe("₹98,000");
    expect(formatShortInr(8_520_000)).toBe("₹85.2 L");
    expect(formatShortInr(125_000_000)).toBe("₹12.5 Cr");
  });

  it("keeps very large team totals readable", () => {
    expect(formatShortInr(21_500_000_000)).toBe("₹2,150 Cr");
    expect(formatShortInr(1_754_320_000_000)).toBe("₹1,75,432 Cr");
  });
});
