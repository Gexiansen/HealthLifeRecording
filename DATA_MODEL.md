# HealthLife schema v8

## 根对象

```js
{
  schemaVersion: 8,
  settings: { weightUnit, goalWeightGrams, eggGramsPerPiece },
  weeklyTraining: [/* 周一至周日 7 项 */],
  foodPreferences: { favoriteRefs, recentRefs },
  customFoods: [],
  recipes: [],
  workouts: [],
  meals: [],
  sleepRecords: [],
  weights: []
}
```

schema v8 使用 `healthlife:data:v8` 独立存储键。应用不读取、不迁移 v1 至 v7 数据；旧键不主动删除。完整备份只接受 `backupVersion: 8`。

进行中的引导训练继续使用 `healthlife:workout-draft:v2`，撤销历史使用独立的 `healthlife:workout-undo:v1`。撤销历史保存同一训练草稿的最近状态快照，最多 50 项；每个快照必须通过完整草稿校验并与当前草稿 UUID 匹配。它们都不是正式健康记录，不进入完整备份或分析导出。

## 通用规则

- 所有业务记录使用 UUID，日期为本地自然日 `YYYY-MM-DD`，时间为 `HH:mm`。
- 每条正式记录包含 `createdAt` 和 `updatedAt` ISO 8601 时间戳。
- 所有对象严格校验字段，不接受未知字段。
- 睡眠和体重按日期唯一；运动和饮食允许同日多条。
- 体重以整数克保存，食物重量和运动时长均使用整数。

## 每周训练模板

`weeklyTraining` 固定为周一至周日 7 项，可选 `strengthA`、`strengthB`、`runWalk`、`walking`、`mobility`、`rest`。模板只用于当天推荐，不保存执行状态、工作安排或改期关系，也不会自动生成运动记录。

## 运动

运动包含：

- `type`：力量、跑步、有氧、步行、拉伸、球类或其他。
- `durationMinutes`：1～1440 的整数分钟。
- `intensity`：1～3。
- `source`：`manual` 或 `appleWatch`。
- `averageHeartRateBpm`：可选，30～240。
- `distanceMeters`：跑步、步行或有氧可选。
- `guidedSession`：可选的引导训练快照。
- `note`：可选备注。

引导训练快照固定保存原计划动作、实际动作、组次、目标值、完成值、负重、主观用力感和可选不适反馈，避免动作库更新改变历史数据。

## 饮食

餐食包含餐次、精确／估算模式、可信度、一个或多个食物明细、可选饱腹感和备注。每个食物明细保存：

- 食物引用、名称、生熟／包装状态、来源和可信度。
- 整数克数，以及录入单位、数量和单个克数快照。
- 计算时的每 100 克热量、蛋白质、脂肪和碳水快照。

按个录入时必须满足 `grams === inputQuantity * unitGrams`。营养汇总由食物快照计算，不能直接编辑。饱腹感为可选的 1～5，不保存“健康程度”评分。

## 睡眠

睡眠包含入睡时间、起床时间、1～5 质量评分、夜醒次数和备注。记录归属于起床日期；入睡和起床时间相同时拒绝计算。

## 体重

体重包含整数克、可选体脂基点和备注。体脂基点示例：`2660` 表示 `26.60％`。7 日均重只使用窗口内已有样本，不补零。

## 备份与分析导出

- 完整备份保留设置、每周模板、食物库、菜谱、偏好和四类正式记录，用于完整替换恢复。
- 分析 JSON 按自然日输出体重、睡眠、运动、餐食与当日营养，供后续健康习惯分析。
- 导入必须先验证版本、字段、范围、UUID、日期唯一性和跨对象 ID 唯一性。
