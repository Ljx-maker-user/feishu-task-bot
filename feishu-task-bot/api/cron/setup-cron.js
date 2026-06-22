const { config } = require('../../lib/config');
const feishuClient = require('../../services/feishu-client');

module.exports = async (req, res) => {
  // 验证 cron secret
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${config.cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // 获取机器人加入的群聊列表
    const chats = await feishuClient.getBotChatList();

    const chatList = chats.map(chat => ({
      chat_id: chat.chat_id,
      name: chat.name,
      description: chat.description,
      owner_id: chat.owner_id,
    }));

    res.status(200).json({
      message: '获取群聊列表成功',
      chats: chatList,
      count: chatList.length,
      hint: '将 chat_id 添加到 MONITORED_CHAT_IDS 环境变量',
    });
  } catch (error) {
    console.error('获取群聊列表失败:', error);
    res.status(500).json({ error: error.message });
  }
};
