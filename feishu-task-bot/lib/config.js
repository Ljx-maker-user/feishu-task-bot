/**
 * 共享配置 - Serverless 版本
 * 从 Vercel 环境变量读取
 */

const config = {
  feishu: {
    appId: process.env.FEISHU_APP_ID || '',
    appSecret: process.env.FEISHU_APP_SECRET || '',
    verificationToken: process.env.FEISHU_VERIFICATION_TOKEN || '',
    encryptKey: process.env.FEISHU_ENCRYPT_KEY || '',
    baseUrl: 'https://open.feishu.cn/open-apis',
  },

  ai: {
    provider: process.env.AI_PROVIDER || 'dashscope',
    apiKey: process.env.AI_API_KEY || '',
    model: process.env.AI_MODEL || 'qwen-plus',
    baseUrl: process.env.AI_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  },

  bitable: {
    appToken: process.env.BITABLE_APP_TOKEN || '',
    tableId: process.env.BITABLE_TABLE_ID || '',
  },

  timezone: process.env.TIMEZONE || 'Asia/Shanghai',
  monitoredChatIds: (process.env.MONITORED_CHAT_IDS || '').split(',').filter(Boolean),

  // 用于保护 cron 端口的密钥
  cronSecret: process.env.CRON_SECRET || 'feishu-task-bot-cron-secret',
};

function validateConfig() {
  const required = [
    { path: 'FEISHU_APP_ID', value: config.feishu.appId },
    { path: 'FEISHU_APP_SECRET', value: config.feishu.appSecret },
    { path: 'AI_API_KEY', value: config.ai.apiKey },
    { path: 'BITABLE_APP_TOKEN', value: config.bitable.appToken },
    { path: 'BITABLE_TABLE_ID', value: config.bitable.tableId },
  ];
  const missing = required.filter(r => !r.value);
  if (missing.length > 0) {
    console.warn(`缺少配置: ${missing.map(m => m.path).join(', ')}`);
    return false;
  }
  return true;
}

module.exports = { config, validateConfig };
