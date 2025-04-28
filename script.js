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