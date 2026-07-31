export const WORKOUT_DRAFT_VERSION = 2;
export const WORKOUT_UNDO_VERSION = 1;
const MAX_WORKOUT_UNDO_SNAPSHOTS = 50;
export const DISCOMFORT_BODY_PARTS = Object.freeze([
  "knee",
  "lowerBack",
  "shoulder",
  "elbow",
  "wrist",
  "hip",
  "ankle",
  "other",
]);
export const DISCOMFORT_BODY_PART_LABELS = Object.freeze({
  knee: "膝盖",
  lowerBack: "腰部",
  shoulder: "肩部",
  elbow: "肘部",
  wrist: "手腕",
  hip: "髋部",
  ankle: "脚踝／跟腱",
  other: "其他部位",
});

export const EXERCISE_LIBRARY = Object.freeze({
  gobletSquat: Object.freeze({
    id: "gobletSquat",
    name: "壶铃杯式深蹲",
    equipment: "壶铃",
    unit: "reps",
    unitLabel: "次",
    weightEnabled: true,
    weightLabel: "壶铃重量（kg，可选）",
    setup: "壶铃贴近胸口，双脚约与肩同宽，脚尖微微向外。",
    cues: Object.freeze(["脚掌三点踩稳", "膝盖跟随脚尖方向", "收紧腹部，腰背保持稳定"]),
    mistakes: Object.freeze(["膝盖明显内扣", "脚跟抬起", "为了蹲深而弯曲腰背"]),
    stopCondition: "膝盖或腰部出现尖锐疼痛，或者身体无法保持平衡时停止。",
  }),
  dumbbellRomanianDeadlift: Object.freeze({
    id: "dumbbellRomanianDeadlift",
    name: "哑铃罗马尼亚硬拉",
    equipment: "一对哑铃",
    unit: "reps",
    unitLabel: "次",
    weightEnabled: true,
    weightLabel: "每只哑铃重量（kg，可选）",
    setup: "双脚与髋同宽，哑铃放在大腿前侧，膝盖保持轻微弯曲。",
    cues: Object.freeze(["臀部向后推", "哑铃贴近双腿下降", "站起时收紧臀部，不向后仰腰"]),
    mistakes: Object.freeze(["把动作做成下蹲", "哑铃离身体太远", "含胸或腰背明显弯曲"]),
    stopCondition: "腰部出现尖锐疼痛，或无法感受到臀部和大腿后侧发力时停止调整。",
  }),
  pushup: Object.freeze({
    id: "pushup",
    name: "俯卧撑",
    equipment: "俯卧撑握柄",
    unit: "reps",
    unitLabel: "次",
    weightEnabled: false,
    weightLabel: null,
    setup: "握柄放在肩部略外侧，从头到脚保持一条直线；太难时改做桌边上斜俯卧撑。",
    cues: Object.freeze(["腹部和臀部同时收紧", "肘部与身体约呈 30～45 度", "胸口整体下降，不要只低头"]),
    mistakes: Object.freeze(["塌腰", "耸肩", "肘部完全向两侧打开"]),
    stopCondition: "肩、肘或手腕出现尖锐疼痛，或身体无法保持直线时停止。",
  }),
  oneArmDumbbellRow: Object.freeze({
    id: "oneArmDumbbellRow",
    name: "单臂哑铃划船",
    equipment: "单只哑铃",
    unit: "repsEachSide",
    unitLabel: "次／侧",
    weightEnabled: true,
    weightLabel: "单只哑铃重量（kg，可选）",
    setup: "一手扶稳支撑物，躯干稳定，另一手让哑铃自然下垂。",
    cues: Object.freeze(["肩膀远离耳朵", "手肘向髋部方向拉", "两侧都完成相同次数"]),
    mistakes: Object.freeze(["耸肩拉起", "身体大幅扭转", "用惯性甩动哑铃"]),
    stopCondition: "肩部或腰部出现尖锐疼痛，或躯干无法保持稳定时停止。",
  }),
  deadBug: Object.freeze({
    id: "deadBug",
    name: "死虫式",
    equipment: "瑜伽垫或地面",
    unit: "repsEachSide",
    unitLabel: "次／侧",
    weightEnabled: false,
    weightLabel: null,
    setup: "仰卧抬起双腿和双臂，膝髋约呈 90 度，让腰部自然贴稳地面。",
    cues: Object.freeze(["先呼气收紧腹部", "对侧手脚缓慢伸出", "腰部一旦离地就缩小幅度"]),
    mistakes: Object.freeze(["动作过快", "腰部拱起", "为了伸得更远而失去控制"]),
    stopCondition: "腰部不适持续加重，或无法在呼吸时维持腰部稳定时停止。",
  }),
  stairClimb: Object.freeze({
    id: "stairClimb",
    name: "爬楼梯",
    equipment: "楼梯",
    unit: "floors",
    unitLabel: "层",
    weightEnabled: false,
    weightLabel: null,
    setup: "穿稳定的运动鞋，从轻松步速开始，需要时扶住扶手。",
    cues: Object.freeze(["整只脚掌尽量踩稳", "保持能够说出短句的速度", "初期上楼训练、下楼坐电梯"]),
    mistakes: Object.freeze(["起步冲刺", "跨越多级台阶", "疲劳后继续追求速度"]),
    stopCondition: "胸闷、眩晕、异常气短，或膝盖和跟腱出现尖锐疼痛时立即停止。",
  }),
  bodyweightSquat: Object.freeze({
    id: "bodyweightSquat",
    name: "徒手深蹲",
    equipment: "无需器械",
    unit: "reps",
    unitLabel: "次",
    weightEnabled: false,
    weightLabel: null,
    setup: "双脚约与肩同宽，双手放在胸前，先用舒适深度练习稳定下蹲。",
    cues: Object.freeze(["脚掌三点踩稳", "膝盖跟随脚尖方向", "只蹲到腰背能保持稳定的位置"]),
    mistakes: Object.freeze(["膝盖明显内扣", "脚跟抬起", "追求深度而失去平衡"]),
    stopCondition: "膝盖或腰部出现尖锐疼痛，或者无法稳定站起时停止。",
  }),
  gluteBridge: Object.freeze({
    id: "gluteBridge",
    name: "臀桥",
    equipment: "瑜伽垫或地面",
    unit: "reps",
    unitLabel: "次",
    weightEnabled: false,
    weightLabel: null,
    setup: "仰卧屈膝，双脚踩地约与髋同宽，脚跟靠近臀部。",
    cues: Object.freeze(["先收紧腹部", "用臀部把髋部抬起", "顶端保持躯干稳定，不向上拱腰"]),
    mistakes: Object.freeze(["主要用腰发力", "膝盖向内倒", "脚离臀部过远"]),
    stopCondition: "腰部或膝盖出现尖锐疼痛，或无法感受到臀部发力时停止调整。",
  }),
  inclinePushup: Object.freeze({
    id: "inclinePushup",
    name: "上斜俯卧撑",
    equipment: "稳固桌面或台面",
    unit: "reps",
    unitLabel: "次",
    weightEnabled: false,
    weightLabel: null,
    setup: "双手撑在不会移动的桌面或台面上，身体从头到脚保持一条直线。",
    cues: Object.freeze(["腹部和臀部同时收紧", "肘部与身体约呈 30～45 度", "胸口靠近支撑面后稳定推起"]),
    mistakes: Object.freeze(["支撑物不稳", "塌腰", "耸肩或只低头"]),
    stopCondition: "肩、肘或手腕出现尖锐疼痛，或支撑物发生移动时停止。",
  }),
  birdDog: Object.freeze({
    id: "birdDog",
    name: "鸟狗式",
    equipment: "瑜伽垫或地面",
    unit: "repsEachSide",
    unitLabel: "次／侧",
    weightEnabled: false,
    weightLabel: null,
    setup: "四点跪姿，双手在肩下、双膝在髋下，腰背保持自然稳定。",
    cues: Object.freeze(["先收紧腹部", "对侧手脚缓慢伸出", "骨盆保持朝向地面"]),
    mistakes: Object.freeze(["腰部塌陷", "身体向一侧旋转", "动作过快"]),
    stopCondition: "手腕、膝盖或腰部不适持续加重时停止，并缩小动作幅度。",
  }),
  briskWalk: Object.freeze({
    id: "briskWalk",
    name: "轻松快走",
    equipment: "运动鞋",
    unit: "minutes",
    unitLabel: "分钟",
    weightEnabled: false,
    weightLabel: null,
    setup: "选择平坦安全的路线，从轻松速度开始，再逐渐提高到能够说短句的速度。",
    cues: Object.freeze(["步幅自然，不刻意跨大步", "上身保持放松", "以能够说短句作为强度上限"]),
    mistakes: Object.freeze(["一开始走得过快", "为了速度明显前倾", "出现不适后仍继续加速"]),
    stopCondition: "胸闷、眩晕、异常气短，或下肢出现尖锐疼痛时立即停止。",
  }),
});

export const EXERCISE_REPLACEMENTS = Object.freeze({
  gobletSquat: Object.freeze(["bodyweightSquat"]),
  dumbbellRomanianDeadlift: Object.freeze(["gluteBridge"]),
  pushup: Object.freeze(["inclinePushup"]),
  deadBug: Object.freeze(["birdDog"]),
  stairClimb: Object.freeze(["briskWalk"]),
});

export const GUIDED_TEMPLATES = Object.freeze({
  squatAdaptation: Object.freeze({
    id: "squatAdaptation",
    name: "动作适应：壶铃深蹲",
    description: "约 15～20 分钟，先学习稳定动作，不练到力竭。",
    exercises: Object.freeze([
      Object.freeze({ exerciseId: "gobletSquat", sets: 3, targetValue: 8, restSeconds: 90 }),
    ]),
  }),
  strengthA: Object.freeze({
    id: "strengthA",
    name: "初级全身力量 A",
    description: "深蹲、推、拉和核心，共约 30 分钟。",
    exercises: Object.freeze([
      Object.freeze({ exerciseId: "gobletSquat", sets: 2, targetValue: 8, restSeconds: 90 }),
      Object.freeze({ exerciseId: "pushup", sets: 2, targetValue: 6, restSeconds: 90 }),
      Object.freeze({ exerciseId: "oneArmDumbbellRow", sets: 2, targetValue: 8, restSeconds: 90 }),
      Object.freeze({ exerciseId: "deadBug", sets: 2, targetValue: 6, restSeconds: 60 }),
    ]),
  }),
  strengthB: Object.freeze({
    id: "strengthB",
    name: "初级全身力量 B",
    description: "髋部、推、拉和核心，共约 30 分钟。",
    exercises: Object.freeze([
      Object.freeze({ exerciseId: "dumbbellRomanianDeadlift", sets: 2, targetValue: 8, restSeconds: 90 }),
      Object.freeze({ exerciseId: "pushup", sets: 2, targetValue: 6, restSeconds: 90 }),
      Object.freeze({ exerciseId: "oneArmDumbbellRow", sets: 2, targetValue: 8, restSeconds: 90 }),
      Object.freeze({ exerciseId: "deadBug", sets: 2, targetValue: 6, restSeconds: 60 }),
    ]),
  }),
  stairBeginner: Object.freeze({
    id: "stairBeginner",
    name: "初级爬楼梯",
    description: "两轮轻松上楼，初期下楼坐电梯。",
    exercises: Object.freeze([
      Object.freeze({ exerciseId: "stairClimb", sets: 2, targetValue: 5, restSeconds: 120 }),
    ]),
  }),
});

export function recommendedTemplateId(trainingPlanType) {
  return {
    strengthA: "strengthA",
    strengthB: "strengthB",
    walking: "stairBeginner",
  }[trainingPlanType] ?? null;
}

export function createWorkoutDraft({ templateId, date, id, now }) {
  getTemplate(templateId);
  assertDate(date, "date");
  assertUuid(id, "id");
  assertIsoTimestamp(now, "now");
  return {
    draftVersion: WORKOUT_DRAFT_VERSION,
    id,
    date,
    templateId,
    startedAt: now,
    updatedAt: now,
    currentExerciseIndex: 0,
    currentSetIndex: 0,
    completedSets: [],
    skippedExerciseIds: [],
    exerciseReplacements: [],
  };
}

export function createWorkoutUndoHistory(draft) {
  assertValidWorkoutDraft(draft);
  return {
    undoVersion: WORKOUT_UNDO_VERSION,
    draftId: draft.id,
    snapshots: [],
  };
}

export function assertValidWorkoutUndoHistory(history, currentDraft = null) {
  assertPlainObject(history, "undoHistory");
  assertExactKeys(history, ["undoVersion", "draftId", "snapshots"], "undoHistory");
  if (history.undoVersion !== WORKOUT_UNDO_VERSION) {
    throw new TypeError(`不支持的 undoVersion：${String(history.undoVersion)}`);
  }
  assertUuid(history.draftId, "undoHistory.draftId");
  if (!Array.isArray(history.snapshots) || history.snapshots.length > MAX_WORKOUT_UNDO_SNAPSHOTS) {
    throw new TypeError(`undoHistory.snapshots 必须是最多 ${MAX_WORKOUT_UNDO_SNAPSHOTS} 项的数组`);
  }
  history.snapshots.forEach((snapshot, index) => {
    assertValidWorkoutDraft(snapshot);
    if (snapshot.id !== history.draftId) {
      throw new TypeError(`undoHistory.snapshots[${index}] 不属于当前训练`);
    }
  });
  if (currentDraft !== null) {
    assertValidWorkoutDraft(currentDraft);
    if (history.draftId !== currentDraft.id) {
      throw new TypeError("undoHistory 与当前训练草稿不匹配");
    }
  }
  return true;
}

export function pushWorkoutUndoSnapshot(history, draft) {
  assertValidWorkoutUndoHistory(history, draft);
  const next = structuredClone(history);
  next.snapshots.push(structuredClone(draft));
  next.snapshots = next.snapshots.slice(-MAX_WORKOUT_UNDO_SNAPSHOTS);
  assertValidWorkoutUndoHistory(next, draft);
  return next;
}

export function popWorkoutUndoSnapshot(history, currentDraft) {
  assertValidWorkoutUndoHistory(history, currentDraft);
  if (history.snapshots.length === 0) throw new TypeError("没有可以撤销的训练操作");
  const next = structuredClone(history);
  const draft = next.snapshots.pop();
  assertValidWorkoutDraft(draft);
  assertValidWorkoutUndoHistory(next, draft);
  return { history: next, draft };
}

export function migrateWorkoutDraftV1(value) {
  assertPlainObject(value, "draft");
  assertExactKeys(value, [
    "draftVersion",
    "id",
    "date",
    "templateId",
    "startedAt",
    "updatedAt",
    "currentExerciseIndex",
    "currentSetIndex",
    "completedSets",
    "skippedExerciseIds",
  ], "draft");
  if (value.draftVersion !== 1) {
    throw new TypeError(`只能迁移 draftVersion 1，收到：${String(value.draftVersion)}`);
  }
  if (!Array.isArray(value.completedSets)) throw new TypeError("draft.completedSets 必须是数组");
  const migrated = {
    ...value,
    draftVersion: WORKOUT_DRAFT_VERSION,
    completedSets: value.completedSets.map((set, index) => {
      assertPlainObject(set, `draft.completedSets[${index}]`);
      assertExactKeys(set, [
        "exerciseId",
        "setNumber",
        "targetValue",
        "completedValue",
        "weightGrams",
        "completedAt",
      ], `draft.completedSets[${index}]`);
      return {
        ...set,
        plannedExerciseId: set.exerciseId,
      };
    }),
    exerciseReplacements: [],
  };
  assertValidWorkoutDraft(migrated);
  return migrated;
}

export function assertValidWorkoutDraft(draft) {
  assertPlainObject(draft, "draft");
  assertExactKeys(draft, [
    "draftVersion",
    "id",
    "date",
    "templateId",
    "startedAt",
    "updatedAt",
    "currentExerciseIndex",
    "currentSetIndex",
    "completedSets",
    "skippedExerciseIds",
    "exerciseReplacements",
  ], "draft");
  if (draft.draftVersion !== WORKOUT_DRAFT_VERSION) {
    throw new TypeError(`不支持的 draftVersion：${String(draft.draftVersion)}`);
  }
  assertUuid(draft.id, "draft.id");
  assertDate(draft.date, "draft.date");
  assertIsoTimestamp(draft.startedAt, "draft.startedAt");
  assertIsoTimestamp(draft.updatedAt, "draft.updatedAt");
  if (draft.updatedAt < draft.startedAt) throw new TypeError("draft.updatedAt 不能早于 startedAt");
  const template = getTemplate(draft.templateId);
  if (!Number.isInteger(draft.currentExerciseIndex)
    || draft.currentExerciseIndex < 0
    || draft.currentExerciseIndex > template.exercises.length) {
    throw new TypeError("draft.currentExerciseIndex 无效");
  }
  const active = template.exercises[draft.currentExerciseIndex] ?? null;
  const maxSetIndex = active?.sets ?? 0;
  if (!Number.isInteger(draft.currentSetIndex)
    || draft.currentSetIndex < 0
    || draft.currentSetIndex >= Math.max(maxSetIndex, 1)) {
    throw new TypeError("draft.currentSetIndex 无效");
  }
  if (draft.currentExerciseIndex === template.exercises.length && draft.currentSetIndex !== 0) {
    throw new TypeError("训练结束时 currentSetIndex 必须为 0");
  }
  if (!Array.isArray(draft.completedSets)) throw new TypeError("draft.completedSets 必须是数组");
  if (!Array.isArray(draft.exerciseReplacements)) {
    throw new TypeError("draft.exerciseReplacements 必须是数组");
  }
  const replacements = new Map();
  draft.exerciseReplacements.forEach((replacement, index) => {
    const path = `draft.exerciseReplacements[${index}]`;
    assertPlainObject(replacement, path);
    assertExactKeys(replacement, ["plannedExerciseId", "exerciseId"], path);
    const prescription = template.exercises.find(
      (item) => item.exerciseId === replacement.plannedExerciseId,
    );
    if (!prescription) throw new TypeError(`${path}.plannedExerciseId 不属于当前模板`);
    if (!EXERCISE_REPLACEMENTS[replacement.plannedExerciseId]?.includes(replacement.exerciseId)) {
      throw new TypeError(`${path}.exerciseId 不是允许的替代动作`);
    }
    if (replacements.has(replacement.plannedExerciseId)) {
      throw new TypeError(`${path}.plannedExerciseId 重复`);
    }
    replacements.set(replacement.plannedExerciseId, replacement.exerciseId);
  });
  const seenSets = new Set();
  for (const [index, set] of draft.completedSets.entries()) {
    const path = `draft.completedSets[${index}]`;
    assertPlainObject(set, path);
    assertExactKeys(set, [
      "exerciseId",
      "plannedExerciseId",
      "setNumber",
      "targetValue",
      "completedValue",
      "weightGrams",
      "completedAt",
    ], path);
    const prescription = template.exercises.find(
      (item) => item.exerciseId === set.plannedExerciseId,
    );
    if (!prescription) throw new TypeError(`${path}.plannedExerciseId 不属于当前模板`);
    const effectiveExerciseId = replacements.get(set.plannedExerciseId) ?? set.plannedExerciseId;
    if (set.exerciseId !== effectiveExerciseId) {
      throw new TypeError(`${path}.exerciseId 与当前替换动作不一致`);
    }
    assertInteger(set.setNumber, 1, prescription.sets, `${path}.setNumber`);
    if (set.targetValue !== prescription.targetValue) throw new TypeError(`${path}.targetValue 与模板不一致`);
    assertInteger(set.completedValue, 1, 1_000, `${path}.completedValue`);
    if (set.weightGrams !== null) assertInteger(set.weightGrams, 100, 200_000, `${path}.weightGrams`);
    if (!EXERCISE_LIBRARY[set.exerciseId].weightEnabled && set.weightGrams !== null) {
      throw new TypeError(`${path}.weightGrams 不适用于该动作`);
    }
    assertIsoTimestamp(set.completedAt, `${path}.completedAt`);
    const key = `${set.plannedExerciseId}:${set.setNumber}`;
    if (seenSets.has(key)) throw new TypeError(`${path} 重复`);
    seenSets.add(key);
  }
  if (!Array.isArray(draft.skippedExerciseIds)) {
    throw new TypeError("draft.skippedExerciseIds 必须是数组");
  }
  const skipped = new Set();
  for (const exerciseId of draft.skippedExerciseIds) {
    if (!template.exercises.some((item) => item.exerciseId === exerciseId)) {
      throw new TypeError("draft.skippedExerciseIds 包含模板外动作");
    }
    if (skipped.has(exerciseId)) throw new TypeError("draft.skippedExerciseIds 包含重复动作");
    skipped.add(exerciseId);
  }
  template.exercises.forEach((prescription, exerciseIndex) => {
    const completed = draft.completedSets
      .filter((set) => set.plannedExerciseId === prescription.exerciseId)
      .sort((left, right) => left.setNumber - right.setNumber);
    completed.forEach((set, index) => {
      if (set.setNumber !== index + 1) {
        throw new TypeError(`draft.completedSets 的 ${prescription.exerciseId} 组号必须连续`);
      }
    });
    const isSkipped = skipped.has(prescription.exerciseId);
    if (exerciseIndex < draft.currentExerciseIndex) {
      if (!isSkipped && completed.length !== prescription.sets) {
        throw new TypeError(`${prescription.exerciseId} 的已完成状态与当前位置不一致`);
      }
      return;
    }
    if (exerciseIndex === draft.currentExerciseIndex) {
      if (isSkipped || completed.length !== draft.currentSetIndex) {
        throw new TypeError(`${prescription.exerciseId} 的当前组状态不一致`);
      }
      return;
    }
    if (isSkipped || completed.length > 0) {
      throw new TypeError(`${prescription.exerciseId} 不能在当前位置之前提前完成`);
    }
  });
  return true;
}

export function getWorkoutStep(draft) {
  assertValidWorkoutDraft(draft);
  const template = getTemplate(draft.templateId);
  if (draft.currentExerciseIndex >= template.exercises.length) {
    return { complete: true, template, exercise: null, prescription: null };
  }
  const prescription = template.exercises[draft.currentExerciseIndex];
  const replacement = draft.exerciseReplacements.find(
    (item) => item.plannedExerciseId === prescription.exerciseId,
  );
  const exerciseId = replacement?.exerciseId ?? prescription.exerciseId;
  return {
    complete: false,
    template,
    plannedExercise: EXERCISE_LIBRARY[prescription.exerciseId],
    exercise: EXERCISE_LIBRARY[exerciseId],
    prescription,
  };
}

export function replaceWorkoutExercise(draft, exerciseId, now) {
  const step = getWorkoutStep(draft);
  if (step.complete) throw new TypeError("当前训练已经完成");
  if (draft.currentSetIndex !== 0) throw new TypeError("当前动作已有完成组，不能再替换");
  assertIsoTimestamp(now, "now");
  const plannedExerciseId = step.prescription.exerciseId;
  if (
    exerciseId !== plannedExerciseId
    && !EXERCISE_REPLACEMENTS[plannedExerciseId]?.includes(exerciseId)
  ) {
    throw new TypeError("请选择同一动作模式的有效替代动作");
  }
  const next = structuredClone(draft);
  next.exerciseReplacements = next.exerciseReplacements.filter(
    (item) => item.plannedExerciseId !== plannedExerciseId,
  );
  if (exerciseId !== plannedExerciseId) {
    next.exerciseReplacements.push({ plannedExerciseId, exerciseId });
  }
  next.updatedAt = now;
  assertValidWorkoutDraft(next);
  return next;
}

export function completeWorkoutSet(draft, { completedValue, weightGrams, now }) {
  const step = getWorkoutStep(draft);
  if (step.complete) throw new TypeError("当前训练已经完成");
  assertInteger(completedValue, 1, 1_000, "completedValue");
  if (weightGrams !== null) assertInteger(weightGrams, 100, 200_000, "weightGrams");
  if (!step.exercise.weightEnabled && weightGrams !== null) {
    throw new TypeError("当前动作不记录负重");
  }
  assertIsoTimestamp(now, "now");
  const next = structuredClone(draft);
  next.completedSets.push({
    exerciseId: step.exercise.id,
    plannedExerciseId: step.prescription.exerciseId,
    setNumber: draft.currentSetIndex + 1,
    targetValue: step.prescription.targetValue,
    completedValue,
    weightGrams,
    completedAt: now,
  });
  advance(next, step.prescription);
  next.updatedAt = now;
  assertValidWorkoutDraft(next);
  return next;
}

export function skipWorkoutExercise(draft, now) {
  const step = getWorkoutStep(draft);
  if (step.complete) throw new TypeError("当前训练已经完成");
  assertIsoTimestamp(now, "now");
  const next = structuredClone(draft);
  next.skippedExerciseIds.push(step.prescription.exerciseId);
  next.currentExerciseIndex += 1;
  next.currentSetIndex = 0;
  next.updatedAt = now;
  assertValidWorkoutDraft(next);
  return next;
}

export function createGuidedSessionSnapshot(
  draft,
  perceivedEffort,
  completedAt,
  exerciseFeedback = {},
) {
  const step = getWorkoutStep(draft);
  if (!step.complete) throw new TypeError("仍有动作未完成或跳过");
  assertInteger(perceivedEffort, 1, 3, "perceivedEffort");
  assertIsoTimestamp(completedAt, "completedAt");
  if (completedAt < draft.startedAt) throw new TypeError("completedAt 不能早于 startedAt");
  const template = getTemplate(draft.templateId);
  assertPlainObject(exerciseFeedback, "exerciseFeedback");
  for (const key of Object.keys(exerciseFeedback)) {
    if (!template.exercises.some((item) => item.exerciseId === key)) {
      throw new TypeError(`exerciseFeedback.${key} 不属于当前模板`);
    }
  }
  return {
    id: draft.id,
    templateId: template.id,
    templateName: template.name,
    startedAt: draft.startedAt,
    completedAt,
    perceivedEffort,
    exercises: template.exercises.map((prescription) => {
      const replacement = draft.exerciseReplacements.find(
        (item) => item.plannedExerciseId === prescription.exerciseId,
      );
      const exerciseId = replacement?.exerciseId ?? prescription.exerciseId;
      const completed = draft.completedSets
        .filter((set) => set.plannedExerciseId === prescription.exerciseId)
        .map(({ targetValue, completedValue, weightGrams }) => ({
          targetValue,
          completedValue,
          weightGrams,
        }));
      const feedback = normalizeExerciseFeedback(
        exerciseFeedback[prescription.exerciseId],
        `exerciseFeedback.${prescription.exerciseId}`,
      );
      return {
        plannedExerciseId: prescription.exerciseId,
        exerciseId,
        name: EXERCISE_LIBRARY[exerciseId].name,
        unit: EXERCISE_LIBRARY[exerciseId].unit,
        status: completed.length === prescription.sets
          ? "completed"
          : completed.length > 0 ? "shortened" : "skipped",
        sets: completed,
        feedbackRecorded: feedback.recorded,
        discomfort: feedback.discomfort,
      };
    }),
  };
}

export function workoutDraftProgress(draft) {
  const step = getWorkoutStep(draft);
  const totalSets = step.template.exercises.reduce((sum, item) => sum + item.sets, 0);
  const progressedSets = step.template.exercises.reduce((sum, prescription) => {
    if (draft.skippedExerciseIds.includes(prescription.exerciseId)) {
      return sum + prescription.sets;
    }
    return sum + draft.completedSets.filter(
      (set) => set.plannedExerciseId === prescription.exerciseId,
    ).length;
  }, 0);
  return {
    completedSets: progressedSets,
    totalSets,
    currentExercise: Math.min(draft.currentExerciseIndex + 1, step.template.exercises.length),
    totalExercises: step.template.exercises.length,
  };
}

export function estimateWorkoutDurationMinutes(draft, completedAt) {
  assertValidWorkoutDraft(draft);
  assertIsoTimestamp(completedAt, "completedAt");
  if (completedAt < draft.startedAt) throw new TypeError("completedAt 不能早于 startedAt");
  return Math.min(
    1_440,
    Math.max(1, Math.round((Date.parse(completedAt) - Date.parse(draft.startedAt)) / 60_000)),
  );
}

function advance(draft, prescription) {
  if (draft.currentSetIndex + 1 < prescription.sets) {
    draft.currentSetIndex += 1;
  } else {
    draft.currentExerciseIndex += 1;
    draft.currentSetIndex = 0;
  }
}

function getTemplate(templateId) {
  const template = GUIDED_TEMPLATES[templateId];
  if (!template) throw new TypeError(`未知训练模板：${String(templateId)}`);
  return template;
}

function normalizeExerciseFeedback(feedback, path) {
  if (feedback === undefined || feedback === null) {
    return { recorded: false, discomfort: null };
  }
  if (feedback === "none") {
    return { recorded: true, discomfort: null };
  }
  assertPlainObject(feedback, path);
  assertExactKeys(feedback, ["bodyPart", "severity"], path);
  if (!DISCOMFORT_BODY_PARTS.includes(feedback.bodyPart)) {
    throw new TypeError(`${path}.bodyPart 不是有效部位`);
  }
  assertInteger(feedback.severity, 1, 3, `${path}.severity`);
  return {
    recorded: true,
    discomfort: {
      bodyPart: feedback.bodyPart,
      severity: feedback.severity,
    },
  };
}

function assertPlainObject(value, path) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${path} 必须是对象`);
  }
}

function assertExactKeys(value, expectedKeys, path) {
  const actual = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new TypeError(`${path} 字段不完整或包含未知字段`);
  }
}

function assertInteger(value, min, max, path) {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new TypeError(`${path} 必须是 ${min}～${max} 的整数`);
  }
}

function assertDate(value, path) {
  const parsed = typeof value === "string" ? new Date(`${value}T00:00:00Z`) : null;
  if (!parsed || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new TypeError(`${path} 必须是有效的 YYYY-MM-DD`);
  }
}

function assertIsoTimestamp(value, path) {
  const parsed = typeof value === "string" ? new Date(value) : null;
  if (!parsed || Number.isNaN(parsed.getTime()) || parsed.toISOString() !== value) {
    throw new TypeError(`${path} 必须是标准 UTC ISO 8601 时间戳`);
  }
}

function assertUuid(value, path) {
  if (typeof value !== "string"
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new TypeError(`${path} 必须是 UUID`);
  }
}
