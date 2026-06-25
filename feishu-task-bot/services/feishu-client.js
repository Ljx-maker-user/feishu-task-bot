const axios = require('axios');
const { config } = require('../lib/config');

class FeishuClient {
  constructor() {
    this.baseUrl = config.feishu.baseUrl;
    this.accessToken = null;
    this.tokenExpireTime = 0;
  }

  async getAccessToken() {
    if (this.accessToken && Date.now() < this.tokenExpireTime) {
      return this.accessToken;
    }

    const response = await axios.post(`${this.baseUrl}/auth/v3/tenant_access_token/internal`, {
      app_id: config.feishu.appId,
      app_secret: config.feishu.appSecret,
    });

    if (response.data.code === 0) {
      this.accessToken = response.data.tenant_access_token;
      this.tokenExpireTime = Date.now() + (response.data.expire - 300) * 1000;
      return this.accessToken;
    }
    throw new Error(`获取 token 失败: ${response.data.msg}`);
  }

  async request(method, path, data = null, params = null) {
    const token = await this.getAccessToken();
    const url = `${this.baseUrl}${path}`;

    const response = await axios({
      method,
      url,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      data,
      params,
    });

    if (response.data.code !== 0) {
      throw new Error(`飞书 API 错误 [${path}]: ${response.data.msg}`);
    }
    return response.data.data;
  }

  async getChatMessages(chatId, startTime, endTime, pageSize = 50) {
    const messages = [];
    let pageToken = '';

    do {
      const params = {
        container_id_type: 'chat',
        container_id: chatId,
        start_time: startTime,
        end_time: endTime,
        sort_type: 'ByCreateTimeAsc',
        page_size: pageSize,
      };
      if (pageToken) params.page_token = pageToken;

      const data = await this.request('GET', '/im/v1/messages', null, params);
      if (data.items) messages.push(...data.items);
      pageToken = data.page_token || '';
    } while (pageToken);

    return messages;
  }

  async sendMessage(chatId, content, msgType = 'text') {
    let formattedContent;
    
    if (typeof content === 'string') {
      // 如果是字符串，根据消息类型包装成 JSON
      if (msgType === 'text') {
        formattedContent = JSON.stringify({ text: content });
      } else {
        formattedContent = content;
      }
    } else {
      // 如果已经是对象，直接序列化
      formattedContent = JSON.stringify(content);
    }
    
    return this.request('POST', '/im/v1/messages', {
      receive_id: chatId,
      msg_type: msgType,
      content: formattedContent,
    }, {
      receive_id_type: 'chat_id',
    });
  }

  async getBotChatList() {
    const data = await this.request('GET', '/im/v1/chats', null, { page_size: 100 });
    return data.items || [];
  }
}

// Serverless 环境下单例
module.exports = new FeishuClient();
