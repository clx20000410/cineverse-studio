# 映界工坊 · CineVerse Studio

面向短剧创作者的一站式 AI 制作工作台。从故事大纲、格式化剧本和角色资产，到分镜拆解、视频生成与整集导出，都可以在同一条工作流中完成。

## 功能

- 剧本改写：将小说、梗概或创意整理为可拍摄的格式化剧本
- 资产提取：识别角色、场景与道具，维护跨镜头一致性
- 分镜制作：拆分镜头并生成图片、视频提示词
- 多模型接入：支持 OpenAI 兼容接口、Gemini、火山引擎、MiniMax、本地 ComfyUI 与即梦兼容服务
- 视频工作流：支持文生视频、首尾帧参考、任务跟踪、海报提取与整集拼接
- 本地优先：项目数据与生成素材默认保存在本机

## 技术栈

- 前端：Nuxt 3、Vue 3、TypeScript
- 后端：Hono、Drizzle ORM、Mastra、MySQL
- 媒体处理：FFmpeg、Sharp
- 部署：Docker Compose

## 快速启动

```bash
git clone <your-repository-url> cineverse-studio
cd cineverse-studio
docker compose up -d --build
```

启动后访问：

- 工作台：<http://localhost:5679>
- 健康检查：<http://localhost:5679/api/v1/health>

默认开发数据库配置仅用于本地体验。公开部署前请通过环境变量修改：

```env
MYSQL_DATABASE=cineverse_studio
MYSQL_USER=cineverse
MYSQL_PASSWORD=replace_with_a_strong_password
MYSQL_ROOT_PASSWORD=replace_with_another_strong_password
```

## 本地开发

后端：

```bash
cd backend
npm install
npm run dev
```

前端：

```bash
cd frontend
npm install
npm run dev
```

开发环境前端默认运行在 `3013` 端口，并将 `/api` 与 `/static` 代理到后端。

## 模型配置

进入「设置 → AI 服务」添加文本、图片和视频服务。每类服务至少启用一个配置后，对应生成能力才可使用。

本地视频服务常用地址：

- ComfyUI：`http://host.docker.internal:8189`
- 即梦兼容服务：`http://host.docker.internal:8000`

Docker 内访问宿主机服务时使用 `host.docker.internal`，不要填写 `127.0.0.1`。

### Seedance 兼容视频接口

对接 [Seedance API 文档](https://seedance.muyuan.do/docs) 时，在「设置 → AI 服务 → 视频」选择「即梦 · Seedance API」模板：

- Provider：`jimeng`，使用 `POST /v1/videos` 创建任务、`GET /v1/videos/{id}` 查询结果。
- Base URL：`https://ai.centos.hk`（文档站配置页的网关地址），也可填写其他兼容网关；允许带 `/v1` 或网关代理前缀。不要填写文档页面地址或完整 `/v1/videos` 路径。
- API Key：填写自己的网关 Key；上述网关的国内 Key 需要 `seedance` 分组。
- 模型：`doubao-seedance-2-0-fast-260128` 或 `doubao-seedance-2-0-260128`。Fast 最高 720p，适配器会将其 1080p/2K/4K 请求归并为 720p；标准版支持 1080p。

推荐配置中的「聚合视频服务 · Seedance」也使用这一协议。已有该配置的用户可重新应用推荐配置，或手动修改 Provider 与 Base URL；已创建的其他配置不会自动迁移。`volcengine` 模板保留用于火山官方 `/api/v3` 协议。

工作台支持纯文本、多图参考与图片/视频/音频混合参考。所有参考图片均使用 `reference_image`；适配器中的显式首尾帧使用 `first_frame`/`last_frame`，不可与参考素材混用。参考素材最多为 9 张图片、3 个视频、3 段音频，音频必须配合图片或视频。生成时长归并到 4–15 秒。

本地参考图片会转成 Data URL；本地视频/音频需要通过 `PUBLIC_BASE_URL` 提供上游可访问的地址。任务完成后从 `metadata.url` 下载视频到本地；上游任务 ID 保留 7 天，签名视频链接有效期为 24 小时。

接口回归测试（在 `backend` 目录执行）：

```bash
node --import tsx --test src/services/adapters/jimeng-video.test.ts src/services/adapters/seedance-compatibility.test.ts
node --test tests/jimeng-video-provider.test.mjs
```

测试包含本地模拟网关的提交、轮询与结果解析，不消耗真实生成额度。

## 目录

```text
backend/                     API、任务调度、模型适配器与 Agent
backend/workspace/skills/    可在设置页维护的 Agent Skills
frontend/                    Nuxt 3 工作台
configs/                     配置示例
data/                        本地生成数据与静态资源（默认不提交）
docker/                      数据库初始化脚本
```

## 安全提示

- 不要提交 `.env`、API Key、数据库密码或生成素材
- 公网部署时应配置 HTTPS、反向代理和访问控制
- 第三方模型可能产生费用，请在服务商后台设置额度与告警
- 生成内容应遵守所使用模型及发布平台的规则
