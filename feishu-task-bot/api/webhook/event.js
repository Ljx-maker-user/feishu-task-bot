const crypto = require('crypto');
const { config } = require('../../lib/config');
const feishuClient = require('../../services/feishu-client');
const aiService = require('../../services/ai-service');
const bitableService = require('../../services/bitable-service');

// 消息去重（Serverless 环境下使用内存缓存，实际生产建议用 Redis）
const messageCache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

function isDuplicate(messageId) {
  if (!messageId) return false;
  const now = Date.now();
  
  for (const [key, timestamp] of messageCache.entries()) {
    if (now - timestamp > CACHE_TTL) {
      messageCache.delete(key);
    }
  }

  if (messageCache.has(messageId)) {
    return true;
  }

  messageCache.set(messageId, now);
  return false;
}

function getTodayTimeRange() {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  return {
    startTime: Math.floor(today.getTime() / 1000).toString(),
    endTime: Math.floor(tomorrow.getTime() / 1000).toString(),
  };
}

function parseTextContent(message) {
  try {
    const content = JSON.parse(message.content);
    if (message.message_type === 'text') {
      return content.text;
    }
    return null;
  } catch {
    return null;
  }
}

async function handleCommand(chatId, command, userId) {
  const parts = command.trim().split(' ');
  const cmd = parts[0].toLowerCase();

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

async function sendHelpMessage(chatId) {
  const helpText = `🤖 飞书AI任务助手

可用命令：
/help 或 /帮助 - 显示此帮助信息
/summary 或 /总结 - 生成今日沟通总结
/tasks 或 /任务 - 查看今日创建的任务
/analyze 或 /分析 - 分析今日聊天并自动创建任务

💡 提示：
- 机器人会自动监控群聊消息
- 每日自动生成日报
- 任务会自动同步到多维表格`;

  await feishuClient.sendMessage(chatId, helpText);
}

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
    console.error('生成总结失败:', error);
    await feishuClient.sendMessage(chatId, `❌ 生成总结失败: ${error.message}`);
  }
}

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
    console.error('获取任务失败:', error);
    await feishuClient.sendMessage(chatId, `❌ 获取任务失败: ${error.message}`);
  }
}

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
    console.error('分析创建任务失败:', error);
    await feishuClient.sendMessage(chatId, `❌ 任务创建失败: ${error.message}`);
  }
}

// 主处理函数
module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const event = req.body;

  // URL 验证（首次配置事件订阅时飞书会发送验证请求）
  if (event.type === 'url_verification') {
    console.log('收到 URL 验证请求');
    return res.status(200).json({ challenge: event.challenge });
  }

  // 验证 token
  if (event.token && event.token !== config.feishu.verificationToken) {
    console.warn('验证 token 不匹配');
    return res.status(403).json({ error: 'Invalid token' });
  }

  // 立即响应，避免飞书重试
  res.status(200).json({ code: 0 });

  // 异步处理事件
  try {
    const eventType = event.header?.event_type || event.event?.type;

    switch (eventType) {
      case 'im.message.receive_v1':
        await handleMessageReceive(event.event);
        break;
      case 'im.chat.member.bot.added_v1':
        await handleBotAddedToChat(event.event);
        break;
      case 'im.chat.member.bot.deleted_v1':
        console.log(`机器人被移出群聊: ${event.event?.chat_id}`);
        break;
      default:
        console.log(`未处理的事件类型: ${eventType}`);
    }
  } catch (error) {
    console.error('事件处理失败:', error);
  }
};

async function handleMessageReceive(event) {
  const message = event.message;
  const chatId = message.chat_id;
  const messageId = message.message_id;

  // 检查是否是监控的群聊
  if (config.monitoredChatIds.length > 0 && !config.monitoredChatIds.includes(chatId)) {
    return;
  }

  // 消息去重
  if (isDuplicate(messageId)) {
    return;
  }

  console.log(`收到群聊消息: ${chatId}, 类型: ${message.message_type}`);

  // 处理命令消息
  const content = parseTextContent(message);
  if (content && content.startsWith('/')) {
    await handleCommand(chatId, content, message.sender?.sender_id?.open_id);
  }
}

async function handleBotAddedToChat(event) {
  const chatId = event.chat_id;
  console.log(`机器人被添加到群聊: ${chatId}`);

  try {
    await feishuClient.sendMessage(chatId, '👋 大家好！我是AI任务助手。\n\n我会自动记录群聊中的任务和待办事项，并同步到多维表格。\n\n发送 /help 查看可用命令。');
  } catch (error) {
    console.error('发送欢迎消息失败:', error);
  }
}
