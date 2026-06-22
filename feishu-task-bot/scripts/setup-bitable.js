#!/usr/bin/env node

/**
 * 多维表格初始化脚本
 * 用于创建任务管理所需的数据表和字段
 */

require('dotenv').config();
const axios = require('axios');
const { config } = require('../config');

async function getAccessToken() {
  const response = await axios.post(`${config.feishu.baseUrl}/auth/v3/tenant_access_token/internal`, {
    app_id: config.feishu.appId,
    app_secret: config.feishu.appSecret,
  });

  if (response.data.code !== 0) {
    throw new Error(`获取 token 失败: ${response.data.msg}`);
  }

  return response.data.tenant_access_token;
}

async function setupBitable() {
  console.log('🔧 开始初始化多维表格...\n');

  const token = await getAccessToken();
  const baseUrl = `${config.feishu.baseUrl}/bitable/v1/apps/${config.bitable.appToken}`;

  // 定义任务表字段
  const fields = [
    {
      field_name: '任务名称',
      type: 1, // 文本
      description: { disable_sync: false, text: '任务的标题' },
    },
    {
      field_name: '任务描述',
      type: 1, // 文本
      description: { disable_sync: false, text: '任务的详细描述' },
    },
    {
      field_name: '负责人',
      type: 1, // 文本（可以改为人员类型 type: 11）
      description: { disable_sync: false, text: '任务负责人' },
    },
    {
      field_name: '截止日期',
      type: 5, // 日期
      property: { date_formatter: 'yyyy-MM-dd' },
      description: { disable_sync: false, text: '任务截止日期' },
    },
    {
      field_name: '优先级',
      type: 3, // 单选
      property: {
        options: [
          { name: '高', color: 0 },
          { name: '中', color: 1 },
          { name: '低', color: 2 },
        ],
      },
      description: { disable_sync: false, text: '任务优先级' },
    },
    {
      field_name: '状态',
      type: 3, // 单选
      property: {
        options: [
          { name: '待开始', color: 3 },
          { name: '进行中', color: 4 },
          { name: '已完成', color: 5 },
          { name: '已取消', color: 6 },
        ],
      },
      description: { disable_sync: false, text: '任务状态' },
    },
    {
      field_name: '来源',
      type: 3, // 单选
      property: {
        options: [
          { name: 'AI自动提取', color: 7 },
          { name: '手动创建', color: 8 },
        ],
      },
      description: { disable_sync: false, text: '任务来源' },
    },
    {
      field_name: '创建时间',
      type: 1005, // 创建时间
      property: { date_formatter: 'yyyy-MM-dd HH:mm' },
    },
    {
      field_name: '群聊ID',
      type: 1, // 文本
      description: { disable_sync: false, text: '来源群聊' },
    },
  ];

  console.log('📋 准备创建以下字段:');
  fields.forEach(f => console.log(`  - ${f.field_name} (${getTypeName(f.type)})`));
  console.log('');

  try {
    // 创建新表
    console.log('创建数据表...');
    const createTableResponse = await axios.post(
      `${config.feishu.baseUrl}/bitable/v1/apps/${config.bitable.appToken}/tables`,
      {
        table: {
          name: '任务管理',
          default_view_name: '全部任务',
          fields: fields,
        },
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (createTableResponse.data.code !== 0) {
      throw new Error(`创建表失败: ${createTableResponse.data.msg}`);
    }

    const tableId = createTableResponse.data.data.table_id;
    console.log(`✅ 数据表创建成功!`);
    console.log(`   Table ID: ${tableId}`);
    console.log('');
    console.log('📝 请将以下配置添加到 .env 文件:');
    console.log(`   BITABLE_TABLE_ID=${tableId}`);
    console.log('');
    console.log('🎉 初始化完成！');
  } catch (error) {
    console.error('❌ 初始化失败:', error.response?.data || error.message);
    console.log('');
    console.log('💡 如果表已存在，请手动获取 table_id 并配置到 .env 文件中');
  }
}

function getTypeName(type) {
  const types = {
    1: '文本',
    2: '数字',
    3: '单选',
    4: '多选',
    5: '日期',
    7: '复选框',
    11: '人员',
    13: '电话',
    15: '链接',
    1001: '创建人',
    1002: '修改人',
    1003: '创建时间',
    1004: '修改时间',
    1005: '创建时间',
  };
  return types[type] || '未知';
}

// 运行
setupBitable().catch(error => {
  console.error('脚本执行失败:', error);
  process.exit(1);
});
