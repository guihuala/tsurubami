# 未完成模块清单与开发顺序建议

这份文档用于说明当前仓库里哪些能力已经完成、哪些还处在半成品阶段，以及后续比较合理的推进顺序。

## 总览

当前项目已经具备一个可运行的桌宠主循环：

- 主窗口、透明置顶、拖拽和位置记忆已经可用
- 台词、时间语境、行为状态切换已经接入主流程
- 设置窗口、点击穿透、托盘菜单已经可用
- 提醒和实验性互动已经接入桌宠行为

但从“原型能跑”走向“功能完整、可持续迭代”，仍有几块明显未完成：

1. 提醒系统第一阶段已完成，但还没进入更完整的管理体验
2. 麦克风 / 声音反应模块已接入主流程，但还需要联调与体验收尾
3. 发布打包流程还没收尾
4. 设置系统和文案资源还缺少对未来扩展的支撑

## 模块清单

## 1. 提醒系统

### 当前状态

- 已有提醒调度器和提醒触发逻辑
- 桌宠已经能在提醒到点时说话并展示提醒内容
- 设置页已经支持提醒列表、筛选、新增、编辑、删除、启停
- 提醒数据已经本地持久化，支持一次性和每日重复
- 可恢复演示提醒，方便联调和展示

### 未完成点

- 还没有批量操作或更完整的提醒管理页
- 没有更细的排序配置和分组视图
- 还没有提醒完成后的归档或历史视图
- 还没有更强的校验与引导，例如冲突检查、批量恢复、导入导出

### 影响

- 已经可以作为基础提醒功能使用
- 但还没有到“重度提醒工具”的完成度

### 代码位置

- [src/reminder/reminder-store.js](/Users/xuzi/Downloads/tsurubami/src/reminder/reminder-store.js)
- [src/reminder/reminder-scheduler.js](/Users/xuzi/Downloads/tsurubami/src/reminder/reminder-scheduler.js)
- [src/pet/pet.js](/Users/xuzi/Downloads/tsurubami/src/pet/pet.js)

## 2. 麦克风 / 声音反应

### 当前状态

- 已经有麦克风监听器
- 已经有音量分析器
- 已经有声音事件到桌宠状态的映射逻辑
- 主状态机也预留了 `sound-react` 和 `startled` 这类状态
- 设置页已经支持麦克风开关、灵敏度和状态展示
- 主流程已经能根据环境声音触发桌宠反应
- 声音相关基础台词已经补齐

### 未完成点

- 还缺真实设备环境下的灵敏度调优
- 权限被拒绝后的引导还可以更完整
- 还没有更细的声音事件去抖和环境噪音适配
- 还没有历史调试面板来观察声音分类结果

### 影响

- 这块功能现在已经可见、可用
- 但在不同设备和不同环境噪音下，体验可能还不够稳定

### 代码位置

- [src/audio/microphone-monitor.js](/Users/xuzi/Downloads/tsurubami/src/audio/microphone-monitor.js)
- [src/audio/audio-analyzer.js](/Users/xuzi/Downloads/tsurubami/src/audio/audio-analyzer.js)
- [src/pet/pet-audio-reaction.js](/Users/xuzi/Downloads/tsurubami/src/pet/pet-audio-reaction.js)
- [src/pet/pet-config.js](/Users/xuzi/Downloads/tsurubami/src/pet/pet-config.js)

## 3. 打包与发布

### 当前状态

- 开发模式可运行
- 可以执行 `npm run tauri build`
- Tauri 主配置已经建立

### 未完成点

- `bundle.active` 仍为 `false`
- 图标配置还没有完整启用
- 发布产物的目标平台体验还没验证
- 安装包、签名、分发方式等都还没进入正式收尾阶段

### 影响

- 目前更适合本地开发与自用测试
- 不适合直接作为“可以分发给别人安装”的成品

### 代码位置

- [src-tauri/tauri.conf.json](/Users/xuzi/Downloads/tsurubami/src-tauri/tauri.conf.json)
- [src-tauri/icons/icon.png](/Users/xuzi/Downloads/tsurubami/src-tauri/icons/icon.png)

## 4. 设置系统扩展性

### 当前状态

- 已支持基础开关项
- 主窗口和设置窗口之间的同步已经打通
- 点击穿透状态也有恢复机制

### 未完成点

- 还没有为未来功能预留更多配置项，例如：
  - 麦克风互动
  - 提醒管理
  - 灵敏度或行为强度细分
  - 角色资源切换
- 设置项迁移策略较轻，未来字段变多后需要更明确的版本演进方式

### 影响

- 现阶段够用
- 一旦功能继续扩展，设置结构会开始变得拥挤，维护成本会上升

### 代码位置

- [src/settings/settings-store.js](/Users/xuzi/Downloads/tsurubami/src/settings/settings-store.js)
- [src/settings-window.js](/Users/xuzi/Downloads/tsurubami/src/settings-window.js)
- [settings.html](/Users/xuzi/Downloads/tsurubami/settings.html)

## 5. 台词资源补全

### 当前状态

- 已有基础时间段台词、点击台词、提醒台词、情绪台词
- 台词去重和按上下文选择的逻辑已经存在

### 未完成点

- 声音反应相关台词分类还没补齐
- 某些状态仍依赖兜底文案
- 台词资源目前完全写死在代码里，不方便后期维护或扩写

### 影响

- 会限制新功能接入速度
- 后续台词量变大后，不适合继续全部塞在单文件里维护

### 代码位置

- [src/dialogue/lines.js](/Users/xuzi/Downloads/tsurubami/src/dialogue/lines.js)
- [src/dialogue/line-selector.js](/Users/xuzi/Downloads/tsurubami/src/dialogue/line-selector.js)

## 建议开发顺序

## 第一阶段：把现有可见功能做完整

优先级最高的是提醒系统产品化。

建议目标：

- 增加可编辑的提醒列表
- 支持新增、修改、删除、启停提醒
- 将提醒数据持久化到本地
- 启动应用后自动恢复提醒

这样做的好处是：

- 复用现有桌宠行为逻辑最多
- 用户价值最直接
- 风险比接麦克风更低

## 第二阶段：接通麦克风互动

在提醒系统稳定后，再做声音反应接入。

建议目标：

- 在设置页增加麦克风互动开关
- 接入权限申请和状态提示
- 将声音事件真正连接到桌宠状态机
- 补全对应台词和异常处理

这样做的好处是：

- 体验上会明显提升桌宠“陪伴感”
- 但它涉及权限、设备和环境噪音问题，适合放在第二阶段做

## 第三阶段：整理配置与资源结构

当提醒和麦克风都接入后，再整理基础设施。

建议目标：

- 扩展设置模型
- 梳理设置迁移策略
- 拆分台词资源
- 明确演示数据和正式数据的边界

这样做可以避免太早抽象，也能减少后期返工。

## 第四阶段：发布收尾

在功能稳定后再做打包与分发。

建议目标：

- 完成图标和 bundle 配置
- 验证目标平台安装体验
- 确认托盘、透明窗口、点击穿透等平台相关行为
- 准备可分发版本

这样更合理，因为发布问题通常要结合最终功能一起验证。

## 推荐里程碑

## M1：提醒可配置

- 已完成
- 用户可以管理自己的提醒
- 重启后提醒仍然存在
- 设置页能够进入提醒管理流程

## M2：声音互动上线

- 已完成第一版
- 用户可选择是否开启麦克风互动
- 桌宠能对环境声音做出基础反馈
- 权限异常已有基本提示
- 后续还需要做真实环境调优

## M3：结构整理

- 设置、台词、数据层结构更稳定
- 便于后续加新角色、新状态或新互动方式

## M4：可分发版本

- 完成打包配置
- 具备对外测试或分享的基础条件

## 一句话建议

最划算的路线不是先追求“更多酷功能”，而是先把已经露出的能力补成完整闭环：

1. 先做提醒产品化
2. 再接通麦克风互动
3. 然后整理设置和资源结构
4. 最后做发布收尾

这样可以让每一步都变成真正可交付的成果，而不是继续累积半成品模块。
