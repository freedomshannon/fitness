// Initialize variables for tracking data
let weightData = [];
let healthAnalysisData = [];

// API URL - 替换为你的Cloudflare Worker URL
const API_URL = 'https://fitnessdatabase.guba396.workers.dev/api/weight-data';

document.addEventListener('DOMContentLoaded', function() {
    // Set today's date as default
    const today = new Date();
    const formattedDate = today.toISOString().split('T')[0];
    document.getElementById('date').value = formattedDate;
    
    // Load data from Cloudflare KV
    loadData();
    
    // Load health analysis data
    loadHealthAnalysisData();
    
    // Setup form submission
    const form = document.getElementById('weight-form');
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        saveData();
    });
    
    // Add styles
    const style = document.createElement('style');
    style.textContent = `
        .small-btn {
            background-color: var(--accent-color);
            color: white;
            border: none;
            padding: 6px 12px;
            font-size: 0.9rem;
            border-radius: 4px;
            cursor: pointer;
            font-family: 'Comic Neue', cursive;
            transition: all 0.2s;
            margin-top: 15px;
        }
        
        .small-btn:hover {
            background-color: #ff9100;
            transform: translateY(-2px);
        }
        
        .analysis-actions {
            text-align: right;
            margin-top: 10px;
        }
        
        .loading-spinner {
            width: 30px;
            height: 30px;
            margin: 20px auto;
            border: 3px solid rgba(91, 143, 185, 0.2);
            border-radius: 50%;
            border-top-color: var(--primary-color);
            animation: spin 1s ease-in-out infinite;
            display: inline-block;
        }
        
        @keyframes spin {
            to { transform: rotate(360deg); }
        }
        
        .health-analysis-list {
            max-height: 400px;
            overflow-y: auto;
            border: 1px solid #e0e0e0;
            border-radius: 8px;
            padding: 15px;
            margin-top: 20px;
        }
        
        .health-analysis-item {
            background-color: #f9f9f9;
            border-radius: 8px;
            padding: 15px;
            margin-bottom: 15px;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
        }
        
        .health-analysis-date {
            font-weight: bold;
            color: var(--primary-color);
            margin-bottom: 10px;
        }
        
        .health-analysis-content {
            line-height: 1.5;
        }
    `;
    document.head.appendChild(style);
});

// Function to load data from Cloudflare KV
async function loadData() {
    try {
        const response = await fetch(API_URL);
        if (!response.ok) {
            throw new Error('Failed to fetch data');
        }
        const data = await response.json();
        weightData = data || [];
        updateChart();
        updateWeightChange();
        updateHistoryList();
        updateDietExerciseAnalysis();
    } catch (error) {
        console.error('Error loading data:', error);
        // Fallback to localStorage if API fails
        const savedData = localStorage.getItem('weightData');
        if (savedData) {
            weightData = JSON.parse(savedData);
            updateChart();
            updateWeightChange();
            updateHistoryList();
            updateDietExerciseAnalysis();
        }
    }
}

// Function to load health analysis data from Cloudflare KV
async function loadHealthAnalysisData() {
    try {
        const response = await fetch(`${API_URL}/health-analysis`);
        if (!response.ok) {
            throw new Error('Failed to fetch health analysis data');
        }
        const data = await response.json();
        healthAnalysisData = data || [];
        
        // 保存到本地存储作为备份
        localStorage.setItem('healthAnalysisData', JSON.stringify(healthAnalysisData));
        
        // 更新UI
        updateHealthAnalysisList();
        updateDietExerciseAnalysis();
        
    } catch (error) {
        console.error('Error loading health analysis data:', error);
        // 从本地存储加载备份数据
        const savedData = localStorage.getItem('healthAnalysisData');
        if (savedData) {
            healthAnalysisData = JSON.parse(savedData);
            updateHealthAnalysisList();
            updateDietExerciseAnalysis();
        }
    }
}

// Function to save data to Cloudflare KV
async function saveData() {
    const date = document.getElementById('date').value;
    const weight = parseFloat(document.getElementById('weight').value);
    const exercise = document.getElementById('exercise').value;
    const diet = document.getElementById('diet').value;
    
    // Basic validation
    if (!date || !weight) {
        alert('请输入日期和体重!');
        return;
    }
    
    // 创建当前记录对象
    const currentRecord = { date, weight, exercise, diet };
    
    // Check if we already have data for this date
    const existingIndex = weightData.findIndex(item => item.date === date);
    
    if (existingIndex >= 0) {
        // Update existing data
        weightData[existingIndex] = currentRecord;
    } else {
        // Add new data and sort by date
        weightData.push(currentRecord);
        weightData.sort((a, b) => new Date(a.date) - new Date(b.date));
    }
    
    try {
        // Save to Cloudflare KV
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(weightData)
        });
        
        if (!response.ok) {
            throw new Error('Failed to save data');
        }
        
        // Fallback: also save to localStorage as backup
        localStorage.setItem('weightData', JSON.stringify(weightData));
        
        console.log('数据保存成功，准备更新UI');
        
        // Update UI
        updateChart();
        updateWeightChange();
        updateHistoryList();
        
        // 检查饮食运动分析元素是否存在
        const analysisElement = document.getElementById('diet-exercise-analysis');
        console.log('分析元素存在:', !!analysisElement);
        
        if (!analysisElement) {
            console.error('找不到饮食运动分析元素，请检查HTML中是否有id为diet-exercise-analysis的div');
            return;
        }
        
        // 只分析刚刚保存的数据
        console.log('开始分析刚保存的数据:', currentRecord);
        // 显示加载状态
        analysisElement.innerHTML = '<div class="loading-spinner"></div> <p>正在分析今日饮食和运动数据...</p>';
        
        // 调用大模型API，只传入当前记录
        callModelAPI([currentRecord]).then(analysisResult => {
            if (analysisResult) {
                // 分析完成后更新UI
                analysisElement.innerHTML = analysisResult.html;
                
                // 将AI分析结果保存到KV
                saveAnalysisToKV(date, analysisResult.analysis);
            } else {
                console.error('大模型分析失败');
                // 分析失败后显示错误信息
                let errorContent = '<h3>AI健康分析</h3>';
                errorContent += '<p>抱歉，AI分析请求失败，请稍后再保存数据重试</p>';
                analysisElement.innerHTML = errorContent;
            }
        }).catch(error => {
            console.error('大模型分析失败:', error);
            // 分析失败后显示错误信息
            let errorContent = '<h3>AI健康分析</h3>';
            errorContent += '<p>抱歉，AI分析请求失败，请稍后再保存数据重试</p>';
            analysisElement.innerHTML = errorContent;
        });
        
        // Show success message with wobble animation
        const btn = document.querySelector('.btn');
        btn.textContent = '保存成功!';
        btn.style.backgroundColor = '#4CAF50';
        
        // Reset form fields except date
        document.getElementById('weight').value = '';
        document.getElementById('exercise').value = '';
        document.getElementById('diet').value = '';
        
        // Reset button text after 2 seconds
        setTimeout(() => {
            btn.textContent = '保存数据';
            btn.style.backgroundColor = '';
        }, 2000);
        
    } catch (error) {
        console.error('Error saving data:', error);
        alert('保存失败，请稍后再试');
    }
}

// Function to update the chart
function updateChart() {
    const ctx = document.getElementById('weightChart').getContext('2d');
    
    // Extract dates and weights for chart
    const labels = weightData.map(item => formatDate(item.date));
    const data = weightData.map(item => item.weight);
    
    // Check if chart already exists and destroy it
    if (window.weightChart instanceof Chart) {
        window.weightChart.destroy();
    }
    
    // Create new chart
    window.weightChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: '体重 (kg)',
                data: data,
                borderColor: '#5b8fb9',
                backgroundColor: 'rgba(91, 143, 185, 0.2)',
                borderWidth: 3,
                pointBackgroundColor: '#ffa41b',
                pointBorderColor: '#fff',
                pointRadius: 6,
                pointHoverRadius: 8,
                tension: 0.2,
                fill: true
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        font: {
                            family: "'Comic Neue', cursive",
                            size: 14
                        }
                    }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        label: function(context) {
                            return `体重: ${context.parsed.y} kg`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    ticks: {
                        font: {
                            family: "'Comic Neue', cursive"
                        }
                    },
                    grid: {
                        display: true,
                        drawBorder: true,
                        drawOnChartArea: true,
                        drawTicks: true,
                        color: '#e0e0e0',
                        borderDash: [5, 5]
                    }
                },
                y: {
                    beginAtZero: false,
                    ticks: {
                        font: {
                            family: "'Comic Neue', cursive"
                        }
                    },
                    grid: {
                        display: true,
                        drawBorder: true,
                        drawOnChartArea: true,
                        drawTicks: true,
                        color: '#e0e0e0',
                        borderDash: [5, 5]
                    }
                }
            }
        }
    });
}

// Function to update weight change information
function updateWeightChange() {
    const weightChangeElement = document.getElementById('weight-change');
    
    if (weightData.length === 0) {
        weightChangeElement.textContent = '还没有记录数据';
        return;
    }
    
    // 获取最新记录的体重数据
    const lastRecord = weightData[weightData.length - 1];
    const currentWeight = lastRecord.weight;
    
    // 定义目标体重
    const targetWeight = 75;
    
    // 创建信息内容
    let message = '';
    
    // 第一行：显示当前体重
    message += `当前体重: ${currentWeight} kg\n`;
    
    // 第二行：比较与上次记录的差异
    if (weightData.length > 1) {
        const prevRecord = weightData[weightData.length - 2];
        const difference = currentWeight - prevRecord.weight;
        const formattedDiff = Math.abs(difference).toFixed(1);
        
        if (difference < 0) {
            message += `比昨天相比减少了 ${formattedDiff} kg! 🎉\n`;
        } else if (difference > 0) {
            message += `比昨天相比增加了 ${formattedDiff} kg\n`;
        } else {
            message += `与昨天相比持平\n`;
        }
    } else {
        message += `初始体重记录\n`;
    }
    
    // 第三行：距离目标还有多少
    if (currentWeight > targetWeight) {
        const toGoKg = (currentWeight - targetWeight).toFixed(1);
        message += `距离目标体重(${targetWeight}kg)还有 ${toGoKg} kg`;
    } else if (currentWeight < targetWeight) {
        const belowTarget = (targetWeight - currentWeight).toFixed(1);
        message += `已低于目标体重(${targetWeight}kg) ${belowTarget} kg`;
    } else {
        message += `恭喜！已达到目标体重(${targetWeight}kg) 🎊`;
    }
    
    // 设置显示样式
    weightChangeElement.style.whiteSpace = 'pre-line'; // 保留换行符
    weightChangeElement.textContent = message;
    
    // 设置文字颜色
    if (weightData.length > 1) {
        const difference = currentWeight - weightData[weightData.length - 2].weight;
        if (difference < 0) {
            weightChangeElement.style.color = 'green';
        } else if (difference > 0) {
            weightChangeElement.style.color = 'red';
        } else {
            weightChangeElement.style.color = '#333';
        }
    } else {
        weightChangeElement.style.color = '#333';
    }
}

// Function to update history list
function updateHistoryList() {
    const historyList = document.getElementById('history-list');
    historyList.innerHTML = '';
    
    // Create history items in reverse order (newest first)
    const reversedData = [...weightData].reverse();
    
    reversedData.forEach(item => {
        const historyItem = document.createElement('div');
        historyItem.className = 'history-item';
        
        const dateElement = document.createElement('div');
        dateElement.className = 'date';
        dateElement.textContent = formatDate(item.date);
        
        const weightElement = document.createElement('div');
        weightElement.className = 'weight';
        weightElement.textContent = `体重: ${item.weight} kg`;
        
        historyItem.appendChild(dateElement);
        historyItem.appendChild(weightElement);
        
        if (item.exercise) {
            const exerciseTitle = document.createElement('h4');
            exerciseTitle.textContent = '运动记录:';
            
            const exerciseContent = document.createElement('p');
            exerciseContent.textContent = item.exercise;
            
            historyItem.appendChild(exerciseTitle);
            historyItem.appendChild(exerciseContent);
        }
        
        if (item.diet) {
            const dietTitle = document.createElement('h4');
            dietTitle.textContent = '饮食记录:';
            
            const dietContent = document.createElement('p');
            dietContent.textContent = item.diet;
            
            historyItem.appendChild(dietTitle);
            historyItem.appendChild(dietContent);
        }
        
        historyList.appendChild(historyItem);
    });
    
    // If no data, show message
    if (weightData.length === 0) {
        const noDataMessage = document.createElement('p');
        noDataMessage.textContent = '暂无记录数据';
        noDataMessage.style.textAlign = 'center';
        noDataMessage.style.padding = '20px';
        historyList.appendChild(noDataMessage);
    }
}

// Helper function to format date as YYYY-MM-DD
function formatDate(dateString) {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}年${month}月${day}日`;
}

// 更新饮食和运动分析
function updateDietExerciseAnalysis() {
    const analysisElement = document.getElementById('diet-exercise-analysis');
    if (!analysisElement) return;
    
    // 检查是否有健康分析数据
    if (healthAnalysisData && healthAnalysisData.length > 0) {
        // 获取最新的分析结果（按日期排序后的最后一项）
        const latestAnalysis = [...healthAnalysisData].sort((a, b) => 
            new Date(b.date) - new Date(a.date)
        )[0];
        
        if (latestAnalysis) {
            // 格式化并显示最新的分析结果
            let html = formatModelAnalysis(latestAnalysis.analysis);
            analysisElement.innerHTML = html;
            
            // 添加查看历史分析按钮
            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'analysis-actions';
            
            const historyBtn = document.createElement('button');
            historyBtn.className = 'small-btn';
            historyBtn.textContent = '查看历史分析';
            historyBtn.onclick = toggleHealthAnalysisHistory;
            
            actionsDiv.appendChild(historyBtn);
            analysisElement.appendChild(actionsDiv);
            return;
        }
    }
    
    // 从localStorage获取大模型分析结果（兼容旧版本）
    const modelAnalysis = localStorage.getItem('model-diet-exercise-analysis');
    
    if (modelAnalysis) {
        // 如果有大模型分析结果，直接显示
        analysisElement.innerHTML = modelAnalysis;
        
        // 添加查看历史分析按钮
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'analysis-actions';
        
        const historyBtn = document.createElement('button');
        historyBtn.className = 'small-btn';
        historyBtn.textContent = '查看历史分析';
        historyBtn.onclick = toggleHealthAnalysisHistory;
        
        actionsDiv.appendChild(historyBtn);
        analysisElement.appendChild(actionsDiv);
    } else {
        // 如果没有大模型分析结果，显示等待提示
        let content = '<h3>AI健康分析</h3>';
        content += '<p>请先记录体重、饮食或运动数据，保存后系统将自动分析</p>';
        analysisElement.innerHTML = content;
    }
}

// 更新健康分析历史列表
function updateHealthAnalysisList() {
    // 检查是否已经有健康分析历史列表元素
    let healthAnalysisList = document.getElementById('health-analysis-list');
    
    // 如果没有，则创建一个
    if (!healthAnalysisList) {
        // 获取数据可视化section
        const dataVisualizationSection = document.querySelector('.data-visualization');
        if (!dataVisualizationSection) return;
        
        // 创建健康分析历史列表容器
        healthAnalysisList = document.createElement('div');
        healthAnalysisList.id = 'health-analysis-list';
        healthAnalysisList.className = 'health-analysis-list';
        healthAnalysisList.style.display = 'none'; // 默认隐藏
        
        // 添加到数据可视化section之后
        dataVisualizationSection.appendChild(healthAnalysisList);
    }
    
    // 清空列表
    healthAnalysisList.innerHTML = '';
    
    // 确保有健康分析数据
    if (!healthAnalysisData || healthAnalysisData.length === 0) {
        const noDataMessage = document.createElement('p');
        noDataMessage.textContent = '暂无健康分析记录';
        noDataMessage.style.textAlign = 'center';
        noDataMessage.style.padding = '20px';
        healthAnalysisList.appendChild(noDataMessage);
        return;
    }
    
    // 按日期逆序排序（最新的在前面）
    const sortedAnalysisData = [...healthAnalysisData].sort((a, b) => 
        new Date(b.date) - new Date(a.date)
    );
    
    // 创建健康分析项
    sortedAnalysisData.forEach(item => {
        const analysisItem = document.createElement('div');
        analysisItem.className = 'health-analysis-item';
        
        const dateElement = document.createElement('div');
        dateElement.className = 'health-analysis-date';
        dateElement.textContent = formatDate(item.date);
        
        const contentElement = document.createElement('div');
        contentElement.className = 'health-analysis-content';
        contentElement.textContent = item.analysis;
        
        analysisItem.appendChild(dateElement);
        analysisItem.appendChild(contentElement);
        healthAnalysisList.appendChild(analysisItem);
    });
}

// 切换健康分析历史列表的显示/隐藏
function toggleHealthAnalysisHistory() {
    const healthAnalysisList = document.getElementById('health-analysis-list');
    if (!healthAnalysisList) return;
    
    const isCurrentlyHidden = healthAnalysisList.style.display === 'none';
    
    if (isCurrentlyHidden) {
        healthAnalysisList.style.display = 'block';
        this.textContent = '隐藏历史分析';
    } else {
        healthAnalysisList.style.display = 'none';
        this.textContent = '查看历史分析';
    }
}

// 使用大模型分析数据
async function callModelAPI(weightData) {
    try {
        // 确保有记录数据
        if (!weightData || weightData.length === 0) {
            console.log('没有记录数据，无法进行大模型分析');
            return null;
        }
        
        // 获取要分析的记录（传入的应该只有一条）
        const recordToAnalyze = weightData[0];
        
        console.log('准备分析数据:', recordToAnalyze);
        
        // 生成提示词
        let prompt = "请分析以下健康记录数据：\n\n";
        
        // 添加记录信息
        prompt += `日期: ${formatDate(recordToAnalyze.date)}\n`;
        prompt += `体重: ${recordToAnalyze.weight} kg\n`;
        
        if (recordToAnalyze.exercise && recordToAnalyze.exercise.trim() !== '') {
            prompt += `运动记录: ${recordToAnalyze.exercise}\n`;
        } else {
            prompt += "运动记录: 无\n";
        }
        
        if (recordToAnalyze.diet && recordToAnalyze.diet.trim() !== '') {
            prompt += `饮食记录: ${recordToAnalyze.diet}\n`;
        } else {
            prompt += "饮食记录: 无\n";
        }
        
        prompt += "\n计算出食物摄入和运动消耗的热量，最后输出格式务必为今日摄入食物热量是，运动消耗，热量差为。";

        // 显示加载状态
        const analysisElement = document.getElementById('diet-exercise-analysis');
        if (analysisElement) {
            analysisElement.innerHTML = '<div class="loading-spinner"></div> <p>正在分析今日饮食和运动数据...</p>';
        }

        try {
            const response = await fetch('https://mingdata.shannonwang.top/api/proxy', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: "deepseek-v3-241226",
                    messages: [
                        {
                            role: "system",
                            content: "你是一位专业的健康顾问和营养师。请针对用户今日的健康记录，计算出食物摄入和运动消耗的热量，最后输出格式务必为今日摄入食物热量是，运动消耗，热量差为。务必纯文字输出"
                        },
                        {
                            role: "user",
                            content: prompt
                        }
                    ]
                })
            });

            // 如果服务器返回错误，处理错误情况
            if (!response.ok) {
                console.error('API请求失败，状态码:', response.status);
                throw new Error('API请求失败');
            }

            const data = await response.json();
            console.log('API响应:', data);
            
            // 从响应中获取大模型生成的分析结果 - 兼容多种返回格式
            const analysis = data.choices?.[0]?.message?.content || data.analysis || data.content || data.result || '';
            
            if (!analysis) {
                console.error('API返回的分析结果为空');
                throw new Error('分析结果为空');
            }
            
            // 将大模型分析结果格式化为HTML
            let analysisHTML = formatModelAnalysis(analysis);
            
            // 保存到localStorage
            localStorage.setItem('model-diet-exercise-analysis', analysisHTML);
            
            // 返回分析结果和格式化后的HTML
            return { html: analysisHTML, analysis: analysis, date: recordToAnalyze.date };
            
        } catch (error) {
            console.error('大模型API调用失败:', error);
            
            // 返回null，让调用者处理错误情况
            return null;
        }
        
    } catch (error) {
        console.error('调用大模型API失败:', error);
        return null; // 失败时返回null而不是抛出异常
    }
}

// 格式化大模型分析结果为HTML
function formatModelAnalysis(analysis) {
    if (!analysis) return '';
    
    // 替换换行符为HTML段落
    let html = '<h3>AI健康分析</h3>';
    
    // 分割文本为段落
    const paragraphs = analysis.split(/\n\s*\n/);
    
    // 处理每个段落
    paragraphs.forEach(paragraph => {
        // 检查是否是标题（以数字和点开头）
        if (/^\d+\.\s+.+/.test(paragraph)) {
            // 是标题，创建h4
            html += `<h4>${paragraph}</h4>`;
        } 
        // 检查是否是列表项（以-或*开头）
        else if (paragraph.trim().split('\n').every(line => /^[\-\*]\s+.+/.test(line.trim()))) {
            // 是列表，创建ul
            html += '<ul>';
            paragraph.trim().split('\n').forEach(line => {
                const content = line.trim().replace(/^[\-\*]\s+/, '');
                html += `<li>${content}</li>`;
            });
            html += '</ul>';
        } 
        // 普通段落
        else {
            html += `<p>${paragraph}</p>`;
        }
    });
    
    // 记录分析日期时间
    const now = new Date();
    const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    html += `<p class="analysis-date">分析时间: ${formattedDate}</p>`;
    
    return html;
}

// 重新分析函数（全局可调用）
window.reanalyzeWithModel = function() {
    console.log('开始重新分析');
    
    // 获取分析元素
    const analysisElement = document.getElementById('diet-exercise-analysis');
    if (!analysisElement) {
        console.error('找不到分析元素');
        return;
    }
    
    // 清除旧的分析结果
    localStorage.removeItem('model-diet-exercise-analysis');
    
    // 显示加载状态
    analysisElement.innerHTML = '<div class="loading-spinner"></div> <p>正在调用AI分析...</p>';
    
    // 获取当前日期
    const date = document.getElementById('date').value;
    
    // 调用大模型API
    callModelAPI(weightData).then(analysisResult => {
        if (analysisResult) {
            // 分析成功，直接更新UI
            analysisElement.innerHTML = analysisResult.html;
            
            // 添加查看历史分析按钮
            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'analysis-actions';
            
            const historyBtn = document.createElement('button');
            historyBtn.className = 'small-btn';
            historyBtn.textContent = '查看历史分析';
            historyBtn.onclick = toggleHealthAnalysisHistory;
            
            actionsDiv.appendChild(historyBtn);
            analysisElement.appendChild(actionsDiv);
            
            // 将分析结果保存到KV
            saveAnalysisToKV(analysisResult.date, analysisResult.analysis);
        } else {
            // 分析失败，显示错误信息和重试按钮
            let errorContent = '<h3>AI健康分析</h3>';
            errorContent += '<p>抱歉，AI分析请求失败，请稍后再试</p>';
            analysisElement.innerHTML = errorContent;
        }
    });
};

// 展示体重记录数据分析
function displayRecordAnalysis() {
    const analysisElement = document.getElementById('record-analysis');
    if (!analysisElement) return;
    
    // 从localStorage获取大模型分析结果
    const modelAnalysis = localStorage.getItem('model-analysis');
    
    if (modelAnalysis) {
        // 如果有大模型分析结果，直接显示
        analysisElement.innerHTML = modelAnalysis;
    } else {
        // 如果没有大模型分析结果，只显示引导用户进行分析的内容
        let content = '<h3>AI健康分析</h3>';
        content += '<p>点击下方按钮，使用AI分析您的健康数据，获取个性化建议</p>';
        content += `<div class="analysis-actions">
            <button class="small-btn" onclick="window.reanalyzeWithModel()">开始分析</button>
        </div>`;
        analysisElement.innerHTML = content;
    }
}

// 将AI分析结果保存到KV
async function saveAnalysisToKV(date, analysis) {
    try {
        // 首先从KV获取现有的分析结果
        const analysisResponse = await fetch(`${API_URL}/health-analysis`);
        let healthAnalysisData = [];
        
        if (analysisResponse.ok) {
            healthAnalysisData = await analysisResponse.json() || [];
        }
        
        // 检查是否已有该日期的分析结果
        const existingIndex = healthAnalysisData.findIndex(item => item.date === date);
        
        // 创建新的分析结果对象
        const analysisRecord = {
            date: date,
            analysis: analysis,
            timestamp: new Date().toISOString()
        };
        
        if (existingIndex >= 0) {
            // 更新现有的分析结果
            healthAnalysisData[existingIndex] = analysisRecord;
        } else {
            // 添加新的分析结果
            healthAnalysisData.push(analysisRecord);
        }
        
        // 按日期排序
        healthAnalysisData.sort((a, b) => new Date(a.date) - new Date(b.date));
        
        // 保存到KV
        const saveResponse = await fetch(`${API_URL}/health-analysis`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(healthAnalysisData)
        });
        
        if (!saveResponse.ok) {
            throw new Error('Failed to save health analysis data');
        }
        
        console.log('分析结果保存成功');
        
        // 保存成功后，更新本地缓存
        localStorage.setItem('healthAnalysisData', JSON.stringify(healthAnalysisData));
        
    } catch (error) {
        console.error('Error saving analysis:', error);
        // 不弹出警告，避免打扰用户
        console.log('分析结果保存失败，将只保存在本地');
    }
} 