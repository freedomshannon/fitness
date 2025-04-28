// 定义 KV 数据键名
const WEIGHT_DATA_KEY = 'weight-data';
const ANALYSIS_DATA_KEY = 'analysis-data';

// 处理请求的主函数
async function handleRequest(request) {
  // 设置CORS头，允许Pages域名访问
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
  
  // 处理预检请求
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
    });
  }
  
  // 获取请求 URL 和请求方法
  const url = new URL(request.url);
  const method = request.method;

  // 处理体重数据的请求
  if (url.pathname === '/api/weight-data') {
    if (method === 'GET') {
      const response = await getWeightData();
      // 添加CORS头
      const newHeaders = new Headers(response.headers);
      Object.keys(corsHeaders).forEach(key => {
        newHeaders.set(key, corsHeaders[key]);
      });
      return new Response(response.body, {
        status: response.status,
        headers: newHeaders
      });
    } else if (method === 'POST') {
      const response = await saveWeightData(request);
      // 添加CORS头
      const newHeaders = new Headers(response.headers);
      Object.keys(corsHeaders).forEach(key => {
        newHeaders.set(key, corsHeaders[key]);
      });
      return new Response(response.body, {
        status: response.status,
        headers: newHeaders
      });
    } else {
      return new Response('Method not allowed', { 
        status: 405,
        headers: corsHeaders
      });
    }
  }
  
  // 处理分析数据的请求
  if (url.pathname === '/api/analysis-data') {
    if (method === 'GET') {
      const response = await getAnalysisData();
      // 添加CORS头
      const newHeaders = new Headers(response.headers);
      Object.keys(corsHeaders).forEach(key => {
        newHeaders.set(key, corsHeaders[key]);
      });
      return new Response(response.body, {
        status: response.status,
        headers: newHeaders
      });
    } else if (method === 'POST') {
      const response = await saveAnalysisData(request);
      // 添加CORS头
      const newHeaders = new Headers(response.headers);
      Object.keys(corsHeaders).forEach(key => {
        newHeaders.set(key, corsHeaders[key]);
      });
      return new Response(response.body, {
        status: response.status,
        headers: newHeaders
      });
    } else {
      return new Response('Method not allowed', { 
        status: 405,
        headers: corsHeaders
      });
    }
  }
  
  // 其他路径返回404
  return new Response('Not Found', { 
    status: 404,
    headers: corsHeaders
  });
}

// 获取体重数据
async function getWeightData() {
  try {
    // 从 KV 存储中获取数据
    const data = await WEIGHT_TRACKER.get(WEIGHT_DATA_KEY);
    
    // 如果数据存在，解析并返回
    if (data) {
      return new Response(data, {
        headers: { 'Content-Type': 'application/json' },
        status: 200
      });
    } else {
      // 如果数据不存在，返回空数组
      return new Response('[]', {
        headers: { 'Content-Type': 'application/json' },
        status: 200
      });
    }
  } catch (error) {
    // 处理错误情况
    console.error('Error fetching data from KV:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch data' }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500
    });
  }
}

// 保存体重数据
async function saveWeightData(request) {
  try {
    // 解析请求体
    const data = await request.json();
    
    // 验证数据格式
    if (!Array.isArray(data)) {
      return new Response(JSON.stringify({ error: 'Invalid data format' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 400
      });
    }
    
    // 将数据存储到 KV
    await WEIGHT_TRACKER.put(WEIGHT_DATA_KEY, JSON.stringify(data));
    
    // 返回成功响应
    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200
    });
  } catch (error) {
    // 处理错误情况
    console.error('Error saving data to KV:', error);
    return new Response(JSON.stringify({ error: 'Failed to save data' }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500
    });
  }
}

// 获取分析数据
async function getAnalysisData() {
  try {
    // 从 KV 存储中获取数据
    const data = await WEIGHT_TRACKER.get(ANALYSIS_DATA_KEY);
    
    // 如果数据存在，解析并返回
    if (data) {
      return new Response(data, {
        headers: { 'Content-Type': 'application/json' },
        status: 200
      });
    } else {
      // 如果数据不存在，返回空对象
      return new Response('{}', {
        headers: { 'Content-Type': 'application/json' },
        status: 200
      });
    }
  } catch (error) {
    // 处理错误情况
    console.error('Error fetching analysis data from KV:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch analysis data' }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500
    });
  }
}

// 保存分析数据
async function saveAnalysisData(request) {
  try {
    // 解析请求体
    const data = await request.json();
    
    // 从KV中获取现有的分析数据
    let existingData = {};
    const storedData = await WEIGHT_TRACKER.get(ANALYSIS_DATA_KEY);
    if (storedData) {
      existingData = JSON.parse(storedData);
    }
    
    // 如果请求包含分析结果，则保存到特定日期
    if (data.date && (data.dietAnalysis || data.exerciseAnalysis || data.calorieAnalysis || data.suggestions)) {
      // 将新的分析数据添加到现有数据中
      existingData[data.date] = {
        dietAnalysis: data.dietAnalysis || '',
        exerciseAnalysis: data.exerciseAnalysis || '',
        calorieAnalysis: data.calorieAnalysis || '',
        suggestions: data.suggestions || ''
      };
    } 
    // 如果客户端直接发送整个analysis对象，则直接保存
    else {
      existingData = data;
    }
    
    // 将更新后的数据存储到 KV
    await WEIGHT_TRACKER.put(ANALYSIS_DATA_KEY, JSON.stringify(existingData));
    
    // 返回成功响应
    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200
    });
  } catch (error) {
    // 处理错误情况
    console.error('Error saving analysis data to KV:', error);
    return new Response(JSON.stringify({ error: 'Failed to save analysis data' }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500
    });
  }
}

// 设置事件监听器
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
}); 