import { assertValidData, calculateSleepMinutes } from "./model.js?v=36";
import { calculatePaceSecondsPerKilometer } from "./interaction.js?v=36";

export const ANALYSIS_FORMAT = "healthlife-analysis-export";
export const ANALYSIS_VERSION = 9;

export function createAnalysisExport(data, exportedAt = new Date().toISOString()) {
  assertValidData(data);
  assertIsoTimestamp(exportedAt);
  const dates = allDates(data);
  return {
    format: ANALYSIS_FORMAT,
    analysisVersion: ANALYSIS_VERSION,
    schemaVersion: data.schemaVersion,
    exportedAt,
    dateRange: {
      firstDate: dates[0] ?? null,
      lastDate: dates.at(-1) ?? null,
      daysWithRecords: dates.length,
    },
    days: dates.map((date) => createDay(data, date)),
  };
}

export function serializeAnalysisExport(data, exportedAt) {
  return JSON.stringify(createAnalysisExport(data, exportedAt), null, 2);
}

function createDay(data, date) {
  const meals = data.meals.filter((record) => record.date === date);
  const workouts = data.workouts.filter((record) => record.date === date);
  const sleep = data.sleepRecords.find((record) => record.date === date) ?? null;
  const weight = data.weights.find((record) => record.date === date) ?? null;
  return {
    date,
    weight: weight
      ? { weightGrams: weight.weightGrams, bodyFatBasisPoints: weight.bodyFatBasisPoints }
      : null,
    sleep: sleep
      ? {
        sleepTime: sleep.sleepTime,
        wakeTime: sleep.wakeTime,
        durationMinutes: calculateSleepMinutes(sleep.sleepTime, sleep.wakeTime),
        qualityScore: sleep.qualityScore,
        awakeCount: sleep.awakeCount,
      }
      : null,
    workouts: workouts.map((record) => ({
      scenario: record.scenario,
      type: record.type,
      durationMinutes: record.durationMinutes,
      intensity: record.intensity,
      source: record.source,
      averageHeartRateBpm: record.averageHeartRateBpm,
      distanceMeters: record.distanceMeters,
      paceSecondsPerKilometer: record.distanceMeters === null
        ? null
        : calculatePaceSecondsPerKilometer(record.durationMinutes, record.distanceMeters),
      guidedSession: record.guidedSession === null
        ? null
        : structuredClone(record.guidedSession),
      keepDetails: record.keepDetails === null
        ? null
        : structuredClone(record.keepDetails),
      note: record.note,
    })),
    meals: meals.map((record) => ({
      mealType: record.mealType,
      content: record.content,
    })),
  };
}

function allDates(data) {
  return [...new Set([
    ...data.workouts,
    ...data.meals,
    ...data.sleepRecords,
    ...data.weights,
  ].map((record) => record.date))].sort();
}

function assertIsoTimestamp(value) {
  const parsed = typeof value === "string" ? new Date(value) : null;
  if (!parsed || Number.isNaN(parsed.getTime()) || parsed.toISOString() !== value) {
    throw new TypeError("exportedAt 必须是标准 UTC ISO 8601 时间戳");
  }
}
