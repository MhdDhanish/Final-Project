// Initialize global variables
let timelineChart, zscoreChart, barChart;
const rawData = window.dashboardData;

// Wait for DOM
document.addEventListener('DOMContentLoaded', () => {
    initializeDashboard();
    setupEventListeners();
});

// -------------------------------
//  DASHBOARD INIT
// -------------------------------
function initializeDashboard() {
    if (!rawData) {
        console.error("Dashboard data not found. Make sure data.js is loaded.");
        return;
    }
    
    // We will render everything based on current filters
    updateDashboard();
}

function updateDashboard() {
    const filters = getFilters();
    
    // Apply filters
    const filteredAlerts = filterAlerts(rawData.alerts, filters);
    const filteredTraffic = filterTraffic(rawData.traffic, filters);

    // Render KPIs
    renderKPIs(filteredAlerts, filteredTraffic);

    // Render Charts
    renderTimelineChart(filteredTraffic, filteredAlerts);
    renderZScoreChart(filteredAlerts);
    renderBarChart(filteredTraffic);
    
    // Render Table
    renderTable(filteredAlerts);
}

// -------------------------------
//  FILTER LOGIC
// -------------------------------
function getFilters() {
    const dateInput = document.getElementById('dateRange').value;
    
    // Get checked severities
    const activeSeverities = Array.from(
        document.querySelectorAll('.severity-label input:checked')
    ).map(input => input.value);
    
    const searchInput = document.getElementById('tableSearch').value.toLowerCase();
    
    return { date: dateInput, severities: activeSeverities, search: searchInput };
}

function filterTraffic(traffic, filters) {
    if (filters.date === 'all') return traffic;
    return traffic.filter(row => row.Time && row.Time.includes(filters.date));
}

function filterAlerts(alerts, filters) {
    return alerts.filter(row => {
        // Date match
        let dateMatch = filters.date === 'all' || (row.Time && row.Time.includes(filters.date));
        
        // Severity match
        let sevMatch = filters.severities.includes(row.severity || 'Low');
        
        // Search text match (timestamp or exact zscore)
        let searchMatch = true;
        if (filters.search) {
            searchMatch = (row.Time && row.Time.toLowerCase().includes(filters.search));
        }

        return dateMatch && sevMatch && searchMatch;
    });
}

function setupEventListeners() {
    document.getElementById('dateRange').addEventListener('change', updateDashboard);
    document.getElementById('tableSearch').addEventListener('input', updateDashboard);
    
    document.querySelectorAll('.severity-label input').forEach(el => {
        el.addEventListener('change', updateDashboard);
    });
}

// -------------------------------
//  KPI RENDER
// -------------------------------
function renderKPIs(alerts, traffic) {
    document.getElementById('kpi-total-logs').innerText = traffic.length.toLocaleString();
    document.getElementById('kpi-total-alerts').innerText = alerts.length.toLocaleString();
    
    const rate = traffic.length > 0 ? ((alerts.length / traffic.length) * 100).toFixed(2) : 0;
    document.getElementById('kpi-alert-rate').innerText = rate + '%';
    
    // Max Score
    let maxR = 0;
    alerts.forEach(a => {
        if(a.Risk_Score > maxR) maxR = a.Risk_Score;
    });
    document.getElementById('kpi-max-risk').innerText = maxR.toFixed(2);
}

// -------------------------------
//  CHARTJS: THEME CONFIG
// -------------------------------
Chart.defaults.color = '#94a3b8';
Chart.defaults.font.family = "'Inter', sans-serif";

const CHART_COLORS = {
    trafficLine: 'rgba(59, 130, 246, 0.8)',
    baselineLine: 'rgba(148, 163, 184, 0.5)',
    thresholdLine: 'rgba(249, 115, 22, 0.8)',
    alertPoints: 'rgba(239, 68, 68, 1)',
    low: 'rgba(59, 130, 246, 0.8)',
    medium: 'rgba(234, 179, 8, 0.8)',
    high: 'rgba(249, 115, 22, 0.8)',
    critical: 'rgba(239, 68, 68, 0.8)'
};

// -------------------------------
//  CHART 1: TIMELINE
// -------------------------------
function renderTimelineChart(traffic, alerts) {
    const ctx = document.getElementById('timelineChart').getContext('2d');
    
    if (timelineChart) timelineChart.destroy();
    
    // Downsample traffic data if it's too huge (> 1000 points) to keep UI fast
    let tData = traffic;
    if(tData.length > 3000) {
        tData = traffic.filter((_, i) => i % 5 === 0); // take every 5th point
    }

    const tLabels = tData.map(d => new Date(d.Time).getTime());
    const dBytes = tData.map(d => d.Bytes_Sent);
    const dBase = tData.map(d => d.rolling_mean);
    const dThresh = tData.map(d => d.dynamic_threshold);

    // Map alerts exactly to point scatter
    // We map them as {x: timestamp, y: bytes, r: radius based on risk}
    const scatterAlerts = alerts.map(a => ({
        x: new Date(a.Time).getTime(),
        y: a.Bytes_Sent,
        risk: a.Risk_Score || 10
    }));

    timelineChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: tLabels,
            datasets: [
                {
                    label: 'Anomalies',
                    data: scatterAlerts.map(a => ({x: a.x, y: a.y})),
                    type: 'scatter',
                    backgroundColor: CHART_COLORS.alertPoints,
                    borderColor: '#fff',
                    borderWidth: 1,
                    pointRadius: 6,
                    pointHoverRadius: 8,
                    order: 0 // draw on top
                },
                {
                    label: 'Traffic Volume',
                    data: dBytes,
                    borderColor: CHART_COLORS.trafficLine,
                    borderWidth: 1,
                    pointRadius: 0,
                    tension: 0.1,
                    order: 3
                },
                {
                    label: 'Rolling Baseline',
                    data: dBase,
                    borderColor: CHART_COLORS.baselineLine,
                    borderDash: [5, 5],
                    borderWidth: 1,
                    pointRadius: 0,
                    order: 2
                },
                {
                    label: 'Dynamic Threshold',
                    data: dThresh,
                    borderColor: CHART_COLORS.thresholdLine,
                    borderWidth: 1,
                    pointRadius: 0,
                    backgroundColor: 'rgba(249, 115, 22, 0.05)',
                    fill: '-1', // fill to previous dataset (baseline)
                    order: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 500 },
            interaction: { mode: 'nearest', intersect: false },
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: 'hour',
                        displayFormats: { hour: 'MMM dd, HH:mm' }
                    },
                    grid: { color: 'rgba(255,255,255,0.05)' }
                },
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    title: { display: true, text: 'Bytes Sent' }
                }
            },
            plugins: {
                legend: { labels: { usePointStyle: true } }
            }
        }
    });
}

// -------------------------------
//  CHART 2: Z-SCORE STRESS
// -------------------------------
function renderZScoreChart(alerts) {
    const ctx = document.getElementById('zscoreChart').getContext('2d');
    if (zscoreChart) zscoreChart.destroy();
    
    // Sort alerts chronologically
    let sortedAlerts = [...alerts].sort((a, b) => new Date(a.Time).getTime() - new Date(b.Time).getTime());
    
    let labels = sortedAlerts.map(a => new Date(a.Time).getTime());
    let zscores = sortedAlerts.map(a => Number(a.z_score).toFixed(2));

    zscoreChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Z-Score Magnitude',
                data: zscores,
                backgroundColor: zscores.map(z => z > 2.0 ? CHART_COLORS.critical : CHART_COLORS.alertPoints),
                borderRadius: 2,
                barPercentage: 1.0,
                categoryPercentage: 1.0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    type: 'time',
                    time: { unit: 'hour', displayFormats: { hour: 'MMM dd, HH:mm' } },
                    grid: { display: false }
                },
                y: {
                    min: 1.0,
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    title: { display: true, text: 'Z-Score Deviation' }
                }
            },
            plugins: {
                legend: { display: false }
            }
        }
    });
}

// -------------------------------
//  CHART 3: HOURLY BAR
// -------------------------------
function renderBarChart(traffic) {
    const ctx = document.getElementById('hourlyBarChart').getContext('2d');
    if (barChart) barChart.destroy();
    
    // Calculate aggregate traffic by hour
    let hourSums = new Array(24).fill(0);
    let hourCounts = new Array(24).fill(0);
    
    traffic.forEach(row => {
        if(row.Time && row.Bytes_Sent) {
            // Extract hour: "2019-01-22 04:15:00+03:30"
            const match = row.Time.match(/\s(\d{2}):/);
            if(match) {
                let h = parseInt(match[1]);
                hourSums[h] += row.Bytes_Sent;
                hourCounts[h]++;
            }
        }
    });
    
    let hourAvgs = hourSums.map((sum, i) => hourCounts[i] > 0 ? (sum / hourCounts[i]) : 0);

    barChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Array.from({length:24}, (_,i) => i+":00"),
            datasets: [{
                label: 'Avg Bytes Sent',
                data: hourAvgs,
                backgroundColor: CHART_COLORS.trafficLine,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { grid: { color: 'rgba(255,255,255,0.05)' } },
                x: { grid: { display: false } }
            },
            plugins: {
                legend: { display: false }
            }
        }
    });
}


// -------------------------------
//  TABLE RENDER
// -------------------------------
function renderTable(alerts) {
    const tbody = document.getElementById('threatTableBody');
    tbody.innerHTML = "";
    
    // Sort by Risk Score descending, limit to top 50 to avoid browser lag
    let topAlerts = [...alerts].sort((a,b) => (b.Risk_Score||0) - (a.Risk_Score||0)).slice(0, 50);

    if(topAlerts.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;">No threats found matching criteria.</td></tr>`;
        return;
    }

    topAlerts.forEach(a => {
        const row = document.createElement('tr');
        
        const sevClass = `badge-${a.severity ? a.severity.toLowerCase() : 'low'}`;
        
        row.innerHTML = `
            <td>${a.Time.substring(0, 19)}</td>
            <td>${a.Bytes_Sent.toLocaleString()}</td>
            <td style="color:${a.z_score > 2 ? 'var(--accent-red)' : 'var(--text-primary)'}">${Number(a.z_score).toFixed(2)}</td>
            <td>${Number(a.dynamic_threshold).toLocaleString(undefined,{maximumFractionDigits:0})}</td>
            <td class="highlight">${(a.Risk_Score||0).toLocaleString()}</td>
            <td><span class="badge ${sevClass}">${a.severity||'Low'}</span></td>
        `;
        tbody.appendChild(row);
    });
}
