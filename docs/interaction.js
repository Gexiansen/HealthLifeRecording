const COLLECTIONS = new Set(["workouts", "meals", "sleepRecords", "weights", "hydration"]);

export function getDateContext(selectedDate, today) {
  assertDateString(selectedDate, "selectedDate");
  assertDateString(today, "today");
  if (selectedDate === today) {
    return {
      heading: "今日",
      hydrationLabel: "今日饮水（ml）",
    };
  }
  const [, month, day] = selectedDate.split("-").map(Number);
  return {
    heading: `${month}月${day}日`,
    hydrationLabel: "当日饮水（ml）",
  };
}

export function getDefaultMealType(hour) {
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    throw new TypeError("hour 必须是 0～23 的整数");
  }
  if (hour < 10) return "breakfast";
  if (hour < 15) return "lunch";
  if (hour < 21) return "dinner";
  return "snack";
}

export function addHydrationAmount(currentMilliliters, addedMilliliters) {
  if (!Number.isInteger(currentMilliliters) || currentMilliliters < 0) {
    throw new TypeError("currentMilliliters 必须是非负整数");
  }
  if (!Number.isInteger(addedMilliliters) || addedMilliliters < 1) {
    throw new TypeError("addedMilliliters 必须是正整数");
  }
  const total = currentMilliliters + addedMilliliters;
  if (total > 20_000) throw new RangeError("单日饮水量不能超过 20000 ml");
  return total;
}

export function filterRecordItems(items, collectionName = "all", month = "") {
  if (!Array.isArray(items)) throw new TypeError("items 必须是数组");
  if (collectionName !== "all" && !COLLECTIONS.has(collectionName)) {
    throw new TypeError("collectionName 不受支持");
  }
  if (month !== "" && !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    throw new TypeError("month 必须是 YYYY-MM");
  }
  return items.filter((item) => {
    const typeMatches = collectionName === "all" || item.collectionName === collectionName;
    const monthMatches = month === "" || item.record.date.startsWith(`${month}-`);
    return typeMatches && monthMatches;
  });
}

export function getRestoreLabel(currentCount, incomingCount) {
  if (!Number.isInteger(currentCount) || currentCount < 0 || !Number.isInteger(incomingCount) || incomingCount < 0) {
    throw new TypeError("记录数量必须是非负整数");
  }
  if (currentCount === 0) {
    return {
      summary: `将恢复备份中的 ${incomingCount} 条记录。`,
      action: `恢复 ${incomingCount} 条记录`,
    };
  }
  return {
    summary: `当前 ${currentCount} 条记录将被备份中的 ${incomingCount} 条完整替换；替换前会先下载当前数据。`,
    action: `用 ${incomingCount} 条替换当前 ${currentCount} 条`,
  };
}

function assertDateString(value, name) {
  if (typeof value !== "string" || !/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(value)) {
    throw new TypeError(`${name} 必须是 YYYY-MM-DD`);
  }
}
