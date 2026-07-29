import {
  calculateSleepMinutes,
  createId,
} from "./model.js";
import {
  allRecordsByDate,
  deleteRecord,
  findDailyRecord,
  saveCustomFood,
  saveRecipe,
  saveRecord,
  updateEggGramsPerPiece,
  updateFoodPreferences,
} from "./data.js";
import {
  loadBackupMetadata,
  loadData,
  saveBackupMetadata,
  saveData,
} from "./storage.js";
import {
  calculateRecordingStreak,
  getCalendarLabel,
  getDailyStatus,
  getMonthGrid,
  getWeekDates,
  shiftCalendarAnchor,
} from "./calendar.js";
import { calculateTrendComparison } from "./stats.js";
import {
  createBackupMetadata,
  getBackupReminder,
  parseCompleteBackup,
  serializeCompleteBackup,
  summarizeData,
} from "./backup.js";
import {
  addHydrationAmount,
  calculatePaceSecondsPerKilometer,
  filterRecordItems,
  getDateContext,
  getDefaultMealType,
  getRestoreLabel,
} from "./interaction.js";
import {
  calculateRecipeNutrition,
  createFoodEntry,
  formatNutrition,
  getFoodCatalog,
  sumNutrition,
} from "./nutrition.js";
import { serializeAnalysisExport } from "./analysis.js";

const TYPE_CONFIG = Object.freeze({
  workout: { collectionName: "workouts", label: "运动" },
  activity: { collectionName: "dailyActivities", label: "每日活动" },
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
  running: "跑步",
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

let storageState = loadData();
let data = storageState.data;
let backupMetadata = loadBackupMetadata();
let selectedDate = localDateString(new Date());
let calendarAnchor = selectedDate;
let calendarMode = "week";
let editing = null;
let undoState = null;
let toastTimer = null;
let pendingImport = null;
let trendDays = 7;
let activeForm = null;
let formBaseline = null;
let installPromptEvent = null;
let mealItemsDraft = [];
let recipeIngredientsDraft = [];

const elements = {
  storageAlert: document.querySelector("#storage-alert"),
  storageAlertTitle: document.querySelector("#storage-alert-title"),
  storageAlertMessage: document.querySelector("#storage-alert-message"),
  downloadRaw: document.querySelector("#download-raw"),
  backupReminder: document.querySelector("#backup-reminder"),
  backupReminderMessage: document.querySelector("#backup-reminder-message"),
  openData: document.querySelector("#open-data"),
  openDataReminder: document.querySelector("#open-data-reminder"),
  appUpdate: document.querySelector("#app-update"),
  reloadApp: document.querySelector("#reload-app"),
  todayTitle: document.querySelector("#today-title"),
  returnToday: document.querySelector("#return-today"),
  previousPeriod: document.querySelector("#previous-period"),
  nextPeriod: document.querySelector("#next-period"),
  calendarLabel: document.querySelector("#calendar-label"),
  calendarGrid: document.querySelector("#calendar-grid"),
  toggleCalendar: document.querySelector("#toggle-calendar"),
  streakDays: document.querySelector("#streak-days"),
  workoutSummary: document.querySelector("#workout-summary"),
  activitySummary: document.querySelector("#activity-summary"),
  mealSummary: document.querySelector("#meal-summary"),
  sleepSummary: document.querySelector("#sleep-summary"),
  weightSummary: document.querySelector("#weight-summary"),
  hydrationSummary: document.querySelector("#hydration-summary"),
  sleepAction: document.querySelector("#sleep-action"),
  weightAction: document.querySelector("#weight-action"),
  hydrationAction: document.querySelector("#hydration-action"),
  activityAction: document.querySelector("#activity-action"),
  trendPeriodLabel: document.querySelector("#trend-period-label"),
  trendEmpty: document.querySelector("#trend-empty"),
  trendGrid: document.querySelector(".trend-grid"),
  trendBoundary: document.querySelector(".trend-boundary"),
  weightTrendSamples: document.querySelector("#weight-trend-samples"),
  weightTrendValue: document.querySelector("#weight-trend-value"),
  weightTrendMeta: document.querySelector("#weight-trend-meta"),
  weightChart: document.querySelector("#weight-chart"),
  weightChartLegend: document.querySelector("#weight-chart-legend"),
  weightChartDetail: document.querySelector("#weight-chart-detail"),
  sleepTrendSamples: document.querySelector("#sleep-trend-samples"),
  sleepTrendValue: document.querySelector("#sleep-trend-value"),
  sleepTrendMeta: document.querySelector("#sleep-trend-meta"),
  workoutTrendSamples: document.querySelector("#workout-trend-samples"),
  workoutTrendValue: document.querySelector("#workout-trend-value"),
  workoutTrendMeta: document.querySelector("#workout-trend-meta"),
  activityTrendSamples: document.querySelector("#activity-trend-samples"),
  activityTrendValue: document.querySelector("#activity-trend-value"),
  activityTrendMeta: document.querySelector("#activity-trend-meta"),
  mealTrendSamples: document.querySelector("#meal-trend-samples"),
  mealTrendValue: document.querySelector("#meal-trend-value"),
  mealTrendMeta: document.querySelector("#meal-trend-meta"),
  hydrationTrendSamples: document.querySelector("#hydration-trend-samples"),
  hydrationTrendValue: document.querySelector("#hydration-trend-value"),
  hydrationTrendMeta: document.querySelector("#hydration-trend-meta"),
  recordsList: document.querySelector("#records-list"),
  recordCount: document.querySelector("#record-count"),
  recordTypeFilter: document.querySelector("#record-type-filter"),
  recordMonthFilter: document.querySelector("#record-month-filter"),
  clearRecordFilters: document.querySelector("#clear-record-filters"),
  dialog: document.querySelector("#record-dialog"),
  dialogTitle: document.querySelector("#dialog-title"),
  closeDialog: document.querySelector("#close-dialog"),
  recordDate: document.querySelector("#record-date"),
  hydrationAmountLabel: document.querySelector("#hydration-amount-label"),
  sleepDurationPreview: document.querySelector("#sleep-duration-preview"),
  mealFoodSelect: document.querySelector("#meal-food-select"),
  mealFoodQuantity: document.querySelector("#meal-food-quantity"),
  mealFoodQuantityLabel: document.querySelector("#meal-food-quantity-label"),
  mealFoodUnit: document.querySelector("#meal-food-unit"),
  eggPieceWeightField: document.querySelector("#egg-piece-weight-field"),
  eggGramsPerPiece: document.querySelector("#egg-grams-per-piece"),
  mealFoodFavorite: document.querySelector("#meal-food-favorite"),
  addMealFood: document.querySelector("#add-meal-food"),
  mealItems: document.querySelector("#meal-items"),
  mealNutrition: document.querySelector("#meal-nutrition"),
  openCustomFood: document.querySelector("#open-custom-food"),
  openRecipe: document.querySelector("#open-recipe"),
  customFoodDialog: document.querySelector("#custom-food-dialog"),
  closeCustomFood: document.querySelector("#close-custom-food"),
  customFoodForm: document.querySelector("#custom-food-form"),
  customFoodError: document.querySelector("#custom-food-error"),
  recipeDialog: document.querySelector("#recipe-dialog"),
  closeRecipe: document.querySelector("#close-recipe"),
  recipeForm: document.querySelector("#recipe-form"),
  recipeFoodSelect: document.querySelector("#recipe-food-select"),
  recipeFoodGrams: document.querySelector("#recipe-food-grams"),
  addRecipeFood: document.querySelector("#add-recipe-food"),
  recipeItems: document.querySelector("#recipe-items"),
  recipeNutrition: document.querySelector("#recipe-nutrition"),
  recipeError: document.querySelector("#recipe-error"),
  workoutPacePreview: document.querySelector("#workout-pace-preview"),
  workoutDistanceField: document.querySelector("#workout-distance-field"),
  formError: document.querySelector("#form-error"),
  discardDialog: document.querySelector("#discard-dialog"),
  continueEditing: document.querySelector("#continue-editing"),
  discardChanges: document.querySelector("#discard-changes"),
  toast: document.querySelector("#toast"),
  toastMessage: document.querySelector("#toast-message"),
  undoButton: document.querySelector("#undo-button"),
  dataDialog: document.querySelector("#data-dialog"),
  closeDataDialog: document.querySelector("#close-data-dialog"),
  backupStatus: document.querySelector("#backup-status"),
  exportBackup: document.querySelector("#export-backup"),
  exportAnalysis: document.querySelector("#export-analysis"),
  importFile: document.querySelector("#import-file"),
  importError: document.querySelector("#import-error"),
  importPreview: document.querySelector("#import-preview"),
  importFileName: document.querySelector("#import-file-name"),
  importExportedAt: document.querySelector("#import-exported-at"),
  importDateRange: document.querySelector("#import-date-range"),
  importTotal: document.querySelector("#import-total"),
  importCounts: document.querySelector("#import-counts"),
  importReplaceSummary: document.querySelector("#import-replace-summary"),
  confirmImport: document.querySelector("#confirm-import"),
  installApp: document.querySelector("#install-app"),
};

initialize();

function initialize() {
  const today = localDateString(new Date());
  elements.recordDate.max = today;
  elements.recordMonthFilter.max = today.slice(0, 7);
  elements.recordDate.value = selectedDate;
  bindEvents();
  renderStorageState();
  renderAll();
  registerServiceWorker();
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    const hadController = Boolean(navigator.serviceWorker.controller);
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (hadController) elements.appUpdate.hidden = false;
    });
    navigator.serviceWorker.register("./sw.js").then((registration) => {
      if (registration.waiting && hadController) elements.appUpdate.hidden = false;
    }).catch(() => {});
  });
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
    form.addEventListener("input", handleFormInput);
    form.addEventListener("change", handleFormInput);
  });
  elements.previousPeriod.addEventListener("click", () => changeCalendarPeriod(-1));
  elements.nextPeriod.addEventListener("click", () => changeCalendarPeriod(1));
  elements.toggleCalendar.addEventListener("click", toggleCalendarMode);
  elements.returnToday.addEventListener("click", () => setSelectedDate(localDateString(new Date())));
  document.querySelectorAll("[data-trend-days]").forEach((button) => {
    button.addEventListener("click", () => setTrendDays(Number(button.dataset.trendDays)));
  });
  document.querySelectorAll("[data-go-today]").forEach((button) => {
    button.addEventListener("click", goToTodayView);
  });
  document.querySelectorAll("[data-quick-duration]").forEach((button) => {
    button.addEventListener("click", () => setQuickDuration(Number(button.dataset.quickDuration)));
  });
  document.querySelectorAll("[data-form-water-add]").forEach((button) => {
    button.addEventListener("click", () => addWaterInForm(Number(button.dataset.formWaterAdd)));
  });
  document.querySelectorAll("[data-quick-water]").forEach((button) => {
    button.addEventListener("click", () => quickAddHydration(Number(button.dataset.quickWater)));
  });
  elements.recordTypeFilter.addEventListener("change", renderRecords);
  elements.recordMonthFilter.addEventListener("change", renderRecords);
  elements.clearRecordFilters.addEventListener("click", clearRecordFilters);
  elements.recordDate.addEventListener("input", handleSharedDateInput);
  elements.addMealFood.addEventListener("click", addMealFood);
  elements.mealFoodSelect.addEventListener("change", () => {
    syncFavoriteCheckbox();
    updateMealFoodUnitState(true);
  });
  elements.mealFoodUnit.addEventListener("change", () => updateMealFoodUnitState(false));
  elements.openCustomFood.addEventListener("click", openCustomFoodDialog);
  elements.closeCustomFood.addEventListener("click", () => elements.customFoodDialog.close());
  elements.customFoodForm.addEventListener("submit", handleCustomFoodSubmit);
  elements.openRecipe.addEventListener("click", openRecipeDialog);
  elements.closeRecipe.addEventListener("click", () => elements.recipeDialog.close());
  elements.addRecipeFood.addEventListener("click", addRecipeFood);
  elements.recipeForm.addEventListener("input", renderRecipeDraft);
  elements.recipeForm.addEventListener("submit", handleRecipeSubmit);
  elements.closeDialog.addEventListener("click", requestCloseRecordDialog);
  elements.dialog.addEventListener("click", (event) => {
    if (event.target === elements.dialog) requestCloseRecordDialog();
  });
  elements.dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    requestCloseRecordDialog();
  });
  elements.dialog.addEventListener("close", () => {
    editing = null;
    activeForm = null;
    formBaseline = null;
    setFormError("");
  });
  elements.continueEditing.addEventListener("click", () => elements.discardDialog.close());
  elements.discardChanges.addEventListener("click", discardFormChanges);
  elements.undoButton.addEventListener("click", undoDelete);
  elements.downloadRaw.addEventListener("click", downloadCorruptData);
  elements.openData.addEventListener("click", openDataDialog);
  elements.openDataReminder.addEventListener("click", openDataDialog);
  elements.closeDataDialog.addEventListener("click", () => elements.dataDialog.close());
  elements.exportBackup.addEventListener("click", exportCompleteBackup);
  elements.exportAnalysis.addEventListener("click", exportAnalysisData);
  elements.importFile.addEventListener("change", handleImportFile);
  elements.confirmImport.addEventListener("click", confirmImport);
  elements.installApp.addEventListener("click", installApp);
  elements.reloadApp.addEventListener("click", () => window.location.reload());
  window.addEventListener("beforeinstallprompt", handleInstallPrompt);
}

function renderStorageState() {
  if (storageState.status === "ready" || storageState.status === "empty") {
    elements.storageAlert.hidden = true;
    document.querySelectorAll("[data-open-form]").forEach((button) => {
      button.disabled = false;
    });
    return;
  }

  elements.storageAlert.hidden = false;
  if (storageState.status === "corrupt") {
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
  renderTrends();
  renderRecords();
  renderBackupState();
}

function renderBackupState() {
  if (!data) {
    elements.backupReminder.hidden = true;
    elements.backupStatus.textContent = "当前数据不可用，可以选择有效完整备份进行恢复。";
    elements.exportBackup.disabled = true;
    elements.exportAnalysis.disabled = true;
    return;
  }
  elements.exportBackup.disabled = false;
  elements.exportAnalysis.disabled = false;
  const summary = summarizeData(data);
  const reminder = getBackupReminder(data, backupMetadata);
  elements.backupReminder.hidden = !reminder.needed;
  const messages = {
    never: "当前记录从未导出完整备份。",
    stale: "上次备份已超过 14 天。",
    manyChanges: "上次备份后已新增至少 10 条记录。",
  };
  elements.backupReminderMessage.textContent = messages[reminder.reason] ?? "";
  elements.backupStatus.textContent = backupMetadata
    ? `上次备份：${formatTimestamp(backupMetadata.lastBackupAt)} · 当时 ${backupMetadata.recordCount} 条；当前 ${summary.totalRecords} 条。`
    : `尚未备份 · 当前 ${summary.totalRecords} 条记录。`;
}

function renderToday() {
  const today = localDateString(new Date());
  const dateContext = getDateContext(selectedDate, today);
  elements.todayTitle.textContent = dateContext.heading;
  elements.hydrationAmountLabel.textContent = dateContext.hydrationLabel;
  elements.returnToday.hidden = selectedDate === today;
  renderCalendar();

  if (!data) {
    for (const element of [
      elements.workoutSummary,
      elements.activitySummary,
      elements.mealSummary,
      elements.sleepSummary,
      elements.weightSummary,
      elements.hydrationSummary,
    ]) element.textContent = "数据不可用";
    elements.streakDays.textContent = "—";
    return;
  }

  const workouts = data.workouts.filter((record) => record.date === selectedDate);
  const activity = findDailyRecord(data, "dailyActivities", selectedDate);
  const meals = data.meals.filter((record) => record.date === selectedDate);
  const sleep = findDailyRecord(data, "sleepRecords", selectedDate);
  const weight = findDailyRecord(data, "weights", selectedDate);
  const hydration = findDailyRecord(data, "hydration", selectedDate);

  elements.workoutSummary.textContent = workouts.length
    ? `${workouts.length} 次，共 ${workouts.reduce((sum, item) => sum + item.durationMinutes, 0)} 分钟`
    : "尚未记录";
  elements.activitySummary.textContent = activity ? `${activity.steps.toLocaleString("zh-CN")} 步` : "尚未记录";
  elements.mealSummary.textContent = meals.length
    ? `${meals.length} 餐 · ${formatNutrition(sumNutrition(meals.flatMap((item) => item.items)))}`
    : "尚未记录";
  elements.sleepSummary.textContent = sleep
    ? `${formatMinutes(calculateSleepMinutes(sleep.sleepTime, sleep.wakeTime))}，质量 ${sleep.qualityScore}/5`
    : "尚未记录";
  elements.weightSummary.textContent = weight ? `${formatWeight(weight.weightGrams)} kg` : "尚未记录";
  elements.hydrationSummary.textContent = hydration ? `${hydration.milliliters} ml` : "尚未记录";
  elements.sleepAction.textContent = sleep ? "编辑睡眠" : "记录睡眠";
  elements.weightAction.textContent = weight ? "编辑体重" : "记录体重";
  elements.hydrationAction.textContent = hydration ? "编辑饮水" : "记录饮水";
  elements.activityAction.textContent = activity ? "编辑步数" : "记录步数";
  const streak = calculateRecordingStreak(data, today);
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
    button.setAttribute("aria-pressed", String(entry.date === selectedDate));
    if (status.hasRecord) button.classList.add("has-record");
    button.disabled = entry.date > today || !data;
    button.setAttribute("aria-label", `${formatDisplayDate(entry.date)}，已完成 ${status.completedCount}/6 类记录`);
    const dayNumber = document.createElement("span");
    dayNumber.className = "day-number";
    dayNumber.textContent = String(Number(entry.date.slice(-2)));
    const dayStatus = document.createElement("span");
    dayStatus.className = "day-status";
    dayStatus.textContent = status.hasRecord ? `${status.completedCount}/6` : "—";
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

  const allItems = allRecordsByDate(data);
  const items = filterRecordItems(
    allItems,
    elements.recordTypeFilter.value,
    elements.recordMonthFilter.value,
  );
  const hasFilters = elements.recordTypeFilter.value !== "all" || elements.recordMonthFilter.value !== "";
  elements.clearRecordFilters.hidden = !hasFilters;
  elements.recordCount.textContent = hasFilters
    ? `${items.length}/${allItems.length} 条`
    : `${allItems.length} 条`;
  if (items.length === 0) {
    elements.recordsList.append(createEmptyRecordsState(allItems.length > 0));
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

function renderTrends() {
  const endDate = localDateString(new Date());
  if (!data) {
    elements.trendPeriodLabel.textContent = "数据不可用";
    return;
  }

  const comparison = calculateTrendComparison(data, endDate, trendDays);
  const summary = comparison.current;
  elements.trendPeriodLabel.textContent = `${summary.period.startDate} 至 ${summary.period.endDate} · 共 ${trendDays} 个自然日`;
  document.querySelectorAll("[data-trend-days]").forEach((button) => {
    button.setAttribute("aria-pressed", String(Number(button.dataset.trendDays) === trendDays));
  });
  const hasAnySamples = summary.weight.sampleCount
    + summary.sleep.sampleCount
    + summary.workout.count
    + summary.dailyActivity.sampleCount
    + summary.meal.count
    + summary.hydration.sampleCount > 0;
  elements.trendEmpty.hidden = hasAnySamples;
  elements.trendGrid.hidden = !hasAnySamples;
  elements.trendBoundary.hidden = !hasAnySamples;
  if (!hasAnySamples) return;

  elements.weightTrendSamples.textContent = `${summary.weight.sampleCount} 个样本`;
  if (summary.weight.sampleCount) {
    elements.weightTrendValue.textContent = `${formatWeight(summary.weight.latestGrams)} kg`;
    const ownChange = summary.weight.changeGrams === null
      ? "至少需要 2 次称重才能显示区间变化"
      : `区间变化 ${formatSignedWeight(summary.weight.changeGrams)} kg · 细线为 7 日均重`;
    elements.weightTrendMeta.textContent = joinComparison(
      ownChange,
      comparison.changes.weightGrams,
      (value) => `${formatSignedWeight(value)} kg`,
    );
  } else {
    elements.weightTrendValue.textContent = "暂无足够数据";
    elements.weightTrendMeta.textContent = "记录体重后显示原始值和 7 日均重";
  }
  renderWeightChart(summary.weight.points);

  elements.sleepTrendSamples.textContent = `${summary.sleep.sampleCount} 晚`;
  elements.sleepTrendValue.textContent = summary.sleep.sampleCount
    ? `平均 ${formatMinutes(summary.sleep.averageMinutes)}`
    : "暂无足够数据";
  elements.sleepTrendMeta.textContent = summary.sleep.sampleCount
    ? joinComparison(
      `平均质量 ${summary.sleep.averageQuality}/5`,
      comparison.changes.sleepMinutes,
      (value) => formatSignedUnit(value, "分钟"),
    )
    : "记录睡眠后显示时长和主观质量";

  elements.workoutTrendSamples.textContent = `${summary.workout.count} 次`;
  elements.workoutTrendValue.textContent = summary.workout.count
    ? `共 ${summary.workout.totalMinutes} 分钟`
    : "暂无足够数据";
  elements.workoutTrendMeta.textContent = summary.workout.count
    ? joinComparison(
      [
        Object.entries(summary.workout.byType).map(([type, minutes]) => `${WORKOUT_LABELS[type]} ${minutes} 分`).join(" · "),
        summary.workout.totalActiveEnergyKcal === null
          ? null
          : `活动热量 ${summary.workout.totalActiveEnergyKcal} kcal`,
        summary.workout.averageHeartRateBpm === null
          ? null
          : `平均心率 ${summary.workout.averageHeartRateBpm} bpm`,
        summary.workout.totalDistanceMeters === null
          ? null
          : `距离 ${formatDistance(summary.workout.totalDistanceMeters)}`,
        summary.workout.appleWatchCount ? `Apple Watch ${summary.workout.appleWatchCount} 次` : null,
      ].filter(Boolean).join(" · "),
      comparison.changes.workoutMinutes,
      (value) => formatSignedUnit(value, "分钟"),
    )
    : "记录运动后显示次数、时长和类型分布";

  elements.activityTrendSamples.textContent = `${summary.dailyActivity.sampleCount} 天`;
  elements.activityTrendValue.textContent = summary.dailyActivity.sampleCount
    ? `日均 ${summary.dailyActivity.averageSteps.toLocaleString("zh-CN")} 步`
    : "暂无足够数据";
  elements.activityTrendMeta.textContent = summary.dailyActivity.sampleCount
    ? joinComparison(
      `累计 ${summary.dailyActivity.totalSteps.toLocaleString("zh-CN")} 步，仅按有记录日期计算`,
      comparison.changes.dailySteps,
      (value) => formatSignedUnit(value, "步"),
    )
    : "记录 Apple Watch 当日步数后显示活动趋势";

  elements.mealTrendSamples.textContent = `${summary.meal.count} 餐`;
  elements.mealTrendValue.textContent = summary.meal.count
    ? `日均蛋白质 ${formatDecimal(summary.meal.dailyAverageNutrition.proteinGrams, 1)} g`
    : "暂无足够数据";
  elements.mealTrendMeta.textContent = summary.meal.count
    ? joinComparison(
      `日均 ${formatDecimal(summary.meal.dailyAverageNutrition.energyKcal, 1)} kcal · 脂肪 ${formatDecimal(summary.meal.dailyAverageNutrition.fatGrams, 1)} g · 碳水 ${formatDecimal(summary.meal.dailyAverageNutrition.carbsGrams, 1)} g · 精确 ${summary.meal.preciseCount} 餐／估算 ${summary.meal.estimatedCount} 餐`,
      comparison.changes.mealProteinGrams,
      (value) => formatSignedUnit(formatDecimal(value, 1), "g 蛋白质"),
    )
    : "按克记录食物后显示热量和宏量营养素";

  elements.hydrationTrendSamples.textContent = `${summary.hydration.sampleCount} 天`;
  elements.hydrationTrendValue.textContent = summary.hydration.sampleCount
    ? `日均 ${summary.hydration.averageMilliliters} ml`
    : "暂无足够数据";
  elements.hydrationTrendMeta.textContent = summary.hydration.sampleCount
    ? joinComparison(
      "仅使用有饮水记录的日期计算",
      comparison.changes.hydrationMilliliters,
      (value) => formatSignedUnit(value, "ml"),
    )
    : "记录饮水后显示有记录日期的平均值";
}

function renderWeightChart(points) {
  elements.weightChart.replaceChildren();
  if (!points.length) {
    const empty = document.createElement("div");
    empty.className = "chart-empty";
    empty.textContent = "暂无体重样本";
    elements.weightChart.append(empty);
    elements.weightChartLegend.hidden = true;
    elements.weightChartDetail.textContent = "";
    return;
  }
  elements.weightChartLegend.hidden = false;
  elements.weightChartDetail.textContent = `${points[0].date} 至 ${points.at(-1).date} · 点击数据点查看详情`;

  const width = 320;
  const height = 132;
  const padding = 18;
  const values = points.flatMap((point) => [point.weightGrams, point.movingAverageGrams]);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, 500);
  const x = (index) => points.length === 1
    ? width / 2
    : padding + index / (points.length - 1) * (width - padding * 2);
  const y = (value) => padding + (max - value + (range - (max - min)) / 2) / range * (height - padding * 2);
  const namespace = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(namespace, "svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("role", "group");
  svg.setAttribute("aria-label", `${points.length} 个体重样本及七日均重`);

  if (points.length > 1) {
    const averageLine = document.createElementNS(namespace, "polyline");
    averageLine.setAttribute("points", points.map((point, index) => `${x(index)},${y(point.movingAverageGrams)}`).join(" "));
    averageLine.setAttribute("fill", "none");
    averageLine.setAttribute("stroke", "#7ca698");
    averageLine.setAttribute("stroke-width", "2");
    svg.append(averageLine);
  }
  points.forEach((point, index) => {
    const circle = document.createElementNS(namespace, "circle");
    circle.setAttribute("cx", x(index));
    circle.setAttribute("cy", y(point.weightGrams));
    circle.setAttribute("r", "4");
    circle.setAttribute("fill", "#1f6252");
    circle.setAttribute("tabindex", "0");
    circle.setAttribute("role", "button");
    const label = `${point.date}，${formatWeight(point.weightGrams)} kg，7 日均重 ${formatWeight(point.movingAverageGrams)} kg`;
    circle.setAttribute("aria-label", label);
    const showPoint = () => {
      elements.weightChartDetail.textContent = label;
    };
    circle.addEventListener("click", showPoint);
    circle.addEventListener("focus", showPoint);
    circle.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") showPoint();
    });
    svg.append(circle);
  });
  elements.weightChart.append(svg);
}

function createEmptyRecordsState(isFiltered = false) {
  const container = document.createElement("div");
  container.className = "empty-state";
  const icon = document.createElement("span");
  icon.textContent = "＋";
  const title = document.createElement("h3");
  title.textContent = isFiltered ? "没有符合筛选的记录" : "还没有健康记录";
  const message = document.createElement("p");
  message.textContent = isFiltered ? "调整类型或月份后再看看。" : "从今日选择一类数据开始记录。";
  const action = document.createElement("button");
  action.type = "button";
  action.className = isFiltered ? "text-button" : "primary-button";
  action.textContent = isFiltered ? "显示全部记录" : "去记录";
  action.addEventListener("click", isFiltered ? clearRecordFilters : goToTodayView);
  container.append(icon, title, message, action);
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
  const more = document.createElement("details");
  more.className = "record-more";
  const summary = document.createElement("summary");
  summary.textContent = "更多";
  summary.setAttribute("aria-label", `更多${labelText.textContent}记录操作`);
  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.className = "delete-action";
  deleteButton.textContent = "删除";
  deleteButton.setAttribute("aria-label", `删除${labelText.textContent}记录`);
  deleteButton.addEventListener("click", () => handleDelete(collectionName, record.id));
  more.append(summary, deleteButton);
  actions.append(editButton, more);
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
    const metrics = [
      `${WORKOUT_LABELS[record.type]} · ${record.durationMinutes} 分钟 · 强度 ${record.intensity}/3`,
      record.source === "appleWatch" ? "Apple Watch" : "手动",
      record.activeEnergyKcal === null ? null : `${record.activeEnergyKcal} kcal`,
      record.averageHeartRateBpm === null ? null : `平均心率 ${record.averageHeartRateBpm}`,
      record.maxHeartRateBpm === null ? null : `最高心率 ${record.maxHeartRateBpm}`,
      record.distanceMeters === null ? null : formatDistance(record.distanceMeters),
      record.distanceMeters === null
        ? null
        : `配速 ${formatPace(record.durationMinutes, record.distanceMeters)}`,
    ];
    detail = metrics.filter(Boolean).join(" · ");
  } else if (collectionName === "dailyActivities") {
    detail = `${record.steps.toLocaleString("zh-CN")} 步 · ${record.source === "appleWatch" ? "Apple Watch" : "手动"}`;
  } else if (collectionName === "meals") {
    const nutrition = sumNutrition(record.items);
    detail = `${MEAL_LABELS[record.mealType]} · ${record.items.map((item) => `${item.name} ${formatFoodAmount(item)}`).join("、")} · ${formatNutrition(nutrition)} · ${record.trackingMode === "precise" ? "称重" : "估算"}／${confidenceLabel(record.confidence)}`;
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
  if (viewName === "trends") renderTrends();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function goToTodayView() {
  setSelectedDate(localDateString(new Date()));
  switchView("today");
}

function setTrendDays(days) {
  trendDays = days;
  renderTrends();
}

function clearRecordFilters() {
  elements.recordTypeFilter.value = "all";
  elements.recordMonthFilter.value = "";
  renderRecords();
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
  if (!record && ["activity", "sleep", "weight", "hydration"].includes(type)) {
    record = findDailyRecord(data, config.collectionName, selectedDate);
  }

  editing = record ? { type, record } : { type, record: null };
  document.querySelectorAll("[data-record-form]").forEach((form) => {
    form.hidden = form.dataset.recordForm !== type;
    form.reset();
  });
  const form = document.querySelector(`[data-record-form="${type}"]`);
  activeForm = form;
  mealItemsDraft = type === "meal" ? structuredClone(record?.items ?? []) : [];
  elements.recordDate.value = record?.date ?? selectedDate;
  elements.dialogTitle.textContent = `${record ? "编辑" : "新增"}${config.label}`;
  setFormError("");
  fillForm(type, form, record);
  if (type === "meal") {
    populateFoodSelects();
    renderMealDraft();
    syncFavoriteCheckbox();
    updateMealConfidenceState();
  }
  updateFormContext();
  updateSleepDurationPreview();
  updateWorkoutFieldState(false);
  updateWorkoutPacePreview();
  formBaseline = getFormSignature();
  elements.dialog.showModal();
  form.querySelector("input, select, textarea")?.focus();
}

function fillForm(type, form, record) {
  if (!record) {
    if (type === "sleep") {
      form.elements.sleepTime.value = "23:00";
      form.elements.wakeTime.value = "07:00";
    } else if (type === "meal") {
      form.elements.mealType.value = getDefaultMealType(new Date().getHours());
      form.elements.trackingMode.value = "precise";
      form.elements.confidence.value = "medium";
    } else if (type === "workout") {
      form.elements.source.value = "manual";
    } else if (type === "activity") {
      form.elements.source.value = "appleWatch";
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
  if (type === "workout") {
    form.elements.distanceKm.value = record.distanceMeters === null
      ? ""
      : formatDecimal(record.distanceMeters / 1_000, 3);
  }
}

function handleFormInput(event) {
  if (editing?.type === "meal" && event?.target?.name === "trackingMode") {
    activeForm.elements.confidence.value = "medium";
    updateMealConfidenceState();
  }
  if (editing?.type === "workout" && event?.target?.name === "type") {
    updateWorkoutFieldState(true);
  }
  updateFormContext();
  updateSleepDurationPreview();
  updateWorkoutPacePreview();
}

function updateMealConfidenceState() {
  if (editing?.type !== "meal" || !activeForm) return;
  const lowOption = activeForm.elements.confidence.querySelector('option[value="low"]');
  const isPrecise = activeForm.elements.trackingMode.value === "precise";
  lowOption.disabled = isPrecise;
  if (isPrecise && activeForm.elements.confidence.value === "low") {
    activeForm.elements.confidence.value = "medium";
  }
}

function handleSharedDateInput() {
  updateFormContext();
}

function updateFormContext() {
  const value = elements.recordDate.value || selectedDate;
  elements.hydrationAmountLabel.textContent = getDateContext(
    value,
    localDateString(new Date()),
  ).hydrationLabel;
}

function updateSleepDurationPreview() {
  if (editing?.type !== "sleep" || !activeForm) return;
  const sleepTime = activeForm.elements.sleepTime.value;
  const wakeTime = activeForm.elements.wakeTime.value;
  if (!sleepTime || !wakeTime) {
    elements.sleepDurationPreview.textContent = "填写完整时间后显示预计睡眠时长";
    return;
  }
  try {
    elements.sleepDurationPreview.textContent = `预计睡眠：${formatMinutes(calculateSleepMinutes(sleepTime, wakeTime))}`;
  } catch {
    elements.sleepDurationPreview.textContent = "入睡和起床时间不能相同";
  }
}

function updateWorkoutPacePreview() {
  if (editing?.type !== "workout" || !activeForm) return;
  const durationMinutes = Number(activeForm.elements.durationMinutes.value);
  const distanceKm = Number(activeForm.elements.distanceKm.value);
  if (!durationMinutes || !distanceKm) {
    elements.workoutPacePreview.textContent = "填写时长和距离后显示平均配速";
    return;
  }
  try {
    elements.workoutPacePreview.textContent = `平均配速：${formatPace(durationMinutes, Math.round(distanceKm * 1_000))}`;
  } catch {
    elements.workoutPacePreview.textContent = "请输入有效的整数时长和距离";
  }
}

function updateWorkoutFieldState(clearUnsupported) {
  if (editing?.type !== "workout" || !activeForm) return;
  const supportsDistance = ["running", "walking", "cardio"].includes(
    activeForm.elements.type.value,
  );
  elements.workoutDistanceField.hidden = !supportsDistance;
  elements.workoutPacePreview.hidden = !supportsDistance;
  if (!supportsDistance && clearUnsupported) {
    activeForm.elements.distanceKm.value = "";
  }
}

function setQuickDuration(minutes) {
  if (editing?.type !== "workout" || !activeForm) return;
  activeForm.elements.durationMinutes.value = String(minutes);
  activeForm.elements.durationMinutes.focus();
}

function addWaterInForm(amount) {
  if (editing?.type !== "hydration" || !activeForm) return;
  try {
    const current = Number(activeForm.elements.milliliters.value || 0);
    activeForm.elements.milliliters.value = String(addHydrationAmount(current, amount));
    activeForm.elements.milliliters.focus();
    setFormError("");
  } catch (error) {
    setFormError(error.message || "无法增加饮水量");
  }
}

function quickAddHydration(amount) {
  if (!data) return;
  const existing = findDailyRecord(data, "hydration", selectedDate);
  const now = new Date().toISOString();
  try {
    const record = {
      id: existing?.id ?? createId(),
      date: selectedDate,
      milliliters: addHydrationAmount(existing?.milliliters ?? 0, amount),
      note: existing?.note ?? "",
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    const next = saveRecord(data, "hydration", record);
    saveData(next);
    data = next;
    renderAll();
    showToast(`饮水已增加 ${amount} ml`);
  } catch (error) {
    showToast(error.message || "饮水记录失败");
  }
}

function populateFoodSelects(selectedMealRef = elements.mealFoodSelect.value) {
  if (!data) return;
  populateFoodSelect(elements.mealFoodSelect, getFoodCatalog(data), selectedMealRef);
  populateFoodSelect(elements.recipeFoodSelect, getFoodCatalog(data, { includeRecipes: false }));
  updateMealFoodUnitState(elements.mealFoodSelect.value === "builtin:egg-boiled");
}

function populateFoodSelect(select, catalog, selectedRef = "") {
  select.replaceChildren();
  for (const food of catalog) {
    const option = document.createElement("option");
    option.value = food.ref;
    const pieceHint = food.pieceGrams
      ? ` · 1 个≈${data.settings.eggGramsPerPiece}g`
      : "";
    option.textContent = `${favoritePrefix(food.ref)}${food.name} · ${foodStateLabel(food.foodState)}${pieceHint} · 蛋白质 ${formatDecimal(food.proteinGramsPer100g, 1)}g/100g`;
    select.append(option);
  }
  if (selectedRef && catalog.some((food) => food.ref === selectedRef)) select.value = selectedRef;
}

function addMealFood() {
  if (!data || editing?.type !== "meal" || !activeForm) return;
  try {
    const food = selectedFood(elements.mealFoodSelect, true);
    const inputQuantity = Number(elements.mealFoodQuantity.value);
    const inputUnit = elements.mealFoodUnit.value;
    const unitGrams = inputUnit === "piece"
      ? Number(elements.eggGramsPerPiece.value)
      : 1;
    const confidence = activeForm.elements.confidence.value;
    const entry = createFoodEntry(
      food,
      inputQuantity,
      confidence,
      createId(),
      inputUnit,
      unitGrams,
    );
    let next = data;
    if (inputUnit === "piece" && unitGrams !== data.settings.eggGramsPerPiece) {
      next = updateEggGramsPerPiece(next, unitGrams);
    }
    next = updateFoodPreferences(
      next,
      food.ref,
      elements.mealFoodFavorite.checked,
    );
    saveData(next);
    data = next;
    mealItemsDraft.push(entry);
    elements.mealFoodQuantity.value = "";
    populateFoodSelects(food.ref);
    syncFavoriteCheckbox();
    renderMealDraft();
    setFormError("");
  } catch (error) {
    setFormError(error.message || "无法加入食物");
  }
}

function renderMealDraft() {
  renderFoodEntries(elements.mealItems, mealItemsDraft, (id) => {
    mealItemsDraft = mealItemsDraft.filter((item) => item.id !== id);
    renderMealDraft();
  });
  elements.mealNutrition.textContent = mealItemsDraft.length
    ? `本餐估算：${formatNutrition(sumNutrition(mealItemsDraft))}`
    : "尚未添加食物";
}

function renderFoodEntries(container, entries, remove) {
  container.replaceChildren();
  for (const entry of entries) {
    const item = document.createElement("li");
    item.className = "food-item";
    const detail = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = entry.inputUnit === "piece"
      ? `${entry.name} · ${entry.inputQuantity} 个（${entry.grams} g）`
      : `${entry.name} · ${entry.grams} g`;
    const nutrition = document.createElement("span");
    nutrition.textContent = formatNutrition(sumNutrition([entry]));
    detail.append(title, nutrition);
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "移除";
    button.setAttribute("aria-label", `移除${entry.name}`);
    button.addEventListener("click", () => remove(entry.id));
    item.append(detail, button);
    container.append(item);
  }
}

function syncFavoriteCheckbox() {
  if (!data) return;
  elements.mealFoodFavorite.checked = data.foodPreferences.favoriteRefs.includes(
    elements.mealFoodSelect.value,
  );
}

function updateMealFoodUnitState(preferPiece) {
  if (!data) return;
  const food = getFoodCatalog(data).find((item) => item.ref === elements.mealFoodSelect.value);
  const pieceOption = elements.mealFoodUnit.querySelector('option[value="piece"]');
  const supportsPiece = Number.isInteger(food?.pieceGrams);
  pieceOption.disabled = !supportsPiece;
  if (!supportsPiece) elements.mealFoodUnit.value = "grams";
  else if (preferPiece) elements.mealFoodUnit.value = "piece";
  const usesPiece = supportsPiece && elements.mealFoodUnit.value === "piece";
  elements.eggPieceWeightField.hidden = !usesPiece;
  elements.eggGramsPerPiece.value = String(data.settings.eggGramsPerPiece);
  elements.mealFoodQuantityLabel.textContent = usesPiece ? "实际食用（个）" : "实际食用（克）";
  elements.mealFoodQuantity.max = usesPiece ? "50" : "100000";
}

function openCustomFoodDialog() {
  elements.customFoodForm.reset();
  setInlineError(elements.customFoodError, "");
  elements.customFoodDialog.showModal();
  elements.customFoodForm.elements.name.focus();
}

function handleCustomFoodSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const now = new Date().toISOString();
  try {
    const food = {
      id: createId(),
      name: form.elements.name.value.trim(),
      foodState: form.elements.foodState.value,
      energyKcalPer100g: oneDecimal(form.elements.energyKcalPer100g.value),
      proteinGramsPer100g: oneDecimal(form.elements.proteinGramsPer100g.value),
      fatGramsPer100g: oneDecimal(form.elements.fatGramsPer100g.value),
      carbsGramsPer100g: oneDecimal(form.elements.carbsGramsPer100g.value),
      createdAt: now,
      updatedAt: now,
    };
    const next = saveCustomFood(data, food);
    saveData(next);
    data = next;
    const ref = `custom:${food.id}`;
    populateFoodSelects(ref);
    syncFavoriteCheckbox();
    elements.customFoodDialog.close();
    showToast(`${food.name}已加入本地食物库`);
  } catch (error) {
    setInlineError(elements.customFoodError, error.message || "食品保存失败");
  }
}

function openRecipeDialog() {
  elements.recipeForm.reset();
  recipeIngredientsDraft = [];
  setInlineError(elements.recipeError, "");
  populateFoodSelect(elements.recipeFoodSelect, getFoodCatalog(data, { includeRecipes: false }));
  renderRecipeDraft();
  elements.recipeDialog.showModal();
  elements.recipeForm.elements.name.focus();
}

function addRecipeFood() {
  try {
    const food = selectedFood(elements.recipeFoodSelect, false);
    const entry = createFoodEntry(food, Number(elements.recipeFoodGrams.value), "high", createId());
    recipeIngredientsDraft.push(entry);
    elements.recipeFoodGrams.value = "";
    renderRecipeDraft();
    setInlineError(elements.recipeError, "");
  } catch (error) {
    setInlineError(elements.recipeError, error.message || "无法加入原料");
  }
}

function renderRecipeDraft() {
  renderFoodEntries(elements.recipeItems, recipeIngredientsDraft, (id) => {
    recipeIngredientsDraft = recipeIngredientsDraft.filter((item) => item.id !== id);
    renderRecipeDraft();
  });
  const finishedWeightGrams = Number(elements.recipeForm.elements.finishedWeightGrams.value);
  if (!recipeIngredientsDraft.length || !Number.isInteger(finishedWeightGrams) || finishedWeightGrams < 1) {
    elements.recipeNutrition.textContent = "添加原料并填写成品熟重后计算";
    return;
  }
  try {
    const result = calculateRecipeNutrition({ ingredients: recipeIngredientsDraft, finishedWeightGrams });
    elements.recipeNutrition.textContent = `整道菜：${formatNutrition(result.total)}；每 100g：${formatNutrition(result.per100g)}`;
  } catch (error) {
    elements.recipeNutrition.textContent = error.message;
  }
}

function handleRecipeSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const now = new Date().toISOString();
  try {
    if (!recipeIngredientsDraft.length) throw new TypeError("请至少加入一种原料");
    const recipe = {
      id: createId(),
      name: form.elements.name.value.trim(),
      ingredients: structuredClone(recipeIngredientsDraft),
      finishedWeightGrams: Number(form.elements.finishedWeightGrams.value),
      createdAt: now,
      updatedAt: now,
    };
    calculateRecipeNutrition(recipe);
    const next = saveRecipe(data, recipe);
    saveData(next);
    data = next;
    const ref = `recipe:${recipe.id}`;
    populateFoodSelects(ref);
    syncFavoriteCheckbox();
    elements.recipeDialog.close();
    showToast(`${recipe.name}菜谱已保存`);
  } catch (error) {
    setInlineError(elements.recipeError, error.message || "菜谱保存失败");
  }
}

function selectedFood(select, includeRecipes) {
  const food = getFoodCatalog(data, { includeRecipes }).find((item) => item.ref === select.value);
  if (!food) throw new TypeError("请选择有效食物");
  return food;
}

function favoritePrefix(foodRef) {
  return data?.foodPreferences.favoriteRefs.includes(foodRef) ? "★ " : "";
}

function foodStateLabel(state) {
  return { raw: "生重", cooked: "熟重", packaged: "包装", prepared: "成品" }[state] ?? state;
}

function setInlineError(element, message) {
  element.textContent = message;
  element.hidden = !message;
}

function oneDecimal(value) {
  return Math.round(Number(value) * 10) / 10;
}

function getFormSignature() {
  if (!activeForm) return "";
  const fields = [elements.recordDate, ...activeForm.querySelectorAll("input, select, textarea")];
  const value = fields.map((field) => `${field.name || field.id}:${field.value}`).join("|");
  return editing?.type === "meal" ? `${value}|items:${JSON.stringify(mealItemsDraft)}` : value;
}

function requestCloseRecordDialog() {
  if (!activeForm || getFormSignature() === formBaseline) {
    elements.dialog.close();
    return;
  }
  if (!elements.discardDialog.open) elements.discardDialog.showModal();
}

function discardFormChanges() {
  elements.discardDialog.close();
  elements.dialog.close();
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
      source: form.elements.source.value,
      activeEnergyKcal: nullableInteger(form.elements.activeEnergyKcal.value),
      averageHeartRateBpm: nullableInteger(form.elements.averageHeartRateBpm.value),
      maxHeartRateBpm: nullableInteger(form.elements.maxHeartRateBpm.value),
      distanceMeters: form.elements.distanceKm.value === ""
        ? null
        : Math.round(Number(form.elements.distanceKm.value) * 1_000),
      note: form.elements.note.value.trim(),
    };
  }
  if (type === "activity") {
    return {
      ...base,
      steps: Number(form.elements.steps.value),
      source: form.elements.source.value,
      note: form.elements.note.value.trim(),
    };
  }
  if (type === "meal") {
    if (!mealItemsDraft.length) throw new TypeError("请至少加入一种食物");
    const confidence = form.elements.confidence.value;
    return {
      ...base,
      mealType: form.elements.mealType.value,
      trackingMode: form.elements.trackingMode.value,
      confidence,
      items: mealItemsDraft.map((item) => ({ ...item, confidence })),
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
  if (!storageState.raw) return;
  downloadText(storageState.raw, `healthlife-corrupt-${localDateString(new Date())}.json`);
}

function openDataDialog() {
  pendingImport = null;
  elements.importFile.value = "";
  elements.importPreview.hidden = true;
  setImportError("");
  renderBackupState();
  elements.dataDialog.showModal();
  elements.closeDataDialog.focus();
}

function exportCompleteBackup() {
  if (!data) return;
  const now = new Date().toISOString();
  const summary = summarizeData(data);
  try {
    downloadText(
      serializeCompleteBackup(data, now),
      `healthlife-backup-${localDateString(new Date())}.json`,
    );
    backupMetadata = createBackupMetadata(now, summary.totalRecords);
    try {
      saveBackupMetadata(backupMetadata);
    } catch {
      backupMetadata = null;
      renderBackupState();
      showToast("备份已导出，但提醒状态保存失败");
      return;
    }
    renderBackupState();
    showToast("完整备份已导出");
  } catch (error) {
    showToast(error.message || "备份导出失败");
  }
}

function exportAnalysisData() {
  if (!data) return;
  try {
    downloadText(
      serializeAnalysisExport(data, new Date().toISOString()),
      `healthlife-analysis-${localDateString(new Date())}.json`,
    );
    showToast("分析 JSON 已导出");
  } catch (error) {
    showToast(error.message || "分析数据导出失败");
  }
}

async function handleImportFile() {
  pendingImport = null;
  elements.importPreview.hidden = true;
  setImportError("");
  const file = elements.importFile.files[0];
  if (!file) return;
  try {
    const result = parseCompleteBackup(await file.text());
    pendingImport = { ...result, fileName: file.name };
    renderImportPreview();
  } catch (error) {
    setImportError(error.message || "无法读取备份文件");
  }
}

function renderImportPreview() {
  const { backup, summary, fileName } = pendingImport;
  elements.importFileName.textContent = fileName;
  elements.importExportedAt.textContent = formatTimestamp(backup.exportedAt);
  elements.importDateRange.textContent = summary.firstDate
    ? `${summary.firstDate} 至 ${summary.lastDate}`
    : "空账本";
  elements.importTotal.textContent = `${summary.totalRecords} 条`;
  elements.importCounts.textContent = `运动 ${summary.counts.workouts}、每日活动 ${summary.counts.dailyActivities}、饮食 ${summary.counts.meals}、睡眠 ${summary.counts.sleepRecords}、体重 ${summary.counts.weights}、饮水 ${summary.counts.hydration}；自定义食品 ${backup.data.customFoods.length}、菜谱 ${backup.data.recipes.length}`;
  const currentCount = data ? summarizeData(data).totalRecords : 0;
  const restoreLabel = getRestoreLabel(currentCount, summary.totalRecords);
  elements.importReplaceSummary.textContent = restoreLabel.summary;
  elements.confirmImport.textContent = restoreLabel.action;
  elements.importPreview.hidden = false;
}

function confirmImport() {
  if (!pendingImport) return;
  const now = new Date().toISOString();
  try {
    if (data && summarizeData(data).totalRecords > 0) {
      downloadText(
        serializeCompleteBackup(data, now),
        `healthlife-before-restore-${localDateString(new Date())}.json`,
      );
    } else if (storageState.status === "corrupt" && storageState.raw) {
      downloadText(storageState.raw, `healthlife-corrupt-before-restore-${localDateString(new Date())}.json`);
    }
    saveData(pendingImport.backup.data);
    data = pendingImport.backup.data;
    storageState = { status: "ready", data, raw: null, error: null };
    backupMetadata = createBackupMetadata(now, pendingImport.summary.totalRecords);
    try {
      saveBackupMetadata(backupMetadata);
    } catch {
      backupMetadata = null;
    }
    elements.dataDialog.close();
    renderStorageState();
    renderAll();
    showToast(`已恢复 ${pendingImport.summary.totalRecords} 条记录`);
    pendingImport = null;
  } catch (error) {
    setImportError(error.message || "恢复失败，当前数据未改变");
  }
}

function setImportError(message) {
  elements.importError.textContent = message;
  elements.importError.hidden = !message;
}

function handleInstallPrompt(event) {
  event.preventDefault();
  installPromptEvent = event;
  elements.installApp.hidden = false;
}

async function installApp() {
  if (!installPromptEvent) return;
  try {
    await installPromptEvent.prompt();
    await installPromptEvent.userChoice;
  } catch {
    showToast("暂时无法安装，请使用浏览器菜单添加到主屏幕");
  } finally {
    installPromptEvent = null;
    elements.installApp.hidden = true;
  }
}

function downloadText(text, fileName) {
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function formatTimestamp(value) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatMinutes(minutes) {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (hours === 0) return `${remainder} 分钟`;
  return remainder === 0 ? `${hours} 小时` : `${hours} 小时 ${remainder} 分`;
}

function formatDistance(meters) {
  return `${formatDecimal(meters / 1_000, 3)} km`;
}

function formatFoodAmount(entry) {
  return entry.inputUnit === "piece"
    ? `${entry.inputQuantity} 个（${entry.grams}g）`
    : `${entry.grams}g`;
}

function formatPace(durationMinutes, distanceMeters) {
  const secondsPerKilometer = calculatePaceSecondsPerKilometer(
    durationMinutes,
    distanceMeters,
  );
  const minutes = Math.floor(secondsPerKilometer / 60);
  const seconds = String(secondsPerKilometer % 60).padStart(2, "0");
  return `${minutes}:${seconds} 分／km`;
}

function formatWeight(grams) {
  return formatDecimal(grams / 1_000, 3);
}

function formatBodyFat(basisPoints) {
  return formatDecimal(basisPoints / 100, 2);
}

function confidenceLabel(value) {
  return { high: "较高可信度", medium: "中等可信度", low: "较低可信度" }[value] ?? value;
}

function formatSignedWeight(grams) {
  const value = grams / 1_000;
  return `${value > 0 ? "+" : ""}${formatDecimal(value, 3)}`;
}

function joinComparison(base, value, formatter) {
  if (value === null) return `${base} · 上一周期暂无可比样本`;
  if (value === 0) return `${base} · 较上一周期持平`;
  return `${base} · 较上一周期 ${formatter(value)}`;
}

function formatSignedUnit(value, unit) {
  return `${value > 0 ? "+" : ""}${value} ${unit}`;
}

function formatDecimal(value, digits) {
  return value.toFixed(digits).replace(/\.?0+$/, "");
}

function nullableInteger(value) {
  return value === "" ? null : Number(value);
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
