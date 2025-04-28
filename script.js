document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('entry-form');
    const dateInput = document.getElementById('date');
    const weightInput = document.getElementById('weight');
    const exerciseInput = document.getElementById('exercise');
    const dietInput = document.getElementById('diet');
    const submitStatus = document.getElementById('submit-status');
    const weightChangeInfo = document.getElementById('weight-change-info');
    const historyLog = document.getElementById('history-log');
    const ctx = document.getElementById('weightChart').getContext('2d');

    let weightChart;
    let allData = []; // To store fetched data

    // --- Chart Initialization --- //
    function initializeChart() {
        if (weightChart) {
            weightChart.destroy(); // Destroy previous instance if exists
        }
        weightChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [], // Dates will go here
                datasets: [{
                    label: '体重 (kg)',
                    data: [], // Weights will go here
                    borderColor: '#0077cc', // Soft blue line
                    backgroundColor: 'rgba(0, 119, 204, 0.1)', // Light blue fill
                    borderWidth: 3,
                    tension: 0.1, // Slightly curved lines
                    pointBackgroundColor: '#ffcc00', // Vibrant yellow points
                    pointBorderColor: '#e6b800',
                    pointRadius: 5,
                    pointHoverRadius: 8
                }]
            },
            options: {
                scales: {
                    y: {
                        beginAtZero: false, // Don't force scale to start at 0
                        title: {
                            display: true,
                            text: '体重 (kg)',
                            font: {
                                family: 'Kalam',
                                size: 14
                            }
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: '日期',
                            font: {
                                family: 'Kalam',
                                size: 14
                            }
                        }
                    }
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                let label = context.dataset.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                if (context.parsed.y !== null) {
                                    label += context.parsed.y + ' kg';
                                }
                                return label;
                            }
                        }
                    }
                },
                 responsive: true,
                 maintainAspectRatio: true
            }
        });
    }

    // --- Set Default Date --- //
    function setDefaultDate() {
        const today = new Date();
        // Format as YYYY-MM-DD
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        dateInput.value = `${year}-${month}-${day}`;
    }

    // --- Display Status Message --- //
    function showStatus(message, isError = false) {
        submitStatus.textContent = message;
        submitStatus.className = `status-message ${isError ? 'error' : 'success'}`;
        // Clear message after a few seconds
        setTimeout(() => {
            submitStatus.textContent = '';
            submitStatus.className = 'status-message';
        }, 5000);
    }

    // --- Update UI (Chart, Analysis, History) --- //
    function updateUI(data) {
        // Sort data by date in ascending order
        data.sort((a, b) => new Date(a.date) - new Date(b.date));
        allData = data; // Store sorted data

        // 1. Update Chart
        const labels = data.map(entry => entry.date);
        const weights = data.map(entry => entry.weight);
        weightChart.data.labels = labels;
        weightChart.data.datasets[0].data = weights;
        weightChart.update();

        // 2. Calculate and Display Weight Change
        if (data.length === 0) {
            weightChangeInfo.textContent = '暂无数据，请开始记录！';
        } else if (data.length === 1) {
            weightChangeInfo.textContent = `初始体重记录: ${data[0].weight} kg`;
        } else {
            const latestWeight = parseFloat(data[data.length - 1].weight);
            const previousWeight = parseFloat(data[data.length - 2].weight);
            const change = (latestWeight - previousWeight).toFixed(1);

            if (change > 0) {
                weightChangeInfo.textContent = `今日 (${data[data.length - 1].date}) 体重比上次 (${data[data.length - 2].date}) 增加 ${change} 公斤`;
                weightChangeInfo.style.color = '#dc3545'; // Red for increase
            } else if (change < 0) {
                weightChangeInfo.textContent = `今日 (${data[data.length - 1].date}) 体重比上次 (${data[data.length - 2].date}) 减少 ${Math.abs(change)} 公斤`;
                weightChangeInfo.style.color = '#28a745'; // Green for decrease
            } else {
                weightChangeInfo.textContent = `今日 (${data[data.length - 1].date}) 体重与上次 (${data[data.length - 2].date}) 持平`;
                weightChangeInfo.style.color = '#0077cc'; // Blue for same
            }
        }

        // 3. Update History Log
        historyLog.innerHTML = ''; // Clear previous entries
        if (data.length === 0) {
            historyLog.innerHTML = '<p>暂无历史记录。</p>';
        } else {
            // Display in reverse chronological order (newest first)
            data.slice().reverse().forEach(entry => {
                const entryDiv = document.createElement('div');
                entryDiv.className = 'history-entry';
                entryDiv.innerHTML = `
                    <h3>${entry.date} - <strong>${entry.weight} kg</strong></h3>
                    ${entry.exercise ? `<p><strong>运动:</strong> ${entry.exercise}</p>` : ''}
                    ${entry.diet ? `<p><strong>饮食:</strong> ${entry.diet}</p>` : ''}
                `;
                historyLog.appendChild(entryDiv);
            });
        }
    }

    // --- Fetch Data from Backend --- //
    async function fetchData() {
        weightChangeInfo.textContent = '正在加载数据...';
        weightChangeInfo.style.color = '#0077cc'; // Default blue
        try {
            const response = await fetch('/api/data');
            if (!response.ok) {
                 // Try to get error message from backend, otherwise use default
                 let errorMsg = `HTTP error! status: ${response.status}`;
                 try {
                     const errorData = await response.json();
                     errorMsg = errorData.message || errorMsg;
                 } catch (jsonError) {
                     // Ignore if response is not JSON
                 }
                 throw new Error(errorMsg);
             }
            const data = await response.json();

            updateUI(data);
            if(data.length === 0) {
                 weightChangeInfo.textContent = '暂无数据，请开始记录！';
            }

        } catch (error) {
            console.error('Error fetching data:', error);
            weightChangeInfo.textContent = '加载数据失败';
             weightChangeInfo.style.color = '#dc3545'; // Red
            showStatus(`加载数据失败: ${error.message}`, true);
             updateUI([]); // Show empty state
        }
    }

    // --- Handle Form Submission --- //
    async function handleFormSubmit(event) {
        event.preventDefault(); // Prevent default page reload

        const entry = {
            date: dateInput.value,
            // Ensure weight is a string with one decimal place for consistency before sending
            weight: parseFloat(weightInput.value).toFixed(1),
            exercise: exerciseInput.value.trim(),
            diet: dietInput.value.trim()
        };

        // Re-validate weight as number for checking > 0
        const weightNum = parseFloat(entry.weight);
        if (!entry.date || isNaN(weightNum) || weightNum <= 0) {
            showStatus('请确保日期和体重填写正确 (体重需大于 0)。', true);
            return;
        }

        submitStatus.textContent = '正在保存...';
        submitStatus.className = 'status-message';

        try {
            const response = await fetch('/api/data', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(entry),
            });

            if (!response.ok) {
                 // Try to get error message from backend, otherwise use default
                 let errorMsg = `HTTP error! status: ${response.status}`;
                 try {
                     const errorData = await response.json();
                     errorMsg = errorData.message || errorMsg;
                 } catch (jsonError) {
                     // Ignore if response is not JSON
                 }
                 throw new Error(errorMsg);
             }

            // const result = await response.json(); // Contains { message: ..., entry: ... }
            // console.log('Save result:', result);

            showStatus('记录已保存！', false);

            // Fetch data again to update the chart and history
            await fetchData();

            // Clear fields after successful submission
            weightInput.value = '';
            exerciseInput.value = '';
            dietInput.value = '';
            // Set date back to today
            setDefaultDate();

        } catch (error) {
            console.error('Error saving data:', error);
            showStatus(`保存失败: ${error.message || '请检查网络连接或稍后重试'}`, true);
        }
    }

    // --- Initial Setup --- //
    setDefaultDate();
    initializeChart();
    fetchData(); // Load initial data when the page loads

    form.addEventListener('submit', handleFormSubmit);
}); 