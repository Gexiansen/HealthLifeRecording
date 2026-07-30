# HealthLife schema v4

## 根对象

本地数据以一个完整对象保存。根对象字段固定，导入或读取时遇到未知字段、缺失字段或未知版本将拒绝使用。

```js
{
  schemaVersion: 4,
  settings: {},
  trainingPlan: {
    weeklyTraining: [],
    dailyPlans: []
  },
  foodPreferences: {},
  customFoods: [],
  recipes: [],
  workouts: [],
  dailyActivities: [],
  meals: [],
  sleepRecords: [],
  weights: [],
  hydration: []
}
```

日期统一使用本地自然日 `YYYY-MM-DD`，时间统一使用 `HH:mm`。记录 ID 使用 UUID，`createdAt` 和 `updatedAt` 使用标准 UTC ISO 8601 时间戳。

schema v4 使用 `healthlife:data:v4` 独立存储键。首次读取不到 v4 时，只尝试从 `healthlife:data:v3` 自动迁移并写入 v4；原 v3 键不删除。应用不读取或迁移 v1／v2。完整备份版本升级为 4，并允许导入有效的 v3 完整备份后转换为 v4。

## 设置

| 字段 | 类型 | 规则 |
| --- | --- | --- |
| `weightUnit` | string | `kg` 或 `lb`，只影响界面显示 |
| `goalWeightGrams` | integer／null | 20,000～500,000 克 |
| `eggGramsPerPiece` | integer | 每个水煮鸡蛋的可食部分克数，20～100，默认 50 |

## 健康计划

`trainingPlan.weeklyTraining` 固定保存周一至周日 7 项默认训练，可选值为 `strengthA`、`strengthB`、`runWalk`、`walking`、`mobility`、`rest`。默认模板为周二力量 A、周四力量 B、周六跑走结合，其他日期休息。

`trainingPlan.dailyPlans` 每个自然日最多一条，字段如下：

| 字段 | 类型 | 规则 |
| --- | --- | --- |
| `id`、`date`、时间戳 | — | UUID、自然日和标准时间戳；日期唯一 |
| `workdayType` | string | `normal`、`overtime25`、`overtime30`、`overtime35`、`weekendOvertime`、`rest` |
| `trainingOverride` | string／null | 覆盖当周模板的训练类型；`null` 表示继续使用模板 |
| `status` | string | `planned`、`completed`、`shortened`、`rescheduled`、`rest` |
| `rescheduledToDate` | string／null | 仅 `rescheduled` 状态必填，且不能与原日期相同 |

计划状态不等于实际运动记录。只有用户另外保存运动记录后，运动才进入训练统计。

## 食物偏好

| 字段 | 类型 | 规则 |
| --- | --- | --- |
| `favoriteRefs` | string[] | 最多 100 项，不重复 |
| `recentRefs` | string[] | 最近使用优先，最多 12 项，不重复 |

食物引用使用稳定字符串：内置食物以 `builtin:` 开头，自定义食品以 `custom:` 开头，菜谱以 `recipe:` 开头。

## 自定义食品

| 字段 | 类型 | 规则 |
| --- | --- | --- |
| `id` | string | UUID，全数据唯一 |
| `name` | string | 1～60 个字符 |
| `foodState` | string | `raw`、`cooked`、`packaged`、`prepared` |
| `energyKcalPer100g` | number | 每 100 克 0～1,000 kcal，最多一位小数 |
| `proteinGramsPer100g` | number | 每 100 克 0～100 g，最多一位小数 |
| `fatGramsPer100g` | number | 每 100 克 0～100 g，最多一位小数 |
| `carbsGramsPer100g` | number | 每 100 克 0～100 g，最多一位小数 |
| `createdAt`、`updatedAt` | string | UTC ISO 8601 时间戳 |

## 食物明细快照

餐食和菜谱原料都保存完整快照，字段固定：

| 字段 | 类型 | 规则 |
| --- | --- | --- |
| `id` | string | UUID，全数据唯一 |
| `foodRef` | string | 1～100 个字符的食物引用 |
| `name` | string | 计算时使用的食物名称 |
| `foodState` | string | 生重、熟重、包装或成品状态 |
| `grams` | integer | 1～100,000 克 |
| `inputUnit` | string | `grams` 或 `piece` |
| `inputQuantity` | integer | 用户录入的克数或个数 |
| `unitGrams` | integer | 每单位对应克数；按克录入时固定为 1 |
| 四项 `*Per100g` | number | 计算时使用的每 100 克营养值快照 |
| `source` | string | `builtIn`、`custom`、`recipe`、`estimated` |
| `confidence` | string | `high`、`medium`、`low` |

`grams` 必须等于 `inputQuantity × unitGrams`。单项营养按“每 100 克营养值 × 实际克数 ÷ 100”计算，餐食营养是全部明细之和，最终统一保留一位小数。

## 自制菜谱

| 字段 | 类型 | 规则 |
| --- | --- | --- |
| `id` | string | UUID，全数据唯一 |
| `name` | string | 1～60 个字符 |
| `ingredients` | 食物明细快照[] | 1～50 项，记录各原料投入克数 |
| `finishedWeightGrams` | integer | 烹饪完成后的整道菜熟重，1～100,000 克 |
| `createdAt`、`updatedAt` | string | UTC ISO 8601 时间戳 |

菜谱先汇总全部原料营养，再用成品熟重折算每 100 克营养。食用油和调料按普通原料加入。

## 运动记录

| 字段 | 类型 | 规则 |
| --- | --- | --- |
| `id` | string | UUID，全数据唯一 |
| `date` | string | 本地自然日 |
| `type` | string | `strength`、`running`、`cardio`、`walking`、`stretching`、`ballSports`、`other` |
| `durationMinutes` | integer | 1～1,440 分钟 |
| `intensity` | integer | 1～3，分别表示低、中、高 |
| `source` | string | `manual` 或 `appleWatch` |
| `activeEnergyKcal` | integer／null | Apple Watch 活动热量摘要，1～10,000 kcal |
| `averageHeartRateBpm` | integer／null | 平均心率，30～240 bpm |
| `maxHeartRateBpm` | integer／null | 最高心率，30～240 bpm，不能低于平均心率 |
| `distanceMeters` | integer／null | 距离，1～1,000,000 米 |
| `note` | string | 0～500 个字符 |
| `createdAt` | string | UTC ISO 8601 时间戳 |
| `updatedAt` | string | 不早于 `createdAt` |

平均配速由 `durationMinutes ÷ distanceMeters` 计算，只在存在距离时展示，不单独持久化。上述设备指标都是可选摘要，`source: appleWatch` 表示由用户从 Apple Watch 手动抄录，不代表网页已直接连接 HealthKit。

## 每日活动

| 字段 | 类型 | 规则 |
| --- | --- | --- |
| `id`、`date`、时间戳 | — | 与运动记录相同；每个日期最多一条 |
| `steps` | integer | 1～100,000 步 |
| `source` | string | `manual` 或 `appleWatch` |
| `note` | string | 0～500 个字符 |

## 饮食记录

| 字段 | 类型 | 规则 |
| --- | --- | --- |
| `id`、`date`、时间戳 | — | 与运动记录相同 |
| `mealType` | string | `breakfast`、`lunch`、`dinner`、`snack` |
| `trackingMode` | string | `precise` 或 `estimated` |
| `confidence` | string | `high`、`medium`、`low`；精确模式不得使用 `low` |
| `items` | 食物明细快照[] | 1～50 项 |
| `healthScore` | integer | 1～5，只表达用户主观评价 |
| `fullnessScore` | integer | 1～5，只表达用户主观饱腹感 |
| `note` | string | 0～500 个字符 |

## 睡眠记录

| 字段 | 类型 | 规则 |
| --- | --- | --- |
| `id`、时间戳 | — | 与运动记录相同 |
| `date` | string | 起床日期；每个日期最多一条 |
| `sleepTime` | string | 入睡时间 `HH:mm` |
| `wakeTime` | string | 起床时间 `HH:mm` |
| `qualityScore` | integer | 1～5，主观睡眠质量 |
| `awakeCount` | integer | 0～50 次 |
| `note` | string | 0～500 个字符 |

起床时间早于入睡时间时按跨日计算；两者相等视为无效输入，不把它解释为睡眠 24 小时。

## 体重记录

| 字段 | 类型 | 规则 |
| --- | --- | --- |
| `id`、`date`、时间戳 | — | 与运动记录相同；每个日期最多一条 |
| `weightGrams` | integer | 20,000～500,000 克 |
| `bodyFatBasisPoints` | integer／null | 100～7,500，即 1.00％～75.00％ |
| `note` | string | 0～500 个字符 |

体重趋势使用指定结束日期向前 7 个自然日内的已有记录计算平均值，缺失日期不补零，结果同时返回样本数。

趋势页的 7 天／30 天比较使用紧邻当前窗口、长度相同的上一自然日窗口。只有当前和上一周期都存在对应样本时才展示差值；数据不足时返回 `null` 并明确显示无可比样本，不补零或推断健康结论。

## 饮水记录

| 字段 | 类型 | 规则 |
| --- | --- | --- |
| `id`、`date`、时间戳 | — | 与运动记录相同；每个日期最多一条 |
| `milliliters` | integer | 1～20,000 毫升 |
| `note` | string | 0～500 个字符 |

## 完整性规则

- 自定义食品、菜谱、菜谱原料、业务记录和餐食明细的 ID 在整个根对象中唯一。
- 睡眠、体重、饮水和每日活动分别按日期唯一；运动和饮食允许同日多条。
- 重量和其他整数单位字段必须是整数；每 100 克营养值最多一位小数，不能使用字符串或隐式转换。
- schema v4 不接受未知字段，不静默丢弃无效项。
- `serializeData` 和 `parseData` 在输出或返回数据前都会执行整体校验。
- v4 完整备份保留训练模板、每日计划、食物库、菜谱、偏好、所有历史营养快照、运动摘要和每日步数。
- 分析 JSON 按自然日汇总计划状态、体重、睡眠、运动、每日步数、餐食明细、每日营养和饮水，供后续趋势分析使用。
