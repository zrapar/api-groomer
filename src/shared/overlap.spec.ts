import { hasOverlap } from "./overlap";

describe("hasOverlap", () => {
  const base = [
    {
      id: "a",
      status: "CONFIRMED",
      startTime: new Date("2025-01-01T10:00:00Z"),
      endTime: new Date("2025-01-01T11:00:00Z"),
    },
  ];

  it("detects overlap with confirmed appointment", () => {
    const overlaps = hasOverlap(
      base,
      new Date("2025-01-01T10:30:00Z"),
      new Date("2025-01-01T11:30:00Z"),
    );
    expect(overlaps).toBe(true);
  });

  it("ignores cancelled appointments", () => {
    const overlaps = hasOverlap(
      [
        {
          id: "b",
          status: "CANCELLED",
          startTime: new Date("2025-01-01T10:00:00Z"),
          endTime: new Date("2025-01-01T11:00:00Z"),
        },
      ],
      new Date("2025-01-01T10:30:00Z"),
      new Date("2025-01-01T11:30:00Z"),
    );
    expect(overlaps).toBe(false);
  });

  it("respects excludeId", () => {
    const overlaps = hasOverlap(
      base,
      new Date("2025-01-01T10:30:00Z"),
      new Date("2025-01-01T11:30:00Z"),
      "a",
    );
    expect(overlaps).toBe(false);
  });

  it("returns false when no overlap", () => {
    const overlaps = hasOverlap(
      base,
      new Date("2025-01-01T11:00:00Z"),
      new Date("2025-01-01T12:00:00Z"),
    );
    expect(overlaps).toBe(false);
  });
});
