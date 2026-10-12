import { expect, test } from "vitest";
import { importReminderDue } from "@/lib/importReminder";
const d=(s:string)=>new Date(s+"T12:00:00");
test("cycle", () => {
  expect(importReminderDue({mode:"cycle",days:2},"2026-11-04","2026-10-12",d("2026-11-02"))).toBeNull();
  expect(importReminderDue({mode:"cycle",days:2},"2026-11-04","2026-10-12",d("2026-11-03"))?.title).toBe("Cycle ends in 1 day");
  expect(importReminderDue({mode:"cycle",days:2},"2026-11-04","2026-11-03",d("2026-11-04"))).toBeNull();
});
test("interval", () => {
  expect(importReminderDue({mode:"interval",days:7},"x","2026-10-12",d("2026-10-18"))).toBeNull();
  expect(importReminderDue({mode:"interval",days:7},"x","2026-10-12",d("2026-10-19"))?.key).toBe("import:interval:2026-10-19");
});
