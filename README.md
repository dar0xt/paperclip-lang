# paperclip-lang

为 [Paperclip](https://github.com/paperclipai/paperclip) 提供多语言界面支持的插件。无需修改 Paperclip 源码，通过插件系统安装即可切换界面语言。

**当前支持语言：**

- 🇺🇸 English（默认）
- 🇨🇳 中文（简体）
- 🇯🇵 日本語
- 🇰🇷 한국어
- 🇩🇪 Deutsch
- 🇫🇷 Français

---

## 工作原理

插件通过 Paperclip 的 `globalToolbarButton` 插槽挂载，在界面顶部工具栏注入语言选择器。选择非英文语言后，插件使用 `MutationObserver` 监听 DOM 变化，将英文文本节点实时替换为对应语言的翻译内容，无需修改宿主程序的任何文件。

**构建产物完全自包含：**

- Worker（`dist/worker.js`）由 esbuild 打包，SDK 已内联，安装后无需额外依赖
- UI（`dist/ui/index.js`）由 esbuild 打包为单文件，`react` 由 Paperclip 宿主在运行时提供

---

## 安装

### 方式一：从 npm 安装（推荐）

在 Paperclip 界面中：

1. 进入 **Instance Settings → Plugins**
2. 点击 **Install Plugin**
3. 输入包名：

```
paperclip-lang
```

4. 点击 **Install**，等待安装完成

### 方式二：从独立源码目录构建并安装（无需发布 npm）

前置要求：Git、Node.js 18+、npm，以及 Paperclip 实例管理员权限。
以下命令在 **Paperclip 服务器** 上运行。将仓库 URL 换成自己的 fork 即可使用自己的修改：

```bash
git clone https://github.com/hinet/paperclip-lang.git
cd paperclip-lang
npm ci
npm run build
pwd
```

确认生成 `dist/manifest.js`、`dist/worker.js` 和 `dist/ui/index.js`。
本地路径必须是 **Paperclip 进程可访问的绝对路径**。Docker 部署时，将构建后的目录挂载到容器，
并使用容器内的路径，而不是宿主机路径。目录需要在重启、重建容器后仍然存在。

目前普通的 **Install Plugin** 对话框只发送 npm 包名。使用本地目录时，
在已登录该实例的管理员浏览器中，通过同源 API 注册：

```javascript
const response = await fetch("/api/plugins/install", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  credentials: "same-origin",
  body: JSON.stringify({
    packageName: "/absolute/path/visible/to/paperclip/paperclip-lang",
    isLocalPath: true,
  }),
});
console.log(response.status, await response.json());
```

将 `packageName` 替换为实际目录。刷新插件管理页，确认 Language Pack 安装成功并已启用。
如果实例已经安装该插件，应通过该实例支持的升级流程替换原有安装；不要同时运行两个翻译器。
托管云实例可能只允许安装应用自带的插件；此流程面向自行托管的实例。

---

## 使用方法

### 切换语言（工具栏）

安装成功后，页面顶部工具栏会出现语言选择下拉框：

```
🇺🇸 English  ▾
```

点击展开，选择目标语言，页面将自动刷新并应用翻译。

### 切换语言（设置页）

1. 进入 **Instance Settings → Plugins**
2. 找到 **Language Pack**，点击进入设置
3. 从列表中选择语言，点击 **Save & Reload**

语言偏好保存在浏览器 `localStorage` 中，刷新页面后自动恢复，无需重复设置。

---

## 添加新语言

### 步骤 1：在语言注册表中添加条目

编辑 `src/ui/locales/registry.ts`：

```typescript
export const LOCALES: LocaleEntry[] = [
  { code: "en",    nativeName: "English",     englishName: "English",              flag: "🇺🇸" },
  { code: "zh-CN", nativeName: "中文（简体）", englishName: "Chinese (Simplified)", flag: "🇨🇳" },
  // ... 已有语言省略 ...
  // 新增：
  { code: "es",    nativeName: "Español",     englishName: "Spanish",              flag: "🇪🇸" },
];
```

### 步骤 2：创建翻译词典文件

新建 `src/ui/locales/es.ts`：

```typescript
export const es: Record<string, string> = {
  "Home": "Inicio",
  "Issues": "Incidencias",
  "Create": "Crear",
  // ... 更多翻译
};
```

### 步骤 3：注册到翻译映射表

编辑 `src/ui/translations.ts`：

```typescript
import { zhCN } from "./locales/zh-CN.js";
import { es } from "./locales/es.js";  // 新增

export const LOCALE_DICTS: Record<string, Record<string, string>> = {
  "zh-CN": zhCN,
  "es":    es,  // 新增
};
```

### 步骤 4：重新构建并发布

```bash
pnpm build
npm publish
```

---

## 翻译词典说明

词典文件（如 `src/ui/locales/zh-CN.ts`）是一个键值对对象：

- **键（Key）**：DOM 文本节点的精确内容（区分大小写，去除首尾空格）
- **值（Value）**：对应的翻译文本

```typescript
export const zhCN: Record<string, string> = {
  "Save": "保存",
  "Cancel": "取消",
  "In Progress": "进行中",
  // ...
};
```

> **注意：** 键必须与界面中实际渲染的文本完全一致。如果某个翻译不生效，请在浏览器开发者工具中检查对应元素的文本节点内容。

---

## 已知限制

| 限制 | 说明 |
|------|------|
| 动态内容轻微闪烁 | 动态渲染的内容（如弹窗、下拉菜单）会先短暂显示英文再替换为译文 |
| 版本兼容性 | Paperclip 界面更新后，新增文本仍需添加到词典中。本插件不是完整的原生 i18n 替代方案 |
| 浏览器存储 | 语言偏好存储于 `localStorage`，清除浏览器数据后需重新设置 |
| 图片/图标文字 | 图片像素和 SVG 内的文字不会被替换；普通图片的 `alt` 标签可翻译 |

---

### Japanese maintenance and translation boundaries

The Japanese dictionary was reviewed against Paperclip UI commit
[`db70c5ac`](https://github.com/paperclipai/paperclip/commit/db70c5acd92f50fa37fb4f0dea3da0e7685089a2).
This adds current navigation/task, plugin, agent configuration, dashboard, and
settings labels; it does **not** claim full coverage of every Paperclip screen.

Terminology: legacy `Issues` and current `Tasks` are both **タスク**; board
approval/ownership refers to the human **管理者**, distinct from a kanban **ボード**.
Agent heartbeat labels describe execution; interval scheduling is **定期実行**.

The translator preserves text-node identity for React, observes later text and
attribute updates, and ignores its own writes. It translates `title`, `placeholder`,
`aria-label`, `aria-description`, `aria-valuetext`, and `alt`; it never changes
input values, IDs, URLs, or machine-readable attributes. Wrapping whitespace and
`…`/`...` variations are normalized for lookup. Exact keys take precedence.

Code, preformatted text, textareas' contents, contenteditable regions, SVG/MathML,
`translate="no"`, `.notranslate`, and Paperclip's `.paperclip-markdown` content are
excluded. Add `translate="no"` around other user-authored content that could match
a dictionary entry. Arbitrary titles/names rendered without such a boundary cannot
be reliably distinguished from UI labels by a DOM overlay.

For variable **numeric** labels, add a whole-label template with one `{count}` in
both key and value, for example `"{count} tasks": "{count}件のタスク"`.
Only digits (optionally grouped with commas) match; unmatched sentences, dates,
free-text variables, and sentences split over sibling nodes are not rewritten.
There is no remote translation service or network submission of page text.

`npm run preview:test` serves the actual language switcher and settings components
in a local React fixture. Check Japanese → English → Japanese, status/count
updates, editable values, hide/show/unmount, and protected Markdown/code. This
fixture does not validate authentication, host plugin loading, or a production
Paperclip deployment.

After updating your fork, rebuild and use your Paperclip version's plugin upgrade
or reload flow to load the new bundles. A browser refresh alone may retain the
host's cached plugin bundles; keep the package and manifest versions aligned when
preparing a release.

## 开发

```bash
# 完整构建（tsc 类型检查 + esbuild 打包 worker 和 UI）
pnpm build

# 类型检查（独立仓库可运行）
npm run typecheck

# DOM / React 回归测试和词典校验
npm test

# 本地浏览器测试页（不需要 Paperclip 服务器或登录）
npm run preview:test
# 打开 http://127.0.0.1:4178

# 清理构建产物
pnpm clean
```

**构建流程说明：**

| 步骤 | 工具 | 输出 |
|------|------|------|
| 1. 编译 manifest 和类型声明 | `tsc` | `dist/manifest.js`、`dist/*.d.ts` |
| 2. 打包 worker（含 SDK） | `esbuild` | `dist/worker.js`（自包含，234kb） |
| 3. 打包 UI（react 为 external） | `esbuild` | `dist/ui/index.js`（单文件，13kb） |

---

## 项目结构

```
paperclip-lang/
├── package.json
├── tsconfig.json
├── scripts/
│   ├── build-worker.mjs     # esbuild：打包 worker（含 SDK）
│   └── build-ui.mjs         # esbuild：打包 UI（react 为 external）
└── src/
    ├── manifest.ts          # 插件声明（ID、版本、插槽配置）
    ├── worker.ts            # Worker 端（服务端插件逻辑）
    ├── index.ts             # 包导出入口
    └── ui/
        ├── index.tsx        # UI 组件导出
        ├── LangSwitcher.tsx     # 工具栏语言选择器 + DOM 注入逻辑
        ├── LangSettingsPage.tsx # 插件设置页
        ├── domTranslator.ts     # MutationObserver 文本替换引擎
        ├── translations.ts      # 语言代码 → 词典映射
        └── locales/
            ├── registry.ts  # 语言注册表
            ├── zh-CN.ts     # 简体中文翻译词典
            ├── ja.ts        # 日本語翻译词典
            ├── ko.ts        # 한국어翻译词典
            ├── de.ts        # Deutsch翻译词典
            └── fr.ts        # Français翻译词典
```

---

## License

MIT

---

## 作者

**hinet** — [63603636@qq.com](mailto:63603636@qq.com)

项目地址：[https://github.com/hinet/paperclip-lang](https://github.com/hinet/paperclip-lang)

如有问题或建议，欢迎提交 [Issue](https://github.com/hinet/paperclip-lang/issues)。
