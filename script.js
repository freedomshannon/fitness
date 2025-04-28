// Initialize variables for tracking data
let weightData = [];

// API URL - 替换为你的Cloudflare Worker URL
const API_URL = 'https://fitnessdatabase.guba396.workers.dev/api/weight-data';

document.addEventListener('DOMContentLoaded', function() {
    // Set today's date as default
    const today = new Date();
    const formattedDate = today.toISOString().split('T')[0];
    document.getElementById('date').value = formattedDate;
    
    // Load data from Cloudflare KV
    loadData();
    
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
    
    // Check if we already have data for this date
    const existingIndex = weightData.findIndex(item => item.date === date);
    
    if (existingIndex >= 0) {
        // Update existing data
        weightData[existingIndex] = { date, weight, exercise, diet };
    } else {
        // Add new data and sort by date
        weightData.push({ date, weight, exercise, diet });
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
        
        // Update UI
        updateChart();
        updateWeightChange();
        updateHistoryList();
        
        // 如果有饮食或运动记录，调用大模型分析
        if ((diet && diet.trim() !== '') || (exercise && exercise.trim() !== '')) {
            const analysisElement = document.getElementById('diet-exercise-analysis');
            if (analysisElement) {
                // 显示加载状态
                analysisElement.innerHTML = '<div class="loading-spinner"></div> <p>正在分析饮食和运动数据...</p>';
                
                // 调用大模型分析
                getModelAnalysis(weightData).then(() => {
                    // 分析完成后更新UI
                    updateDietExerciseAnalysis();
                }).catch(error => {
                    console.error('大模型分析失败:', error);
                    // 分析失败后仍然更新UI
                    updateDietExerciseAnalysis();
                });
            } else {
                updateDietExerciseAnalysis();
            }
        } else {
            updateDietExerciseAnalysis();
        }
        
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
            message += `比上次减少了 ${formattedDiff} kg! 🎉\n`;
        } else if (difference > 0) {
            message += `比上次增加了 ${formattedDiff} kg\n`;
        } else {
            message += `与上次持平\n`;
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

// 新增饮食运动分析函数
function updateDietExerciseAnalysis() {
    const analysisElement = document.getElementById('diet-exercise-analysis');
    
    if (!analysisElement || weightData.length === 0) {
        return; // 如果元素不存在或没有数据，直接返回
    }
    
    // 检查是否已有大模型分析结果
    const modelAnalysis = localStorage.getItem('model-diet-exercise-analysis');
    
    if (modelAnalysis) {
        // 如果有大模型分析结果，直接显示
        analysisElement.innerHTML = modelAnalysis;
        return;
    }
    
    // 创建分析内容
    let analysisContent = '';
    
    // 获取最近7天的记录
    const recentRecords = [...weightData].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 7);
    
    // 分析运动情况
    let exerciseCount = 0;
    let exercisePattern = '';
    
    recentRecords.forEach(record => {
        if (record.exercise && record.exercise.trim() !== '') {
            exerciseCount++;
        }
    });
    
    const exerciseRate = recentRecords.length > 0 ? (exerciseCount / recentRecords.length * 100).toFixed(0) : 0;
    
    if (exerciseRate >= 80) {
        exercisePattern = '运动习惯非常好！保持这种状态 💪';
    } else if (exerciseRate >= 50) {
        exercisePattern = '运动习惯良好，可以再提高一些频率';
    } else if (exerciseRate >= 30) {
        exercisePattern = '运动频率偏低，建议增加运动次数';
    } else {
        exercisePattern = '需要增加更多运动来促进健康';
    }
    
    // 分析饮食情况
    let dietCount = 0;
    let dietPattern = '';
    
    recentRecords.forEach(record => {
        if (record.diet && record.diet.trim() !== '') {
            dietCount++;
        }
    });
    
    const dietRate = recentRecords.length > 0 ? (dietCount / recentRecords.length * 100).toFixed(0) : 0;
    
    if (dietRate >= 80) {
        dietPattern = '饮食记录非常规律，有助于健康管理 🥗';
    } else if (dietRate >= 50) {
        dietPattern = '饮食记录习惯良好，继续保持';
    } else if (dietRate >= 30) {
        dietPattern = '饮食记录偏少，建议增加记录频率';
    } else {
        dietPattern = '需要更规律地记录饮食情况';
    }
    
    // 分析体重变化与饮食运动的关系
    let weightTrend = '暂无明显趋势';
    
    if (recentRecords.length >= 3) {
        const oldestWeight = recentRecords[recentRecords.length - 1].weight;
        const newestWeight = recentRecords[0].weight;
        const weightDiff = newestWeight - oldestWeight;
        
        if (weightDiff < -0.5) {
            weightTrend = `近期体重呈下降趋势，减少了${Math.abs(weightDiff).toFixed(1)}kg`;
            if (exerciseRate > 50) {
                weightTrend += '，可能与规律运动有关';
            }
            if (dietRate > 50) {
                weightTrend += '，健康的饮食习惯正在发挥作用';
            }
        } else if (weightDiff > 0.5) {
            weightTrend = `近期体重呈上升趋势，增加了${weightDiff.toFixed(1)}kg`;
            if (exerciseRate < 30) {
                weightTrend += '，可能与运动较少有关';
            }
            if (dietRate < 30) {
                weightTrend += '，建议更注意饮食控制';
            }
        } else {
            weightTrend = '近期体重保持稳定';
        }
    }
    
    // 组合分析内容
    analysisContent += `<h3>近期健康分析</h3>`;
    analysisContent += `<p><strong>运动情况：</strong>${exercisePattern} (${exerciseRate}%)</p>`;
    analysisContent += `<p><strong>饮食记录：</strong>${dietPattern} (${dietRate}%)</p>`;
    analysisContent += `<p><strong>体重趋势：</strong>${weightTrend}</p>`;
    
    // 添加建议
    analysisContent += `<h3>健康建议</h3>`;
    let suggestions = '<ul>';
    
    if (exerciseRate < 50) {
        suggestions += '<li>尝试增加运动频率，每天至少30分钟中等强度活动</li>';
    }
    
    if (dietRate < 50) {
        suggestions += '<li>规律记录饮食有助于发现饮食模式，建议每日记录</li>';
    }
    
    // 一些通用建议
    suggestions += '<li>保持足够的水分摄入，每天至少1.5-2升水</li>';
    suggestions += '<li>确保充足的睡眠，每晚7-8小时</li>';
    
    if (recentRecords.length < 3) {
        suggestions += '<li>持续记录数据，至少连续记录一周，以便获得更准确的分析</li>';
    }
    
    suggestions += '</ul>';
    analysisContent += suggestions;
    
    // 设置HTML内容
    analysisElement.innerHTML = analysisContent;
}

// 大模型分析饮食和运动数据
async function getModelAnalysis(weightData) {
    try {
        // 获取最近7天的记录
        const recentRecords = [...weightData].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 7);
        
        // 如果记录少于2条，不进行API调用
        if (recentRecords.length < 2) {
            console.log('记录不足，无法进行分析');
            return;
        }
        
        // 构建提示词
        const prompt = buildAnalysisPrompt(recentRecords);
        
        // 尝试直接使用Cloudflare Worker的API URL
        const MODEL_API_URL = API_URL.replace('/weight-data', '/model-analysis');
        console.log('调用分析API:', MODEL_API_URL);
        
        // 通过API发送请求
        const response = await fetch(MODEL_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                prompt: prompt
            })
        });
        
        // 如果服务器返回错误，使用默认分析
        if (!response.ok) {
            console.error('API请求失败，状态码:', response.status);
            return;
        }
        
        const data = await response.json();
        
        // 如果返回数据格式不正确，使用默认分析
        if (!data.analysis) {
            console.error('API返回数据格式不正确:', data);
            return;
        }
        
        // 获取AI分析
        let aiAnalysis = data.analysis;
        console.log('获取到AI分析结果');
        
        // 将AI分析格式化为HTML
        let formattedAnalysis = formatModelAnalysis(aiAnalysis);
        
        // 保存到localStorage
        localStorage.setItem('model-diet-exercise-analysis', formattedAnalysis);
        
    } catch (error) {
        console.error('API调用失败:', error);
    }
}

// 构建分析提示词
function buildAnalysisPrompt(records) {
    let prompt = "请分析以下健康记录数据，并提供饮食和运动方面的建议：\n\n";
    
    records.forEach(record => {
        prompt += `日期: ${formatDate(record.date)}\n`;
        prompt += `体重: ${record.weight} kg\n`;
        
        if (record.exercise && record.exercise.trim() !== '') {
            prompt += `运动记录: ${record.exercise}\n`;
        } else {
            prompt += "运动记录: 无\n";
        }
        
        if (record.diet && record.diet.trim() !== '') {
            prompt += `饮食记录: ${record.diet}\n`;
        } else {
            prompt += "饮食记录: 无\n";
        }
        
        prompt += "\n";
    });
    
    prompt += "请从以下几个方面分析：\n";
    prompt += "1. 饮食模式分析及改进建议\n";
    prompt += "2. 运动习惯分析及改进建议\n";
    prompt += "3. 体重变化趋势与饮食运动的关系\n";
    prompt += "4. 个性化的健康建议\n\n";
    prompt += "要求分析详细专业但通俗易懂，直接给出分析结果，不要输出思考过程。";
    
    return prompt;
}

// 格式化大模型分析结果为HTML
function formatModelAnalysis(analysis) {
    if (!analysis) return '';
    
    // 替换换行符为HTML段落
    let html = '<h3>智能健康分析</h3>';
    
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
    
    // 添加重新分析按钮，使用onclick定义全局函数调用
    html += `<div class="analysis-actions">
        <button class="small-btn" onclick="window.clearModelAnalysis()">重新分析</button>
    </div>`;
    
    return html;
}

// 清除模型分析结果（定义为全局函数）
window.clearModelAnalysis = function() {
    // 移除localStorage中的分析结果
    localStorage.removeItem('model-diet-exercise-analysis');
    
    // 获取分析元素
    const analysisElement = document.getElementById('diet-exercise-analysis');
    if (analysisElement) {
        // 显示加载状态
        analysisElement.innerHTML = '<div class="loading-spinner"></div> <p>正在重新分析数据...</p>';
        
        // 触发新的分析
        getModelAnalysis(weightData).then(() => {
            // 分析完成后更新UI
            updateDietExerciseAnalysis();
        }).catch(error => {
            console.error('重新分析失败:', error);
            // 分析失败后仍然更新UI
            updateDietExerciseAnalysis();
        });
    }
}; 