const feishuClient = require('./feishu-client');
const { config } = require('../lib/config');

class BitableService {
  get appToken() { return config.bitable.appToken; }
  get tableId() { return config.bitable.tableId; }

  async createTask(task) {
    const fields = {
      '任务名称': task.title,
      '任务描述': task.description || '',
      '负责人': task.assignee || '',
      '截止日期': task.deadline || '',
      '优先级': task.priority || '中',
      '状态': task.status || '待开始',
      '来源': 'AI自动提取',
      '创建时间': new Date().toISOString(),
    };

    const data = await feishuClient.request(
      'POST',
      `/bitable/v1/apps/${this.appToken}/tables/${this.tableId}/records`,
      { fields }
    );

    console.log(`任务创建成功: ${task.title}`);
    return data.record;
  }

  async createTasks(tasks) {
    if (!tasks || tasks.length === 0) return [];

    const results = [];
    for (const task of tasks) {
      try {
        const record = await this.createTask(task);
        results.push({ success: true, task: task.title, record });
      } catch (error) {
        console.error(`创建任务失败 [${task.title}]:`, error.message);
        results.push({ success: false, task: task.title, error: error.message });
      }
    }

    const successCount = results.filter(r => r.success).length;
    console.log(`批量创建: ${successCount}/${tasks.length} 成功`);
    return results;
  }

  async getTodayTasks() {
    try {
      const today = new Date().toISOString().split('T')[0];
      const data = await feishuClient.request(
        'GET',
        `/bitable/v1/apps/${this.appToken}/tables/${this.tableId}/records`,
        null,
        {
          filter: `CurrentValue.[创建时间] >= "${today}T00:00:00.000Z"`,
          page_size: 100,
        }
      );
      return data.items || [];
    } catch (error) {
      console.error('查询今日任务失败:', error.message);
      return [];
    }
  }
}

module.exports = new BitableService();
