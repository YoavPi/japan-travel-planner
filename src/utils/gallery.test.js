import { visibleDayCount, coverIsEmoji, coverEmoji } from "./gallery";

test("visibleDayCount: 30% rounded up, min 1", () => {
  expect(visibleDayCount(10)).toBe(3);
  expect(visibleDayCount(4)).toBe(2);   // ceil(1.2)
  expect(visibleDayCount(1)).toBe(1);
  expect(visibleDayCount(0)).toBe(1);   // guard
  expect(visibleDayCount(3)).toBe(1);   // ceil(0.9)
});

test("coverIsEmoji / coverEmoji", () => {
  expect(coverIsEmoji("emoji:🗼")).toBe(true);
  expect(coverIsEmoji("https://x/y.jpg")).toBe(false);
  expect(coverIsEmoji("")).toBe(false);
  expect(coverEmoji("emoji:🗼")).toBe("🗼");
});
