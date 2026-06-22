const { config } = require('../../lib/config');
const feishuClient = require('../../services/feishu-client');
const aiService = require('../../services/ai-service');
const bitableService = require('../../services/bitable-service');

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

module.exports = async (req, res) => {
  // 验证 cron secret（防止外部调用）
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${config.cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  console.log('开始执行每日汇总任务');

  const results = [];

  for (const chatId of config.monitoredChatIds) {
    try {
      const { startTime, endTime } = getTodayTimeRange();
      const messages = await feishuClient.getChatMessages(chatId, startTime, endTime);

      if (messages.length === 0) {
        console.log(`群聊 ${chatId} 今日无消息`);
        results.push({ chatId, status: 'no_messages' });
        continue;
      }

      const analysis = await aiService.analyzeMessages(messages);

      // 创建任务到多维表格
      if (analysis.tasks.length > 0) {
        await bitableService.createTasks(analysis.tasks);
      }

      // 发送总结到群聊
      const summaryText = `🌙 每日工作汇总

📊 今日沟通总结:
${analysis.summary}

📝 提取任务: ${analysis.tasks.length} 个
${analysis.tasks.length > 0 ? '\n任务列表:\n' + analysis.tasks.map((t, i) => `${i + 1}. ${t.title} (${t.priority}优先级)`).join('\n') : ''}

✅ 所有任务已同步到多维表格`;

      await feishuClient.sendMessage(chatId, summaryText);
      console.log(`群聊 ${chatId} 每日汇总完成`);
      results.push({ chatId, status: 'success', tasks: analysis.tasks.length });
    } catch (error) {
      console.error(`群聊 ${chatId} 每日汇总失败:`, error);
      results.push({ chatId, status: 'error', error: error.message });
    }
  }

  res.status(200).json({
    message: '每日汇总完成',
    results,
    timestamp: new Date().toISOString(),
  });
};
