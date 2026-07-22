import { COLLECTIONS } from "./data.js";

export function getDailyStatus(data, date) {
  const categories = {
    workout: data.workouts.some((record) => record.date === date),
    meal: data.meals.some((record) => record.date === date),
    sleep: data.sleepRecords.some((record) => record.date === date),
    weight: data.weights.some((record) => record.date === date),
    hydration: data.hydration.some((record) => record.date === date),
  };
  return {
    categories,
    completedCount: Object.values(categories).filter(Boolean).length,
    hasRecord: Object.values(categories).some(Boolean),
  };
}

export function getWeekDates(anchorDate) {
  const anchor = parseDate(anchorDate);
  const mondayOffset = (anchor.getUTCDay() + 6) % 7;
  const monday = addDays(anchor, -mondayOffset);
  return Array.from({ length: 7 }, (_, index) => formatDate(addDays(monday, index)));
}

export function getMonthGrid(anchorDate) {
  const anchor = parseDate(anchorDate);
  const first = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), 1));
  const startOffset = (first.getUTCDay() + 6) % 7;
  const start = addDays(first, -startOffset);
  const month = anchor.getUTCMonth();
  return Array.from({ length: 42 }, (_, index) => {
    const date = addDays(start, index);
    return {
      date: formatDate(date),
      inCurrentMonth: date.getUTCMonth() === month,
    };
  });
}

export function shiftCalendarAnchor(anchorDate, mode, direction) {
  const anchor = parseDate(anchorDate);
  if (direction !== -1 && direction !== 1) {
    throw new TypeError("direction 必须是 -1 或 1");
  }
  if (mode === "week") return formatDate(addDays(anchor, direction * 7));
  if (mode !== "month") throw new TypeError("mode 必须是 week 或 month");
  return formatDate(new Date(Date.UTC(
    anchor.getUTCFullYear(),
    anchor.getUTCMonth() + direction,
    1,
  )));
}

export function calculateRecordingStreak(data, todayDate) {
  const recordedDates = new Set(
    COLLECTIONS.flatMap((collectionName) => data[collectionName].map((record) => record.date)),
  );
  const todayRecorded = recordedDates.has(todayDate);
  let cursor = parseDate(todayDate);
  if (!todayRecorded) cursor = addDays(cursor, -1);

  let days = 0;
  while (recordedDates.has(formatDate(cursor))) {
    days += 1;
    cursor = addDays(cursor, -1);
  }
  return { days, todayRecorded };
}

export function getCalendarLabel(anchorDate, mode) {
  if (mode === "month") {
    const date = parseDate(anchorDate);
    return `${date.getUTCFullYear()}年${date.getUTCMonth() + 1}月`;
  }
  const dates = getWeekDates(anchorDate);
  const start = parseDate(dates[0]);
  const end = parseDate(dates[6]);
  if (start.getUTCFullYear() === end.getUTCFullYear()) {
    return `${start.getUTCFullYear()}年${start.getUTCMonth() + 1}月${start.getUTCDate()}日—${end.getUTCMonth() + 1}月${end.getUTCDate()}日`;
  }
  return `${dates[0]}—${dates[6]}`;
}

function parseDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new TypeError("日期必须是 YYYY-MM-DD");
  }
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || formatDate(date) !== value) {
    throw new TypeError("日期无效");
  }
  return date;
}

function addDays(date, days) {
  return new Date(date.getTime() + days * 86_400_000);
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}
