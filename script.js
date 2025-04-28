// Initialize variables for tracking data
let weightData = [];
let analysisData = {};

// API URLs from config
const API_URL = config.cloudflare.weightDataUrl;
const ANALYSIS_API_URL = config.cloudflare.analysisDataUrl;

document.addEventListener('DOMContentLoaded', function() {
    // Set today's date as default
    const today = new Date();
    const formattedDate = today.toISOString().split('T')[0];
    document.getElementById('date').value = formattedDate;
    
    // Load data from Cloudflare KV
    loadData();
    loadAnalysisData();
    
    // Setup form submission
    const form = document.getElementById('weight-form');
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        saveData();
    });
    
    // 检查URL参数是否需要测试分析功能
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('testAnalysis')) {
        console.log('检测到测试参数，将生成测试分析数据');
        setTimeout(() => {
            testAnalysisGeneration();
        }, 1000);
    }
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
    } catch (error) {
        console.error('Error loading data:', error);
        // Fallback to localStorage if API fails
        const savedData = localStorage.getItem('weightData');
        if (savedData) {
            weightData = JSON.parse(savedData);
            updateChart();
            updateWeightChange();
            updateHistoryList();
        }
    }
}

// Function to load analysis data from Cloudflare KV
async function loadAnalysisData() {
    try {
        const response = await fetch(ANALYSIS_API_URL);
        if (!response.ok) {
            throw new Error('Failed to fetch analysis data');
        }
        const data = await response.json();
        analysisData = data || {};
        updateAnalysisContent();
    } catch (error) {
        console.error('Error loading analysis data:', error);
        // Fallback to localStorage if API fails
        const savedData = localStorage.getItem('analysisData');
        if (savedData) {
            analysisData = JSON.parse(savedData);
            updateAnalysisContent();
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
        
        // 触发饮食和运动分析
        if (diet || exercise) {
            console.log('检测到饮食或运动记录，触发分析...');
            try {
                await generateAnalysis(date, diet, exercise, weight);
                console.log('分析已完成');
            } catch (analysisError) {
                console.error('生成分析时出错:', analysisError);
            }
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

// 调用大模型生成饮食和运动分析
async function generateAnalysis(date, diet, exercise, weight) {
    if (!diet && !exercise) return;
    
    try {
        console.log('开始生成分析数据...', date, weight);
        const previousData = getPreviousDataForAnalysis(date);
        
        // 构建发送给大模型的提示词
        const prompt = `作为一名专业的营养师和健身教练，请根据以下信息提供饮食和运动分析：
        
日期：${formatDate(date)}
体重：${weight} kg
饮食记录：${diet || '无记录'}
运动记录：${exercise || '无记录'}

${previousData.length > 0 ? `历史数据（近7天）：
${previousData.map(item => `日期：${formatDate(item.date)}，体重：${item.weight}kg，饮食：${item.diet || '无'}，运动：${item.exercise || '无'}`).join('\n')}` : '无历史数据'}

请提供以下分析（简明扼要）：
1. 饮食分析：评估饮食结构、营养均衡性
2. 运动分析：评估运动类型、强度和时长
3. 热量分析：估算摄入和消耗的热量平衡
4. 改进建议：针对饮食和运动提出1-2条具体建议

分析格式（JSON）：
{
    "dietAnalysis": "饮食分析内容...",
    "exerciseAnalysis": "运动分析内容...",
    "calorieAnalysis": "热量分析内容...",
    "suggestions": "改进建议内容..."
}`;

        // 调用OpenRouter API
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${config.openRouter.apiKey}`,
                "HTTP-Referer": encodeURI(window.location.origin),
                "X-Title": "Weight Tracker App"  // 使用英文标题避免编码问题
            },
            body: JSON.stringify({
                model: config.openRouter.model,
                messages: [
                    {
                        role: "user",
                        content: prompt
                    }
                ]
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            console.error('API响应错误:', errorData);
            throw new Error(`Failed to generate analysis: ${response.status} ${response.statusText}`);
        }
        
        const responseData = await response.json();
        console.log('API响应成功:', responseData);
        let analysisResult;
        
        try {
            // 尝试解析JSON响应
            const content = responseData.choices[0].message.content;
            console.log('大模型返回内容:', content);
            
            // 查找JSON内容（可能被包含在代码块内）
            const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || 
                             content.match(/```\s*([\s\S]*?)\s*```/) ||
                             content.match(/{[\s\S]*?}/);
                             
            if (jsonMatch) {
                analysisResult = JSON.parse(jsonMatch[1] || jsonMatch[0]);
            } else {
                // 如果无法解析为JSON，则创建一个简单的结果
                analysisResult = {
                    dietAnalysis: "无法生成饮食分析。",
                    exerciseAnalysis: "无法生成运动分析。",
                    calorieAnalysis: "无法生成热量分析。",
                    suggestions: "请稍后再试。"
                };
            }
        } catch (parseError) {
            console.error('Error parsing model response:', parseError);
            // 创建一个默认的分析结果
            analysisResult = {
                dietAnalysis: "饮食分析生成失败，请稍后再试。",
                exerciseAnalysis: "运动分析生成失败，请稍后再试。",
                calorieAnalysis: "热量分析生成失败，请稍后再试。",
                suggestions: "系统暂时无法提供有效建议，请稍后再试。"
            };
        }
        
        console.log('分析结果:', analysisResult);
        
        // 存储分析结果
        analysisData[date] = analysisResult;
        
        // 存储到本地作为备份
        localStorage.setItem('analysisData', JSON.stringify(analysisData));
        
        // 将分析结果保存到云端
        try {
            const saveResponse = await fetch(ANALYSIS_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    date: date,
                    ...analysisResult
                })
            });
            
            if (!saveResponse.ok) {
                console.error('保存分析到云端失败:', await saveResponse.json());
            } else {
                console.log('分析数据已保存到云端');
            }
        } catch (saveError) {
            console.error('保存分析数据出错:', saveError);
        }
        
        // 更新UI显示
        updateAnalysisContent();
        
    } catch (error) {
        console.error('Error generating analysis:', error);
    }
}

// 获取用于分析的历史数据
function getPreviousDataForAnalysis(currentDate) {
    // 获取最近7天的数据作为参考
    const currentDateObj = new Date(currentDate);
    const sevenDaysAgo = new Date(currentDateObj);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    return weightData.filter(item => {
        const itemDate = new Date(item.date);
        return itemDate >= sevenDaysAgo && item.date < currentDate;
    }).map(item => ({
        date: item.date,
        weight: item.weight,
        diet: item.diet,
        exercise: item.exercise
    }));
}

// 更新分析内容显示
function updateAnalysisContent() {
    const analysisContainer = document.getElementById('analysis-content');
    console.log('更新分析内容显示，当前数据:', analysisData);
    
    // 如果没有分析数据，显示提示
    if (!analysisData || Object.keys(analysisData).length === 0) {
        console.log('没有分析数据可显示');
        analysisContainer.innerHTML = '<p class="no-analysis">暂无分析数据</p>';
        return;
    }
    
    // 清空容器
    analysisContainer.innerHTML = '';
    
    // 获取最近的分析结果（按日期倒序）
    const sortedDates = Object.keys(analysisData).sort((a, b) => new Date(b) - new Date(a));
    console.log('排序后的分析日期:', sortedDates);
    
    if (sortedDates.length === 0) {
        console.log('排序后没有有效日期');
        analysisContainer.innerHTML = '<p class="no-analysis">暂无分析数据</p>';
        return;
    }
    
    const latestDate = sortedDates[0];
    const latestAnalysis = analysisData[latestDate];
    console.log('最新分析日期:', latestDate);
    console.log('最新分析内容:', latestAnalysis);
    
    // 创建分析内容
    const analysisItem = document.createElement('div');
    analysisItem.className = 'analysis-item';
    
    // 添加日期
    const dateElement = document.createElement('div');
    dateElement.className = 'analysis-date';
    dateElement.textContent = formatDate(latestDate);
    analysisItem.appendChild(dateElement);
    
    // 检查是否有有效的分析内容
    if (!latestAnalysis || 
        (!latestAnalysis.dietAnalysis && 
         !latestAnalysis.exerciseAnalysis && 
         !latestAnalysis.calorieAnalysis && 
         !latestAnalysis.suggestions)) {
        console.log('最新分析数据为空');
        const noDataMsg = document.createElement('p');
        noDataMsg.textContent = '此日期的分析数据不完整';
        noDataMsg.style.fontStyle = 'italic';
        noDataMsg.style.color = '#888';
        analysisItem.appendChild(noDataMsg);
        analysisContainer.appendChild(analysisItem);
        return;
    }
    
    // 添加饮食分析
    if (latestAnalysis.dietAnalysis) {
        const dietTitle = document.createElement('div');
        dietTitle.className = 'analysis-title';
        dietTitle.textContent = '饮食分析:';
        
        const dietContent = document.createElement('p');
        dietContent.textContent = latestAnalysis.dietAnalysis;
        
        analysisItem.appendChild(dietTitle);
        analysisItem.appendChild(dietContent);
    }
    
    // 添加运动分析
    if (latestAnalysis.exerciseAnalysis) {
        const exerciseTitle = document.createElement('div');
        exerciseTitle.className = 'analysis-title';
        exerciseTitle.textContent = '运动分析:';
        
        const exerciseContent = document.createElement('p');
        exerciseContent.textContent = latestAnalysis.exerciseAnalysis;
        
        analysisItem.appendChild(exerciseTitle);
        analysisItem.appendChild(exerciseContent);
    }
    
    // 添加热量分析
    if (latestAnalysis.calorieAnalysis) {
        const calorieTitle = document.createElement('div');
        calorieTitle.className = 'analysis-title';
        calorieTitle.textContent = '热量分析:';
        
        const calorieContent = document.createElement('p');
        calorieContent.textContent = latestAnalysis.calorieAnalysis;
        
        analysisItem.appendChild(calorieTitle);
        analysisItem.appendChild(calorieContent);
    }
    
    // 添加建议
    if (latestAnalysis.suggestions) {
        const suggestionsTitle = document.createElement('div');
        suggestionsTitle.className = 'analysis-title';
        suggestionsTitle.textContent = '建议:';
        
        const suggestionsContent = document.createElement('p');
        suggestionsContent.textContent = latestAnalysis.suggestions;
        
        analysisItem.appendChild(suggestionsTitle);
        analysisItem.appendChild(suggestionsContent);
    }
    
    // 添加到容器
    analysisContainer.appendChild(analysisItem);
    console.log('分析内容已更新到界面');
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
    const targetWeight = config.app.targetWeight;
    
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
    
    // 确保使用HTML元素显示每一行
    const lines = message.split('\n');
    weightChangeElement.innerHTML = '';
    
    lines.forEach(line => {
        if (line.trim()) {
            const paragraph = document.createElement('p');
            paragraph.textContent = line;
            
            // 根据内容设置不同的样式
            if (line.includes('减少')) {
                paragraph.style.color = 'green';
                paragraph.style.fontWeight = 'bold';
            } else if (line.includes('增加')) {
                paragraph.style.color = 'red';
            } else if (line.includes('恭喜')) {
                paragraph.style.color = 'green';
                paragraph.style.fontWeight = 'bold';
            }
            
            weightChangeElement.appendChild(paragraph);
        }
    });
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

// 测试分析生成功能的函数
async function testAnalysisGeneration() {
    try {
        const today = new Date();
        const date = today.toISOString().split('T')[0];
        const testDiet = "早餐：全麦面包两片，一杯牛奶，一个苹果；午餐：糙米饭一碗，清蒸鱼一条，西兰花200克；晚餐：鸡胸肉沙拉一份，南瓜汤一碗；加餐：酸奶一杯";
        const testExercise = "慢跑5公里，用时30分钟；俯卧撑3组，每组15个；仰卧起坐3组，每组20个；平板支撑2分钟3组";
        const testWeight = 78.5;
        
        console.log('生成测试分析数据...');
        document.getElementById('analysis-content').innerHTML = '<p class="no-analysis">正在生成测试分析数据，请稍候...</p>';
        
        await generateAnalysis(date, testDiet, testExercise, testWeight);
        console.log('测试分析数据已生成');
    } catch (error) {
        console.error('测试分析数据生成失败:', error);
    }
} 