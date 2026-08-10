import {
  calculateSleepMinutes,
  createId,
  createEmptyData,
} from "./model.js?v=28";
import {
  allRecordsByDate,
  deleteFood,
  deleteRecord,
  findDailyRecord,
  reorderFoods,
  saveFood,
  saveRecord,
  updateWeeklyTraining,
} from "./data.js?v=28";
import {
  clearWorkoutUndoHistory,
  clearWorkoutDraft,
  loadBackupMetadata,
  loadData,
  loadWorkoutDraft,
  loadWorkoutUndoHistory,
  saveBackupMetadata,
  saveData,
  saveWorkoutDraft,
  saveWorkoutUndoHistory,
} from "./storage.js?v=28";
import {
  getCalendarLabel,
  getDailyStatus,
  getMonthGrid,
  getWeekDates,
  shiftCalendarAnchor,
} from "./calendar.js?v=28";
import { calculateTrendComparison, countWorkoutDaysInMonth } from "./stats.js?v=28";
import {
  createBackupMetadata,
  getBackupReminder,
  parseCompleteBackup,
  serializeCompleteBackup,
  summarizeData,
} from "./backup.js?v=28";
import {
  calculatePaceSecondsPerKilometer,
  calculateVisibilityScroll,
  createWorkoutRepeatValues,
  filterRecordItems,
  getDateContext,
  getDefaultMealType,
  getDefaultWorkoutScenario,
  getLatestWorkoutForScenario,
  getRestoreLabel,
} from "./interaction.js?v=28";
import { serializeAnalysisExport } from "./analysis.js?v=28";
import {
  completeWorkoutSet,
  createWorkoutUndoHistory,
  createGuidedSessionSnapshot,
  createWorkoutDraft,
  DISCOMFORT_BODY_PART_LABELS,
  estimateWorkoutDurationMinutes,
  EXERCISE_LIBRARY,
  EXERCISE_REPLACEMENTS,
  getWorkoutStep,
  GUIDED_TEMPLATES,
  popWorkoutUndoSnapshot,
  pushWorkoutUndoSnapshot,
  recommendedTemplateId,
  replaceWorkoutExercise,
  skipWorkoutExercise,
  workoutDraftProgress,
} from "./guided-workout.js?v=28";
import {
  createProgressionAdvice,
  getExerciseHistory,
  summarizeWorkoutDiscomfort,
} from "./training-insights.js?v=28";
import {
  buildMealContent,
  calculateDailyProteinSummary,
  calculateFoodProteinMilligrams,
  calculateMealProteinSummary,
  createMealFoodSnapshot,
  foodFromMealSnapshot,
  formatFoodAmount,
  formatProteinGrams,
} from "./nutrition.js?v=28";

const TYPE_CONFIG = Object.freeze({
  workout: { collectionName: "workouts", label: "运动" },
  meal: { collectionName: "meals", label: "饮食" },
  sleep: { collectionName: "sleepRecords", label: "睡眠" },
  weight: { collectionName: "weights", label: "体重" },
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

const WORKOUT_SCENARIO_LABELS = Object.freeze({
  keep: "Keep 跟练",
  running: "跑步",
  other: "其他运动",
  guided: "备用文字训练",
});

const MEAL_LABELS = Object.freeze({
  breakfast: "早餐",
  lunch: "午餐",
  dinner: "晚餐",
  snack: "加餐",
});

const TRAINING_PLAN_LABELS = Object.freeze({
  strengthA: "力量 A",
  strengthB: "力量 B",
  runWalk: "跑走结合",
  rest: "休息",
});

const FOOD_CATEGORY_LABELS = Object.freeze({
  protein: "肉蛋豆类",
  staple: "主食",
  vegetable: "蔬菜",
  fruit: "水果",
  dairy: "奶类",
  drink: "饮品",
  other: "其他",
});

const FOOD_UNIT_LABELS = Object.freeze({
  grams: "克",
  milliliters: "毫升",
  piece: "个",
  serving: "份",
});

const FOOD_BASIS_LABELS = Object.freeze({
  raw: "生重",
  cooked: "熟重",
  edible: "可食部分",
  packaged: "包装份量",
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
let pendingDiscardAction = null;
let weeklyPlanBaseline = null;
let foodFormBaseline = null;
let foodDialogViewportBaseline = null;
let foodVisibilityFrame = null;
let mealSelections = [];
let pendingFoodDeletion = null;
let workoutDraftState = loadWorkoutDraft();
let workoutDraft = workoutDraftState.draft;
let workoutUndoState = loadWorkoutUndoHistory(workoutDraft);
let workoutUndoHistory = workoutUndoState.history
  ?? (workoutDraft ? createWorkoutUndoHistory(workoutDraft) : null);
let workoutRestTimer = null;
let workoutRestEndsAt = null;

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
  selectedTrainingLabel: document.querySelector("#selected-training-label"),
  monthWorkoutLabel: document.querySelector("#month-workout-label"),
  monthWorkoutDays: document.querySelector("#month-workout-days"),
  returnToday: document.querySelector("#return-today"),
  previousPeriod: document.querySelector("#previous-period"),
  nextPeriod: document.querySelector("#next-period"),
  calendarLabel: document.querySelector("#calendar-label"),
  calendarGrid: document.querySelector("#calendar-grid"),
  toggleCalendar: document.querySelector("#toggle-calendar"),
  planHeadline: document.querySelector("#plan-headline"),
  planDetail: document.querySelector("#plan-detail"),
  recordPlannedWorkout: document.querySelector("#record-planned-workout"),
  startGuidedWorkout: document.querySelector("#start-guided-workout"),
  workoutSummary: document.querySelector("#workout-summary"),
  mealSummary: document.querySelector("#meal-summary"),
  mealFoodEmpty: document.querySelector("#meal-food-empty"),
  mealFoodOptions: document.querySelector("#meal-food-options"),
  mealSelectedFoods: document.querySelector("#meal-selected-foods"),
  mealProteinPreview: document.querySelector("#meal-protein-preview"),
  manageFoodsFromMeal: document.querySelector("#manage-foods-from-meal"),
  sleepSummary: document.querySelector("#sleep-summary"),
  weightSummary: document.querySelector("#weight-summary"),
  sleepAction: document.querySelector("#sleep-action"),
  weightAction: document.querySelector("#weight-action"),
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
  mealTrendSamples: document.querySelector("#meal-trend-samples"),
  mealTrendValue: document.querySelector("#meal-trend-value"),
  mealTrendMeta: document.querySelector("#meal-trend-meta"),
  recordsList: document.querySelector("#records-list"),
  recordCount: document.querySelector("#record-count"),
  recordTypeFilter: document.querySelector("#record-type-filter"),
  recordMonthFilter: document.querySelector("#record-month-filter"),
  clearRecordFilters: document.querySelector("#clear-record-filters"),
  dialog: document.querySelector("#record-dialog"),
  dialogTitle: document.querySelector("#dialog-title"),
  closeDialog: document.querySelector("#close-dialog"),
  recordDate: document.querySelector("#record-date"),
  sleepDurationPreview: document.querySelector("#sleep-duration-preview"),
  workoutGuidedEditNote: document.querySelector("#workout-guided-edit-note"),
  workoutScenarioPicker: document.querySelector("#workout-scenario-picker"),
  repeatLastWorkout: document.querySelector("#repeat-last-workout"),
  repeatLastWorkoutMeta: document.querySelector("#repeat-last-workout-meta"),
  workoutKeepFields: document.querySelector("#workout-keep-fields"),
  workoutRunningFields: document.querySelector("#workout-running-fields"),
  workoutOtherFields: document.querySelector("#workout-other-fields"),
  workoutSourceField: document.querySelector("#workout-source-field"),
  workoutAverageHeartRateField: document.querySelector("#workout-average-heart-rate-field"),
  keepDiscomfortFields: document.querySelector("#keep-discomfort-fields"),
  workoutPacePreview: document.querySelector("#workout-pace-preview"),
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
  weeklyPlanForm: document.querySelector("#weekly-plan-form"),
  weeklyPlanError: document.querySelector("#weekly-plan-error"),
  foodList: document.querySelector("#food-list"),
  foodListEmpty: document.querySelector("#food-list-empty"),
  addFood: document.querySelector("#add-food"),
  foodDialog: document.querySelector("#food-dialog"),
  closeFoodDialog: document.querySelector("#close-food-dialog"),
  foodForm: document.querySelector("#food-form"),
  foodFormFields: document.querySelector("#food-form-fields"),
  foodFormTitle: document.querySelector("#food-form-title"),
  foodProteinFields: document.querySelector("#food-protein-fields"),
  foodProteinUnit: document.querySelector("#food-protein-unit"),
  foodSourceDetails: document.querySelector("#food-source-details"),
  foodFormError: document.querySelector("#food-form-error"),
  cancelFoodEdit: document.querySelector("#cancel-food-edit"),
  deleteFoodDialog: document.querySelector("#delete-food-dialog"),
  deleteFoodDialogMessage: document.querySelector("#delete-food-dialog-message"),
  cancelDeleteFood: document.querySelector("#cancel-delete-food"),
  confirmDeleteFood: document.querySelector("#confirm-delete-food"),
  guidedWorkoutDialog: document.querySelector("#guided-workout-dialog"),
  guidedWorkoutTitle: document.querySelector("#guided-workout-title"),
  closeGuidedWorkout: document.querySelector("#close-guided-workout"),
  workoutDraftActions: document.querySelector("#workout-draft-actions"),
  undoWorkoutAction: document.querySelector("#undo-workout-action"),
  abandonWorkout: document.querySelector("#abandon-workout"),
  abandonWorkoutDialog: document.querySelector("#abandon-workout-dialog"),
  cancelAbandonWorkout: document.querySelector("#cancel-abandon-workout"),
  confirmAbandonWorkout: document.querySelector("#confirm-abandon-workout"),
  finishWorkoutDialog: document.querySelector("#finish-workout-dialog"),
  cancelFinishWorkout: document.querySelector("#cancel-finish-workout"),
  confirmFinishWorkout: document.querySelector("#confirm-finish-workout"),
  workoutTemplateChooser: document.querySelector("#workout-template-chooser"),
  workoutTemplateList: document.querySelector("#workout-template-list"),
  workoutActiveStage: document.querySelector("#workout-active-stage"),
  workoutExerciseProgress: document.querySelector("#workout-exercise-progress"),
  workoutSetProgress: document.querySelector("#workout-set-progress"),
  workoutProgress: document.querySelector("#workout-progress"),
  workoutEquipment: document.querySelector("#workout-equipment"),
  workoutExerciseName: document.querySelector("#workout-exercise-name"),
  workoutSetup: document.querySelector("#workout-setup"),
  workoutCues: document.querySelector("#workout-cues"),
  workoutMistakes: document.querySelector("#workout-mistakes"),
  workoutStopCondition: document.querySelector("#workout-stop-condition"),
  workoutReplacementField: document.querySelector("#workout-replacement-field"),
  workoutExerciseReplacement: document.querySelector("#workout-exercise-replacement"),
  workoutHistory: document.querySelector("#workout-history"),
  workoutProgressionAdvice: document.querySelector("#workout-progression-advice"),
  workoutCompletedValueLabel: document.querySelector("#workout-completed-value-label"),
  workoutCompletedValue: document.querySelector("#workout-completed-value"),
  workoutWeightField: document.querySelector("#workout-weight-field"),
  workoutWeightLabel: document.querySelector("#workout-weight-label"),
  workoutWeight: document.querySelector("#workout-weight"),
  workoutStageError: document.querySelector("#workout-stage-error"),
  completeWorkoutSet: document.querySelector("#complete-workout-set"),
  skipWorkoutExercise: document.querySelector("#skip-workout-exercise"),
  finishWorkoutEarly: document.querySelector("#finish-workout-early"),
  workoutRestStage: document.querySelector("#workout-rest-stage"),
  workoutRestCountdown: document.querySelector("#workout-rest-countdown"),
  workoutNextStep: document.querySelector("#workout-next-step"),
  skipWorkoutRest: document.querySelector("#skip-workout-rest"),
  workoutSummaryStage: document.querySelector("#workout-summary-stage"),
  workoutSummaryList: document.querySelector("#workout-summary-list"),
  workoutPerceivedEffort: document.querySelector("#workout-perceived-effort"),
  workoutSummaryError: document.querySelector("#workout-summary-error"),
  confirmGuidedWorkout: document.querySelector("#confirm-guided-workout"),
};

initialize();

function initialize() {
  const today = localDateString(new Date());
  elements.recordDate.max = today;
  elements.recordMonthFilter.max = today.slice(0, 7);
  elements.recordDate.value = selectedDate;
  populateWeeklyPlanOptions();
  bindEvents();
  renderStorageState();
  renderAll();
  reconcileWorkoutDraft();
  registerServiceWorker();
  if (storageState.migratedFromVersion !== null && storageState.status === "ready") {
    showToast(`现有 v${storageState.migratedFromVersion} 数据已安全升级，原数据仍保留`);
  }
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    const hadController = Boolean(navigator.serviceWorker.controller);
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (hadController) elements.appUpdate.hidden = false;
    });
    navigator.serviceWorker.register("./sw.js?v=28").then((registration) => {
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
  elements.recordTypeFilter.addEventListener("change", renderRecords);
  elements.recordMonthFilter.addEventListener("change", renderRecords);
  elements.clearRecordFilters.addEventListener("click", clearRecordFilters);
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
  elements.continueEditing.addEventListener("click", () => {
    pendingDiscardAction = null;
    elements.discardDialog.close();
  });
  elements.discardChanges.addEventListener("click", discardFormChanges);
  elements.undoButton.addEventListener("click", undoDelete);
  elements.downloadRaw.addEventListener("click", downloadCorruptData);
  elements.openData.addEventListener("click", openDataDialog);
  elements.openDataReminder.addEventListener("click", openDataDialog);
  elements.closeDataDialog.addEventListener("click", requestCloseDataDialog);
  elements.exportBackup.addEventListener("click", exportCompleteBackup);
  elements.exportAnalysis.addEventListener("click", exportAnalysisData);
  elements.importFile.addEventListener("change", handleImportFile);
  elements.confirmImport.addEventListener("click", confirmImport);
  elements.installApp.addEventListener("click", installApp);
  elements.reloadApp.addEventListener("click", () => window.location.reload());
  elements.weeklyPlanForm.addEventListener("submit", handleWeeklyPlanSubmit);
  elements.addFood.addEventListener("click", () => openFoodForm());
  elements.foodForm.addEventListener("submit", handleFoodSubmit);
  elements.foodForm.addEventListener("focusin", handleFoodFormFocus);
  elements.foodForm.elements.proteinEnabled.addEventListener("change", updateFoodProteinFields);
  elements.foodForm.elements.unit.addEventListener("change", updateFoodProteinUnit);
  elements.closeFoodDialog.addEventListener("click", closeFoodForm);
  elements.cancelFoodEdit.addEventListener("click", closeFoodForm);
  elements.manageFoodsFromMeal.addEventListener("click", openFoodSettingsFromMeal);
  elements.cancelDeleteFood.addEventListener("click", closeDeleteFoodDialog);
  elements.confirmDeleteFood.addEventListener("click", confirmFoodDeletion);
  elements.deleteFoodDialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeDeleteFoodDialog();
  });
  elements.startGuidedWorkout.addEventListener("click", openGuidedWorkout);
  elements.repeatLastWorkout.addEventListener("click", repeatLastWorkout);
  elements.closeGuidedWorkout.addEventListener("click", closeGuidedWorkout);
  elements.undoWorkoutAction.addEventListener("click", undoWorkoutAction);
  elements.abandonWorkout.addEventListener("click", requestAbandonWorkout);
  elements.cancelAbandonWorkout.addEventListener("click", () => elements.abandonWorkoutDialog.close());
  elements.confirmAbandonWorkout.addEventListener("click", confirmAbandonWorkout);
  elements.cancelFinishWorkout.addEventListener("click", () => elements.finishWorkoutDialog.close());
  elements.confirmFinishWorkout.addEventListener("click", finishWorkoutEarly);
  elements.completeWorkoutSet.addEventListener("click", handleCompleteWorkoutSet);
  elements.workoutExerciseReplacement.addEventListener("change", handleWorkoutReplacement);
  elements.skipWorkoutExercise.addEventListener("click", handleSkipWorkoutExercise);
  elements.finishWorkoutEarly.addEventListener("click", requestFinishWorkoutEarly);
  elements.skipWorkoutRest.addEventListener("click", finishWorkoutRest);
  elements.confirmGuidedWorkout.addEventListener("click", confirmGuidedWorkout);
  elements.guidedWorkoutDialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeGuidedWorkout();
  });
  bindGuardedDialog(elements.dataDialog, requestCloseDataDialog);
  bindGuardedDialog(elements.foodDialog, closeFoodForm);
  window.visualViewport?.addEventListener("resize", syncFoodDialogViewport);
  window.visualViewport?.addEventListener("scroll", syncFoodDialogViewport);
  window.addEventListener("resize", syncFoodDialogViewport);
  window.addEventListener("beforeinstallprompt", handleInstallPrompt);
}

function renderStorageState() {
  if (isStorageWritable()) {
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
  } else if (storageState.status === "migrationFailed") {
    elements.storageAlertTitle.textContent = `v${storageState.migratedFromVersion} 数据升级写入失败，当前为只读`;
    elements.storageAlertMessage.textContent = `原 v${storageState.migratedFromVersion} 数据仍完整保留。请先下载原始内容并检查浏览器可用空间，再刷新重试。`;
    elements.downloadRaw.hidden = false;
  } else {
    elements.storageAlertTitle.textContent = "浏览器本地存储不可用";
    elements.storageAlertMessage.textContent = "当前无法安全读取或保存健康记录，请检查浏览器隐私设置。";
  }
  document.querySelectorAll("[data-open-form]").forEach((button) => {
    button.disabled = true;
  });
}

function isStorageWritable() {
  return storageState.status === "ready" || storageState.status === "empty";
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
    never: "当前数据从未导出完整备份。",
    stale: "上次备份已超过 14 天。",
    manyChanges: "上次备份后已新增至少 10 条记录。",
    settingsChanges: "常用食材、健康阶段或每周模板在上次备份后发生了变化。",
  };
  elements.backupReminderMessage.textContent = messages[reminder.reason] ?? "";
  elements.backupStatus.textContent = backupMetadata
    ? `上次备份：${formatTimestamp(backupMetadata.lastBackupAt)} · 当时 ${backupMetadata.recordCount} 条；当前 ${summary.totalRecords} 条记录。`
    : `尚未备份 · 当前 ${summary.totalRecords} 条记录。`;
}

function renderToday() {
  const today = localDateString(new Date());
  const isFuture = selectedDate > today;
  const dateContext = getDateContext(selectedDate, today);
  const selectedMonth = selectedDate.slice(0, 7);
  elements.todayTitle.textContent = dateContext.heading;
  elements.monthWorkoutLabel.textContent = `${Number(selectedMonth.slice(5, 7))}月运动`;
  elements.monthWorkoutDays.textContent = data
    ? `${countWorkoutDaysInMonth(data, selectedMonth)} 天`
    : "不可用";
  elements.returnToday.hidden = selectedDate === today;
  renderCalendar();
  renderTrainingRecommendation();
  document.querySelectorAll("[data-open-form]").forEach((button) => {
    button.disabled = isFuture || !data || !isStorageWritable();
    button.title = isFuture ? "未来日期不能记录健康数据" : "";
  });
  elements.startGuidedWorkout.disabled = (!workoutDraft && isFuture) || !data || !isStorageWritable();
  elements.startGuidedWorkout.title = !workoutDraft && isFuture ? "未来日期不能开始训练" : "";

  if (!data) {
    for (const element of [
      elements.workoutSummary,
      elements.mealSummary,
      elements.sleepSummary,
      elements.weightSummary,
    ]) element.textContent = "数据不可用";
    return;
  }

  const workouts = data.workouts.filter((record) => record.date === selectedDate);
  const meals = data.meals.filter((record) => record.date === selectedDate);
  const protein = calculateDailyProteinSummary(data.meals, selectedDate);
  const sleep = findDailyRecord(data, "sleepRecords", selectedDate);
  const weight = findDailyRecord(data, "weights", selectedDate);

  elements.workoutSummary.textContent = workouts.length
    ? `${workouts.length} 次，共 ${workouts.reduce((sum, item) => sum + item.durationMinutes, 0)} 分钟`
    : "尚未记录";
  if (!meals.length) {
    elements.mealSummary.textContent = "尚未记录";
  } else if (protein.estimatedProteinMilligrams === 0) {
    elements.mealSummary.textContent = `${meals.length} 餐 · 尚无蛋白质估算`;
  } else {
    const incompleteMeals = protein.partialMealCount + protein.unestimatedMealCount;
    elements.mealSummary.textContent = `${meals.length} 餐 · 已估 ${formatProteinGrams(protein.estimatedProteinMilligrams)} g${
      incompleteMeals ? ` · ${incompleteMeals} 餐未完整估算` : ""
    }`;
  }
  elements.sleepSummary.textContent = sleep
    ? `${formatMinutes(calculateSleepMinutes(sleep.sleepTime, sleep.wakeTime))}，质量 ${sleep.qualityScore}/5`
    : "尚未记录";
  elements.weightSummary.textContent = weight ? `${formatWeight(weight.weightGrams)} kg` : "尚未记录";
  if (isFuture) {
    for (const element of [
      elements.workoutSummary,
      elements.mealSummary,
      elements.sleepSummary,
      elements.weightSummary,
    ]) element.textContent = "未来日期不能记录";
  }
  elements.sleepAction.textContent = sleep ? "编辑睡眠" : "记录睡眠";
  elements.weightAction.textContent = weight ? "编辑体重" : "记录体重";
}

function renderTrainingRecommendation() {
  if (!data) {
    elements.selectedTrainingLabel.textContent = "计划不可用";
    elements.selectedTrainingLabel.dataset.planType = "unavailable";
    elements.planHeadline.textContent = "无法读取训练模板";
    elements.planDetail.textContent = "";
    elements.recordPlannedWorkout.textContent = "记录不可用";
    elements.startGuidedWorkout.textContent = "备用文字训练不可用";
    elements.startGuidedWorkout.disabled = true;
    return;
  }
  const plannedType = getTrainingPlanForDate(selectedDate);
  elements.selectedTrainingLabel.textContent = TRAINING_PLAN_LABELS[plannedType];
  elements.selectedTrainingLabel.dataset.planType = plannedType === "rest" ? "rest" : "training";
  elements.planHeadline.textContent = TRAINING_PLAN_LABELS[plannedType];
  elements.planDetail.textContent = plannedType === "rest"
    ? "今天按模板休息；实际有运动时仍可照常记录。"
    : "完成后按实际情况记录；课程视频继续由 Keep 提供。";
  elements.recordPlannedWorkout.textContent = plannedType === "rest"
    ? "记录实际运动"
    : "记录实际训练";
  elements.startGuidedWorkout.textContent = workoutDraft
    ? `继续备用文字训练：${GUIDED_TEMPLATES[workoutDraft.templateId].name}`
    : "备用文字训练";
}

function getTrainingPlanForDate(date) {
  const dayIndex = (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7;
  return data.weeklyTraining[dayIndex];
}

function reconcileWorkoutDraft() {
  if (workoutDraft && data?.workouts.some(
    (record) => record.guidedSession?.id === workoutDraft.id,
  )) {
    try {
      clearWorkoutDraft();
      clearWorkoutUndoHistory();
      workoutDraft = null;
      workoutUndoHistory = null;
      workoutDraftState = { status: "empty", draft: null, error: null };
    } catch {
      showToast("训练记录已存在，但旧训练草稿清理失败");
    }
  } else if (workoutDraftState.status === "corrupt") {
    showToast("上次训练草稿已损坏，无法继续；开始新训练后会覆盖该草稿");
  } else if (workoutDraftState.status === "unavailable") {
    showToast("训练进度存储不可用，暂时不能开始引导训练");
  } else if (workoutUndoState.status === "corrupt") {
    workoutUndoHistory = workoutDraft ? createWorkoutUndoHistory(workoutDraft) : null;
    showToast("训练进度可以继续，但旧撤销历史已损坏，无法恢复上一步");
  } else if (workoutUndoState.status === "unavailable") {
    workoutUndoHistory = workoutDraft ? createWorkoutUndoHistory(workoutDraft) : null;
    showToast("训练进度可以继续，但当前无法保存撤销历史");
  }
  renderToday();
}

function openGuidedWorkout() {
  if (!data || workoutDraftState.status === "unavailable") return;
  stopWorkoutRestTimer();
  elements.guidedWorkoutDialog.showModal();
  if (workoutDraft) {
    renderWorkoutStep();
  } else {
    renderWorkoutTemplateChooser();
  }
}

function closeGuidedWorkout() {
  stopWorkoutRestTimer();
  elements.guidedWorkoutDialog.close();
  renderToday();
}

function persistWorkoutDraftTransition(nextDraft) {
  if (!workoutDraft) throw new TypeError("当前没有进行中的训练");
  const previousHistory = workoutUndoHistory ?? createWorkoutUndoHistory(workoutDraft);
  const nextHistory = pushWorkoutUndoSnapshot(previousHistory, workoutDraft);
  saveWorkoutUndoHistory(nextHistory);
  try {
    saveWorkoutDraft(nextDraft);
  } catch (error) {
    try {
      saveWorkoutUndoHistory(previousHistory);
    } catch {}
    throw error;
  }
  workoutDraft = nextDraft;
  workoutUndoHistory = nextHistory;
  workoutUndoState = { status: "ready", history: nextHistory, error: null };
}

function undoWorkoutAction() {
  if (!workoutDraft || !workoutUndoHistory?.snapshots.length) return;
  const previousHistory = workoutUndoHistory;
  try {
    const result = popWorkoutUndoSnapshot(workoutUndoHistory, workoutDraft);
    saveWorkoutUndoHistory(result.history);
    try {
      saveWorkoutDraft(result.draft);
    } catch (error) {
      try {
        saveWorkoutUndoHistory(previousHistory);
      } catch {}
      throw error;
    }
    workoutDraft = result.draft;
    workoutUndoHistory = result.history;
    workoutUndoState = { status: "ready", history: result.history, error: null };
    elements.finishWorkoutDialog.close();
    stopWorkoutRestTimer();
    renderWorkoutStep();
    renderToday();
    showToast("已撤销上一步训练操作");
  } catch (error) {
    setInlineError(elements.workoutStageError, error.message || "无法撤销上一步");
  }
}

function requestAbandonWorkout() {
  if (!workoutDraft) return;
  elements.abandonWorkoutDialog.showModal();
}

function confirmAbandonWorkout() {
  if (!workoutDraft) return;
  try {
    clearWorkoutDraft();
    try {
      clearWorkoutUndoHistory();
    } catch {}
    workoutDraft = null;
    workoutUndoHistory = null;
    workoutDraftState = { status: "empty", draft: null, error: null };
    workoutUndoState = { status: "empty", history: null, error: null };
    elements.abandonWorkoutDialog.close();
    elements.guidedWorkoutDialog.close();
    stopWorkoutRestTimer();
    renderToday();
    showToast("本次训练已放弃，正式记录未受影响");
  } catch (error) {
    showToast(error.message || "无法放弃本次训练");
  }
}

function renderWorkoutTemplateChooser() {
  showWorkoutStage("chooser");
  elements.guidedWorkoutTitle.textContent = "选择训练";
  elements.workoutTemplateList.replaceChildren();
  const dayIndex = (new Date(`${selectedDate}T00:00:00Z`).getUTCDay() + 6) % 7;
  const plannedType = data.weeklyTraining[dayIndex];
  const recommendedId = recommendedTemplateId(plannedType);
  for (const template of Object.values(GUIDED_TEMPLATES)) {
    const card = document.createElement("article");
    card.className = "workout-template-card";
    if (template.id === recommendedId) card.classList.add("recommended");
    const content = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = template.name;
    const description = document.createElement("span");
    description.textContent = template.description;
    content.append(title, description);
    if (template.id === recommendedId) {
      const badge = document.createElement("span");
      badge.className = "workout-template-badge";
      badge.textContent = "符合当天计划";
      content.append(badge);
    }
    const start = document.createElement("button");
    start.type = "button";
    start.textContent = "开始";
    start.addEventListener("click", () => startWorkoutTemplate(template.id));
    card.append(content, start);
    elements.workoutTemplateList.append(card);
  }
}

function startWorkoutTemplate(templateId) {
  try {
    const now = new Date().toISOString();
    const next = createWorkoutDraft({
      templateId,
      date: selectedDate,
      id: createId(),
      now,
    });
    clearWorkoutUndoHistory();
    saveWorkoutDraft(next);
    workoutDraft = next;
    workoutUndoHistory = createWorkoutUndoHistory(next);
    workoutUndoState = { status: "ready", history: workoutUndoHistory, error: null };
    workoutDraftState = { status: "ready", draft: next, error: null };
    renderWorkoutStep();
    renderToday();
  } catch (error) {
    showToast(error.message || "训练无法开始");
  }
}

function renderWorkoutStep() {
  if (!workoutDraft) return renderWorkoutTemplateChooser();
  const step = getWorkoutStep(workoutDraft);
  if (step.complete) {
    renderWorkoutSummary();
    return;
  }
  showWorkoutStage("active");
  elements.guidedWorkoutTitle.textContent = step.template.name;
  const progress = workoutDraftProgress(workoutDraft);
  elements.workoutExerciseProgress.textContent =
    `动作 ${progress.currentExercise}/${progress.totalExercises}`;
  elements.workoutSetProgress.textContent =
    `第 ${workoutDraft.currentSetIndex + 1}/${step.prescription.sets} 组`;
  elements.workoutProgress.max = progress.totalSets;
  elements.workoutProgress.value = progress.completedSets;
  elements.workoutEquipment.textContent = `器材：${step.exercise.equipment}`;
  elements.workoutExerciseName.textContent = step.exercise.name;
  elements.workoutSetup.textContent = step.exercise.setup;
  replaceTextList(elements.workoutCues, step.exercise.cues);
  replaceTextList(elements.workoutMistakes, step.exercise.mistakes);
  elements.workoutStopCondition.textContent = step.exercise.stopCondition;
  renderWorkoutReplacement(step);
  renderExerciseHistory(step.exercise.id);
  elements.workoutCompletedValueLabel.textContent =
    `本组完成${step.exercise.unitLabel}（目标 ${step.prescription.targetValue}）`;
  elements.workoutCompletedValue.value = String(step.prescription.targetValue);
  elements.workoutWeightField.hidden = !step.exercise.weightEnabled;
  elements.workoutWeightLabel.textContent = step.exercise.weightLabel ?? "本组负重（kg，可选）";
  elements.workoutWeight.value = latestExerciseWeightKg(step.exercise.id);
  setInlineError(elements.workoutStageError, "");
}

function renderWorkoutReplacement(step) {
  const replacementIds = EXERCISE_REPLACEMENTS[step.plannedExercise.id] ?? [];
  const canReplace = workoutDraft.currentSetIndex === 0 && replacementIds.length > 0;
  elements.workoutReplacementField.hidden = !canReplace;
  elements.workoutExerciseReplacement.replaceChildren();
  if (!canReplace) return;
  for (const exerciseId of [step.plannedExercise.id, ...replacementIds]) {
    const option = document.createElement("option");
    option.value = exerciseId;
    option.textContent = exerciseId === step.plannedExercise.id
      ? `${EXERCISE_LIBRARY[exerciseId].name}（原计划）`
      : `${EXERCISE_LIBRARY[exerciseId].name}（替代）`;
    option.selected = exerciseId === step.exercise.id;
    elements.workoutExerciseReplacement.append(option);
  }
}

function renderExerciseHistory(exerciseId) {
  const history = getExerciseHistory(data.workouts, exerciseId, 3);
  elements.workoutHistory.replaceChildren();
  if (history.length === 0) {
    elements.workoutHistory.textContent = "暂无同动作记录。";
  } else {
    for (const item of history) {
      const line = document.createElement("span");
      const exercise = EXERCISE_LIBRARY[exerciseId];
      const setSummary = item.sets.map((set) => {
        const weight = set.weightGrams === null
          ? ""
          : `，${formatDecimal(set.weightGrams / 1_000, 1)} kg`;
        return `${set.completedValue} ${exercise.unitLabel}${weight}`;
      }).join("；");
      const discomfort = item.discomfort === null
        ? ""
        : ` · ${DISCOMFORT_BODY_PART_LABELS[item.discomfort.bodyPart]}不适 ${item.discomfort.severity}/3`;
      line.textContent = `${formatDisplayDate(item.date)} · ${setSummary}${discomfort}`;
      elements.workoutHistory.append(line);
    }
  }
  elements.workoutProgressionAdvice.textContent =
    createProgressionAdvice(history, exerciseId).text;
}

function handleWorkoutReplacement() {
  if (!workoutDraft) return;
  try {
    const next = replaceWorkoutExercise(
      workoutDraft,
      elements.workoutExerciseReplacement.value,
      new Date().toISOString(),
    );
    saveWorkoutDraft(next);
    workoutDraft = next;
    renderWorkoutStep();
  } catch (error) {
    setInlineError(elements.workoutStageError, error.message || "动作替换失败");
  }
}

function replaceTextList(element, values) {
  element.replaceChildren();
  for (const value of values) {
    const item = document.createElement("li");
    item.textContent = value;
    element.append(item);
  }
}

function latestExerciseWeightKg(exerciseId) {
  const latest = [...workoutDraft.completedSets].reverse().find(
    (set) => set.exerciseId === exerciseId && set.weightGrams !== null,
  );
  return latest ? formatDecimal(latest.weightGrams / 1_000, 1) : "";
}

function handleCompleteWorkoutSet() {
  if (!workoutDraft) return;
  try {
    const currentStep = getWorkoutStep(workoutDraft);
    const completedValue = Number(elements.workoutCompletedValue.value);
    const weightGrams = elements.workoutWeightField.hidden || elements.workoutWeight.value === ""
      ? null
      : Math.round(Number(elements.workoutWeight.value) * 1_000);
    const next = completeWorkoutSet(workoutDraft, {
      completedValue,
      weightGrams,
      now: new Date().toISOString(),
    });
    persistWorkoutDraftTransition(next);
    setInlineError(elements.workoutStageError, "");
    if (getWorkoutStep(next).complete) {
      renderWorkoutSummary();
    } else {
      startWorkoutRest(currentStep.prescription.restSeconds);
    }
  } catch (error) {
    setInlineError(elements.workoutStageError, error.message || "本组保存失败");
  }
}

function handleSkipWorkoutExercise() {
  if (!workoutDraft) return;
  try {
    const next = skipWorkoutExercise(workoutDraft, new Date().toISOString());
    persistWorkoutDraftTransition(next);
    renderWorkoutStep();
  } catch (error) {
    setInlineError(elements.workoutStageError, error.message || "动作无法跳过");
  }
}

function requestFinishWorkoutEarly() {
  if (!workoutDraft) return;
  elements.finishWorkoutDialog.showModal();
}

function finishWorkoutEarly() {
  if (!workoutDraft) return;
  try {
    let next = workoutDraft;
    const now = new Date().toISOString();
    while (!getWorkoutStep(next).complete) {
      next = skipWorkoutExercise(next, now);
    }
    persistWorkoutDraftTransition(next);
    elements.finishWorkoutDialog.close();
    renderWorkoutSummary();
  } catch (error) {
    setInlineError(elements.workoutStageError, error.message || "无法结束训练");
  }
}

function startWorkoutRest(seconds) {
  stopWorkoutRestTimer();
  showWorkoutStage("rest");
  const nextStep = getWorkoutStep(workoutDraft);
  elements.workoutNextStep.textContent =
    `接下来：${nextStep.exercise.name}，第 ${workoutDraft.currentSetIndex + 1} 组`;
  workoutRestEndsAt = Date.now() + seconds * 1_000;
  updateWorkoutRestCountdown();
  workoutRestTimer = setInterval(updateWorkoutRestCountdown, 1_000);
}

function updateWorkoutRestCountdown() {
  const remaining = Math.max(0, Math.ceil((workoutRestEndsAt - Date.now()) / 1_000));
  const minutes = String(Math.floor(remaining / 60)).padStart(2, "0");
  const seconds = String(remaining % 60).padStart(2, "0");
  elements.workoutRestCountdown.textContent = `${minutes}:${seconds}`;
  if (remaining === 0) finishWorkoutRest();
}

function finishWorkoutRest() {
  stopWorkoutRestTimer();
  renderWorkoutStep();
}

function stopWorkoutRestTimer() {
  if (workoutRestTimer !== null) clearInterval(workoutRestTimer);
  workoutRestTimer = null;
  workoutRestEndsAt = null;
}

function renderWorkoutSummary() {
  stopWorkoutRestTimer();
  showWorkoutStage("summary");
  const snapshot = createGuidedSessionSnapshot(
    workoutDraft,
    Number(elements.workoutPerceivedEffort.value),
    new Date().toISOString(),
  );
  elements.guidedWorkoutTitle.textContent = "训练总结";
  elements.workoutSummaryList.replaceChildren();
  for (const exercise of snapshot.exercises) {
    const item = document.createElement("article");
    item.className = "workout-summary-item";
    const title = document.createElement("strong");
    title.textContent = exercise.name;
    const detail = document.createElement("span");
    const unitLabel = EXERCISE_LIBRARY[exercise.exerciseId].unitLabel;
    detail.textContent = exercise.sets.length
      ? exercise.sets.map((set) =>
        `${set.completedValue} ${unitLabel}${set.weightGrams === null ? "" : `，${formatDecimal(set.weightGrams / 1_000, 1)} kg`}`
      ).join("；")
      : "已跳过";
    item.append(title, detail);
    if (exercise.status !== "skipped") {
      item.append(createWorkoutFeedbackControls(exercise.plannedExerciseId));
    }
    elements.workoutSummaryList.append(item);
  }
  setInlineError(
    elements.workoutSummaryError,
    workoutDraft.completedSets.length ? "" : "尚未完成任何一组，不能生成运动记录。",
  );
  elements.confirmGuidedWorkout.disabled = workoutDraft.completedSets.length === 0;
}

function createWorkoutFeedbackControls(plannedExerciseId) {
  const container = document.createElement("div");
  container.className = "workout-feedback";
  container.dataset.plannedExerciseId = plannedExerciseId;
  const partLabel = document.createElement("label");
  partLabel.textContent = "动作后不适（可选）";
  const partSelect = document.createElement("select");
  partSelect.dataset.feedbackPart = plannedExerciseId;
  const none = document.createElement("option");
  none.value = "";
  none.textContent = "未记录";
  partSelect.append(none);
  const noDiscomfort = document.createElement("option");
  noDiscomfort.value = "none";
  noDiscomfort.textContent = "没有不适";
  partSelect.append(noDiscomfort);
  for (const [value, label] of Object.entries(DISCOMFORT_BODY_PART_LABELS)) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    partSelect.append(option);
  }
  partLabel.append(partSelect);
  const severityLabel = document.createElement("label");
  severityLabel.textContent = "程度";
  severityLabel.hidden = true;
  const severitySelect = document.createElement("select");
  severitySelect.dataset.feedbackSeverity = plannedExerciseId;
  for (const [value, label] of [["1", "轻微"], ["2", "明显"], ["3", "严重"]]) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = `${value}/3 · ${label}`;
    severitySelect.append(option);
  }
  severityLabel.append(severitySelect);
  partSelect.addEventListener("change", () => {
    severityLabel.hidden = partSelect.value === "" || partSelect.value === "none";
  });
  container.append(partLabel, severityLabel);
  return container;
}

function collectWorkoutFeedback() {
  const feedback = {};
  elements.workoutSummaryList.querySelectorAll("[data-planned-exercise-id]").forEach((container) => {
    const plannedExerciseId = container.dataset.plannedExerciseId;
    const bodyPart = container.querySelector("[data-feedback-part]").value;
    if (bodyPart === "") return;
    if (bodyPart === "none") {
      feedback[plannedExerciseId] = "none";
      return;
    }
    feedback[plannedExerciseId] = {
      bodyPart,
      severity: Number(container.querySelector("[data-feedback-severity]").value),
    };
  });
  return feedback;
}

function confirmGuidedWorkout() {
  if (!workoutDraft || !data) return;
  const completedAt = new Date().toISOString();
  try {
    if (!workoutDraft.completedSets.length) throw new TypeError("请至少完成一组训练");
    const perceivedEffort = Number(elements.workoutPerceivedEffort.value);
    const guidedSession = createGuidedSessionSnapshot(
      workoutDraft,
      perceivedEffort,
      completedAt,
      collectWorkoutFeedback(),
    );
    const workoutType = guidedSession.templateId === "stairBeginner"
      ? "cardio"
      : guidedSession.templateId === "runWalk"
        ? "running"
        : "strength";
    const workout = {
      id: createId(),
      date: workoutDraft.date,
      scenario: "guided",
      type: workoutType,
      durationMinutes: estimateWorkoutDurationMinutes(workoutDraft, completedAt),
      intensity: perceivedEffort,
      source: "manual",
      averageHeartRateBpm: null,
      distanceMeters: null,
      keepDetails: null,
      guidedSession,
      note: "",
      createdAt: completedAt,
      updatedAt: completedAt,
    };
    const next = saveRecord(data, "workouts", workout);
    saveData(next);
    data = next;
    try {
      clearWorkoutDraft();
      clearWorkoutUndoHistory();
    } catch {
      showToast("运动记录已保存，但训练草稿或撤销历史清理失败");
    }
    workoutDraft = null;
    workoutUndoHistory = null;
    workoutDraftState = { status: "empty", draft: null, error: null };
    workoutUndoState = { status: "empty", history: null, error: null };
    selectedDate = workout.date;
    calendarAnchor = workout.date;
    elements.guidedWorkoutDialog.close();
    renderAll();
    showToast("训练记录已保存");
  } catch (error) {
    setInlineError(elements.workoutSummaryError, error.message || "训练记录保存失败");
  }
}

function showWorkoutStage(name) {
  elements.workoutTemplateChooser.hidden = name !== "chooser";
  elements.workoutActiveStage.hidden = name !== "active";
  elements.workoutRestStage.hidden = name !== "rest";
  elements.workoutSummaryStage.hidden = name !== "summary";
  elements.workoutDraftActions.hidden = !workoutDraft;
  elements.undoWorkoutAction.hidden = !workoutDraft
    || !workoutUndoHistory?.snapshots.length;
  elements.undoWorkoutAction.textContent = name === "summary" ? "返回修改" : "撤销上一步";
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
  elements.nextPeriod.disabled = false;

  for (const entry of entries) {
    const status = data ? getDailyStatus(data, entry.date) : { completedCount: 0, hasRecord: false };
    const button = document.createElement("button");
    button.type = "button";
    button.className = "calendar-day";
    if (!entry.inCurrentMonth) button.classList.add("outside-month");
    if (entry.date === selectedDate) button.classList.add("selected");
    button.setAttribute("aria-pressed", String(entry.date === selectedDate));
    if (status.hasRecord) button.classList.add("has-record");
    button.disabled = !data;
    button.setAttribute(
      "aria-label",
      `${formatDisplayDate(entry.date)}，已完成 ${status.completedCount}/4 类记录`,
    );
    const dayNumber = document.createElement("span");
    dayNumber.className = "day-number";
    dayNumber.textContent = String(Number(entry.date.slice(-2)));
    const dayStatus = document.createElement("span");
    dayStatus.className = "day-status";
    dayStatus.textContent = status.hasRecord ? `${status.completedCount}/4` : "—";
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
    + summary.meal.count > 0;
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
  if (summary.workout.count) {
    const discomfort = summarizeWorkoutDiscomfort(
      data.workouts,
      summary.period.startDate,
      summary.period.endDate,
    );
    const discomfortDetail = discomfort.count
      ? `已记录动作后不适 ${discomfort.count} 次（明显及以上 ${discomfort.moderateOrHigher} 次）：${
        Object.entries(discomfort.byBodyPart).map(
          ([bodyPart, count]) => `${DISCOMFORT_BODY_PART_LABELS[bodyPart]} ${count} 次`,
        ).join(" · ")
      }`
      : "已记录动作后不适 0 次；未填写不代表没有不适";
    renderExpandableTrendMeta(
      elements.workoutTrendMeta,
      joinComparison(
        Object.entries(summary.workout.byType).map(
          ([type, minutes]) => `${WORKOUT_LABELS[type]} ${minutes} 分`,
        ).join(" · "),
        comparison.changes.workoutMinutes,
        (value) => formatSignedUnit(value, "分钟"),
      ),
      [
        summary.workout.averageHeartRateBpm === null
          ? null
          : `平均心率 ${summary.workout.averageHeartRateBpm} bpm`,
        summary.workout.totalDistanceMeters === null
          ? null
          : `距离 ${formatDistance(summary.workout.totalDistanceMeters)}`,
        summary.workout.appleWatchCount ? `Apple Watch ${summary.workout.appleWatchCount} 次` : null,
        discomfortDetail,
      ].filter(Boolean).join(" · "),
    );
  } else {
    elements.workoutTrendMeta.textContent = "记录运动后显示次数、时长和类型分布";
  }

  elements.mealTrendSamples.textContent = `${summary.meal.count} 餐`;
  elements.mealTrendValue.textContent = summary.meal.count
    ? `${summary.meal.recordedDays} 天有记录`
    : "暂无足够数据";
  if (summary.meal.count) {
    elements.mealTrendMeta.textContent = joinComparison(
      `覆盖 ${summary.meal.completionPercent}% 的日期`,
      comparison.changes.mealCompletionPoints,
      (value) => formatSignedUnit(value, "百分点"),
    );
  } else {
    elements.mealTrendMeta.textContent = "用文字记录每餐后显示记录覆盖情况";
  }

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
    const hitTarget = document.createElementNS(namespace, "circle");
    hitTarget.setAttribute("cx", x(index));
    hitTarget.setAttribute("cy", y(point.weightGrams));
    hitTarget.setAttribute("r", "22");
    hitTarget.setAttribute("fill", "transparent");
    hitTarget.setAttribute("tabindex", "0");
    hitTarget.setAttribute("role", "button");
    const circle = document.createElementNS(namespace, "circle");
    circle.setAttribute("cx", x(index));
    circle.setAttribute("cy", y(point.weightGrams));
    circle.setAttribute("r", "4");
    circle.setAttribute("fill", "#1f6252");
    const label = `${point.date}，${formatWeight(point.weightGrams)} kg，7 日均重 ${formatWeight(point.movingAverageGrams)} kg`;
    hitTarget.setAttribute("aria-label", label);
    const showPoint = () => {
      elements.weightChartDetail.textContent = label;
    };
    hitTarget.addEventListener("click", showPoint);
    hitTarget.addEventListener("focus", showPoint);
    hitTarget.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") showPoint();
    });
    svg.append(hitTarget, circle);
  });
  elements.weightChart.append(svg);
}

function renderExpandableTrendMeta(element, summary, details) {
  element.replaceChildren();
  const summaryText = document.createElement("span");
  summaryText.textContent = summary;
  element.append(summaryText);
  if (!details) return;
  const detailText = document.createElement("span");
  detailText.className = "trend-extra";
  detailText.textContent = details;
  detailText.hidden = true;
  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "trend-detail-toggle";
  toggle.textContent = "更多指标";
  toggle.setAttribute("aria-expanded", "false");
  toggle.addEventListener("click", () => {
    detailText.hidden = !detailText.hidden;
    toggle.textContent = detailText.hidden ? "更多指标" : "收起指标";
    toggle.setAttribute("aria-expanded", String(!detailText.hidden));
  });
  element.append(toggle, detailText);
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
  editButton.disabled = !isStorageWritable();
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
  deleteButton.disabled = !isStorageWritable();
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
    const keepDetail = record.keepDetails === null
      ? null
      : [
        record.keepDetails.courseName,
        record.keepDetails.completed ? "完整完成" : "缩短完成",
        record.keepDetails.equipmentWeightGrams === null
          ? null
          : `器械 ${formatDecimal(record.keepDetails.equipmentWeightGrams / 1_000, 1)} kg`,
        record.keepDetails.feedbackRecorded && record.keepDetails.discomfort === null
          ? "没有不适"
          : record.keepDetails.discomfort === null
            ? null
            : `${DISCOMFORT_BODY_PART_LABELS[record.keepDetails.discomfort.bodyPart]}不适 ${record.keepDetails.discomfort.severity}/3`,
      ].filter(Boolean).join(" · ");
    const metrics = [
      WORKOUT_SCENARIO_LABELS[record.scenario],
      keepDetail,
      record.scenario === "running"
        ? `${record.durationMinutes} 分钟 · 强度 ${record.intensity}/3`
        : `${WORKOUT_LABELS[record.type]} · ${record.durationMinutes} 分钟 · 强度 ${record.intensity}/3`,
      ["keep", "running"].includes(record.scenario)
        ? record.source === "appleWatch" ? "Apple Watch" : "手动"
        : null,
      record.averageHeartRateBpm === null ? null : `平均心率 ${record.averageHeartRateBpm}`,
      record.distanceMeters === null ? null : formatDistance(record.distanceMeters),
      record.distanceMeters === null
        ? null
        : `配速 ${formatPace(record.durationMinutes, record.distanceMeters)}`,
      record.guidedSession === null
        ? null
        : `${record.guidedSession.templateName} · ${record.guidedSession.exercises
          .filter((exercise) => exercise.status !== "skipped")
          .map((exercise) => `${exercise.name} ${exercise.sets.length} 组`)
          .join("、")}`,
    ];
    detail = metrics.filter(Boolean).join(" · ");
  } else if (collectionName === "meals") {
    const protein = calculateMealProteinSummary(record.foodItems, record.freeText);
    const estimate = protein.estimatedItemCount
      ? ` · 蛋白质约 ${formatProteinGrams(protein.estimatedProteinMilligrams)} g${protein.unestimatedItemCount ? `，另有 ${protein.unestimatedItemCount} 项未估算` : ""}`
      : " · 蛋白质未估算";
    detail = `${MEAL_LABELS[record.mealType]} · ${record.content}${estimate}`;
  } else if (collectionName === "sleepRecords") {
    detail = `${record.sleepTime}–${record.wakeTime} · ${formatMinutes(calculateSleepMinutes(record.sleepTime, record.wakeTime))} · 质量 ${record.qualityScore}/5`;
  } else if (collectionName === "weights") {
    detail = `${formatWeight(record.weightGrams)} kg${record.bodyFatBasisPoints === null ? "" : ` · 体脂 ${formatBodyFat(record.bodyFatBasisPoints)}％`}`;
  }
  return collectionName === "meals" || !record.note ? detail : `${detail} · ${record.note}`;
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

function populateWeeklyPlanOptions() {
  for (const select of elements.weeklyPlanForm.querySelectorAll("select")) {
    select.replaceChildren();
    for (const [value, label] of Object.entries(TRAINING_PLAN_LABELS)) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      select.append(option);
    }
  }
}

function renderWeeklyPlanForm() {
  for (const field of elements.weeklyPlanForm.querySelectorAll("select, button")) {
    field.disabled = !data || !isStorageWritable();
  }
  if (!data) {
    weeklyPlanBaseline = formSignature(elements.weeklyPlanForm);
    return;
  }
  data.weeklyTraining.forEach((type, index) => {
    elements.weeklyPlanForm.elements[`day${index}`].value = type;
  });
  setInlineError(elements.weeklyPlanError, "");
  weeklyPlanBaseline = formSignature(elements.weeklyPlanForm);
}

function handleWeeklyPlanSubmit(event) {
  event.preventDefault();
  if (!data || !isStorageWritable()) return;
  const weeklyTraining = Array.from(
    { length: 7 },
    (_, index) => event.currentTarget.elements[`day${index}`].value,
  );
  try {
    const next = updateWeeklyTraining(data, weeklyTraining);
    saveData(next);
    data = next;
    renderAll();
    renderWeeklyPlanForm();
    weeklyPlanBaseline = formSignature(elements.weeklyPlanForm);
    showToast("每周训练模板已保存");
  } catch (error) {
    setInlineError(elements.weeklyPlanError, error.message || "每周模板保存失败");
  }
}

function renderFoodList() {
  elements.foodList.replaceChildren();
  elements.addFood.disabled = !data || !isStorageWritable();
  if (!data) {
    elements.foodListEmpty.hidden = false;
    elements.foodListEmpty.textContent = "当前数据不可用，恢复有效备份后才能管理食材。";
    return;
  }
  elements.foodListEmpty.textContent = "还没有常用食材。";
  elements.foodListEmpty.hidden = data.foods.length > 0;
  data.foods.forEach((food, index) => {
    const item = document.createElement("article");
    item.className = "food-list-item";
    const detail = document.createElement("div");
    const name = document.createElement("strong");
    name.textContent = food.name;
    const meta = document.createElement("span");
    const protein = food.proteinReference === null
      ? "仅记录"
      : `蛋白质 ${formatProteinGrams(food.proteinReference.proteinMilligrams)} g／${formatFoodAmount(food.proteinReference.referenceAmount, food.unit)}（${FOOD_BASIS_LABELS[food.proteinReference.basis]}）`;
    meta.textContent = `${FOOD_CATEGORY_LABELS[food.category]} · 默认 ${formatFoodAmount(food.defaultAmount, food.unit)} · ${protein}`;
    detail.append(name, meta);
    const actions = document.createElement("div");
    actions.className = "food-list-actions";
    const up = createFoodAction("↑", `上移${food.name}`, () => moveFood(index, -1));
    up.disabled = index === 0 || !isStorageWritable();
    const down = createFoodAction("↓", `下移${food.name}`, () => moveFood(index, 1));
    down.disabled = index === data.foods.length - 1 || !isStorageWritable();
    const edit = createFoodAction("编辑", `编辑${food.name}`, () => openFoodForm(food));
    edit.disabled = !isStorageWritable();
    const remove = createFoodAction("删除", `删除${food.name}`, () => removeFood(food));
    remove.classList.add("delete-food");
    remove.disabled = !isStorageWritable();
    actions.append(up, down, edit, remove);
    item.append(detail, actions);
    elements.foodList.append(item);
  });
}

function createFoodAction(text, label, action) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = text;
  button.setAttribute("aria-label", label);
  button.addEventListener("click", action);
  return button;
}

function openFoodForm(food = null) {
  if (!data || !isStorageWritable()) return;
  if (
    elements.foodDialog.open
    && formSignature(elements.foodForm) !== foodFormBaseline
  ) {
    requestDiscardConfirmation(() => {
      resetFoodForm();
      openFoodForm(food);
    });
    return;
  }
  elements.foodForm.reset();
  elements.foodForm.elements.id.value = food?.id ?? "";
  elements.foodForm.elements.name.value = food?.name ?? "";
  elements.foodForm.elements.category.value = food?.category ?? "protein";
  elements.foodForm.elements.defaultAmount.value = String(food?.defaultAmount ?? 100);
  elements.foodForm.elements.unit.value = food?.unit ?? "grams";
  elements.foodForm.elements.proteinEnabled.checked = food?.proteinReference !== null && food !== null;
  elements.foodForm.elements.referenceAmount.value = food?.proteinReference?.referenceAmount ?? food?.defaultAmount ?? 100;
  elements.foodForm.elements.proteinGrams.value = food?.proteinReference === null || !food
    ? ""
    : formatProteinGrams(food.proteinReference.proteinMilligrams);
  elements.foodForm.elements.basis.value = food?.proteinReference?.basis ?? "cooked";
  elements.foodForm.elements.source.value = food?.proteinReference?.source ?? "packageLabel";
  elements.foodForm.elements.sourceNote.value = food?.proteinReference?.sourceNote ?? "";
  elements.foodSourceDetails.open = Boolean(food?.proteinReference?.sourceNote);
  elements.foodFormTitle.textContent = food ? "编辑常用食材" : "添加常用食材";
  setInlineError(elements.foodFormError, "");
  updateFoodProteinFields();
  updateFoodProteinUnit();
  if (!elements.foodDialog.open) elements.foodDialog.showModal();
  foodDialogViewportBaseline = window.visualViewport?.height ?? window.innerHeight;
  syncFoodDialogViewport();
  foodFormBaseline = formSignature(elements.foodForm);
  elements.foodForm.elements.name.focus({ preventScroll: true });
}

function updateFoodProteinFields() {
  const enabled = elements.foodForm.elements.proteinEnabled.checked;
  elements.foodProteinFields.hidden = !enabled;
  for (const name of ["referenceAmount", "proteinGrams", "basis", "source"]) {
    elements.foodForm.elements[name].required = enabled;
  }
  if (enabled) queueFoodControlVisibility(elements.foodForm.elements.referenceAmount);
}

function updateFoodProteinUnit() {
  elements.foodProteinUnit.textContent = FOOD_UNIT_LABELS[elements.foodForm.elements.unit.value] ?? "单位";
}

function handleFoodFormFocus(event) {
  if (!(event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement)) return;
  queueFoodControlVisibility(event.target);
}

function syncFoodDialogViewport() {
  if (!elements.foodDialog.open) return;
  const viewport = window.visualViewport;
  if (!viewport || !window.matchMedia("(max-width: 559px)").matches) {
    resetFoodDialogViewport();
    return;
  }
  elements.foodDialog.style.setProperty("--food-dialog-height", `${Math.round(viewport.height)}px`);
  elements.foodDialog.style.setProperty("--food-dialog-top", `${Math.round(viewport.offsetTop)}px`);
  const baseline = foodDialogViewportBaseline ?? viewport.height;
  elements.foodDialog.classList.toggle("keyboard-open", baseline - viewport.height > 120);
  queueFoodControlVisibility(document.activeElement);
}

function queueFoodControlVisibility(control) {
  if (!elements.foodDialog.open || !elements.foodForm.contains(control)) return;
  if (foodVisibilityFrame !== null) window.cancelAnimationFrame(foodVisibilityFrame);
  foodVisibilityFrame = window.requestAnimationFrame(() => {
    foodVisibilityFrame = null;
    ensureFoodControlVisible(control);
  });
}

function ensureFoodControlVisible(control) {
  const target = control.closest(".field, .food-protein-reference, .checkbox-field") ?? control;
  const viewportRect = elements.foodFormFields.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  const adjustment = calculateVisibilityScroll(
    viewportRect.top,
    viewportRect.bottom,
    targetRect.top,
    targetRect.bottom,
  );
  if (adjustment !== 0) elements.foodFormFields.scrollTop += adjustment;
}

function resetFoodDialogViewport() {
  elements.foodDialog.classList.remove("keyboard-open");
  elements.foodDialog.style.removeProperty("--food-dialog-height");
  elements.foodDialog.style.removeProperty("--food-dialog-top");
}

function handleFoodSubmit(event) {
  event.preventDefault();
  if (!data || !isStorageWritable()) return;
  const form = event.currentTarget;
  const existing = data.foods.find((item) => item.id === form.elements.id.value) ?? null;
  const name = form.elements.name.value.trim();
  if (data.foods.some((item) => item.id !== existing?.id && item.name.trim() === name)) {
    setInlineError(elements.foodFormError, "已经存在同名常用食材");
    return;
  }
  const now = new Date().toISOString();
  const proteinReference = form.elements.proteinEnabled.checked
    ? {
      referenceAmount: Number(form.elements.referenceAmount.value),
      proteinMilligrams: Math.round(Number(form.elements.proteinGrams.value) * 1_000),
      basis: form.elements.basis.value,
      source: form.elements.source.value,
      sourceNote: form.elements.sourceNote.value.trim(),
    }
    : null;
  const food = {
    id: existing?.id ?? createId(),
    name,
    category: form.elements.category.value,
    defaultAmount: Number(form.elements.defaultAmount.value),
    unit: form.elements.unit.value,
    proteinReference,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  try {
    const next = saveFood(data, food);
    saveData(next);
    data = next;
    resetFoodForm();
    renderFoodList();
    renderAll();
    showToast(existing ? "常用食材已更新，历史饮食未改变" : "常用食材已添加");
  } catch (error) {
    setInlineError(elements.foodFormError, error.message || "食材保存失败");
  }
}

function closeFoodForm() {
  if (!elements.foodDialog.open) return;
  if (formSignature(elements.foodForm) === foodFormBaseline) {
    resetFoodForm();
    return;
  }
  requestDiscardConfirmation(resetFoodForm);
}

function resetFoodForm() {
  if (elements.foodDialog.open) elements.foodDialog.close();
  resetFoodDialogViewport();
  foodDialogViewportBaseline = null;
  if (foodVisibilityFrame !== null) window.cancelAnimationFrame(foodVisibilityFrame);
  foodVisibilityFrame = null;
  elements.foodFormFields.scrollTop = 0;
  elements.foodSourceDetails.open = false;
  elements.foodForm.reset();
  setInlineError(elements.foodFormError, "");
  foodFormBaseline = null;
}

function moveFood(index, direction) {
  const target = index + direction;
  if (!data || target < 0 || target >= data.foods.length) return;
  const ids = data.foods.map((food) => food.id);
  [ids[index], ids[target]] = [ids[target], ids[index]];
  try {
    const next = reorderFoods(data, ids);
    saveData(next);
    data = next;
    renderFoodList();
    renderBackupState();
  } catch (error) {
    showToast(error.message || "食材排序保存失败");
  }
}

function removeFood(food) {
  if (!data || !isStorageWritable()) return;
  pendingFoodDeletion = food;
  elements.deleteFoodDialogMessage.textContent = `删除“${food.name}”后，已有饮食记录中的历史快照仍会保留。`;
  elements.deleteFoodDialog.showModal();
}

function closeDeleteFoodDialog() {
  pendingFoodDeletion = null;
  elements.deleteFoodDialog.close();
}

function confirmFoodDeletion() {
  if (!data || !pendingFoodDeletion) return;
  const food = pendingFoodDeletion;
  try {
    const result = deleteFood(data, food.id);
    saveData(result.data);
    data = result.data;
    if (elements.foodForm.elements.id.value === food.id) resetFoodForm();
    pendingFoodDeletion = null;
    elements.deleteFoodDialog.close();
    renderFoodList();
    renderAll();
    showToast("常用食材已删除，历史饮食未改变");
  } catch (error) {
    pendingFoodDeletion = null;
    elements.deleteFoodDialog.close();
    showToast(error.message || "食材删除失败");
  }
}

function openFoodSettingsFromMeal() {
  const open = () => {
    elements.dialog.close();
    openDataDialog();
    openFoodForm();
  };
  if (getFormSignature() === formBaseline) open();
  else requestDiscardConfirmation(open);
}

function openForm(type, explicitRecord = null) {
  if (!data || !isStorageWritable()) return;
  const config = TYPE_CONFIG[type];
  let record = explicitRecord;
  if (!record && ["sleep", "weight"].includes(type)) {
    record = findDailyRecord(data, config.collectionName, selectedDate);
  }

  editing = record ? { type, record } : { type, record: null };
  document.querySelectorAll("[data-record-form]").forEach((form) => {
    form.hidden = form.dataset.recordForm !== type;
    form.reset();
  });
  const form = document.querySelector(`[data-record-form="${type}"]`);
  activeForm = form;
  mealSelections = [];
  elements.recordDate.value = record?.date ?? selectedDate;
  elements.dialogTitle.textContent = `${record ? "编辑" : "新增"}${config.label}`;
  setFormError("");
  fillForm(type, form, record);
  if (type === "meal") renderMealFoodPicker(record);
  updateSleepDurationPreview();
  updateWorkoutFieldState(false);
  updateWorkoutPacePreview();
  formBaseline = getFormSignature();
  elements.dialog.showModal();
  let initialFocusTarget;
  if (type === "meal") {
    initialFocusTarget = form.querySelector("[data-food-select]") ?? form.querySelector("[data-primary-input]");
  } else if (type === "workout") {
    initialFocusTarget = record?.scenario === "guided"
      ? form.elements.durationMinutes
      : form.querySelector("[name=workoutScenario]:checked");
  } else {
    initialFocusTarget = form.querySelector("[data-primary-input]");
  }
  (initialFocusTarget ?? elements.dialogTitle).focus({ preventScroll: true });
}

function fillForm(type, form, record) {
  if (!record) {
    if (type === "sleep") {
      form.elements.sleepTime.value = "22:30";
      form.elements.wakeTime.value = "06:30";
    } else if (type === "meal") {
      form.elements.mealType.value = getDefaultMealType(new Date().getHours());
    } else if (type === "workout") {
      form.elements.workoutScenario.value = getDefaultWorkoutScenario(getTrainingPlanForDate(selectedDate));
      form.elements.source.value = "manual";
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
    if (record.scenario !== "guided") form.elements.workoutScenario.value = record.scenario;
    form.elements.keepType.value = record.type === "running" ? "strength" : record.type;
    form.elements.otherType.value = record.type === "running" ? "other" : record.type;
    form.elements.keepCourseName.value = record.keepDetails?.courseName ?? "";
    form.elements.keepCompleted.value = String(record.keepDetails?.completed ?? true);
    form.elements.keepEquipmentWeightKg.value = record.keepDetails?.equipmentWeightGrams === null
      || record.keepDetails === null
      ? ""
      : formatDecimal(record.keepDetails.equipmentWeightGrams / 1_000, 1);
    form.elements.keepFeedback.value = !record.keepDetails?.feedbackRecorded
      ? "unrecorded"
      : record.keepDetails.discomfort === null ? "none" : "discomfort";
    if (record.keepDetails?.discomfort) {
      form.elements.keepDiscomfortBodyPart.value = record.keepDetails.discomfort.bodyPart;
      form.elements.keepDiscomfortSeverity.value = String(record.keepDetails.discomfort.severity);
    }
    form.elements.distanceKm.value = record.distanceMeters === null
      ? ""
      : formatDecimal(record.distanceMeters / 1_000, 3);
  }
}

function renderMealFoodPicker(record) {
  mealSelections = (record?.foodItems ?? []).map((snapshot) => ({
    sourceFoodId: snapshot.sourceFoodId,
    snapshotId: snapshot.id,
    food: foodFromMealSnapshot(snapshot),
    amount: snapshot.amount,
  }));
  elements.mealFoodOptions.replaceChildren();
  elements.mealFoodEmpty.hidden = data.foods.length > 0;
  for (const food of data.foods) {
    const label = document.createElement("label");
    label.className = "meal-food-option";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.value = food.id;
    input.dataset.foodSelect = food.id;
    input.checked = mealSelections.some((item) => item.sourceFoodId === food.id);
    const text = document.createElement("span");
    text.textContent = `${food.name} · ${formatFoodAmount(food.defaultAmount, food.unit)}`;
    input.addEventListener("change", () => toggleMealFood(food, input.checked));
    label.append(input, text);
    elements.mealFoodOptions.append(label);
  }
  renderMealSelections();
}

function toggleMealFood(food, selected) {
  if (selected) {
    if (!mealSelections.some((item) => item.sourceFoodId === food.id)) {
      mealSelections.push({
        sourceFoodId: food.id,
        snapshotId: createId(),
        food: structuredClone(food),
        amount: food.defaultAmount,
      });
    }
  } else {
    mealSelections = mealSelections.filter((item) => item.sourceFoodId !== food.id);
  }
  renderMealSelections();
}

function renderMealSelections() {
  elements.mealSelectedFoods.replaceChildren();
  elements.mealSelectedFoods.hidden = mealSelections.length === 0;
  for (const selection of mealSelections) {
    const item = document.createElement("div");
    item.className = "meal-selected-item";
    const detail = document.createElement("div");
    const name = document.createElement("strong");
    name.textContent = selection.food.name;
    const meta = document.createElement("span");
    meta.textContent = selection.food.proteinReference === null
      ? `${FOOD_CATEGORY_LABELS[selection.food.category]} · 暂无蛋白质参考值`
      : `${FOOD_CATEGORY_LABELS[selection.food.category]} · ${FOOD_BASIS_LABELS[selection.food.proteinReference.basis]}参考值`;
    detail.append(name, meta);
    const amountLabel = document.createElement("label");
    amountLabel.textContent = `本次份量（${FOOD_UNIT_LABELS[selection.food.unit]}）`;
    const amount = document.createElement("input");
    amount.type = "number";
    amount.min = "1";
    amount.max = "100000";
    amount.step = "1";
    amount.inputMode = "numeric";
    amount.value = String(selection.amount);
    amount.dataset.mealFoodAmount = selection.sourceFoodId;
    amount.addEventListener("input", () => {
      selection.amount = Number(amount.value);
      renderMealProteinPreview();
    });
    amountLabel.append(amount);
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "meal-remove-food";
    remove.textContent = "移除";
    remove.setAttribute("aria-label", `移除${selection.food.name}`);
    remove.addEventListener("click", () => {
      mealSelections = mealSelections.filter(
        (item) => item.sourceFoodId !== selection.sourceFoodId,
      );
      const checkbox = elements.mealFoodOptions.querySelector(
        `[data-food-select="${selection.sourceFoodId}"]`,
      );
      if (checkbox) checkbox.checked = false;
      renderMealSelections();
    });
    item.append(detail, amountLabel, remove);
    elements.mealSelectedFoods.append(item);
  }
  renderMealProteinPreview();
}

function renderMealProteinPreview() {
  let estimatedProteinMilligrams = 0;
  let estimatedItemCount = 0;
  let unestimatedItemCount = 0;
  try {
    for (const selection of mealSelections) {
      const value = calculateFoodProteinMilligrams(
        selection.food,
        selection.amount,
        selection.food.unit,
      );
      if (value === null) unestimatedItemCount += 1;
      else {
        estimatedItemCount += 1;
        estimatedProteinMilligrams += value;
      }
    }
  } catch {
    elements.mealProteinPreview.textContent = "请填写有效的整数份量后再保存";
    return;
  }
  const hasFreeText = editing?.type === "meal"
    && Boolean(activeForm?.elements.freeText.value.trim());
  if (!estimatedItemCount) {
    elements.mealProteinPreview.textContent = mealSelections.length || hasFreeText
      ? "当前已填内容暂无蛋白质估算"
      : "尚未选择可估算蛋白质的食材";
    return;
  }
  elements.mealProteinPreview.textContent = `本餐已估算蛋白质 ${formatProteinGrams(estimatedProteinMilligrams)} g${
    unestimatedItemCount || hasFreeText ? "，另有食材或文字未估算" : ""
  }`;
}

function handleFormInput(event) {
  if (editing?.type === "workout" && ["workoutScenario", "source", "keepFeedback"].includes(event?.target?.name)) {
    updateWorkoutFieldState(true);
  }
  if (editing?.type === "meal") renderMealProteinPreview();
  updateSleepDurationPreview();
  updateWorkoutPacePreview();
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
  if (getSelectedWorkoutScenario() !== "running") {
    elements.workoutPacePreview.textContent = "填写时长和距离后显示平均配速";
    return;
  }
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
  const scenario = getSelectedWorkoutScenario();
  const isGuided = scenario === "guided";
  const hasSource = scenario === "keep" || scenario === "running";
  const hasWatchDetails = hasSource && activeForm.elements.source.value === "appleWatch";
  elements.workoutScenarioPicker.hidden = isGuided;
  elements.workoutGuidedEditNote.hidden = !isGuided;
  elements.workoutKeepFields.hidden = scenario !== "keep";
  elements.workoutRunningFields.hidden = scenario !== "running";
  elements.workoutOtherFields.hidden = scenario !== "other";
  elements.workoutSourceField.hidden = !hasSource;
  elements.workoutAverageHeartRateField.hidden = !hasWatchDetails;
  elements.keepDiscomfortFields.hidden = scenario !== "keep"
    || activeForm.elements.keepFeedback.value !== "discomfort";
  activeForm.elements.keepCourseName.required = scenario === "keep";
  activeForm.elements.keepType.required = scenario === "keep";
  activeForm.elements.otherType.required = scenario === "other";
  activeForm.elements.source.required = hasSource;
  elements.repeatLastWorkout.hidden = isGuided || Boolean(editing?.record);
  elements.repeatLastWorkoutMeta.hidden = isGuided || Boolean(editing?.record);
  if (!hasWatchDetails && clearUnsupported) {
    activeForm.elements.averageHeartRateBpm.value = "";
  }
  renderRepeatLastWorkoutState(scenario);
}

function getSelectedWorkoutScenario() {
  if (editing?.record?.scenario === "guided") return "guided";
  return activeForm.elements.workoutScenario.value;
}

function renderRepeatLastWorkoutState(scenario) {
  if (!["keep", "running", "other"].includes(scenario) || editing?.record) return;
  const latest = getLatestWorkoutForScenario(data.workouts, scenario);
  elements.repeatLastWorkout.disabled = latest === null;
  if (latest === null) {
    elements.repeatLastWorkoutMeta.textContent = `还没有可复用的${WORKOUT_SCENARIO_LABELS[scenario]}记录。`;
    return;
  }
  const detail = scenario === "keep"
    ? latest.keepDetails.courseName
    : WORKOUT_LABELS[latest.type];
  elements.repeatLastWorkoutMeta.textContent = `上次：${latest.date} · ${detail} · ${latest.durationMinutes} 分钟`;
}

function repeatLastWorkout() {
  if (editing?.type !== "workout" || editing.record || !activeForm) return;
  const scenario = getSelectedWorkoutScenario();
  const latest = getLatestWorkoutForScenario(data.workouts, scenario);
  if (!latest) return;
  const values = createWorkoutRepeatValues(latest);
  activeForm.elements.durationMinutes.value = String(values.durationMinutes);
  activeForm.elements.intensity.value = String(values.intensity);
  activeForm.elements.source.value = values.source;
  activeForm.elements.averageHeartRateBpm.value = "";
  activeForm.elements.distanceKm.value = values.distanceMeters === null
    ? ""
    : formatDecimal(values.distanceMeters / 1_000, 3);
  activeForm.elements.note.value = "";
  if (scenario === "keep") {
    activeForm.elements.keepType.value = values.type;
    activeForm.elements.keepCourseName.value = values.keepDetails.courseName;
    activeForm.elements.keepCompleted.value = "true";
    activeForm.elements.keepEquipmentWeightKg.value = values.keepDetails.equipmentWeightGrams === null
      ? ""
      : formatDecimal(values.keepDetails.equipmentWeightGrams / 1_000, 1);
    activeForm.elements.keepFeedback.value = "unrecorded";
  } else if (scenario === "other") {
    activeForm.elements.otherType.value = values.type;
  }
  updateWorkoutFieldState(false);
  updateWorkoutPacePreview();
  showToast("已填入上次同类训练，可继续修改后保存");
}

function setQuickDuration(minutes) {
  if (editing?.type !== "workout" || !activeForm) return;
  activeForm.elements.durationMinutes.value = String(minutes);
  activeForm.elements.durationMinutes.focus();
}

function setInlineError(element, message) {
  element.textContent = message;
  element.hidden = !message;
}

function getFormSignature() {
  if (!activeForm) return "";
  const fields = [elements.recordDate, ...activeForm.querySelectorAll("input, select, textarea")];
  const value = fields.map((field) => `${field.name || field.id}:${
    ["checkbox", "radio"].includes(field.type) ? field.checked : field.value
  }`).join("|");
  return value;
}

function requestCloseRecordDialog() {
  if (!activeForm || getFormSignature() === formBaseline) {
    elements.dialog.close();
    return;
  }
  requestDiscardConfirmation(() => elements.dialog.close());
}

function discardFormChanges() {
  elements.discardDialog.close();
  const action = pendingDiscardAction;
  pendingDiscardAction = null;
  action?.();
}

function formSignature(form) {
  return Array.from(form.querySelectorAll("input, select, textarea"))
    .map((field) => `${field.name || field.id}:${["checkbox", "radio"].includes(field.type) ? field.checked : field.value}`)
    .join("|");
}

function requestDiscardConfirmation(action) {
  pendingDiscardAction = action;
  if (!elements.discardDialog.open) elements.discardDialog.showModal();
}

function requestCloseDataDialog() {
  const weeklyDirty = formSignature(elements.weeklyPlanForm) !== weeklyPlanBaseline;
  if (!weeklyDirty) {
    elements.dataDialog.close();
    return;
  }
  requestDiscardConfirmation(() => {
    weeklyPlanBaseline = null;
    elements.dataDialog.close();
  });
}

function bindGuardedDialog(dialog, close) {
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) close();
  });
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    close();
  });
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
    selectedDate = record.date;
    calendarAnchor = record.date;
    renderAll();
    showToast(`${TYPE_CONFIG[type].label}已保存`);
  } catch (error) {
    setFormError(error.message || "保存失败，请检查输入");
  }
}

function buildRecord(type, form, base) {
  if (type === "workout") {
    const existing = editing?.record ?? null;
    const scenario = getSelectedWorkoutScenario();
    if (scenario === "guided") {
      return {
        ...existing,
        ...base,
        durationMinutes: Number(form.elements.durationMinutes.value),
        intensity: Number(form.elements.intensity.value),
        note: form.elements.note.value.trim(),
      };
    }
    const workoutType = scenario === "running"
      ? "running"
      : scenario === "keep" ? form.elements.keepType.value : form.elements.otherType.value;
    const source = scenario === "other"
      ? existing?.source ?? "manual"
      : form.elements.source.value;
    const averageHeartRateBpm = scenario === "other"
      ? existing?.averageHeartRateBpm ?? null
      : source === "appleWatch" ? nullableInteger(form.elements.averageHeartRateBpm.value) : null;
    const distanceMeters = scenario === "running"
      ? form.elements.distanceKm.value === ""
        ? null
        : Math.round(Number(form.elements.distanceKm.value) * 1_000)
      : scenario === "other" && ["walking", "cardio"].includes(workoutType)
        ? existing?.distanceMeters ?? null
        : null;
    const feedback = form.elements.keepFeedback.value;
    const keepDetails = scenario === "keep"
      ? {
        courseName: form.elements.keepCourseName.value.trim(),
        completed: form.elements.keepCompleted.value === "true",
        equipmentWeightGrams: form.elements.keepEquipmentWeightKg.value === ""
          ? null
          : Math.round(Number(form.elements.keepEquipmentWeightKg.value) * 1_000),
        feedbackRecorded: feedback !== "unrecorded",
        discomfort: feedback === "discomfort"
          ? {
            bodyPart: form.elements.keepDiscomfortBodyPart.value,
            severity: Number(form.elements.keepDiscomfortSeverity.value),
          }
          : null,
      }
      : null;
    return {
      ...base,
      scenario,
      type: workoutType,
      durationMinutes: Number(form.elements.durationMinutes.value),
      intensity: Number(form.elements.intensity.value),
      source,
      averageHeartRateBpm,
      distanceMeters,
      keepDetails,
      guidedSession: null,
      note: form.elements.note.value.trim(),
    };
  }
  if (type === "meal") {
    const foodItems = mealSelections.map((selection) => createMealFoodSnapshot(
      selection.food,
      selection.amount,
      selection.snapshotId,
    ));
    const freeText = form.elements.freeText.value.trim();
    const content = buildMealContent(foodItems, freeText);
    return {
      ...base,
      mealType: form.elements.mealType.value,
      content,
      freeText,
      foodItems,
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
  throw new TypeError("不支持的记录类型");
}

function handleDelete(collectionName, recordId) {
  if (!isStorageWritable()) return;
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
  const prefix = storageState.status === "migrationFailed"
    ? `healthlife-v${storageState.migratedFromVersion}-before-migration`
    : "healthlife-corrupt";
  downloadText(storageState.raw, `${prefix}-${localDateString(new Date())}.json`);
}

function openDataDialog() {
  pendingImport = null;
  elements.importFile.value = "";
  elements.importPreview.hidden = true;
  setImportError("");
  renderBackupState();
  resetFoodForm();
  renderFoodList();
  renderWeeklyPlanForm();
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
    backupMetadata = createBackupMetadata(now, data);
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
  const migrationLabel = pendingImport.sourceBackupVersion === 10 ? "；将安全升级 v10 备份" : "";
  elements.importCounts.textContent = `运动 ${summary.counts.workouts}、饮食 ${summary.counts.meals}、睡眠 ${summary.counts.sleepRecords}、体重 ${summary.counts.weights}；常用食材 ${summary.foodCount}、健康阶段 ${summary.healthStageCount}；每周模板：${summary.weeklyTraining.map((type) => TRAINING_PLAN_LABELS[type]).join("、")}${migrationLabel}`;
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
    const defaults = createEmptyData();
    const hasSettingsChanges = data && (
      data.foods.length > 0
      || data.healthStages.length > 0
      || JSON.stringify(data.weeklyTraining) !== JSON.stringify(defaults.weeklyTraining)
    );
    if (data && (summarizeData(data).totalRecords > 0 || hasSettingsChanges)) {
      downloadText(
        serializeCompleteBackup(data, now),
        `healthlife-before-restore-${localDateString(new Date())}.json`,
      );
    } else if (storageState.status === "corrupt" && storageState.raw) {
      downloadText(storageState.raw, `healthlife-corrupt-before-restore-${localDateString(new Date())}.json`);
    }
    saveData(pendingImport.backup.data);
    data = pendingImport.backup.data;
    storageState = {
      status: "ready",
      data,
      raw: null,
      error: null,
      migratedFromVersion: null,
    };
    backupMetadata = createBackupMetadata(now, data);
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
