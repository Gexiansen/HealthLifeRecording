import {
  calculateSleepMinutes,
  createId,
} from "./model.js";
import {
  allRecordsByDate,
  deleteRecord,
  findDailyRecord,
  saveRecord,
} from "./data.js";
import { loadData, saveData } from "./storage.js";
import {
  calculateRecordingStreak,
  getCalendarLabel,
  getDailyStatus,
  getMonthGrid,
  getWeekDates,
  shiftCalendarAnchor,
} from "./calendar.js";

const TYPE_CONFIG = Object.freeze({
  workout: { collectionName: "workouts", label: "运动" },
  meal: { collectionName: "meals", label: "饮食" },
  sleep: { collectionName: "sleepRecords", label: "睡眠" },
  weight: { collectionName: "weights", label: "体重" },
  hydration: { collectionName: "hydration", label: "饮水" },
});

const COLLECTION_TO_TYPE = Object.freeze(
  Object.fromEntries(Object.entries(TYPE_CONFIG).map(([type, config]) => [config.collectionName, type])),
);

const WORKOUT_LABELS = Object.freeze({
  strength: "力量",
  cardio: "有氧",
  walking: "步行",
  stretching: "拉伸",
  ballSports: "球类",
  other: "其他",
});

const MEAL_LABELS = Object.freeze({
  breakfast: "早餐",
  lunch: "午餐",
  dinner: "晚餐",
  snack: "加餐",
});

const loadResult = loadData();
let data = loadResult.data;
let selectedDate = localDateString(new Date());
let calendarAnchor = selectedDate;
let calendarMode = "week";
let editing = null;
let undoState = null;
let toastTimer = null;

const elements = {
  storageAlert: document.querySelector("#storage-alert"),
  storageAlertTitle: document.querySelector("#storage-alert-title"),
  storageAlertMessage: document.querySelector("#storage-alert-message"),
  downloadRaw: document.querySelector("#download-raw"),
  selectedDate: document.querySelector("#selected-date"),
  returnToday: document.querySelector("#return-today"),
  previousPeriod: document.querySelector("#previous-period"),
  nextPeriod: document.querySelector("#next-period"),
  calendarLabel: document.querySelector("#calendar-label"),
  calendarGrid: document.querySelector("#calendar-grid"),
  toggleCalendar: document.querySelector("#toggle-calendar"),
  streakDays: document.querySelector("#streak-days"),
  dailyProgress: document.querySelector("#daily-progress"),
  workoutSummary: document.querySelector("#workout-summary"),
  mealSummary: document.querySelector("#meal-summary"),
  sleepSummary: document.querySelector("#sleep-summary"),
  weightSummary: document.querySelector("#weight-summary"),
  hydrationSummary: document.querySelector("#hydration-summary"),
  sleepAction: document.querySelector("#sleep-action"),
  weightAction: document.querySelector("#weight-action"),
  hydrationAction: document.querySelector("#hydration-action"),
  recordsList: document.querySelector("#records-list"),
  recordCount: document.querySelector("#record-count"),
  dialog: document.querySelector("#record-dialog"),
  dialogTitle: document.querySelector("#dialog-title"),
  closeDialog: document.querySelector("#close-dialog"),
  recordDate: document.querySelector("#record-date"),
  formError: document.querySelector("#form-error"),
  toast: document.querySelector("#toast"),
  toastMessage: document.querySelector("#toast-message"),
  undoButton: document.querySelector("#undo-button"),
};

initialize();

function initialize() {
  const today = localDateString(new Date());
  elements.selectedDate.max = today;
  elements.recordDate.max = today;
  elements.selectedDate.value = selectedDate;
  elements.recordDate.value = selectedDate;
  bindEvents();
  renderStorageState();
  renderAll();
}

function bindEvents() {
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => switchView(button.dataset.view));
  });
  document.querySelectorAll("[data-open-form]").forEach((button) => {
    button.addEventListener("click", () => openForm(button.dataset.openForm));
  });
  document.querySelectorAll("[data-record-form]").forEach((form) => {
    form.addEventListener("submit", handleFormSubmit);
  });
  elements.previousPeriod.addEventListener("click", () => changeCalendarPeriod(-1));
  elements.nextPeriod.addEventListener("click", () => changeCalendarPeriod(1));
  elements.toggleCalendar.addEventListener("click", toggleCalendarMode);
  elements.returnToday.addEventListener("click", () => setSelectedDate(localDateString(new Date())));
  elements.selectedDate.addEventListener("change", () => setSelectedDate(elements.selectedDate.value));
  elements.closeDialog.addEventListener("click", () => elements.dialog.close());
  elements.dialog.addEventListener("click", (event) => {
    if (event.target === elements.dialog) elements.dialog.close();
  });
  elements.dialog.addEventListener("close", () => {
    editing = null;
    setFormError("");
  });
  elements.undoButton.addEventListener("click", undoDelete);
  elements.downloadRaw.addEventListener("click", downloadCorruptData);
}

function renderStorageState() {
  if (loadResult.status === "ready" || loadResult.status === "empty") return;

  elements.storageAlert.hidden = false;
  if (loadResult.status === "corrupt") {
    elements.storageAlertTitle.textContent = "检测到异常本地数据，已停止写入";
    elements.storageAlertMessage.textContent = "原始内容仍保留在浏览器中。请先下载保存，再处理或恢复数据。";
    elements.downloadRaw.hidden = false;
  } else {
    elements.storageAlertTitle.textContent = "浏览器本地存储不可用";
    elements.storageAlertMessage.textContent = "当前无法安全读取或保存健康记录，请检查浏览器隐私设置。";
  }
  document.querySelectorAll("[data-open-form]").forEach((button) => {
    button.disabled = true;
  });
}

function renderAll() {
  renderToday();
  renderRecords();
}

function renderToday() {
  elements.selectedDate.value = selectedDate;
  elements.returnToday.hidden = selectedDate === localDateString(new Date());
  renderCalendar();

  if (!data) {
    for (const element of [
      elements.workoutSummary,
      elements.mealSummary,
      elements.sleepSummary,
      elements.weightSummary,
      elements.hydrationSummary,
    ]) element.textContent = "数据不可用";
    elements.streakDays.textContent = "—";
    elements.dailyProgress.textContent = "写入已锁定";
    return;
  }

  const workouts = data.workouts.filter((record) => record.date === selectedDate);
  const meals = data.meals.filter((record) => record.date === selectedDate);
  const sleep = findDailyRecord(data, "sleepRecords", selectedDate);
  const weight = findDailyRecord(data, "weights", selectedDate);
  const hydration = findDailyRecord(data, "hydration", selectedDate);
  const completed = [workouts.length > 0, meals.length > 0, sleep, weight, hydration].filter(Boolean).length;

  elements.workoutSummary.textContent = workouts.length
    ? `${workouts.length} 次，共 ${workouts.reduce((sum, item) => sum + item.durationMinutes, 0)} 分钟`
    : "尚未记录";
  elements.mealSummary.textContent = meals.length
    ? `${meals.length} 餐：${meals.map((item) => MEAL_LABELS[item.mealType]).join("、")}`
    : "尚未记录";
  elements.sleepSummary.textContent = sleep
    ? `${formatMinutes(calculateSleepMinutes(sleep.sleepTime, sleep.wakeTime))}，质量 ${sleep.qualityScore}/5`
    : "尚未记录";
  elements.weightSummary.textContent = weight ? `${formatWeight(weight.weightGrams)} kg` : "尚未记录";
  elements.hydrationSummary.textContent = hydration ? `${hydration.milliliters} ml` : "尚未记录";
  elements.sleepAction.textContent = sleep ? "编辑睡眠" : "记录睡眠";
  elements.weightAction.textContent = weight ? "编辑体重" : "记录体重";
  elements.hydrationAction.textContent = hydration ? "编辑饮水" : "记录饮水";
  elements.dailyProgress.textContent = `${formatDisplayDate(selectedDate)} · 已完成 ${completed}/5 类记录`;
  const streak = calculateRecordingStreak(data, localDateString(new Date()));
  elements.streakDays.textContent = `${streak.days} 天`;
  elements.streakDays.title = streak.todayRecorded ? "今天已有记录" : "今天尚未记录，连续天数截至昨天";
}

function renderCalendar() {
  const today = localDateString(new Date());
  const entries = calendarMode === "week"
    ? getWeekDates(calendarAnchor).map((date) => ({ date, inCurrentMonth: true }))
    : getMonthGrid(calendarAnchor);
  elements.calendarLabel.textContent = getCalendarLabel(calendarAnchor, calendarMode);
  elements.calendarGrid.replaceChildren();
  elements.toggleCalendar.textContent = calendarMode === "week" ? "展开整月" : "收起到本周";
  elements.toggleCalendar.setAttribute("aria-expanded", String(calendarMode === "month"));
  elements.previousPeriod.setAttribute("aria-label", calendarMode === "week" ? "上一周" : "上个月");
  elements.nextPeriod.setAttribute("aria-label", calendarMode === "week" ? "下一周" : "下个月");
  elements.nextPeriod.disabled = entries.some((entry) => entry.date === today);

  for (const entry of entries) {
    const status = data ? getDailyStatus(data, entry.date) : { completedCount: 0, hasRecord: false };
    const button = document.createElement("button");
    button.type = "button";
    button.className = "calendar-day";
    if (!entry.inCurrentMonth) button.classList.add("outside-month");
    if (entry.date === selectedDate) button.classList.add("selected");
    if (status.hasRecord) button.classList.add("has-record");
    button.disabled = entry.date > today || !data;
    button.setAttribute("aria-label", `${formatDisplayDate(entry.date)}，已完成 ${status.completedCount}/5 类记录`);
    const dayNumber = document.createElement("span");
    dayNumber.className = "day-number";
    dayNumber.textContent = String(Number(entry.date.slice(-2)));
    const dayStatus = document.createElement("span");
    dayStatus.className = "day-status";
    dayStatus.textContent = status.hasRecord ? `${status.completedCount}/5` : "—";
    button.append(dayNumber, dayStatus);
    button.addEventListener("click", () => setSelectedDate(entry.date));
    elements.calendarGrid.append(button);
  }
}

function renderRecords() {
  elements.recordsList.replaceChildren();
  if (!data) {
    elements.recordCount.textContent = "不可用";
    return;
  }

  const items = allRecordsByDate(data);
  elements.recordCount.textContent = `${items.length} 条`;
  if (items.length === 0) {
    elements.recordsList.append(createEmptyRecordsState());
    return;
  }

  let currentDate = null;
  let group = null;
  for (const item of items) {
    if (item.record.date !== currentDate) {
      currentDate = item.record.date;
      group = document.createElement("section");
      group.className = "date-group";
      const title = document.createElement("h3");
      title.className = "date-group-title";
      title.textContent = formatDisplayDate(currentDate);
      group.append(title);
      elements.recordsList.append(group);
    }
    group.append(createRecordCard(item.collectionName, item.record));
  }
}

function createEmptyRecordsState() {
  const container = document.createElement("div");
  container.className = "empty-state";
  const icon = document.createElement("span");
  icon.textContent = "＋";
  const title = document.createElement("h3");
  title.textContent = "还没有健康记录";
  const message = document.createElement("p");
  message.textContent = "从“今日”选择一类数据开始记录。";
  container.append(icon, title, message);
  return container;
}

function createRecordCard(collectionName, record) {
  const card = document.createElement("article");
  card.className = "record-card";
  const top = document.createElement("div");
  top.className = "record-top";
  const label = document.createElement("div");
  label.className = "record-label";
  const dot = document.createElement("span");
  dot.className = "record-type-dot";
  const labelText = document.createElement("span");
  labelText.textContent = TYPE_CONFIG[COLLECTION_TO_TYPE[collectionName]].label;
  label.append(dot, labelText);

  const actions = document.createElement("div");
  actions.className = "record-actions";
  const editButton = document.createElement("button");
  editButton.type = "button";
  editButton.textContent = "编辑";
  editButton.setAttribute("aria-label", `编辑${labelText.textContent}记录`);
  editButton.addEventListener("click", () => openForm(COLLECTION_TO_TYPE[collectionName], record));
  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.className = "delete-action";
  deleteButton.textContent = "删除";
  deleteButton.setAttribute("aria-label", `删除${labelText.textContent}记录`);
  deleteButton.addEventListener("click", () => handleDelete(collectionName, record.id));
  actions.append(editButton, deleteButton);
  top.append(label, actions);

  const detail = document.createElement("p");
  detail.className = "record-detail";
  detail.textContent = describeRecord(collectionName, record);
  card.append(top, detail);
  return card;
}

function describeRecord(collectionName, record) {
  let detail;
  if (collectionName === "workouts") {
    detail = `${WORKOUT_LABELS[record.type]} · ${record.durationMinutes} 分钟 · 强度 ${record.intensity}/3`;
  } else if (collectionName === "meals") {
    detail = `${MEAL_LABELS[record.mealType]} · ${record.description} · 健康 ${record.healthScore}/5 · 饱腹 ${record.fullnessScore}/5`;
  } else if (collectionName === "sleepRecords") {
    detail = `${record.sleepTime}–${record.wakeTime} · ${formatMinutes(calculateSleepMinutes(record.sleepTime, record.wakeTime))} · 质量 ${record.qualityScore}/5`;
  } else if (collectionName === "weights") {
    detail = `${formatWeight(record.weightGrams)} kg${record.bodyFatBasisPoints === null ? "" : ` · 体脂 ${formatBodyFat(record.bodyFatBasisPoints)}％`}`;
  } else {
    detail = `${record.milliliters} ml`;
  }
  return record.note ? `${detail} · ${record.note}` : detail;
}

function switchView(viewName) {
  document.querySelectorAll(".view").forEach((view) => {
    view.hidden = view.id !== `view-${viewName}`;
  });
  document.querySelectorAll("[data-view]").forEach((button) => {
    if (button.dataset.view === viewName) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  if (viewName === "records") renderRecords();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function changeCalendarPeriod(direction) {
  if (direction === 1 && elements.nextPeriod.disabled) return;
  calendarAnchor = shiftCalendarAnchor(calendarAnchor, calendarMode, direction);
  renderCalendar();
}

function toggleCalendarMode() {
  calendarMode = calendarMode === "week" ? "month" : "week";
  calendarAnchor = selectedDate;
  renderCalendar();
}

function setSelectedDate(value) {
  if (!value) return;
  selectedDate = value;
  calendarAnchor = value;
  renderToday();
}

function openForm(type, explicitRecord = null) {
  if (!data) return;
  const config = TYPE_CONFIG[type];
  let record = explicitRecord;
  if (!record && ["sleep", "weight", "hydration"].includes(type)) {
    record = findDailyRecord(data, config.collectionName, selectedDate);
  }

  editing = record ? { type, record } : { type, record: null };
  document.querySelectorAll("[data-record-form]").forEach((form) => {
    form.hidden = form.dataset.recordForm !== type;
    form.reset();
  });
  const form = document.querySelector(`[data-record-form="${type}"]`);
  elements.recordDate.value = record?.date ?? selectedDate;
  elements.dialogTitle.textContent = `${record ? "编辑" : "新增"}${config.label}`;
  setFormError("");
  fillForm(type, form, record);
  elements.dialog.showModal();
  elements.closeDialog.focus();
}

function fillForm(type, form, record) {
  if (!record) {
    if (type === "sleep") {
      form.elements.sleepTime.value = "23:00";
      form.elements.wakeTime.value = "07:00";
    }
    return;
  }

  for (const [key, value] of Object.entries(record)) {
    if (form.elements[key]) form.elements[key].value = value;
  }
  if (type === "weight") {
    form.elements.weightKg.value = formatWeight(record.weightGrams);
    form.elements.bodyFatPercent.value = record.bodyFatBasisPoints === null
      ? ""
      : formatBodyFat(record.bodyFatBasisPoints);
  }
}

function handleFormSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const type = form.dataset.recordForm;
  const now = new Date().toISOString();
  const existing = editing?.type === type ? editing.record : null;
  const base = {
    id: existing?.id ?? createId(),
    date: elements.recordDate.value,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  try {
    const record = buildRecord(type, form, base);
    const next = saveRecord(data, TYPE_CONFIG[type].collectionName, record);
    saveData(next);
    data = next;
    elements.dialog.close();
    renderAll();
    showToast(`${TYPE_CONFIG[type].label}已保存`);
  } catch (error) {
    setFormError(error.message || "保存失败，请检查输入");
  }
}

function buildRecord(type, form, base) {
  if (type === "workout") {
    return {
      ...base,
      type: form.elements.type.value,
      durationMinutes: Number(form.elements.durationMinutes.value),
      intensity: Number(form.elements.intensity.value),
      note: form.elements.note.value.trim(),
    };
  }
  if (type === "meal") {
    return {
      ...base,
      mealType: form.elements.mealType.value,
      description: form.elements.description.value.trim(),
      healthScore: Number(form.elements.healthScore.value),
      fullnessScore: Number(form.elements.fullnessScore.value),
      note: form.elements.note.value.trim(),
    };
  }
  if (type === "sleep") {
    return {
      ...base,
      sleepTime: form.elements.sleepTime.value,
      wakeTime: form.elements.wakeTime.value,
      qualityScore: Number(form.elements.qualityScore.value),
      awakeCount: Number(form.elements.awakeCount.value),
      note: form.elements.note.value.trim(),
    };
  }
  if (type === "weight") {
    const bodyFat = form.elements.bodyFatPercent.value;
    return {
      ...base,
      weightGrams: Math.round(Number(form.elements.weightKg.value) * 1_000),
      bodyFatBasisPoints: bodyFat === "" ? null : Math.round(Number(bodyFat) * 100),
      note: form.elements.note.value.trim(),
    };
  }
  return {
    ...base,
    milliliters: Number(form.elements.milliliters.value),
    note: form.elements.note.value.trim(),
  };
}

function handleDelete(collectionName, recordId) {
  try {
    const previousData = data;
    const result = deleteRecord(data, collectionName, recordId);
    saveData(result.data);
    data = result.data;
    undoState = { previousData };
    renderAll();
    showToast("记录已删除", true);
  } catch (error) {
    showToast(error.message || "删除失败");
  }
}

function undoDelete() {
  if (!undoState) return;
  try {
    saveData(undoState.previousData);
    data = undoState.previousData;
    undoState = null;
    renderAll();
    showToast("已撤销删除");
  } catch (error) {
    showToast(error.message || "撤销失败");
  }
}

function showToast(message, showUndo = false) {
  clearTimeout(toastTimer);
  elements.toastMessage.textContent = message;
  elements.undoButton.hidden = !showUndo;
  elements.toast.hidden = false;
  toastTimer = setTimeout(() => {
    elements.toast.hidden = true;
    elements.undoButton.hidden = true;
    undoState = null;
  }, showUndo ? 10_000 : 3_000);
}

function setFormError(message) {
  elements.formError.textContent = message;
  elements.formError.hidden = !message;
}

function downloadCorruptData() {
  if (!loadResult.raw) return;
  const blob = new Blob([loadResult.raw], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `healthlife-corrupt-${localDateString(new Date())}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function formatMinutes(minutes) {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (hours === 0) return `${remainder} 分钟`;
  return remainder === 0 ? `${hours} 小时` : `${hours} 小时 ${remainder} 分`;
}

function formatWeight(grams) {
  return formatDecimal(grams / 1_000, 3);
}

function formatBodyFat(basisPoints) {
  return formatDecimal(basisPoints / 100, 2);
}

function formatDecimal(value, digits) {
  return value.toFixed(digits).replace(/\.?0+$/, "");
}

function formatDisplayDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return new Intl.DateTimeFormat("zh-CN", {
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(date);
}

function localDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
