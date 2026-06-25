/**
 * 多维表格初始化脚本
 * 自动创建所需字段
 * 
 * 使用方法: node scripts/setup-bitable.js
 */

const axios = require('axios');

const APP_ID = process.env.FEISHU_APP_ID;
const APP_SECRET = process.env.FEISHU_APP_SECRET;
const APP_TOKEN = process.env.BITABLE_APP_TOKEN;
const TABLE_ID = process.env.BITABLE_TABLE_ID;
const BASE_URL = 'https://open.feishu.cn/open-apis';

async function getAccessToken() {
  const response = await axios.post(`${BASE_URL}/auth/v3/tenant_access_token/internal`, {
    app_id: APP_ID,
    app_secret: APP_SECRET,
  });

  if (response.data.code === 0) {
    return response.data.tenant_access_token;
  }
  throw new Error(`获取 token 失败: ${response.data.msg}`);
}

async function getExistingFields(token) {
  const response = await axios.get(
    `${BASE_URL}/bitable/v1/apps/${APP_TOKEN}/tables/${TABLE_ID}/fields`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    }
  );

  if (response.data.code === 0) {
    return (response.data.data.items || []).map(f => f.field_name);
  }
  throw new Error(`获取字段失败: ${response.data.msg}`);
}

async function createField(token, field) {
  const response = await axios.post(
    `${BASE_URL}/bitable/v1/apps/${APP_TOKEN}/tables/${TABLE_ID}/fields`,
    field,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    }
  );

  if (response.data.code === 0) {
    console.log(`  ✅ 字段 "${field.field_name}" 创建成功`);
    return true;
  } else {
    console.error(`  ❌ 字段 "${field.field_name}" 创建失败: ${response.data.msg}`);
    return false;
  }
}

// 需要创建的字段定义
// 飞书字段类型: 1=文本, 2=数字, 3=单选, 4=多选, 5=日期, 7=复选框, 11=人员, 13=电话, 15=URL
const FIELDS = [
  {
    field_name: '任务名称',
    type: 1, // 文本
  },
  {
    field_name: '任务描述',
    type: 1, // 文本
  },
  {
    field_name: '负责人',
    type: 1, // 文本
  },
  {
    field_name: '截止日期',
    type: 1, // 文本（用文本存储更灵活）
  },
  {
    field_name: '优先级',
    type: 3, // 单选
    property: {
      options: [
        { name: '高', color: 0 },
        { name: '中', color: 1 },
        { name: '低', color: 2 },
      ]
    }
  },
  {
    field_name: '状态',
    type: 3, // 单选
    property: {
      options: [
        { name: '待开始', color: 0 },
        { name: '进行中', color: 1 },
        { name: '已完成', color: 2 },
        { name: '已取消', color: 3 },
      ]
    }
  },
  {
    field_name: '来源',
    type: 1, // 文本
  },
  {
    field_name: '创建时间',
    type: 5, // 日期
    property: {
      date_formatter: 'yyyy/MM/dd HH:mm',
    }
  },
];

async function main() {
  console.log('🔧 多维表格字段初始化脚本');
  console.log('========================');
  
  if (!APP_ID || !APP_SECRET) {
    console.error('❌ 请设置环境变量: FEISHU_APP_ID, FEISHU_APP_SECRET');
    process.exit(1);
  }
  if (!APP_TOKEN || !TABLE_ID) {
    console.error('❌ 请设置环境变量: BITABLE_APP_TOKEN, BITABLE_TABLE_ID');
    process.exit(1);
  }

  console.log(`📋 表格: ${APP_TOKEN}`);
  console.log(`📋 数据表: ${TABLE_ID}`);
  console.log('');

  try {
    const token = await getAccessToken();
    console.log('✅ Token 获取成功');

    const existingFields = await getExistingFields(token);
    console.log(`📊 已有字段: ${existingFields.length > 0 ? existingFields.join(', ') : '(无)'}`);
    console.log('');

    let created = 0;
    let skipped = 0;
    let failed = 0;

    for (const field of FIELDS) {
      if (existingFields.includes(field.field_name)) {
        console.log(`  ⏭️  字段 "${field.field_name}" 已存在，跳过`);
        skipped++;
      } else {
        const success = await createField(token, field);
        if (success) created++;
        else failed++;
      }
    }

    console.log('');
    console.log('========================');
    console.log(`✅ 创建: ${created} | ⏭️ 跳过: ${skipped} | ❌ 失败: ${failed}`);
    
    if (failed === 0) {
      console.log('🎉 多维表格字段初始化完成！');
    }
  } catch (error) {
    console.error('❌ 初始化失败:', error.message);
    process.exit(1);
  }
}

main();
