const express = require('express');
const cron = require('node-cron');
const { config, validateConfig } = require('./config');
const logger = require('./utils/logger');
const { verifySignature, decryptMessage, isDuplicate, getTodayTimeRange } = require('./utils/helpers');
const feishuClient = require('./services/feishu-client');
const aiService = require('./services/ai-service');
const bitableService = require('./services/bitable-service');

const app = express();
app.use(express.json());

// 请求日志中间件
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 飞书事件订阅回调 - 支持多个路径
app.post('/webhook/event', handleWebhook);
app.post('/api/webhook/event', handleWebhook);

async function handleWebhook(req, res) {
  logger.info('收到 webhook 请求');
  logger.debug('请求体:', JSON.stringify(req.body, null, 2));
  
  const { timestamp, nonce, signature, encrypt } = req.body;

  // 验证签名
  if (config.feishu.encryptKey && !verifySignature(timestamp, nonce, JSON.stringify(req.body), signature)) {
    logger.warn('事件签名验证失败');
    return res.status(403).json({ error: 'Invalid signature' });
  }

  // 解密消息
  let event;
  if (encrypt) {
    event = decryptMessage(encrypt);
    if (!event) {
      return res.status(400).json({ error: 'Decrypt failed' });
    }
  } else {
    event = req.body;
  }

  logger.info('事件类型:', event.type || event.header?.event_type);

  // URL 验证（首次配置事件订阅时飞书会发送验证请求）
  if (event.type === 'url_verification') {
    logger.info('收到 URL 验证请求');
    return res.json({ challenge: event.challenge });
  }

  // 立即响应，避免飞书重试
  res.json({ code: 0 });

  // 异步处理事件
  try {
    await handleEvent(event);
  } catch (error) {
    logger.error('事件处理失败:', error);
  }
}

// 处理飞书事件
async function handleEvent(event) {
  // 飞书 v2.0 事件格式
  const eventType = event.header?.event_type || event.event?.type || event.type;
  logger.info(`处理事件: ${eventType}`);

  switch (eventType) {
    case 'im.message.receive_v1':
      // v2.0 格式: event.event.message
      // v1.0 格式: event.message
      const messageEvent = event.event?.message ? event.event : { message: event.message };
      await handleMessageReceive(messageEvent);
      break;
    case 'im.chat.member.bot.added_v1':
      const addedEvent = event.event || event;
      await handleBotAddedToChat(addedEvent);
      break;
    case 'im.chat.member.bot.deleted_v1':
      const removedEvent = event.event || event;
      await handleBotRemovedFromChat(removedEvent);
      break;
    default:
      logger.debug(`未处理的事件类型: ${eventType}`);
  }
}

// 处理消息接收事件
async function handleMessageReceive(event) {
  const message = event.message;
  
  if (!message) {
    logger.warn('消息事件中没有 message 字段');
    logger.debug('事件内容:', JSON.stringify(event, null, 2));
    return;
  }
  
  const chatId = message.chat_id;
  const messageId = message.message_id;

  logger.info(`收到消息 - chatId: ${chatId}, messageId: ${messageId}, type: ${message.message_type}`);

  // 消息去重
  if (isDuplicate(messageId)) {
    logger.info(`消息 ${messageId} 重复，跳过`);
    return;
  }

  // 解析文本内容（提前解析，命令不受群聊白名单限制）
  const content = parseTextContent(message);
  logger.info(`解析的消息内容: ${content}`);

  // 清理 @提及，提取实际命令
  const cleanContent = cleanAtMentions(content);
  logger.info(`清理后的内容: ${cleanContent}`);

  // 命令消息始终处理（不受 monitoredChatIds 限制）
  if (cleanContent && cleanContent.startsWith('/')) {
    logger.info(`收到命令消息: ${chatId}, 命令: ${cleanContent}`);
    await handleCommand(chatId, cleanContent, message.sender?.sender_id?.open_id);
    return;
  }

  // 非命令消息需要检查是否是监控的群聊
  if (!config.monitoredChatIds.includes(chatId)) {
    logger.debug(`忽略非监控群聊消息: ${chatId}`);
    return;
  }

  logger.info(`收到群聊消息: ${chatId}, 类型: ${message.message_type}`);
}

// 解析文本内容
function parseTextContent(message) {
  try {
    if (!message.content) {
      logger.warn('消息没有 content 字段');
      return null;
    }
    
    const content = typeof message.content === 'string' 
      ? JSON.parse(message.content) 
      : message.content;
      
    if (message.message_type === 'text') {
      return content.text;
    }
    return null;
  } catch (error) {
    logger.error('解析消息内容失败:', error);
    logger.debug('原始 content:', message.content);
    return null;
  }
}

// 清理 @提及标记
function cleanAtMentions(text) {
  if (!text) return text;
  
  // 飞书的 @提及格式: @_user_1, @_user_2 等
  // 或者 @_all (所有人)
  return text.replace(/@_user_\d+|@_all/g, '').trim();
}

// 处理命令
async function handleCommand(chatId, command, userId) {
  const parts = command.trim().split(' ');
  const cmd = parts[0].toLowerCase();

  logger.info(`处理命令: ${cmd}`);

  switch (cmd) {
    case '/help':
    case '/帮助':
      await sendHelpMessage(chatId);
      break;
    case '/summary':
    case '/总结':
      await generateAndSendSummary(chatId);
      break;
    case '/tasks':
    case '/任务':
      await sendTodayTasks(chatId);
      break;
    case '/analyze':
    case '/分析':
      await analyzeAndCreateTasks(chatId);
      break;
    default:
      await feishuClient.sendMessage(chatId, `未知命令: ${cmd}\n发送 /help 查看可用命令`);
  }
}

// 发送帮助信息
async function sendHelpMessage(chatId) {
  const helpText = `🤖 飞书AI任务助手

可用命令：
/help 或 /帮助 - 显示此帮助信息
/summary 或 /总结 - 生成今日沟通总结
/tasks 或 /任务 - 查看今日创建的任务
/analyze 或 /分析 - 分析今日聊天并自动创建任务

💡 提示：
- 机器人会自动监控群聊消息
- 每日 ${config.dailySummaryCron.split(' ')[1]}:00 自动生成日报
- 任务会自动同步到多维表格`;

  await feishuClient.sendMessage(chatId, helpText);
}

// 生成并发送总结
async function generateAndSendSummary(chatId) {
  try {
    await feishuClient.sendMessage(chatId, '⏳ 正在分析今日聊天记录...');

    const { startTime, endTime } = getTodayTimeRange();
    const messages = await feishuClient.getChatMessages(chatId, startTime, endTime);

    if (messages.length === 0) {
      await feishuClient.sendMessage(chatId, '📭 今日暂无聊天记录');
      return;
    }

    const analysis = await aiService.analyzeMessages(messages);

    const summaryText = `📊 今日沟通总结

${analysis.summary}

📝 提取任务数: ${analysis.tasks.length}`;

    await feishuClient.sendMessage(chatId, summaryText);
  } catch (error) {
    logger.error('生成总结失败:', error);
    await feishuClient.sendMessage(chatId, `❌ 生成总结失败: ${error.message}`);
  }
}

// 发送今日任务
async function sendTodayTasks(chatId) {
  try {
    const tasks = await bitableService.getTodayTasks();

    if (tasks.length === 0) {
      await feishuClient.sendMessage(chatId, '📭 今日暂无创建的任务');
      return;
    }

    const taskList = tasks.map((t, i) => {
      const fields = t.fields;
      return `${i + 1}. ${fields['任务名称']}\n   负责人: ${fields['负责人'] || '未指定'} | 优先级: ${fields['优先级']} | 状态: ${fields['状态']}`;
    }).join('\n\n');

    const text = `📋 今日任务列表 (${tasks.length}个)\n\n${taskList}`;
    await feishuClient.sendMessage(chatId, text);
  } catch (error) {
    logger.error('获取任务失败:', error);
    await feishuClient.sendMessage(chatId, `❌ 获取任务失败: ${error.message}`);
  }
}

// 分析并创建任务
async function analyzeAndCreateTasks(chatId) {
  try {
    await feishuClient.sendMessage(chatId, '⏳ 正在分析聊天记录并提取任务...');

    const { startTime, endTime } = getTodayTimeRange();
    const messages = await feishuClient.getChatMessages(chatId, startTime, endTime);

    if (messages.length === 0) {
      await feishuClient.sendMessage(chatId, '📭 今日暂无聊天记录，无法提取任务');
      return;
    }

    const analysis = await aiService.analyzeMessages(messages);

    if (analysis.tasks.length === 0) {
      await feishuClient.sendMessage(chatId, '✅ 分析完成，今日聊天中未发现明确的待办任务');
      return;
    }

    await feishuClient.sendMessage(chatId, `📝 发现 ${analysis.tasks.length} 个任务，正在创建...`);

    const results = await bitableService.createTasks(analysis.tasks);
    const successCount = results.filter(r => r.success).length;

    const taskList = analysis.tasks.map((t, i) => {
      const status = results[i].success ? '✅' : '❌';
      return `${status} ${t.title}\n   负责人: ${t.assignee || '未指定'} | 优先级: ${t.priority}`;
    }).join('\n\n');

    const text = `✅ 任务创建完成 (${successCount}/${analysis.tasks.length})\n\n${taskList}\n\n📊 沟通总结:\n${analysis.summary}`;
    await feishuClient.sendMessage(chatId, text);
  } catch (error) {
    logger.error('分析创建任务失败:', error);
    await feishuClient.sendMessage(chatId, `❌ 任务创建失败: ${error.message}`);
  }
}

// 机器人被添加到群聊
async function handleBotAddedToChat(event) {
  const chatId = event.chat_id;
  logger.info(`机器人被添加到群聊: ${chatId}`);

  try {
    await feishuClient.sendMessage(chatId, '👋 大家好！我是AI任务助手。\n\n我会自动记录群聊中的任务和待办事项，并同步到多维表格。\n\n发送 /help 查看可用命令。');
  } catch (error) {
    logger.error('发送欢迎消息失败:', error);
  }
}

// 机器人被移出群聊
async function handleBotRemovedFromChat(event) {
  const chatId = event.chat_id;
  logger.info(`机器人被移出群聊: ${chatId}`);
}

// 每日定时任务
async function dailySummaryJob() {
  logger.info('开始执行每日汇总任务');

  for (const chatId of config.monitoredChatIds) {
    try {
      const { startTime, endTime } = getTodayTimeRange();
      const messages = await feishuClient.getChatMessages(chatId, startTime, endTime);

      if (messages.length === 0) {
        logger.info(`群聊 ${chatId} 今日无消息`);
        continue;
      }

      const analysis = await aiService.analyzeMessages(messages);

      // 创建任务到多维表格
      if (analysis.tasks.length > 0) {
        await bitableService.createTasks(analysis.tasks);
      }

      // 记录每日总结
      await bitableService.createDailySummary(chatId, analysis.summary, analysis.tasks.length);

      // 发送总结到群聊
      const summaryText = `🌙 每日工作汇总

📊 今日沟通总结:
${analysis.summary}

📝 提取任务: ${analysis.tasks.length} 个
${analysis.tasks.length > 0 ? '\n任务列表:\n' + analysis.tasks.map((t, i) => `${i + 1}. ${t.title} (${t.priority}优先级)`).join('\n') : ''}

✅ 所有任务已同步到多维表格`;

      await feishuClient.sendMessage(chatId, summaryText);
      logger.info(`群聊 ${chatId} 每日汇总完成`);
    } catch (error) {
      logger.error(`群聊 ${chatId} 每日汇总失败:`, error);
    }
  }
}

// 启动定时任务
function startCronJobs() {
  // 每日汇总
  cron.schedule(config.dailySummaryCron, dailySummaryJob, {
    timezone: config.timezone,
  });
  logger.info(`每日汇总任务已设置: ${config.dailySummaryCron} (${config.timezone})`);
}

// 启动服务器
function startServer() {
  // 添加全局错误处理
  process.on('uncaughtException', (error) => {
    logger.error('未捕获的异常:', error);
    logger.error(error.stack);
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error('未处理的 Promise 拒绝:', reason);
  });

  logger.info('🔄 正在启动飞书AI任务助手...');
  logger.info(`📋 配置状态:`);
  logger.info(`  - FEISHU_APP_ID: ${config.feishu.appId ? '✅ 已配置' : '❌ 缺失'}`);
  logger.info(`  - FEISHU_APP_SECRET: ${config.feishu.appSecret ? '✅ 已配置' : '❌ 缺失'}`);
  logger.info(`  - AI_API_KEY: ${config.ai.apiKey ? '✅ 已配置' : '⚠️ 未配置 (AI功能不可用)'}`);
  logger.info(`  - BITABLE_APP_TOKEN: ${config.bitable.appToken ? '✅ 已配置' : '⚠️ 未配置 (多维表格不可用)'}`);
  logger.info(`  - BITABLE_TABLE_ID: ${config.bitable.tableId ? '✅ 已配置' : '⚠️ 未配置 (多维表格不可用)'}`);
  logger.info(`  - MONITORED_CHAT_IDS: ${config.monitoredChatIds.length > 0 ? config.monitoredChatIds.join(', ') : '⚠️ 空 (仅命令可用)'}`);
  logger.info(`  - PORT: ${config.server.port}`);

  if (!validateConfig()) {
    logger.warn('⚠️ 部分配置缺失，基础功能（命令回复）仍可运行');
  }

  const server = app.listen(config.server.port, config.server.host, () => {
    logger.info(`🚀 飞书AI任务助手已启动`);
    logger.info(`📡 服务地址: http://${config.server.host}:${config.server.port}`);
    logger.info(`🔗 Webhook: http://${config.server.host}:${config.server.port}/webhook/event`);
    logger.info(`🔗 Webhook (alt): http://${config.server.host}:${config.server.port}/api/webhook/event`);
    logger.info(`💚 健康检查: http://${config.server.host}:${config.server.port}/health`);
    
    startCronJobs();
  });

  server.on('error', (error) => {
    logger.error('服务器启动失败:', error);
    process.exit(1);
  });
}

startServer();
