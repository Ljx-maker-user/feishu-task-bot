# 飞书AI群聊任务助手 - 快速部署指南

## 📦 项目已创建完成

完整的飞书AI群聊任务助手项目已生成，包含以下核心功能：

✅ 自动监听飞书群聊消息
✅ AI智能分析聊天内容并提取任务
✅ 自动创建任务到飞书多维表格
✅ 每日定时生成工作汇总
✅ 支持群内命令交互
✅ 多群聊同时监控

---

## 🚀 5分钟快速部署

### 步骤 1: 创建飞书应用

1. 访问 [飞书开放平台](https://open.feishu.cn/app)
2. 点击「创建企业自建应用」
3. 填写应用名称（如：AI任务助手）
4. 记录 `App ID` 和 `App Secret`

### 步骤 2: 配置应用权限

在「权限管理」中添加以下权限：

```
im:message:readonly    - 获取与发送单聊、群组消息
im:message             - 发送消息
im:chat:readonly       - 获取群组信息
bitable:app            - 查看、评论和编辑多维表格
```

### 步骤 3: 配置事件订阅

1. 进入「事件订阅」页面
2. 设置请求地址：`http://你的服务器IP:3000/webhook/event`
3. 添加以下事件：
   - `im.message.receive_v1` - 接收消息
   - `im.chat.member.bot.added_v1` - 机器人进群
   - `im.chat.member.bot.deleted_v1` - 机器人退群
4. 记录「验证 Token」和「Encrypt Key」

### 步骤 4: 创建多维表格

1. 在飞书中创建一个新的多维表格
2. 从浏览器地址栏复制 `app_token`：
   ```
   https://xxx.feishu.cn/base/BascnXXXXXXXXXXXXX
                            ^^^^^^^^^^^^^^^^^^^^
                            这部分就是 app_token
   ```

### 步骤 5: 获取 AI API Key

**推荐使用通义千问（DashScope）：**

1. 访问 [阿里云 DashScope](https://dashscope.console.aliyun.com/)
2. 开通服务并创建 API Key
3. 记录 API Key

### 步骤 6: 配置环境变量

```bash
cd feishu-task-bot
cp .env.example .env
```

编辑 `.env` 文件，填入你的配置：

```env
FEISHU_APP_ID=cli_xxxxxxxxxxxxx
FEISHU_APP_SECRET=你的App Secret
FEISHU_VERIFICATION_TOKEN=你的验证Token

AI_PROVIDER=dashscope
AI_API_KEY=你的DashScope API Key
AI_MODEL=qwen-plus
AI_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1

BITABLE_APP_TOKEN=你的多维表格app_token
BITABLE_TABLE_ID=（稍后自动获取）

MONITORED_CHAT_IDS=（稍后获取）
```

### 步骤 7: 安装并启动

```bash
npm install
npm run setup    # 初始化多维表格（会自动创建表并输出 table_id）
```

将输出的 `BITABLE_TABLE_ID` 填入 `.env` 文件，然后启动：

```bash
npm start
```

### 步骤 8: 添加机器人到群聊

1. 在飞书群聊中点击「设置」→「群机器人」→「添加机器人」
2. 选择你创建的应用
3. 机器人会自动发送欢迎消息
4. 从日志中获取 `chat_id`：
   ```bash
   tail -f logs/combined.log | grep "机器人被添加到群聊"
   ```
5. 将 `chat_id` 添加到 `.env` 的 `MONITORED_CHAT_IDS`

### 步骤 9: 测试功能

在群聊中发送：
```
/help
```

机器人会回复帮助信息，说明配置成功！

---

## 🎯 使用方式

### 自动模式（推荐）

机器人会自动：
- 监听所有配置的群聊消息
- 每天 18:00 生成日报并发送到群聊
- 提取任务并同步到多维表格

### 手动命令

在群聊中发送：

| 命令 | 功能 |
|------|------|
| `/help` | 显示帮助 |
| `/summary` | 生成今日总结 |
| `/tasks` | 查看今日任务 |
| `/analyze` | 分析并创建任务 |

---

## 📊 多维表格字段

自动创建的任务表包含以下字段：

- **任务名称** - 任务标题
- **任务描述** - 详细说明
- **负责人** - 任务负责人
- **截止日期** - 完成期限
- **优先级** - 高/中/低
- **状态** - 待开始/进行中/已完成/已取消
- **来源** - AI自动提取/手动创建
- **创建时间** - 自动记录
- **群聊ID** - 来源群聊

---

## 🔧 常见问题

### Q: 事件订阅验证失败？

A: 确保：
1. 服务已启动（`npm start`）
2. 服务器可公网访问
3. `FEISHU_VERIFICATION_TOKEN` 配置正确

### Q: 无法获取群聊消息？

A: 检查：
1. 应用权限是否包含 `im:message:readonly`
2. 机器人是否已加入群聊
3. `MONITORED_CHAT_IDS` 是否包含该群聊

### Q: AI 分析失败？

A: 确认：
1. `AI_API_KEY` 有效且有余额
2. 网络连接正常
3. 查看 `logs/error.log` 获取详细错误

### Q: 如何修改每日汇总时间？

A: 编辑 `.env`：
```env
# 每天 9:00 和 18:00
DAILY_SUMMARY_CRON=0 9,18 * * *

# 工作日 18:00
DAILY_SUMMARY_CRON=0 18 * * 1-5
```

---

## 🐳 Docker 部署（可选）

```bash
# 构建镜像
docker build -t feishu-task-bot .

# 运行容器
docker run -d \
  --name feishu-task-bot \
  -p 3000:3000 \
  --env-file .env \
  -v $(pwd)/logs:/app/logs \
  feishu-task-bot

# 或使用 docker-compose
docker-compose up -d
```

---

## 📁 项目结构

```
feishu-task-bot/
├── server.js              # 主服务（事件处理、定时任务）
├── config.js              # 配置管理
├── services/
│   ├── feishu-client.js   # 飞书 API 封装
│   ├── ai-service.js      # AI 分析服务
│   └── bitable-service.js # 多维表格操作
├── utils/
│   ├── logger.js          # 日志工具
│   └── helpers.js         # 辅助函数
├── scripts/
│   └── setup-bitable.js   # 多维表格初始化
├── logs/                  # 日志目录
├── .env.example           # 配置模板
├── Dockerfile             # Docker 配置
├── docker-compose.yml     # Docker Compose 配置
└── README.md              # 完整文档
```

---

## 🎉 部署完成！

现在你的飞书AI任务助手已经准备就绪：

✅ 机器人会自动监听群聊消息
✅ 每天 18:00 自动生成日报
✅ 任务自动同步到多维表格
✅ 支持群内命令随时查看和生成

**下一步：**
1. 将机器人添加到需要监控的群聊
2. 获取 `chat_id` 并配置到 `.env`
3. 重启服务：`npm start`
4. 在群聊中发送 `/help` 测试

如有问题，请查看 `logs/combined.log` 获取详细日志。

---

## 📞 技术支持

- 完整文档：查看 `README.md`
- 飞书开放平台：https://open.feishu.cn/
- 多维表格 API：https://open.feishu.cn/document/server-docs/docs/bitable-v1/bitable-overview
