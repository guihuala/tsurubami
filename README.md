# tsurubami v0.1（Tauri 桌宠原型）

一个轻量、透明、可拖拽、会冒一句话的桌面桌宠原型。  
这个版本重点是“像个桌宠挂在桌面上”，不是聊天面板。

## 功能（v0.1）

- Tauri 桌面应用（无边框、透明、始终置顶、小尺寸窗口）
- 角色待机动画（轻微浮动/呼吸感）
- 点击角色弹出随机短台词（避免连续重复）
- 右键极简菜单：`你好呀` / `重置位置` / `退出`
- 拖拽角色移动窗口位置
- 关闭后重开记住窗口位置
- 保留并整理了旧版的轻互动粒子效果（点击时散射光点）

## 目录结构

```text
.
├─ src/
│  ├─ app.js                  # 应用初始化
│  ├─ main.js                 # 入口
│  ├─ styles/main.css         # 桌宠样式
│  ├─ assets/                 # 原项目角色资源
│  ├─ pet/                    # 角色状态与台词
│  ├─ bubble/                 # 气泡逻辑
│  ├─ interaction/            # 拖拽交互
│  ├─ storage/                # 位置存取调用
│  └─ menu/                   # 右键菜单
└─ src-tauri/
   ├─ src/main.rs             # 原生窗口能力与位置持久化
   └─ tauri.conf.json         # Tauri 配置
```

## 环境要求

- Node.js 18+
- Rust stable（含 `cargo`）
- 系统依赖按 Tauri 官方文档安装（Windows/macOS/Linux）

## 安装依赖

```bash
npm install
```

## 启动开发环境

```bash
npm run tauri dev
```

> `tauri dev` 会自动启动前端 Vite 服务并拉起桌宠窗口。

## 打包（构建）

```bash
npm run tauri build
```

> 当前 `tauri.conf.json` 中 `bundle.active` 为 `false`，会先完成可执行程序构建流程。  
> 你可以在准备好图标后改为 `true` 继续出安装包。

## 下一步建议

1. 增加“自动贴边/吸附屏幕边缘”与缓动动画
2. 加入更多状态（困、开心、摸头）及切图
3. 增加本地可编辑台词文件（JSON）
4. 添加系统托盘图标与托盘菜单
5. 加入“开机自启”开关（仍保持无联网）

