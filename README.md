# Birchize

一间安静、轻盈的本地文件工作室。Designed & developed by **Vargking**.

React + TypeScript + Vite；桌面与移动端适配，花与桦木元素的代码绘制 Logo，支持中文、English、Español、日本語、한국어、Русский、Filipino、Bahasa Melayu。

## 使用与隐私

- 选择或拖入多个文件后，会显示添加成功提示和文件信息。这里的“添加”只发生在浏览器内，不会把文件传给服务器。
- 新文件默认勾选，可逐项勾选／全选、继续追加、逐项删除。转换按钮标明本次处理数量；文档与媒体预览和处理勾选相互独立。
- 图片、媒体、文档、文件加解密、Base64／Hash 文件处理及压缩包创建只处理勾选文件。SVG 为逐文件切换编辑，压缩包浏览为逐包打开。
- 每次处理独立成批，包含时间、状态、输入／输出数量；支持单项下载和本批次 ZIP 下载。单文件失败不会阻止其余文件继续处理。
- 每个结果历史最多保留 8 批，按 200 MB 预算优先移除完整旧批次；最新批次始终保留，可能超过预算。结果仅在页面内存中，刷新会清空；切换工具会重置该工具的工作区，首页仍可下载当前会话的最近结果。请及时下载保存。
- 首次打开显示使用教程，完成后不再自动弹出；语言与教程偏好保存在本机。

## 已实现的格式与边界

不是“任意格式无条件互转”。实际能力取决于浏览器、文件编码和随项目打包的本地引擎。

| 工具 | 功能 | 说明 |
| --- | --- | --- |
| 图片 | 常见 JPG、PNG、WebP、SVG、BMP、TIFF、ICO、GIF 等输入；输出 JPG、PNG、WebP、AVIF、BMP、ICO | AVIF 编解码依浏览器而定；GIF 等动态图按静态帧处理；图片不超过 4000 万像素 |
| 图片压缩 | 目标大小（如 200 KB）、质量、尺寸、透明背景填充 | 优先调整编码质量，再按需缩小尺寸；极低目标无法同时保证原始清晰度，未达目标会提示 |
| 视频／音频 | 视频输出 MP4、MOV、MKV、WebM、AVI、TS、GIF；音频输出 MP3、WAV、FLAC、AAC、M4A、OGG、Opus、AIFF | 本地 FFmpeg WASM；支持提取音轨、分辨率与码率调整、压缩；输入依本地解码器，不支持 DRM；建议视频小于 200 MB |
| 文档 | DOCX／TXT／MD／HTML／CSV／JSON／XML／LOG 等转 PDF、TXT、HTML；PDF 提取文本或逐页 PNG | DOCX 转 PDF 为本地重排，复杂布局可能变化；Markdown 按文本读取；不支持旧版 DOC／XLS／PPT，也不是无损 PDF 转 Word；PDF 最大 30 MB、100 页 |
| SVG | 源码实时编辑、自由绘制、形状与颜色、SVG／PNG 导出 | SVG 转位图不保留矢量可编辑性；不宣称已有位图自动矢量化 |
| 压缩包 | 多文件创建 ZIP、7Z、TAR、TAR.GZ、TAR.BZ2、TAR.XZ；浏览、预览与逐项提取 ZIP／7Z／RAR／TAR 等 | 创建最多 50 文件、256 MB；加密创建仅 ZIP AES-256；其他加密包能否读取依 libarchive 的具体支持，并非支持所有格式／加密方式；条目提取最大 128 MB，文本／图片预览最大 2 MB |
| 文件加解密 | AES-256-GCM、AES-256-CBC + HMAC-SHA256、AES-256-CTR + HMAC-SHA256 | PBKDF2 派生密钥；`.birch` 为本应用封装格式，不与任意第三方加密文件互通；每文件最大 128 MB；密码丢失无法恢复 |
| 开发工具 | Base64、URL 编解码、JSON 格式化／压缩、UUID、MD5／SHA／SHA3／BLAKE2b／BLAKE3／RIPEMD-160／CRC32／xxHash64／SM3 | 文件 Base64／Hash 每文件最大 32 MB；MD5／SHA-1／CRC／xxHash 不用于密码存储或安全签名 |

### 离线使用

生产版本通过 Service Worker 缓存应用、转换引擎、字体与其他本地资源。首次访问仍需联网下载这些资源；等界面显示“已可离线使用”后，可断网继续使用。首次缓存包含较大的 FFmpeg WASM，请等待完成。清除网站数据、浏览器回收缓存或更换设备后需要重新缓存。

Service Worker 与 Web Crypto 需要 HTTPS 或 localhost。不要双击 `dist/index.html` 使用。开发模式不注册离线缓存；请用构建后的预览服务器验证离线。项目无运行时 CDN、外部字体、统计上报或文件上传接口；依赖下载使用 `.npmrc` 配置的中国 npm 镜像。

## 本地开发

安装 Node.js 22.12+（推荐 22 LTS）和 Git，然后在 PowerShell 执行：

```powershell
cd D:\LunWen\Birchize
npm ci
npm run dev -- --port 5174 --strictPort
```

浏览器打开 <http://localhost:5174/>。

```powershell
npm test
npm run test:e2e
npm run test:pages
npm run build
npm run preview -- --port 4174 --strictPort
```

端到端测试使用本机 Microsoft Edge；没有安装 Edge 时先安装浏览器，或调整 `playwright.config.ts` / `playwright.pages.config.ts` 的浏览器配置。`test:pages` 会先构建，再模拟 `/Birchize/` 子目录与断网重载，检查图片转换、7Z 创建／浏览、WAV 转 MP3、PDF 文本提取的离线引擎。GitHub Pages 工作流执行单元测试与生产构建，不依赖 Edge。

`npm ci` 的 `postinstall` 自动将 FFmpeg、libarchive、PDF 引擎准备到 `public/engines/`。该目录不提交 Git；CI 会重新生成。不要使用 `npm ci --ignore-scripts`，否则需自行执行 `npm run prepare:engines`。

## 第一次推送到 GitHub

1. 在 GitHub 新建一个名为 `Birchize` 的空仓库，建议选 Public。**不要勾选初始化 README、.gitignore 或 License**，避免与本地首次提交冲突。
2. 在仓库的 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**，不是 Deploy from a branch。
3. 以下命令适用于本目录尚未初始化 Git、远端为空的情况。把 `YOUR_USERNAME` 换成你的 GitHub 用户名；仓库名不同时同时替换 URL 中的 `Birchize`。

```powershell
cd D:\LunWen\Birchize
git init
git add .
git commit -m "Initial Birchize release"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/Birchize.git
git push -u origin main
```

如果 `git commit` 提示未设置身份，在当前仓库执行以下命令，再重新执行提交与后续步骤。邮箱可以用 GitHub 提供的 noreply 地址。

```powershell
git config user.name "你的名字"
git config user.email "你的GitHub邮箱"
```

推送时按 Git Credential Manager 提示在浏览器登录。不要把 GitHub 登录密码当成 Git HTTPS 密码；也不要把访问令牌发到聊天或提交到仓库。

### 自动部署 Pages

已提供 [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)。每次推送 `main`，依次安装依赖、测试、构建离线资源、上传 `dist` 并部署；也可在仓库 **Actions → Deploy Birchize to GitHub Pages → Run workflow** 手动触发。部署使用仓库内置 `GITHUB_TOKEN`，不需要另建 PAT 或手动创建 `gh-pages` 分支。

部署完成后，在 Actions 的 deploy 任务或 Settings → Pages 查看真实站点地址。普通项目仓库通常为 `https://YOUR_USERNAME.github.io/Birchize/`；用户名主页仓库或自定义域名地址不同。Vite 使用相对资源路径、页面使用 hash 路由，无需将仓库名硬编码进源码。

GitHub 官方说明：[自定义 Pages 工作流](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)。

### 之后更新

```powershell
git add .
git commit -m "Update Birchize"
git push
```

推送前可用 `git status` 和 `git diff --cached` 检查待上传内容。不要提交私人文件、密码或令牌。`.gitignore` 已排除依赖、构建产物、本地引擎和测试截图。

如果提示 `remote origin already exists`，先用 `git remote -v` 检查地址；只有确认需要更改时再使用 `git remote set-url origin ...`。如果提示远端已有提交，不要直接 `--force` 覆盖，请先确认远端内容并合并。

## 许可证与第三方依赖

开发者：Vargking。当前尚未为原创应用代码指定开源许可证；公开仓库不等于授予开源许可，正式作为开源项目发布前需要选择并添加 `LICENSE`。

第三方依赖遵循各自许可证，不能将整个发布包笼统标为 MIT。尤其 `@ffmpeg/core@0.12.10` 标注为 **GPL-2.0-or-later**，与 MIT 的 FFmpeg JavaScript 包装层不同；重新分发其 WASM 时应核对对应源码、构建配置、许可证与所含编解码器的分发要求。依赖版本与来源见 `package-lock.json`，本地 libarchive worker 的补丁见 `scripts/engines.mjs`。
