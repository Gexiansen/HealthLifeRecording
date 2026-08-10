# HealthLife schema v12

## 根对象

```js
{
  schemaVersion: 12,
  weeklyTraining: [/* 周一至周日 7 项 */],
  foods: [],
  healthStages: [],
  workouts: [],
  meals: [],
  sleepRecords: [],
  weights: []
}
```

schema v12 使用 `healthlife:data:v12` 独立存储键。应用优先读取 v12；没有 v12 时优先校验并迁移 `healthlife:data:v11`，只有缺少 v11 键时才校验并链式迁移 `healthlife:data:v10`，不读取 v1 至 v9。迁移写入 v12 成功后才进入可编辑状态；原 v11 和已有 v10 键始终保留。当前版本键或优先前序版本键损坏时停止并提示，不继续回退到更旧数据覆盖异常事实。迁移写入失败时展示迁移后的只读数据，并提供原始前序版本内容下载。

完整备份使用 `backupVersion: 12`。导入接受 v12，也接受经过整体校验后迁移的 v11 或 v10；其他版本拒绝。

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

`sourceFoodId` 是历史来源标识，不要求当前食材库仍存在。移除常用食材不会改变已经保存的快照；普通食材信息修改和蛋白质参考值修改默认也只影响以后记录。编辑旧饮食时继续使用该记录原有参考值，除非用户先移除后重新选择当前食材。

修改已有食材的蛋白质参考定义且存在同一 `sourceFoodId` 的历史快照时，应用必须先给出影响餐数、日期范围和旧估算到新估算的预览，并由用户明确选择“仅影响以后记录”或“同步修正历史估算”。同步修正只处理单位一致、蛋白质口径兼容的快照，按各餐已保存的 `amount` 重新生成 `proteinEstimate`，同时更新该餐 `updatedAt`；`content`、`freeText`、食材名称、分类、份量和单位均保持不变。食材单位或生重／熟重等口径发生变化时禁止批量回算。整次食材与历史修正通过一次 v12 根对象写入完成，失败时不改变内存界面状态，成功后允许短时间撤销整个修改。

自由文字不自动解析。只要存在未估算食材或非空 `freeText`，该餐就标记为部分估算或未估算，不输出确定性缺口。

饮食表单中的三餐蛋白质建议只属于录入时的界面提示，不写入餐食对象，也不参与历史回算。早餐、午餐和晚餐根据当前工作范围或活动健康阶段的每日目标显示建议范围；加餐不使用三餐建议。目标提示不改变正式记录、快照或趋势统计口径。

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

运动通用字段包含 `scenario`、类型、整数分钟、1～3 强度、`manual`／`appleWatch` 来源、可选平均心率、适用类型的可选距离、`keepDetails`、`guidedSession` 和备注。`scenario` 只能是：

- `keep`：`keepDetails` 必填，保存课程名称、是否完整完成、可选整数克器械重量，以及“未反馈／明确无不适／具体不适”的整体反馈；不保存距离。
- `running`：类型固定为 `running`，可选距离和平均心率；`keepDetails`、`guidedSession` 必须为 `null`。
- `other`：类型不能为 `running`，普通新增只记录类型、时长、强度和备注；迁移得到的旧设备字段在编辑时尽量保留，不据此猜测 Keep。
- `guided`：只由备用文字训练生成，`guidedSession` 必填且 `keepDetails` 为 `null`，不出现在普通运动场景选择器中。

引导训练快照固定保存原计划动作、实际动作、组次、目标值、完成值、负重、主观用力感和可选不适反馈，动作库更新不得改变历史数据。v11 迁移时，有引导快照的记录映射为 `guided`，普通跑步映射为 `running`，其余映射为 `other`；所有旧记录的 `keepDetails` 均为 `null`，不得从类型或来源猜测 Keep。

## 睡眠与体重

- 睡眠包含入睡时间、起床时间、1～5 质量评分、夜醒次数和备注，归属于起床日期；入睡和起床时间相同时拒绝计算。
- 体重包含整数克、可选体脂基点和备注；7 日均重只使用窗口内已有样本，不补零。

## 备份与分析导出

- v12 完整备份保留每周模板、常用食材、健康阶段和四类正式记录，用于完整替换恢复。
- v11 备份迁移补齐运动场景；v10 备份继续链式迁移，旧饮食只保留原文，不猜测食材、蛋白质快照或 Keep 场景。
- 分析 JSON 当前按自然日输出体重、睡眠、运动场景、Keep／引导详情和餐食 `content`；蛋白质趋势与更完整的结构化饮食字段留到 v11 切片五。
- 导入必须先验证版本、字段、范围、UUID、日期唯一性和全局 ID 唯一性，覆盖前保护当前完整数据。
