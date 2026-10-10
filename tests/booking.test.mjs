import test from "node:test";
import assert from "node:assert/strict";
import {
  todayKey,
  bookingDays,
  availableSlots,
  overlaps,
  SERVICES,
  makeDemoBooking,
  addDays,
} from "../src/lib/booking.js";

const now = new Date("2026-10-09T16:00:00Z");
test("adjacent appointments are allowed; partial and enclosing overlaps are not", () => {
  assert.equal(overlaps(600, 60, 660, 60), false);
  assert.equal(overlaps(600, 90, 660, 60), true);
  assert.equal(overlaps(540, 180, 600, 30), true);
});
test("slots respect working hours, lunch, occupied time, and cancellation", () => {
  const date = "2026-10-12";
  const items = [{ date, start: 540, minutes: 90, status: "scheduled" }];
  const slots = availableSlots(date, SERVICES[0], items);
  assert.equal(slots.includes(540), false);
  assert.equal(slots.includes(630), true);
  assert.equal(slots.includes(660), false);
  assert.equal(slots.includes(720), false);
  assert.equal(slots.includes(780), true);
  assert.ok(slots.every((s) => s >= 540 && s + 90 <= 1020));
  assert.ok(
    availableSlots(date, SERVICES[0], [
      { ...items[0], status: "cancelled" },
    ]).includes(540),
  );
  assert.equal(
    availableSlots("2026-10-13", SERVICES[0], items).includes(540),
    true,
  );
});
test("business dates use Eastern time and date arithmetic survives DST", () => {
  assert.equal(todayKey(new Date("2026-10-10T01:00:00Z")), "2026-10-09");
  assert.equal(todayKey(new Date("2026-11-01T05:30:00Z")), "2026-11-01");
  assert.equal(todayKey(new Date("2026-11-01T06:30:00Z")), "2026-11-01");
  assert.equal(addDays("2026-10-31", 2), "2026-11-02");
  assert.equal(addDays("2026-03-07", 2), "2026-03-09");
});
test("booking dates start in the future and exclude weekends", () => {
  assert.deepEqual(bookingDays(now), [
    "2026-10-12",
    "2026-10-13",
    "2026-10-14",
    "2026-10-15",
    "2026-10-16",
  ]);
});
test("booking creation rechecks availability, snapshots service and never marks payment received", () => {
  const form = {
    serviceId: "full",
    date: "2026-10-12",
    start: 540,
    pet: "Pip",
    breed: "Poodle",
    size: "Small",
    client: "Demo Client",
    email: "demo@example.com",
  };
  const item = makeDemoBooking(form, [], now);
  assert.equal(item.serviceName, "Full groom");
  assert.equal(item.price, 8500);
  assert.equal(item.paymentStatus, "not-collected");
  assert.throws(
    () => makeDemoBooking(form, [item], now),
    /no longer available/,
  );
  assert.throws(
    () => makeDemoBooking({ ...form, date: "2026-10-09" }, [], now),
    /no longer available/,
  );
  assert.throws(
    () => makeDemoBooking({ ...form, email: "bad" }, [], now),
    /complete/,
  );
  assert.throws(
    () => makeDemoBooking({ ...form, pet: " " }, [], now),
    /complete/,
  );
});
