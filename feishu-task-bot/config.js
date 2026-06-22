require('dotenv').config();

const config = {
  // 飞书应用
  feishu: {
    appId: process.env.FEISHU_APP_ID || '',
    appSecret: process.env.FEISHU_APP_SECRET || '',
    verificationToken: process.env.FEISHU_VERIFICATION_TOKEN || '',
    encryptKey: process.env.FEISHU_ENCRYPT_KEY || '',
    baseUrl: 'https://open.feishu.cn/open-apis',
  },

  // AI 配置
  ai: {
    provider: process.env.AI_PROVIDER || 'dashscope',
    apiKey: process.env.AI_API_KEY || '',
    model: process.env.AI_MODEL || 'qwen-plus',
    baseUrl: process.env.AI_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  },

  // 多维表格
  bitable: {
    appToken: process.env.BITABLE_APP_TOKEN || '',
    tableId: process.env.BITABLE_TABLE_ID || '',
  },

  // 服务
  server: {
    port: parseInt(process.env.PORT || '3000'),
    host: process.env.HOST || '0.0.0.0',
  },

  // 日志
  logLevel: process.env.LOG_LEVEL || 'info',

  // 定时任务
  dailySummaryCron: process.env.DAILY_SUMMARY_CRON || '0 18 * * *',
  timezone: process.env.TIMEZONE || 'Asia/Shanghai',

  // 监控群聊
  monitoredChatIds: (process.env.MONITORED_CHAT_IDS || '').split(',').filter(Boolean),
};

// 验证必要配置
function validateConfig() {
  const required = [
    { path: 'feishu.appId', value: config.feishu.appId },
    { path: 'feishu.appSecret', value: config.feishu.appSecret },
    { path: 'ai.apiKey', value: config.ai.apiKey },
    { path: 'bitable.appToken', value: config.bitable.appToken },
    { path: 'bitable.tableId', value: config.bitable.tableId },
  ];

  const missing = required.filter(r => !r.value);
  if (missing.length > 0) {
    console.warn(`⚠️  缺少必要配置: ${missing.map(m => m.path).join(', ')}`);
    console.warn('请复制 .env.example 为 .env 并填写配置');
    return false;
  }
  return true;
}

module.exports = { config, validateConfig };
