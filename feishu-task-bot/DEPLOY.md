# 飞书AI群聊任务助手 - Vercel Serverless 部署指南

## 📦 项目已改造为 Serverless 版本

✅ 无需服务器，Vercel 免费托管
✅ 自动 HTTPS，安全可靠
✅ 自动扩缩容，按需计费（免费额度足够）
✅ 内置定时任务支持

---

## 🚀 5分钟快速部署

### 步骤 1: 安装 Vercel CLI

```bash
npm install -g vercel
```

### 步骤 2: 登录 Vercel

```bash
vercel login
```

按提示选择登录方式（推荐 GitHub）。

### 步骤 3: 进入项目目录

```bash
cd feishu-task-bot
```

### 步骤 4: 初始化 Vercel 项目

```bash
vercel
```

首次运行会询问：
- **Set up and deploy?** → Yes
- **Which scope?** → 选择你的账号
- **Link to existing project?** → No
- **Project name?** → feishu-task-bot（或自定义）
- **Directory?** → ./（当前目录）
- **Override settings?** → No

### 步骤 5: 配置环境变量

在 Vercel 控制台配置环境变量（不要写在代码里）：

1. 访问 https://vercel.com/dashboard
2. 找到你的项目 `feishu-task-bot`
3. 点击 **Settings** → **Environment Variables**
4. 添加以下变量：

```env
FEISHU_APP_ID=cli_aab22695e53bdbcb
FEISHU_APP_SECRET=5PxH3t…VQr2
FEISHU_VERIFICATION_TOKEN=（从飞书后台获取）

AI_PROVIDER=dashscope
AI_API_KEY=*** API Key
AI_MODEL=qwen-plus
AI_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1

BITABLE_APP_TOKEN=***
BITABLE_TABLE_ID=（运行 setup 脚本后获取）

MONITORED_CHAT_IDS=（机器人加入群后获取）

CRON_SECRET=自定义一个密钥，如：my-secret-key-123456
```

**或者用命令行批量添加：**

```bash
vercel env add FEISHU_APP_ID
# 粘贴值，回车
# 重复添加其他变量
```

### 步骤 6: 部署到生产环境

```bash
vercel --prod
```

部署成功后会显示：
```
🔍  Inspect: https://vercel.com/xxx/feishu-task-bot/xxx
✅  Production: https://feishu-task-bot-xxx.vercel.app
```

**复制 Production URL**，这就是你的请求地址！

---

## 🔗 获取请求地址

部署成功后，你的请求地址是：

```
https://feishu-task-bot-xxx.vercel.app/webhook/event
```

例如：
```
https://feishu-task-bot-git-main-yourname.vercel.app/webhook/event
```

---

## ⚙️ 配置飞书事件订阅

### 1. 进入飞书开放平台

访问：https://open.feishu.cn/app

找到你的应用 `cli_aab22695e53bdbcb`

### 2. 配置事件订阅

进入 **事件与回调** → **事件订阅**

**请求地址配置：**
```
https://feishu-task-bot-xxx.vercel.app/webhook/event
```

点击 **保存**，飞书会发送验证请求，Vercel 会自动响应。

### 3. 添加事件

点击 **添加事件**，搜索并添加：

- `im.message.receive_v1` - 接收消息
- `im.chat.member.bot.added_v1` - 机器人进组
- `im.chat.member.bot.deleted_v1` - 机器人退组

### 4. 获取验证 Token

在事件订阅页面，复制 **验证 Token**，添加到 Vercel 环境变量：

```bash
vercel env add FEISHU_VERIFICATION_TOKEN
# 粘贴 Token
```

然后重新部署：
```bash
vercel --prod
```

---

## 📊 初始化多维表格

### 1. 创建多维表格

在飞书中创建一个新的多维表格，从浏览器地址栏复制 `app_token`：

```
https://xxx.feishu.cn/base/BascnXXXXXXXXXXXXX
                          ^^^^^^^^^^^^^^^^^^^^
                          这部分就是 app_token
```

### 2. 运行初始化脚本

```bash
# 先配置本地 .env 文件（仅用于初始化脚本）
cp .env.example .env
# 编辑 .env，填入 FEISHU_APP_ID、FEISHU_APP_SECRET、BITABLE_APP_TOKEN

# 运行脚本
npm run setup
```

脚本会输出：
```
✅ 数据表创建成功!
   Table ID: tblxxxxxxxxxxxxxx

📝 请将以下配置添加到 Vercel 环境变量:
   BITABLE_TABLE_ID=tblxxxxxxxxxxxxxx
```

### 3. 添加 Table ID 到 Vercel

```bash
vercel env add BITABLE_TABLE_ID
# 粘贴 tblxxxxxxxxxxxxxx
```

重新部署：
```bash
vercel --prod
```

---

## 🤖 添加机器人到群聊

### 1. 在飞书群聊中添加机器人

- 打开目标群聊
- 点击 **设置** → **群机器人** → **添加机器人**
- 选择你创建的应用

机器人会自动发送欢迎消息。

### 2. 获取群聊 ID

访问 Vercel 的 setup-cron 接口：

```bash
curl -H "Authorization: Bearer ***-secret-key-123456" \
  https://feishu-task-bot-xxx.vercel.app/api/cron/setup-cron
```

返回：
```json
{
  "message": "获取群聊列表成功",
  "chats": [
    {
      "chat_id": "oc_xxxxxxxxxxxxx",
      "name": "项目讨论群",
      "description": "..."
    }
  ],
  "count": 1,
  "hint": "将 chat_id 添加到 MONITORED_CHAT_IDS 环境变量"
}
```

### 3. 配置监控的群聊

```bash
vercel env add MONITORED_CHAT_IDS
# 粘贴 oc_xxxxxxxxxxxxx（多个用逗号分隔）
```

重新部署：
```bash
vercel --prod
```

---

## 🎯 测试功能

在监控的群聊中发送：

```
/help
```

机器人会回复帮助信息，说明配置成功！

其他命令：
- `/summary` - 生成今日总结
- `/tasks` - 查看今日任务
- `/analyze` - 分析并创建任务

---

## ⏰ 定时任务配置

Vercel 支持 Cron Jobs，已在 `vercel.json` 中配置：

```json
{
  "crons": [
    {
      "path": "/api/cron/daily-summary",
      "schedule": "0 10 * * *"
    }
  ]
}
```

这表示每天 UTC 10:00（北京时间 18:00）自动执行每日汇总。

**修改时间：**

编辑 `vercel.json`，修改 `schedule` 字段（UTC 时间）：

```json
"schedule": "0 1 * * *"    // 北京时间 9:00
"schedule": "0 10 * * *"   // 北京时间 18:00
"schedule": "0 1,10 * * *" // 北京时间 9:00 和 18:00
```

然后重新部署：
```bash
vercel --prod
```

---

## 📝 查看日志

### Vercel 控制台

1. 访问 https://vercel.com/dashboard
2. 点击你的项目
3. 点击 **Deployments** → 最新部署 → **Functions**
4. 查看实时日志

### 命令行

```bash
vercel logs
```

---

## 🔧 常见问题

### Q: 事件订阅验证失败？

A: 确保：
1. 已部署到生产环境（`vercel --prod`）
2. 环境变量 `FEISHU_VERIFICATION_TOKEN` 已配置
3. 重新部署后等待 1-2 分钟再验证

### Q: 无法获取群聊消息？

A: 检查：
1. 应用权限是否包含 `im:message:readonly`
2. 机器人是否已加入群聊
3. `MONITORED_CHAT_IDS` 是否包含该群聊
4. 查看 Vercel 日志排查错误

### Q: 定时任务没有执行？

A: 确认：
1. `vercel.json` 中 `crons` 配置正确
2. 环境变量 `CRON_SECRET` 已配置
3. 查看 Vercel 控制台的 **Cron Jobs** 页面

### Q: 如何更新代码？

A: 
```bash
# 修改代码后
vercel --prod
```

---

## 📁 项目结构（Serverless 版本）

```
feishu-task-bot/
├── api/
│   ├── webhook/
│   │   └── event.js          # 飞书事件处理（主入口）
│   ├── health.js             # 健康检查
│   └── cron/
│       ├── daily-summary.js  # 每日汇总定时任务
│       └── setup-cron.js     # 获取群聊列表
├── lib/
│   └── config.js             # 配置管理
├── services/
│   ├── feishu-client.js      # 飞书 API 客户端
│   ├── ai-service.js         # AI 分析服务
│   └── bitable-service.js    # 多维表格操作
├── scripts/
│   └── setup-bitable.js      # 多维表格初始化
├── vercel.json               # Vercel 配置
├── package.json
└── README.md
```

---

## 🎉 部署完成！

现在你的飞书AI任务助手已经运行在 Vercel 上：

✅ 自动监听群聊消息
✅ 每天 18:00 自动生成日报
✅ 任务自动同步到多维表格
✅ 支持群内命令交互
✅ 无需维护服务器

**下一步：**
1. 将机器人添加到需要监控的群聊
2. 获取 `chat_id` 并配置到 Vercel 环境变量
3. 重新部署：`vercel --prod`
4. 在群聊中发送 `/help` 测试

---

## 🔗 相关链接

- Vercel 控制台：https://vercel.com/dashboard
- 飞书开放平台：https://open.feishu.cn/
- 通义千问 API：https://dashscope.console.aliyun.com/
