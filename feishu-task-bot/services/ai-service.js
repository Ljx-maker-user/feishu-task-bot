const axios = require('axios');
const { config } = require('../lib/config');

class AIService {
  async callAI(messages, options = {}) {
    const response = await axios.post(
      `${config.ai.baseUrl}/chat/completions`,
      {
        model: config.ai.model,
        messages,
        temperature: options.temperature || 0.7,
        max_tokens: options.maxTokens || 2000,
      },
      {
        headers: {
          'Authorization': `Bearer ${config.ai.apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 60000,
      }
    );
    return response.data.choices[0].message.content;
  }

  async analyzeMessages(messages) {
    if (!messages || messages.length === 0) {
      return { summary: '今日暂无聊天记录', tasks: [] };
    }

    const chatContent = messages.map(msg => {
      const sender = msg.sender?.sender_type === 'user' ? '用户' : '机器人';
      const time = new Date(parseInt(msg.create_time) * 1000).toLocaleString('zh-CN', {
        timeZone: config.timezone,
        hour12: false,
      });

      let content = '';
      try {
        const body = JSON.parse(msg.body.content);
        content = body.text || JSON.stringify(body);
      } catch {
        content = msg.body.content;
      }

      return `[${time}] ${sender}: ${content}`;
    }).join('\n');

    const prompt = `你是一个专业的任务管理助手。请分析以下群聊记录，完成两个任务：

1. **生成今日沟通总结**（200字以内）：概括主要讨论话题、关键决策和进展
2. **提取待办任务**：识别明确的行动项、任务分配、截止日期等

群聊记录：
${chatContent}

请以 JSON 格式返回：
{
  "summary": "今日沟通总结内容",
  "tasks": [
    {
      "title": "任务标题",
      "description": "任务详细描述",
      "assignee": "负责人（如有提及）",
      "deadline": "截止日期（YYYY-MM-DD，如有提及）",
      "priority": "高/中/低",
      "status": "待开始"
    }
  ]
}

注意：只提取明确的、可执行的任务。如果没有明确任务，tasks 返回空数组。`;

    try {
      const response = await this.callAI([
        { role: 'system', content: '你是一个专业的任务管理助手，擅长从对话中提取关键信息和待办任务。请始终返回有效的 JSON 格式。' },
        { role: 'user', content: prompt },
      ]);

      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return { summary: response, tasks: [] };
      }

      const result = JSON.parse(jsonMatch[0]);
      return {
        summary: result.summary || '今日沟通总结',
        tasks: result.tasks || [],
      };
    } catch (error) {
      console.error('AI 分析失败:', error.message);
      return { summary: '分析失败', tasks: [] };
    }
  }
}

module.exports = new AIService();
