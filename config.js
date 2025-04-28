// 配置文件 - 用于存储API密钥和其他配置
const config = {
    // OpenRouter API配置
    openRouter: {
        apiKey: "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", // 替换为实际的OpenRouter API密钥
        model: "deepseek/deepseek-chat-v3-0324:free",
        siteTitle: "王德廷的减肥追踪"
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