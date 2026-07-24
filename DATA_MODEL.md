# HealthLife schema v1

## 根对象

本地数据以一个完整对象保存。根对象字段固定，导入或读取时遇到未知字段、缺失字段或未知版本将拒绝使用。

```js
{
  schemaVersion: 1,
  settings: {},
  workouts: [],
  meals: [],
  sleepRecords: [],
  weights: [],
  hydration: []
}
```

日期统一使用本地自然日 `YYYY-MM-DD`，时间统一使用 `HH:mm`。记录 ID 使用 UUID，`createdAt` 和 `updatedAt` 使用标准 UTC ISO 8601 时间戳。

## 设置

| 字段 | 类型 | 规则 |
| --- | --- | --- |
| `weightUnit` | string | `kg` 或 `lb`，只影响界面显示 |
| `goalWeightGrams` | integer／null | 20,000～500,000 克 |

## 运动记录

| 字段 | 类型 | 规则 |
| --- | --- | --- |
| `id` | string | UUID，全数据唯一 |
| `date` | string | 本地自然日 |
| `type` | string | `strength`、`cardio`、`walking`、`stretching`、`ballSports`、`other` |
| `durationMinutes` | integer | 1～1,440 分钟 |
| `intensity` | integer | 1～3，分别表示低、中、高 |
| `note` | string | 0～500 个字符 |
| `createdAt` | string | UTC ISO 8601 时间戳 |
| `updatedAt` | string | 不早于 `createdAt` |

## 饮食记录

| 字段 | 类型 | 规则 |
| --- | --- | --- |
| `id`、`date`、时间戳 | — | 与运动记录相同 |
| `mealType` | string | `breakfast`、`lunch`、`dinner`、`snack` |
| `description` | string | 1～200 个字符 |
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

- 所有记录 ID 在整个根对象中唯一。
- 睡眠、体重和饮水分别按日期唯一；运动和饮食允许同日多条。
- 数值字段必须是整数并在规定范围内，不能使用字符串或隐式转换。
- schema v1 不接受未知字段，不静默丢弃无效项。
- `serializeData` 和 `parseData` 在输出或返回数据前都会执行整体校验。
- 未来修改字段时必须升级 schema 版本并提供明确迁移方案。
