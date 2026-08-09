# HealthLife schema v11

## 根对象

```js
{
  schemaVersion: 11,
  weeklyTraining: [/* 周一至周日 7 项 */],
  foods: [],
  healthStages: [],
  workouts: [],
  meals: [],
  sleepRecords: [],
  weights: []
}
```

schema v11 使用 `healthlife:data:v11` 独立存储键。应用优先读取 v11；没有 v11 时，只对有效的 `healthlife:data:v10` 执行一次兼容迁移，不读取 v1 至 v9。迁移先完整校验 v10，再生成并校验 v11，写入 v11 成功后才进入可编辑状态；原 v10 键始终保留。迁移写入失败时展示迁移后的只读数据，并提供原始 v10 内容下载，不允许界面假装保存成功。

完整备份使用 `backupVersion: 11`。导入接受 v11，也接受经过整体校验后迁移的 v10；其他版本拒绝。

进行中的引导训练继续使用 `healthlife:workout-draft:v2`，撤销历史使用 `healthlife:workout-undo:v1`。它们不是正式健康记录，不进入完整备份或分析导出。

## 通用规则

- 所有业务对象和饮食食材快照使用 UUID；UUID 在根对象内全局唯一。
- 日期为本地自然日 `YYYY-MM-DD`，时间为 `HH:mm`。
- 正式记录、个人食材和健康阶段包含 `createdAt`、`updatedAt` ISO 8601 时间戳。
- 所有对象严格校验字段，不接受未知字段。
- 睡眠和体重按日期唯一；运动和饮食允许同日多条。
- 体重以整数克保存，运动时长使用整数分钟，蛋白质以整数毫克保存。

## 个人常用食材

`foods` 的数组顺序就是界面顺序，每项包含：

- `id`、`name`：名称去除首尾空白后不得为空，同名食材不允许重复。
- `category`：`protein`、`staple`、`vegetable`、`fruit`、`dairy`、`drink` 或 `other`。
- `defaultAmount`：1～100000 的整数默认份量。
- `unit`：`grams`、`milliliters`、`piece` 或 `serving`。
- `proteinReference`：可以为 `null`，此时食材只用于快速记录。
- `createdAt`、`updatedAt`。

启用蛋白质估算时，`proteinReference` 固定包含：

- `referenceAmount`：与食材 `unit` 相同的参考份量。
- `proteinMilligrams`：该参考份量中的整数毫克蛋白质。
- `basis`：`raw`、`cooked`、`edible` 或 `packaged`。
- `source`：`packageLabel`、`publicReference` 或 `other`。
- `sourceNote`：0～300 个字符的来源说明。

不同单位以及生重、熟重、可食部分和包装份量之间不得静默换算。

## 饮食

餐食继续保存 `mealType` 和 `content`，并新增：

- `freeText`：0～2000 个字符的自由文字补充。v10 饮食迁移时，原 `content` 原样写入这里。
- `foodItems`：最多 50 个食材历史快照；同一餐不能重复选择同一来源食材。

`content` 由食材快照和 `freeText` 生成，仍是后续人工分析可直接阅读的原文。没有食材时，`freeText` 不得为空。

每个 `foodItems` 快照保存：

- 独立 `id`、历史来源 `sourceFoodId`、名称、分类、实际份量和单位。
- `proteinEstimate`：无法估算时为 `null`；可估算时保存本次数量对应的整数毫克，以及参考份量、参考蛋白质、口径、来源和来源说明。

`sourceFoodId` 是历史来源标识，不要求当前食材库仍存在。修改或移除常用食材不会改变已经保存的快照；编辑旧饮食时继续使用该记录原有参考值，除非用户先移除后重新选择当前食材。

自由文字不自动解析。只要存在未估算食材或非空 `freeText`，该餐就标记为部分估算或未估算，不输出确定性缺口。

## 当前健康阶段

`healthStages` 为版本化数据基础，界面将在后续切片启用。同一时间最多一个 `active` 阶段。每项包含：

- `id`、`title`、`startDate`、`endDate`、`status`、`completedAt`、`createdAt`、`updatedAt`。
- 周期为 1～84 个自然日；状态为 `active` 或 `completed`。
- `goals` 固定包含 `protein`、`strength` 和 `cardio`，其中必须启用 1～2 项。
- 蛋白质目标保存每日最小／最大整数毫克；力量和有氧目标保存每周次数。

阶段统计只消费正式饮食和运动记录，输出样本量、估算覆盖和实际次数，不生成第二套打钩状态，也不根据缺失记录判断失败。

## 每周训练模板

`weeklyTraining` 固定为周一至周日 7 项，可选 `strengthA`、`strengthB`、`runWalk`、`rest`。模板只用于当天推荐，不保存执行状态、工作安排或改期关系，也不会自动生成运动记录。

## 运动

运动包含类型、整数分钟、1～3 强度、`manual`／`appleWatch` 来源、可选平均心率、适用类型的可选距离、可选引导训练快照和备注。引导训练快照固定保存原计划动作、实际动作、组次、目标值、完成值、负重、主观用力感和可选不适反馈，动作库更新不得改变历史数据。

## 睡眠与体重

- 睡眠包含入睡时间、起床时间、1～5 质量评分、夜醒次数和备注，归属于起床日期；入睡和起床时间相同时拒绝计算。
- 体重包含整数克、可选体脂基点和备注；7 日均重只使用窗口内已有样本，不补零。

## 备份与分析导出

- v11 完整备份保留每周模板、常用食材、健康阶段和四类正式记录，用于完整替换恢复。
- v10 备份迁移只保留原饮食文字，不猜测食材或蛋白质快照。
- 分析 JSON 当前继续按自然日输出体重、睡眠、运动和餐食 `content`；蛋白质趋势与结构化分析字段留到 v11 切片五。
- 导入必须先验证版本、字段、范围、UUID、日期唯一性和全局 ID 唯一性，覆盖前保护当前完整数据。
