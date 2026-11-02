<p align="center">
  <img src="./public/icon.svg" width="80" height="80" alt="Birchize Logo">
</p>

# Birchize

**你的文件，只在你的设备上处理。**

Birchize 是一款在浏览器中运行的本地文件工具箱，集格式转换、媒体压缩、SVG 编辑、压缩包管理与开发工具于一体。无需账号，无需上传文件；完成首次资源缓存后，可离线使用。

以花与桦木为灵感的品牌设计，配合简洁的界面与轻量动效，为桌面和移动设备提供统一的文件处理体验。

Designed & developed by **Vargking**.

## 特性

- **本地处理**：文件读取、转换、预览与加解密均在浏览器内完成，不发送到服务器。
- **批量工作流**：支持拖放、多选、追加、删除、逐项勾选与全选，处理按钮显示本次选中文件数量。
- **清晰的处理反馈**：添加文件后显示提示和文件信息；处理结果按批次呈现，支持单项下载与本批次 ZIP 下载。
- **目标大小压缩**：图片可设置目标大小，例如 200 KB，结合编码质量与尺寸调整控制体积。
- **离线可用**：首次或更新时优先通过中国 npmmirror 镜像下载运行库，缓存完成后不再依赖网络；启动页展示真实下载进度。
- **多端、多语言**：适配桌面与移动端，支持中文、English、Español、日本語、한국어、Русский、Filipino、Bahasa Melayu。

## 功能概览

| 工具 | 支持的操作 |
| --- | --- |
| 图片工坊 | 读取 JPG、PNG、WebP、SVG、BMP、TIFF、ICO、GIF 等图片；输出 JPG、PNG、WebP、AVIF、BMP、ICO；调整质量、尺寸、背景色与目标大小 |
| 音频与视频 | 本地 FFmpeg 转码、提取音轨、调整视频分辨率与音频码率、媒体压缩；视频输出 MP4、MOV、MKV、WebM、AVI、TS、GIF；音频输出 MP3、WAV、FLAC、AAC、M4A、OGG、Opus、AIFF |
| 文档转换 | DOCX 与常见文本类文件转 PDF、TXT、HTML；提取 PDF 文本，或将 PDF 逐页导出为 PNG |
| SVG 编辑器 | 源码实时预览、自由绘制、基础形状与颜色编辑，导出 SVG 或 PNG |
| 压缩包管理 | 多文件创建 ZIP、7Z、TAR、TAR.GZ、TAR.BZ2、TAR.XZ；浏览 ZIP、7Z、RAR、TAR 等压缩包，预览与按需提取条目；ZIP 支持 AES-256 加密创建 |
| 文件加解密 | AES-256-GCM、AES-256-CBC + HMAC-SHA256、AES-256-CTR + HMAC-SHA256；使用 PBKDF2 派生密钥 |
| 开发者工具 | Base64、URL 编解码，JSON 格式化与压缩，UUID；支持文本／文件 Hash，包括 MD5、SHA、SHA3、BLAKE2b、BLAKE3、RIPEMD-160、CRC32、xxHash64、SM3 |

具体输入格式会显示在对应工具的文件选择区。能否转换还取决于文件内部编码、浏览器能力和本地引擎支持，并非任意格式之间都能互转。

## 使用方法

1. 选择工具，拖入文件或点击选择文件。文件只会添加到当前浏览器，不会上传。
2. 查看文件信息，勾选需要处理的文件，设置输出格式与处理参数。
3. 开始处理，在对应批次中预览或下载结果。支持的批处理工具可将本批次结果打包为 ZIP。

图片、媒体、文档、文件加解密、文件 Base64／Hash 和压缩包创建支持批量处理；SVG 编辑为逐文件切换，压缩包浏览为逐包打开。可预览工具中的预览操作与批量勾选相互独立。

首次打开会展示使用引导，完成后不再自动弹出。语言和引导偏好保存在本机。

### 结果保存

文件和处理结果保存在当前页面内存中，刷新或关闭页面会清空，请及时下载。切换工具会重置该工具的工作区，当前会话的最近结果仍可从首页下载。

每个结果历史最多保留 8 个批次，按 200 MB 预算优先移除完整旧批次；最新批次始终保留，可能超过该预算。

## 离线与隐私

首次访问需要联网下载应用和转换引擎，启动加载页展示缓存百分比、已保存资源数量、已下载大小和当前下载来源。等待界面显示离线就绪后，即可断网使用；首次缓存包含较大的 FFmpeg WASM，完成前请保持页面打开。也可以先进入工具，缓存会在后台继续。

运行库优先使用中国 **npmmirror** 镜像（`registry.npmmirror.com` → `cdn.npmmirror.com`），镜像失败时回退到本站资源。版本由构建时锁定，并校验每个文件的大小和 SHA-256；下载失败不会删除已成功缓存的资源，点击「继续缓存」只补齐缺失项，刷新后也会保留成功项。应用更新时可复用内容未变的运行库。

清除网站数据、浏览器回收缓存或更换设备后，需要重新缓存。

离线缓存使用 Service Worker，文件加解密使用 Web Crypto，因此请通过 **证书有效的 HTTPS 或 localhost** 访问。自定义域名也需要正确配置证书并启用 HTTPS；使用国内镜像不能绕过浏览器的安全上下文要求。开发模式不注册离线缓存；查看启动加载页及测试离线行为需使用生产构建。

项目没有文件上传接口、统计上报或外部字体请求。网站托管服务与国内镜像会接收首次加载和资源更新时的正常资源请求，但用户文件、密码和处理结果不会随这些请求发送。运行库下载请求不携带 Cookie，也不发送来源页面地址；缓存就绪后，转换引擎从本地加载。

## 支持范围与注意事项

- **图片**：AVIF 编解码依赖浏览器；动态图按静态帧处理，多页 TIFF 仅读取首帧。目标大小过低时可能需要缩小尺寸，无法同时保证任意体积与原始清晰度；未达到目标会显示提示。
- **媒体**：输入支持取决于本地 FFmpeg 的解码器，不支持 DRM 内容。转码速度和可处理大小受设备性能与浏览器内存影响，建议视频文件小于 200 MB。
- **文档**：DOCX 转 PDF 使用本地重排，复杂版式可能变化；Markdown 按文本读取。不支持旧版 DOC／XLS／PPT，也不提供无损 PDF 转 Word。
- **SVG**：支持 SVG 编辑和栅格化导出，不提供位图自动矢量化；导出 PNG 后不再保留矢量可编辑性。
- **压缩包**：密码加密创建仅支持 ZIP。其他格式的读取、密码与分卷支持取决于 libarchive，不能保证兼容所有压缩格式和加密方式。
- **加解密**：`.birch` 是 Birchize 的封装格式，不能直接解密任意第三方加密文件。密码不会上传，丢失后无法恢复。
- **Hash**：MD5、SHA-1、CRC、xxHash 适用于兼容或校验场景，不应用于密码存储或安全签名。

为控制浏览器内存占用，当前设有以下处理限制：

| 操作 | 限制 |
| --- | --- |
| 图片处理 | 单张不超过 4000 万像素 |
| PDF 处理 | 单文件不超过 30 MB、100 页 |
| 创建压缩包 | 最多 50 个文件，总大小不超过 256 MB |
| 压缩包提取 | 单条目不超过 128 MB；批量提取总大小不超过 256 MB |
| 压缩包文本／图片预览 | 单条目不超过 2 MB |
| 文件加解密 | 单文件不超过 128 MB |
| 文件 Base64／Hash | 单文件不超过 32 MB |

## 本地开发

环境要求：Node.js 22.12+ 和 npm。

获取仓库源码并进入项目目录后执行：

```sh
npm ci
npm run dev
```

打开终端输出的本地地址。

依赖安装使用 [`.npmrc`](.npmrc) 配置的中国 npm 镜像。`npm ci` 的 `postinstall` 会将 FFmpeg、libarchive 和 PDF 引擎准备到 `public/engines/`，该目录无需提交到版本控制。若安装时跳过了脚本，请另行执行 `npm run prepare:engines`。

### 构建与预览

```sh
npm run build
npm run preview
```

构建产物位于 `dist/`，包含本地转换引擎和生成的离线缓存脚本。请通过预览服务器或静态托管访问，不要直接双击 `dist/index.html`。

### 测试

```sh
npm test
npm run test:e2e
npm run test:pages
```

- `test`：运行单元测试。
- `test:e2e`：验证批量选择、文件反馈、压缩包操作和 SVG 实时编辑等交互。
- `test:pages`：先构建生产版本，再验证 `/Birchize/` 子目录下的缓存进度、失败重试、镜像校验与回退、断网重载，以及图片转换、7Z 创建／浏览、WAV 转 MP3 和 PDF 文本提取。常规测试以本地包文件模拟国内镜像，避免依赖外部网络。

端到端测试默认使用本机 Microsoft Edge。其他浏览器可在 [`playwright.config.ts`](playwright.config.ts) 和 [`playwright.pages.config.ts`](playwright.pages.config.ts) 中配置。

## 部署

Birchize 是纯静态 Web 应用，无需后端服务。将 `dist/` 部署到支持 HTTPS 的静态托管即可。资源使用相对路径，页面使用 hash 路由，可部署在站点根目录或子目录。

仓库包含 [GitHub Pages 工作流](.github/workflows/deploy.yml)：

1. 在仓库的 **Settings → Pages → Build and deployment → Source** 中选择 **GitHub Actions**。
2. 向 `main` 分支推送代码，或从 Actions 页面手动运行工作流。
3. 工作流自动安装依赖、运行单元测试、构建并部署；站点地址可在部署任务或 Pages 设置中查看。

工作流使用内置 `GITHUB_TOKEN`，无需单独配置 PAT 或维护 `gh-pages` 分支。

## 参与贡献

欢迎通过 Issue 反馈问题或提出功能建议，也欢迎提交 Pull Request。

报告转换问题时，请提供浏览器与操作系统、输入／输出格式、复现步骤和报错信息。如需提供示例文件，请先移除个人信息、密码及其他敏感内容。

提交改动前请运行相关测试；涉及转换引擎、资源路径或缓存策略的修改，建议同时运行 `npm run test:pages` 验证生产离线行为。

## 技术与致谢

界面基于 React、TypeScript 和 Vite。文件处理使用浏览器 API，以及 FFmpeg WASM、libarchive.js、zip.js、PDF.js、jsPDF、Mammoth、hash-wasm、UTIF、DOMPurify、html2canvas 等项目。

品牌 Logo 与界面图标使用 SVG／代码绘制。第三方依赖及锁定版本见 [`package.json`](package.json) 与 [`package-lock.json`](package-lock.json)；本地引擎准备及 libarchive worker 补丁见 [`scripts/engines.mjs`](scripts/engines.mjs)。

## 许可证

开发者：**Vargking**。

当前仓库尚未为原创应用代码指定开源许可证；在添加 `LICENSE` 前，不应将公开可见视为已授予开源许可。

第三方依赖遵循各自许可证。其中 `@ffmpeg/core@0.12.10` 标注为 **GPL-2.0-or-later**，与 FFmpeg JavaScript 包装层的 MIT 许可证不同；发布包不能笼统视为全部采用 MIT。分发相关 WASM 时，请核对其许可证、对应源码与构建配置要求。
