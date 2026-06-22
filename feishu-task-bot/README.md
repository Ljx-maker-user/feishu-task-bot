# 飞书AI群聊任务助手

自动分析飞书群聊内容，智能提取任务并同步到多维表格的AI助手。

## ✨ 功能特性

- 🤖 **智能分析**: 使用 AI 自动分析群聊内容，提取关键信息和待办任务
- 📊 **任务管理**: 自动创建任务到飞书多维表格，支持负责人、截止日期、优先级等字段
- 📝 **每日汇总**: 定时生成每日沟通总结和工作报告
- 💬 **命令交互**: 支持群内命令，随时查看任务和生成总结
- 🔔 **实时监控**: 实时监听群聊消息，自动处理
- 🎯 **多群支持**: 可同时监控多个群聊

## 📋 前置要求

1. **飞书开放平台应用**
   - 访问 [飞书开放平台](https://open.feishu.cn/)
   - 创建企业自建应用
   - 获取 `App ID` 和 `App Secret`

2. **配置应用权限**
   ```
   - im:message:readonly (读取消息)
   - im:message (发送消息)
   - im:chat:readonly (读取群信息)
   - bitable:app (多维表格读写)
   ```

3. **配置事件订阅**
   - 请求地址: `http://your-domain:3000/webhook/event`
   - 订阅事件:
     - `im.message.receive_v1` (接收消息)
     - `im.chat.member.bot.added_v1` (机器人进群)
     - `im.chat.member.bot.deleted_v1` (机器人退群)

4. **AI API Key**
   - 支持通义千问 (DashScope)
   - 支持 OpenAI
   - 支持其他兼容 OpenAI API 的服务

5. **多维表格**
   - 在飞书中创建多维表格
   - 从 URL 中获取 `app_token`

## 🚀 快速开始

### 1. 安装依赖

```bash
cd feishu-task-bot
npm install
```

### 2. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env` 文件，填写必要配置：

```env
# 飞书应用配置
FEISHU_APP_ID=cli_xxxxxxxxxxxxx
FEISHU_APP_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
FEISHU_VERIFICATION_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# AI 配置（以通义千问为例）
AI_PROVIDER=dashscope
AI_API_KEY=your_dashscope_api_key
AI_MODEL=qwen-plus
AI_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1

# 多维表格配置
BITABLE_APP_TOKEN=bascnxxxxxxxxxxxxxx
BITABLE_TABLE_ID=tblxxxxxxxxxxxxxx

# 监控的群聊（机器人加入群后可获取）
MONITORED_CHAT_IDS=oc_xxxxxxxxxxxxx1,oc_xxxxxxxxxxxxx2
```

### 3. 初始化多维表格（可选）

如果还没有创建任务表，可以运行初始化脚本：

```bash
npm run setup
```

这会自动创建包含所有必要字段的数据表。

### 4. 启动服务

```bash
npm start
```

服务启动后会显示：
```
🚀 飞书AI任务助手已启动
📡 服务地址: http://0.0.0.0:3000
🔗 Webhook: http://0.0.0.0:3000/webhook/event
💚 健康检查: http://0.0.0.0:3000/health
```

### 5. 配置飞书事件订阅

在飞书开放平台配置事件订阅地址：
```
http://your-domain:3000/webhook/event
```

### 6. 将机器人添加到群聊

在飞书群聊设置中添加机器人，机器人会自动发送欢迎消息。

## 📖 使用说明

### 群内命令

在监控的群聊中发送以下命令：

| 命令 | 说明 |
|------|------|
| `/help` 或 `/帮助` | 显示帮助信息 |
| `/summary` 或 `/总结` | 生成今日沟通总结 |
| `/tasks` 或 `/任务` | 查看今日创建的任务 |
| `/analyze` 或 `/分析` | 分析今日聊天并自动创建任务 |

### 自动功能

- **实时监控**: 机器人会自动记录群聊消息
- **每日汇总**: 每天 18:00（可配置）自动生成日报并发送到群聊
- **任务提取**: 自动从聊天内容中提取待办任务

### 多维表格字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| 任务名称 | 文本 | 任务标题 |
| 任务描述 | 文本 | 详细描述 |
| 负责人 | 文本 | 任务负责人 |
| 截止日期 | 日期 | YYYY-MM-DD 格式 |
| 优先级 | 单选 | 高/中/低 |
| 状态 | 单选 | 待开始/进行中/已完成/已取消 |
| 来源 | 单选 | AI自动提取/手动创建 |
| 创建时间 | 时间 | 自动记录 |
| 群聊ID | 文本 | 来源群聊 |

## 🔧 高级配置

### 修改每日汇总时间

编辑 `.env`：
```env
# 每天 18:00 执行
DAILY_SUMMARY_CRON=0 18 * * *

# 每天 9:00 和 18:00 执行
DAILY_SUMMARY_CRON=0 9,18 * * *

# 工作日 18:00 执行
DAILY_SUMMARY_CRON=0 18 * * 1-5
```

### 切换 AI 提供商

**通义千问 (推荐)**:
```env
AI_PROVIDER=dashscope
AI_API_KEY=your_dashscope_key
AI_MODEL=qwen-plus
AI_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
```

**OpenAI**:
```env
AI_PROVIDER=openai
AI_API_KEY=your_openai_key
AI_MODEL=gpt-4
AI_BASE_URL=https://api.openai.com/v1
```

### 获取群聊 ID

方法 1: 查看日志
```bash
# 机器人加入群后会记录 chat_id
tail -f logs/combined.log | grep "机器人被添加到群聊"
```

方法 2: 使用 API
```bash
# 调用飞书 API 获取机器人加入的群聊列表
curl -X GET "https://open.feishu.cn/open-apis/im/v1/chats" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## 🐛 故障排查

### 事件订阅验证失败

确保：
1. 服务已启动并可访问
2. `FEISHU_VERIFICATION_TOKEN` 配置正确
3. 防火墙允许飞书服务器访问

### 无法获取消息

检查：
1. 应用权限是否包含 `im:message:readonly`
2. 机器人是否已加入群聊
3. `MONITORED_CHAT_IDS` 是否包含目标群聊

### AI 分析失败

确认：
1. `AI_API_KEY` 有效且有足够额度
2. `AI_BASE_URL` 正确
3. 网络连接正常

### 多维表格写入失败

验证：
1. `BITABLE_APP_TOKEN` 和 `BITABLE_TABLE_ID` 正确
2. 应用有 `bitable:app` 权限
3. 表格字段名称与代码一致

## 📁 项目结构

```
feishu-task-bot/
├── server.js              # 主服务文件
├── config.js              # 配置管理
├── package.json           # 依赖配置
├── .env.example          # 环境变量示例
├── services/
│   ├── feishu-client.js  # 飞书 API 客户端
│   ├── ai-service.js     # AI 分析服务
│   └── bitable-service.js # 多维表格服务
├── utils/
│   ├── logger.js         # 日志工具
│   └── helpers.js        # 辅助函数
├── scripts/
│   └── setup-bitable.js  # 多维表格初始化脚本
└── logs/                 # 日志目录（自动创建）
```

## 🔒 安全建议

1. **生产环境部署**
   - 使用 HTTPS
   - 配置防火墙规则
   - 使用反向代理（Nginx）

2. **敏感信息保护**
   - 不要提交 `.env` 文件到代码库
   - 定期轮换 API Key
   - 使用环境变量管理工具

3. **监控和日志**
   - 配置日志轮转
   - 监控 API 调用量
   - 设置异常告警

## 📝 开发计划

- [ ] 支持图片消息识别
- [ ] 支持文件内容分析
- [ ] 任务状态自动更新
- [ ] 支持自定义任务模板
- [ ] Web 管理界面
- [ ] 数据统计报表

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License

## 🔗 相关链接

- [飞书开放平台](https://open.feishu.cn/)
- [飞书多维表格 API](https://open.feishu.cn/document/server-docs/docs/bitable-v1/bitable-overview)
- [通义千问 API](https://help.aliyun.com/zh/dashscope/)
