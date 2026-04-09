# Visual Threat Analysis for E-commerce Networks
![Network Threat Analysis](Results/traffic_anomaly_detection.png)

## Overview
This repository contains a full **Data Engineering and Security Analytics pipeline** designed to ingest, clean, and analyze high-volume e-commerce web server logs. The objective of this project is to detect, score, and visualize network anomalies such as **DDoS attacks, data exfiltration, and coordinated scraping patterns** using statistical thresholds. 

The project operates entirely locally, utilizing a 3.5 GB production `access.log` from an e-commerce platform and surfacing threats through both a Power BI interactive dashboard and a **Standalone SIEM Web Dashboard**.

---

## 🛠️ Technology Stack
- **Data Pipeline:** Python 3, Pandas, Regex
- **Statistical Analysis:** Rolling windows, Z-Score deviation, Outlier trimming (`quantile(0.99)`)
- **Visualizations (Static):** Matplotlib, Seaborn
- **Visualizations (Interactive):** 
  * Power BI Desktop (`.pbix`)
  * HTML5, Vanilla CSS (Glassmorphism), Vanilla JS, Chart.js (Serverless Dashboard)

---

## 🧠 Core Methodology

### 1. Data Ingestion & Parsing
Raw Nginx/Apache logs are parsed using highly optimized Python Regex to extract: `Timestamp`, `IP Address`, `HTTP Method`, `URL/Endpoint`, `HTTP Status`, and `Bytes Sent`. The pipeline successfully parsed **10,363,637** records out of a 10.3M line log file with a **99.98% extraction rate**.

### 2. Statistical Anomaly Detection (Z-Score)
Rather than relying on arbitrary static threshold limits, this pipeline establishes a **Dynamic Baseline Threshold**:
- **Rolling Mean & Std Dev:** Calculated using a `WINDOW = 10` minute interval. This allows the system to adjust to natural diurnal traffic curves (e.g., higher traffic at 5 PM vs 3 AM) without triggering false positives.
- **Outlier Control:** Structural spikes (the top 1% `quantile(0.99)`) are temporarily ignored during baseline generation so single-minute extreme bursts do not artificially warp the rolling baseline.
- **Alert Trigger:** Any 1-minute traffic bucket that deviates from the moving average by `Z > 1.5` standard deviations is flagged as a statistical anomaly.

### 3. Threat Severity & Risk Scoring
Not all alerts are equal. A traffic spike with a Z-score of 3.0 moving `100 KB` of data is less dangerous than a spike with a Z-score of 2.1 moving `500 MB` of data. 
We implemented a **Custom Risk Score Algorithm** to weight alerts:
```text
Risk Score = |z_score| × (Bytes_Sent / 1,000)
```
**Severity Classification Tiering:**
* 🟢 **Low:** Score < 300
* 🟡 **Medium:** Score 300 - 600
* 🟠 **High:** Score 600 - 1000
* 🔴 **Critical:** Score > 1000

---

## 📊 Key Insights & Findings
- **Data Coverage:** Evaluated January 22 – January 26, 2019 (6,686 unique one-minute aggregation buckets).
- **Total Alerts:** 870 anomalies identified (13.01% alert coverage over the dataset).
- **Peak Threat Window:** `January 22, 14:00` — This specific hour generated 9 discrete alerts (a 30% alert rate inside that hour) with a max Z-Score of 2.09.
- **Data Quality:** The duplicate impact was heavily tested. 111,137 duplicate rows (~1.07%) were dropped, producing a negligible impact on structural detection (only a 4-alert variance when testing raw vs cleaned data).

---

## 🖥️ How to Run the Dashboards

### 1. The SIEM Web Dashboard (Recommended)
We built a standalone, offline-ready SOC Analyst web interface to interactively filter and view the alerts.
1. Download or clone this repository.
2. Open the `Web-Dashboard/` folder.
3. Double-click `index.html` to open it in any modern browser. 
*(No server, node, or database installation required).*

### 2. The Power BI Dashboard
1. Ensure Microsoft Power BI Desktop is installed.
2. Open `Dashboard/Threat_Hunting_Analysis_Dashboard.pbix`.

---

## 📁 Repository Structure
```text
├── Dashboard/                 # Power BI files (.pbix) and layout PDFs/SVGs
├── Notebook/                  # Primary Jupyter Notebook pipeline (threat_analysis_polished.ipynb)
├── Results/                   # Output PNG plots and processed .csv/.xls datasets
├── Web-Dashboard/             # HTML/CSS/JS Source for the interactive SOC SIEM console
│   ├── index.html             # Main dashboard layout
│   ├── styles.css             # Dark-mode glassmorphism styling
│   ├── script.js              # Chart.js rendering and filter logic
│   └── data.js                # Data payload compiled automatically from Results/
├── .gitignore                 # Excludes the 3.5GB raw data file from tracking
└── README.md                  # This file
```

---
*Created by **Mhd Dhanish** (ID: 23BCCDD035) for Final Project Evaluation.*
