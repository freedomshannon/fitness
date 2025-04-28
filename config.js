// 配置文件 - 用于存储API密钥和其他配置
const config = {
    // API配置
    api: {
        // Worker代理URL
        workerProxyUrl: 'https://mingwebdatabase.guba396.workers.dev/',
        // 模型配置
        model: "deepseek-v3-241226",
        temperature: 0.7,
        maxTokens: 800
    },
    
    // Cloudflare Workers API配置
    cloudflare: {
        weightDataUrl: 'https://fitnessdatabase.guba396.workers.dev/api/weight-data',
        analysisDataUrl: 'https://fitnessdatabase.guba396.workers.dev/api/analysis-data'
    },
    
    // 其他应用配置
    app: {
        targetWeight: 75, // 目标体重 (kg)
    }
}; 