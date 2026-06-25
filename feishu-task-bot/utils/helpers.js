const crypto = require('crypto');
const { config } = require('../config');
const logger = require('./logger');

// 消息去重缓存（简单内存实现，生产环境建议用 Redis）
const messageCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5分钟

// 验证飞书事件签名
function verifySignature(timestamp, nonce, body, signature) {
  if (!config.feishu.encryptKey) {
    return true; // 未配置加密密钥时跳过验证
  }

  const data = timestamp + nonce + config.feishu.encryptKey + body;
  const hash = crypto.createHash('sha256').update(data).digest('hex');
  return hash === signature;
}

// 解密飞书事件消息
function decryptMessage(encrypt) {
  if (!config.feishu.encryptKey) {
    return null;
  }

  try {
    const decipher = crypto.createDecipheriv(
      'aes-256-cbc',
      crypto.createHash('sha256').update(config.feishu.encryptKey).digest(),
      Buffer.alloc(16, 0)
    );

    let decrypted = decipher.update(encrypt, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    
    return JSON.parse(decrypted);
  } catch (error) {
    logger.error('消息解密失败:', error.message);
    return null;
  }
}

// 消息去重
function isDuplicate(messageId) {
  if (!messageId) return false;

  const now = Date.now();
  
  // 清理过期缓存
  for (const [key, timestamp] of messageCache.entries()) {
    if (now - timestamp > CACHE_TTL) {
      messageCache.delete(key);
    }
  }

  if (messageCache.has(messageId)) {
    logger.debug(`重复消息已忽略: ${messageId}`);
    return true;
  }

  messageCache.set(messageId, now);
  return false;
}

// 解析消息内容
function parseMessageContent(message) {
  try {
    const content = JSON.parse(message.content);
    
    switch (message.message_type) {
      case 'text':
        return { type: 'text', text: content.text };
      case 'post':
        // 富文本消息
        const texts = [];
        content.content?.forEach(paragraph => {
          paragraph.forEach(element => {
            if (element.tag === 'text') {
              texts.push(element.text);
            }
          });
        });
        return { type: 'text', text: texts.join(' ') };
      case 'image':
        return { type: 'image', imageKey: content.image_key };
      case 'file':
        return { type: 'file', fileKey: content.file_key, fileName: content.file_name };
      default:
        return { type: message.message_type, raw: content };
    }
  } catch (error) {
    logger.warn('消息内容解析失败:', error.message);
    return { type: 'unknown', raw: message.content };
  }
}

// 格式化时间戳
function formatTimestamp(timestamp) {
  return new Date(parseInt(timestamp) * 1000).toLocaleString('zh-CN', {
    timeZone: config.timezone,
    hour12: false,
  });
}

// 获取今日时间范围（Unix 时间戳，秒，数字类型）
function getTodayTimeRange() {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  return {
    startTime: Math.floor(today.getTime() / 1000),  // 数字类型，不是字符串
    endTime: Math.floor(tomorrow.getTime() / 1000), // 数字类型，不是字符串
  };
}

module.exports = {
  verifySignature,
  decryptMessage,
  isDuplicate,
  parseMessageContent,
  formatTimestamp,
  getTodayTimeRange,
};
