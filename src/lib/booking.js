export const BUSINESS_TIMEZONE = "America/New_York";

export const SERVICES = [
  {
    id: "full",
    name: "Full groom",
    description: "Bath, haircut, nails & a little extra care.",
    minutes: 90,
    price: 8500,
    deposit: 2000,
    icon: "scissors",
    prep: "Bring your dog on a leash and let us know about any sensitivities.",
  },
  {
    id: "bath",
    name: "Bath & brush",
    description: "A gentle wash, dry, and brush-out.",
    minutes: 60,
    price: 5500,
    deposit: 1500,
    icon: "droplets",
    prep: "Bring your dog on a leash. Tell us about skin sensitivities before the visit.",
  },
  {
    id: "puppy",
    name: "Puppy introduction",
    description: "A calm first visit for little paws.",
    minutes: 45,
    price: 4000,
    deposit: 1000,
    icon: "paw",
    prep: "Bring a familiar treat and your puppy on a leash. We will take things slowly.",
  },
];

export function money(cents) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

// Calendar dates are business-local strings; UTC noon is used only for date arithmetic,
// never as a real appointment instant. The demo has no payment or reservation API.
export function todayKey(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (name) => parts.find((p) => p.type === name).value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function dateLabel(key, options = {}) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "long",
    month: "long",
    day: "numeric",
    ...options,
  }).format(new Date(`${key}T12:00:00Z`));
}

export function addDays(key, amount) {
  const date = new Date(`${key}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

export function bookingDays(now = new Date()) {
  const days = [];
  // Start tomorrow: never offer an elapsed demo time on the current day.
  let day = addDays(todayKey(now), 1);
  while (days.length < 5) {
    const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
    if (weekday !== 0 && weekday !== 6) days.push(day);
    day = addDays(day, 1);
  }
  return days;
}

export function timeLabel(minutes) {
  const hour = Math.floor(minutes / 60);
  return `${hour % 12 || 12}:${String(minutes % 60).padStart(2, "0")} ${hour < 12 ? "AM" : "PM"}`;
}

export function overlaps(start, duration, otherStart, otherDuration) {
  return start < otherStart + otherDuration && start + duration > otherStart;
}

export function availableSlots(date, service, appointments) {
  const slots = [];
  for (let start = 540; start + service.minutes <= 1020; start += 30) {
    if (overlaps(start, service.minutes, 720, 60)) continue;
    if (
      appointments.some(
        (item) =>
          item.date === date &&
          item.status !== "cancelled" &&
          overlaps(start, service.minutes, item.start, item.minutes),
      )
    )
      continue;
    slots.push(start);
  }
  return slots;
}

export function createSamples(date = todayKey()) {
  return [
    {
      id: "sample-milo",
      date,
      start: 540,
      pet: "Milo",
      breed: "Cockapoo",
      size: "Medium",
      client: "Alex Morgan",
      email: "alex@example.com",
      serviceId: "full",
      serviceName: "Full groom",
      minutes: 90,
      price: 8500,
      deposit: 2000,
      status: "scheduled",
      notes: "A little nervous around the dryer.",
      paymentStatus: "not-collected",
    },
    {
      id: "sample-luna",
      date,
      start: 660,
      pet: "Luna",
      breed: "Golden retriever",
      size: "Large",
      client: "Jamie Park",
      email: "jamie@example.com",
      serviceId: "bath",
      serviceName: "Bath & brush",
      minutes: 60,
      price: 5500,
      deposit: 1500,
      status: "scheduled",
      notes: "Loves a treat after brushing.",
      paymentStatus: "not-collected",
    },
    {
      id: "sample-teddy",
      date,
      start: 780,
      pet: "Teddy",
      breed: "Miniature poodle",
      size: "Small",
      client: "Taylor Reed",
      email: "taylor@example.com",
      serviceId: "puppy",
      serviceName: "Puppy introduction",
      minutes: 45,
      price: 4000,
      deposit: 1000,
      status: "scheduled",
      notes: "First grooming visit.",
      paymentStatus: "not-collected",
    },
  ];
}

export function makeDemoBooking(
  { serviceId, date, start, pet, breed, size, client, email, notes },
  appointments,
  now = new Date(),
) {
  const service = SERVICES.find((s) => s.id === serviceId);
  if (
    !service ||
    !bookingDays(now).includes(date) ||
    !availableSlots(date, service, appointments).includes(start)
  )
    throw new Error(
      "That demo time is no longer available. Please choose another time.",
    );
  if (
    !pet?.trim() ||
    !breed?.trim() ||
    !client?.trim() ||
    !["Small", "Medium", "Large", "Extra large"].includes(size) ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email?.trim() || "")
  )
    throw new Error("Please complete the pet and client details.");
  return {
    id: crypto.randomUUID(),
    date,
    start,
    pet: pet.trim().slice(0, 80),
    breed: breed.trim().slice(0, 80),
    size,
    client: client.trim().slice(0, 100),
    email: email.trim().slice(0, 254),
    notes: (notes || "").trim().slice(0, 500),
    serviceId,
    serviceName: service.name,
    minutes: service.minutes,
    price: service.price,
    deposit: service.deposit,
    status: "scheduled",
    paymentStatus: "not-collected",
  };
}
