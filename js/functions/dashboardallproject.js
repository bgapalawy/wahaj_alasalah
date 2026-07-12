class ConstructionCostDashboard {
    constructor(dynamoDBClient, plannedCostsTable, ActualCostsTable,plannedDatesTable,ActualDatesTable,exlcudedkeys,plannedDatesTableFinish,villaInfoTable, fetchTableData) {
       this.dynamoDBClient = dynamoDBClient;
        this.plannedTablecost = plannedCostsTable;
        this.actualTablecost = ActualCostsTable;
        this.plannedTabledates = plannedDatesTable;
        this.actualTabledates = ActualDatesTable;
        this.plannedTabledatesFinish=plannedDatesTableFinish;
        this.EXCLUDED_KEYS =exlcudedkeys; new Set(['nameArabic', 'id', 'name', 'ItemID', 'predecessors']);
        this.categoryColorMap = new Map();
        this.container = null;
        this.constructionData = [];
        this.constructionDataActual = [];
        this.costTrendChart = null;
        this.categoryPieChart = null;
        this.categoryPieChartActual = null;
        this.topItemsChart = null;
        this.categoryChartData = { categories: [], plannedCosts: [], actualCosts: [] };
        this.topItemsChartData = { items: [], plannedCosts: [], actualCosts: [], categories: [] };
        this.originalData = [];
        this.originalDataActual = [];
        this.currentFilteredData = [];
        this.currentFilteredDataActual = [];
        this.currentFilteredDataActualwithoutdates=[];
        this.currentFilteredDatawithoutdates=[];
        this.sortColumn = null;
        this.sortDirection = 'asc';
        this.mindate="";
        this.maxdate="";
        this.minPlannedDate = "";
        this.maxPlannedDate = "";
        this.minActualDate = "";
        this.maxActualDate = "";
        this.minPlannedDate = "";
        this.minActualDateView = "";
        this.maxActualDateView = "";
        this.isWeeklyViewView = false;
        this.totalProjectActualPercentChart = null;
this.projectPlannedUpToDateChart = null;
this.projectActualUpToDateChart = null;
this.plannedCostChart = null;
this.actualCostChart = null;
    this.villaInfoTable = villaInfoTable; // Add this line
     this.dailyMetrics=null
     this.fetchTableData=fetchTableData;
    
    }
    async fetchVillaInfo() {
    try {
        const villaInfo = await this.fetchTableData(this.villaInfoTable);
        this.villaInfoMap = new Map();
        villaInfo.forEach(item => {
            this.villaInfoMap.set(item.villaID, {
                blocknum: item.blocknum || 'N/A',
                stage: item.stage || 'N/A'
            });
        });
        return this.villaInfoMap;
    } catch (error) {
        console.error("Error fetching villa info:", error);
        throw error;
    }
}




      

//  formatDate(date, isFinishDate = false) {
//     if (!date) return 'N/A';
//     const convertedDate = this.convertExcelDateToJSDateForDisplay(date, isFinishDate);
//     if (!convertedDate || !(convertedDate instanceof Date) || isNaN(convertedDate.getTime())) return 'N/A';
//     const day = String(convertedDate.getDate()).padStart(2, '0');
//     const month = String(convertedDate.getMonth() + 1).padStart(2, '0');
//     const year = convertedDate.getFullYear();
//     return `${day}/${month}/${year}`;
// }




calculateDailyCostMetrics(processedData,actual=false) {
    const plannedDailyCosts = {};
    const uniqueWorkingDays = new Set(); // Track unique working days
    let totalPlannedCost = 0;

    processedData.forEach(activity => {
        if (activity.date && activity.cost > 0) {
            const startDate = activity.date;
            let endDate = activity.finishDate;
            if (actual) {
                endDate = new Date(activity.date);
                endDate.setDate(endDate.getDate() + 7);
            }
            
            if (startDate && endDate) {
                const workingDays = this.countWorkingDays(startDate, endDate);
                if (workingDays > 0) {
                    const dailyCost = activity.cost / workingDays;
                    totalPlannedCost += activity.cost;
                    
                    // Distribute cost across working days
                    const current = new Date(startDate);
                    while (current <= endDate) {
                        const dayOfWeek = current.getDay();
                        if (dayOfWeek !== 5) { // Exclude Friday
                            const dateKey = current.toISOString().split('T')[0];
                            
                            // Add to unique working days set
                            uniqueWorkingDays.add(dateKey);
                            
                            // Accumulate daily costs
                            if (!plannedDailyCosts[dateKey]) {
                                plannedDailyCosts[dateKey] = 0;
                            }
                            plannedDailyCosts[dateKey] += dailyCost;
                        }
                        current.setDate(current.getDate() + 1);
                    }
                }
            }
        }
    });

    // Calculate metrics based on unique working days
    const totalUniqueWorkingDays = uniqueWorkingDays.size;
    const avgPlannedDaily = totalUniqueWorkingDays > 0 ? totalPlannedCost / totalUniqueWorkingDays : 0;
    const peakPlannedDay = Object.values(plannedDailyCosts).length > 0 ? Math.max(...Object.values(plannedDailyCosts)) : 0;
    
   
    
    return {
        avgPlannedDaily,
        peakPlannedDay,
        plannedDailyCosts,
        totalWorkingDays: totalUniqueWorkingDays // Return unique count
    };
}

convertExcelDateToJSDateForDisplay(date, isFinishDate = false) {
      if (date instanceof Date) {
        // If it's already a JavaScript Date object, adjust the time
        const adjustedDate = new Date(date);
        if (isFinishDate) {
            adjustedDate.setHours(23, 59, 59, 999);
        } else {
            adjustedDate.setHours(0, 0, 0, 0);
        }
        return adjustedDate;
    } else if (typeof date === 'number') {
        // If it's a number (Excel date), convert it and adjust the time
        if (isNaN(date) || date <= 0) {
            return null;
        }
        
        // Adjust for Excel's leap year bug (Feb 29, 1900)
        let adjustedDate = date;
        if (date >= 60) {
            adjustedDate -= 1;
        }

        // Create base date: January 1, 1900
        const excelBaseDate = new Date(Date.UTC(1900, 0, 1));
        const jsDate = new Date(excelBaseDate.getTime() + adjustedDate * 24 * 60 * 60 * 1000);

        // Set appropriate time
        if (isFinishDate) {
            jsDate.setHours(23, 59, 59, 999);
        } else {
            jsDate.setHours(0, 0, 0, 0);
        }

        // Validate the resulting date
        if (isNaN(jsDate.getTime())) {
            return null;
        }

        return jsDate;
    } else {
        // If it's neither a Date object nor a number, return null
        return null;
    }
}





// Replace the existing convertExcelDateToJSDateForCalculations method with this:
convertExcelDateToJSDateForCalculations(excelDate) {
   if (typeof excelDate !== 'number' || isNaN(excelDate) || excelDate <= 0) {
                    return null; // Handle invalid input
                }

                const daysBeforeExcelEpoch = 25569; // Days from 1/1/1900 to 12/30/1899
                const millisecondsPerDay = 24 * 60 * 60 * 1000;

                // Convert Excel date to JavaScript date
                const jsDate = new Date((excelDate - daysBeforeExcelEpoch) * millisecondsPerDay);

                // Adjust for Excel's leap year bug
                if (excelDate < 60) {
                    jsDate.setDate(jsDate.getDate() + 1);
                }

                return jsDate;
}



// Add this helper method to count working days (excluding Fridays)
countWorkingDays(start, end) {
      let count = 0;
      const current = new Date(start);
      current.setHours(0, 0, 0, 0); // Normalize to start of day for iteration

      const endDay = new Date(end);
      endDay.setHours(23, 59, 59, 999); // Normalize to end of day for iteration

      while (current <= endDay) {
        const dayOfWeek = current.getDay(); // 0 = Sunday, 1 = Monday, ..., 5 = Friday, 6 = Saturday
        if (dayOfWeek !== 5) { // If it's not a Friday
          count++;
        }
        current.setDate(current.getDate() + 1); // Move to the next day
      }
      return count;
    };

updateProjectMetricsCharts() {
    // CHANGE: The getMetricValue helper is no longer needed and can be removed.

    // CHANGE: Get metric values directly from the class properties.
    const totalProjectActualPercent = this.totalProjectActualPercentValue || 0;
    const percentPlannedToDate = this.percentPlannedToDateValue || 0;
    const percentActualToDate = this.percentActualToDateValue || 0;
    const percentPlannedFiltered = this.percentPlannedFilteredValue || 0;
    const percentActualFiltered = this.percentActualFilteredValue || 0;

    // Helper function to create a pie chart
    const createPieChart = (ctx, id, value, title) => {
        if (!ctx) {
            console.error(`Canvas context for ${id} not found`);
            return;
        }

        // Destroy existing chart if it exists
        if (this[id]) {
            this[id].destroy();
            this[id] = null;
        }

        if (value > 0 && !isNaN(value)) {
            const remaining = 100 - value;
            
            // Correctly handle the case for 100% to avoid a tiny "Remaining" slice
            const chartData = (value >= 100) ? [100] : [value, remaining];
            const simpleLabels = (value >= 100) ? [title] : [title, 'Remaining'];
            const backgroundColors = (value >= 100) ? [this.getCategoryColor(title)] : [this.getCategoryColor(title), '#E0E0E0'];

            this[id] = new Chart(ctx, {
                type: 'pie',
                data: {
                    labels: simpleLabels,
                    datasets: [{
                        data: chartData,
                        backgroundColor: backgroundColors,
                        borderColor: '#fff',
                        borderWidth: 2
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        // CHANGE: Re-enable and position the legend cleanly.
                        legend: {
                            display: true,
                            position: 'bottom', // Position at the bottom to avoid clutter.
                            labels: {
                                font: {
                                    size: 12
                                },
                                padding: 20 // Add some space below the chart.
                            }
                        },
                        // The tooltip can show the detailed breakdown on hover.
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    const label = context.label || '';
                                    const val = context.raw || 0;
                                    return `${label}: ${val.toFixed(2)}%`;
                                }
                            }
                        },
                        // Configure the datalabels for better readability.
                        datalabels: {
                            formatter: (val, context) => {
                                if (val < 5) return null;
                                return `${val.toFixed(2)}%`;
                            },
                            color: '#000',
                            font: {
                                weight: 'bold',
                                size: 14,
                            },
                            backgroundColor: 'rgba(255, 255, 255, 0.7)',
                            borderColor: 'rgba(128, 128, 128, 0.5)',
                            borderWidth: 1,
                            borderRadius: 4,
                            padding: 6
                        }
                    }
                },
                plugins: [ChartDataLabels]
            });
        } else {
            ctx.font = '16px Arial';
            ctx.fillStyle = '#666';
            ctx.textAlign = 'center';
            ctx.fillText(`No ${title.toLowerCase()} data available`, ctx.canvas.width / 2, ctx.canvas.height / 2);
            console.warn(`No valid data for ${title}: ${value}`);
        }
    };
    // This part remains unchanged
    const canvases = {
        totalProjectActualPercentChart: { value: totalProjectActualPercent, title: 'Total Project Actual Percent' },
        projectPlannedUpToDateChart: { value: percentPlannedToDate, title: 'Project Planned Up to Date' },
        projectActualUpToDateChart: { value: percentActualToDate, title: 'Project Actual Up to Date' },
        plannedCostChart: { value: percentPlannedFiltered, title: 'Planned  % Filterd UpTodate' },
        actualCostChart: { value: percentActualFiltered, title: 'Actual % Filterd UpTodate' }
    };

    Object.keys(canvases).forEach(chartId => {
        const canvas = document.getElementById(chartId);
        if (!canvas) {
            console.error(`Canvas element ${chartId} not found`);
            return;
        }
        const ctx = canvas.getContext('2d');
        createPieChart(ctx, chartId, canvases[chartId].value, canvases[chartId].title);
    });
}
    // Load external scripts and stylesheets
    async loadScript(src) {
        return new Promise((resolve, reject) => {
            if (document.querySelector(`script[src="${src}"]`)) return resolve();
            const script = document.createElement('script');
            script.src = src;
            script.async = true;
            script.onload = resolve;
            script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
            document.head.appendChild(script);
        });
    }

    async loadStylesheet(href) {
        return new Promise((resolve, reject) => {
            if (document.querySelector(`link[href="${href}"]`)) return resolve();
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = href;
            link.onload = resolve;
            link.onerror = () => reject(new Error(`Failed to load stylesheet: ${href}`));
            document.head.appendChild(link);
        });
    }

    async loadDependencies() {
        const dependencies = [
            { type: 'script', url: 'https://code.jquery.com/jquery-3.7.1.min.js' },
            { type: 'script', url: 'https://cdn.jsdelivr.net/npm/moment@2.29.4/moment.min.js' },
            { type: 'script', url: 'https://cdn.jsdelivr.net/npm/luxon@3.3.0' },
            { type: 'stylesheet', url: 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css' },
            { type: 'script', url: 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js' },
            { type: 'script', url: 'https://cdn.jsdelivr.net/npm/chart.js' },
            { type: 'script', url: 'https://cdn.jsdelivr.net/npm/chartjs-adapter-luxon@1.2.0', requires: ['luxon'] },
            { type: 'script', url: 'https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2.0.0', requires: ['chart.js'] },
            { type: 'stylesheet', url: 'https://cdn.jsdelivr.net/npm/select2@4.1.0-rc.0/dist/css/select2.min.css' },
            { type: 'script', url: 'https://cdn.jsdelivr.net/npm/select2@4.1.0-rc.0/dist/js/select2.min.js', requires: ['jquery'] },
            { type: 'stylesheet', url: 'https://cdn.jsdelivr.net/npm/daterangepicker@3.1.0/daterangepicker.css', requires: ['moment'] },
            { type: 'script', url: 'https://cdn.jsdelivr.net/npm/daterangepicker@3.1.0/daterangepicker.min.js', requires: ['moment', 'jquery'] },
            { type: 'script', url: 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js' },
            { type: 'script', url: 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js' },
            { type: 'script', url: 'https://cdn.jsdelivr.net/npm/echarts@5.4.3/dist/echarts.min.js' },
            { type: 'stylesheet', url: 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css' } 
         
        ];

        const loadedUrls = new Set();
        async function loadWithDependencies(dep) {
            if (loadedUrls.has(dep.url)) return;
            if (dep.requires) {
                for (const req of dep.requires) {
                    const requiredDep = dependencies.find(d => d.url.includes(req));
                    if (requiredDep) await loadWithDependencies(requiredDep);
                }
            }
            try {
                if (dep.type === 'script') await this.loadScript(dep.url);
                else if (dep.type === 'stylesheet') await this.loadStylesheet(dep.url);
                loadedUrls.add(dep.url);
               // console.log(`Successfully loaded: ${dep.url}`);
            } catch (error) {
                console.error(`Error loading ${dep.url}:`, error);
                throw error;
            }
        }

        for (const dep of dependencies) {
            await loadWithDependencies.call(this, dep);
        }
    }
getISOWeek(date) {
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
        const week1 = new Date(d.getFullYear(), 0, 4);
        const weekNumber = 1 + Math.round(((d - week1) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
        return `${d.getFullYear()}-W${String(weekNumber).padStart(2, '0')}`;
    }
    // Create and initialize the dashboard
    createDashboard() {
        this.container = document.createElement('div');
        this.container.className = 'container-fluid';
        this.container.style.display = 'none';

        // Add styles
       
const style = document.createElement('style');
style.textContent = `
/* dashboard */
.dashboard-header {
    background-color: #2c3e50;
    color: white;
    padding: 15px;
    border-radius: 5px;
    margin-bottom: 20px;
    margin-top: 100px;
}
.card {
    border-radius: 8px;
    box-shadow: 0 4px 8px rgba(0,0,0,0.1);
    margin-bottom: 20px;
    border: none;
    max-width: 100%;
}
.card-header {
    background-color: #3498db;
    color: white;
    border-radius: 8px 8px 0 0 !important;
}
.filter-section {
    background-color: white;
    padding: 15px;
    border-radius: 8px;
    box-shadow: 0 4px 8px rgba(0,0,0,0.1);
    margin-bottom: 20px;
}
.chart-container {
    position: relative;
    width: 100%;
    min-height: 500px; /* Increased height to accommodate wrapped y-axis labels */
}
.col-md-12 {
    padding: 0 15px;
    margin-bottom: 20px;
}
.summary-card {
    text-align: center;
    padding: 15px;
}
.summary-value {
    font-size: 20px;
    font-weight: bold;
    color: #2c3e50;
    line-height: 1.5;
}
.summary-label {
    font-size: 14px;
    color: #7f8c8d;
}
.data-table {
    font-size: 14px;
}
.category-badge {
    font-size: 12px;
    margin-right: 5px;
    margin-bottom: 5px;
}
.styled-table {
    width: 100%;
    border-collapse: collapse;
}
.styled-table th, .styled-table td {
    padding: 8px;
    text-align: left;
    border-bottom: 1px solid #ddd;
}
.styled-table th {
    background-color: #f2f2f2;
    position: sticky;
    top: 0;
    z-index: 2; /* Ensure header stays above table body */
    box-shadow: 0 2px 2px -1px rgba(0, 0, 0, 0.1); /* Subtle shadow for visual separation */
}

.select2-container--default .select2-selection--multiple {
    border: 1px solid #ced4da;
    border-radius: 0.375rem;
    min-height: 38px;
    padding: 0 5px;
}
.select2-container--default.select2-container--focus .multiple {
    border-color: #86b7fe;
    box-shadow: 0 0 0 0.25rem rgba(13, 110, 253, 0.25);
}
.select2-container--default .data-item {
    padding-bottom: 0px !important;
}
.select2-container--default .select2-selection--multiple .multiple {
    background-color: #e9ecef;
    border: 1px solid #ced4da;
    border-radius: 4px;
    color: #495057;
}
.select2-container--default .select2-search--inline .data-table {
    margin-top: 7px;
}
.select2-container--default .data-table {
    margin-bottom: 0 !important;
}
.select2-container--default .select2-selection--multiple .data-label {
    color: #6c757d;
    margin-right: 4px;
}
.select2-container--default .data-value {
    background-color: #0d70fd;
}



        #projectMetricsCharts canvas {
    max-width: 100%;
    height: 200px !important; /* Ensure a minimum height */
    width: 100%;
}
   .project-metrics-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr); /* Two columns of equal width */
    grid-template-rows: repeat(3, auto); /* Three rows, height auto-adjusts */
    gap: 20px; /* Space between charts */
    width: 100%;
    min-height: 600px; /* Minimum height for the grid container */
}

.chart-item {
    width: 100%;
    min-height: 200px; /* Minimum height for each chart */
}

.chart-item canvas {
    width: 100% !important;
    height: 200px !important; /* Fixed height for charts */
    max-width: 100%;
}
@media (max-width: 768px) {
    .project-metrics-grid {
        grid-template-columns: 1fr; /* Single column on small screens */
        grid-template-rows: repeat(5, auto); /* One row per chart */
    }
    .project-metrics-grid .chart-item:last-child:nth-child(5) {
        grid-column: span 1; /* Reset spanning for mobile */
    }
}
/* Table Container */
.table-container {
    min-width: 1300px;
    overflow-x: auto;
    box-shadow: 0 0 20px rgba(0, 0, 0, 0.1);
    border-radius: 8px;
    max-height: 600px; /* Ensure height limit for scrolling */
    overflow-y: auto; /* Enable vertical scrolling */
    position: relative;
}

/* Main Table Styles */
#costTable {
    width: 100%;
    border-collapse: collapse;
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    margin: 0;
    background: white;
    border: 1px solid #ddd;
}

/* Table Header (vertical & compact) */
#costTable th {
    writing-mode: horizontal-tb;
    font-size: 11px;
    padding: 4px 2px;
    min-width: 22px;
    max-width: 34px;
    background-color: #3498db;
    color: white;
    font-weight: 600;
    text-align: center;
    position: sticky;
    top: 0;
    border-right: 1px solid rgba(255, 255, 255, 0.1);
    border-bottom: 2px solid #2980b9;
    z-index: 10;
    box-shadow: 0 2px 2Hobbits -1px rgba(0, 0, 0, 0.1);
}

/* First header cell (keep horizontal) */
#costTable th:first-child {
    writing-mode: horizontal-tb;
    transform: none;
    text-align: left;
    padding: 8px 12px;
    min-width: auto;
    max-width: none;
    border-radius: 8px 0 0 0;
    border-right: 2px solid #2980b9;
}

#costTable th:last-child {
    border-radius: 0 8px 0 0;
    border-right: none;
}

/* Table Cells (normal orientation) */
#costTable td {
    padding: 6px 4px;
    font-size: 12px;
    text-align: center;
    border-bottom: 1px solid #e0e0e0;
    border-right: 1px solid #e0e0e0;
}

/* First column of any row (keep horizontal) */
#costTable td:first-child {
    writing-mode: horizontal-tb;
    transform: none;
    text-align: left;
    font-weight: 600;
    color: #2c3e50;
    padding: 8px 12px;
    border-right: 2px solid #2980b9;
    background-color: #f8f9fa;
}

/* Vertically-oriented first and second row (compact) */
#costTable tr:nth-child(2) td,
#costTable tr:nth-child(3) td,
#costTable tr:nth-child(4) td,
#costTable tr:nth-child(5) td {
    writing-mode: horizontal-tb;
    background-color: #e9f7fe;
    font-size: 10px;
    padding: 3px 2px;
    min-width: 22px;
    max-width: 34px;
    font-weight: 500;
}

/* First column in vertical rows (keep horizontal) */
#costTable tr:nth-child(2) td:first-child,
#costTable tr:nth-child(3) td:first-child,
#costTable tr:nth-child(4) td:first-child,
#costTable tr:nth-child(5) td:first-child,
#costTable tr:nth-child(6) td:first-child {
    writing-mode: horizontal-tb;
    transform: none;
    padding: 8px 12px;
    min-width: auto;
    max-width: none;
    background-color: #f8f9fa;
    border-right: 2px solid #2980b9;
}

/* Add thick border to bottom of header row */
#costTable thead tr {
    border-bottom: 2px solid #2980b9;
}

/* Percentage Rows Styling */
#costTable tr:nth-child(2) td,
#costTable tr:nth-child(4) td,
#costTable tr:nth-child(7) td,
#costTable tr:nth-child(9) td {
    background-color: #eeede9;
    font-weight: bold;
}

#costTable tr:nth-child(3) td,
#costTable tr:nth-child(5) td,
#costTable tr:nth-child(8) td,
#costTable tr:nth-child(10) td {
    background-color: #edf9eef3;
}

.percent {
    font-weight: 600;
    color: green;
}

.cost {
    font-weight: 600;
    color: blueviolet;
}

/* Separator Row */
.separator {
    height: 7px;
    background-color: black;
}
.separator td {
    padding: 0 !important;
    height: 7px;
    background-color: black;
}

/* Hover Effects */
#costTable tr:hover td {
    background-color: #f1f9ff;
}

/* Responsive Adjustments */
@media (max-width: 768px) {
    #costTable th {
        font-size: 9px;
        min-width: 14px;
        max-width: 20px;
        padding: 2px 1px;
    }
    
    #costTable th:first-child {
        padding: 6px 8px;
    }
    
    #costTable tr:nth-child(2) td,
    #costTable tr:nth-child(3) td {
        font-size: 8px;
        min-width: 12px;
        max-width: 18px;
        padding: 2px 1px;
    }
    
    #costTable td {
        font-size: 10px;
        padding: 3px 2px;
    }
    
    #costTable td:first-child {
        padding: 6px 8px;
    }
}

/* Total Row */
.total-row {
    font-weight: bold;
    background-color: #2c3e50 !important;
    color: white;
}
.total-row td:first-child {
    border-radius: 0 0 0 8px;
}
.total-row td:last-child {
    border-radius: 0 0 8px 0;
}

#topItemsChart {
    width: 100%;
    height: 400px;
}

/* Sorting Icon Styles */
.sort-icon {
    margin-left: 0.5rem;
    display: inline-flex;
    flex-direction: column;
}
.sort-arrow {
    font-size: 0.6rem;
    color: #ccc;
}
.sort-arrow.active {
    color: #000;
}
    
`;
        document.head.appendChild(style);

        // Dashboard header
        const dashboardHeader = document.createElement('div');
        dashboardHeader.className = 'dashboard-header';
        dashboardHeader.innerHTML = `
            <h1><i class="fas fa-hard-hat"></i> Construction Planned Cost Dashboard</h1>
            <p class="mb-0">Visualization and analysis of villa construction costs</p>
        `;
        this.container.appendChild(dashboardHeader);

        // Loading indicator
        const loadingIndicator = document.createElement('div');
        loadingIndicator.className = 'card';
        loadingIndicator.innerHTML = `
            <div class="card-body text-center">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <p class="mt-2">Loading construction data...</p>
            </div>
        `;
        this.container.appendChild(loadingIndicator);

        // Filter section
        const filterSection = document.createElement('div');
        filterSection.className = 'filter-section';

filterSection.innerHTML = `
            <div class="row">
                <div class="col-md-4">
                    <label for="dateRange" class="form-label">Date Range</label>
                    <input type="text" class="form-control" id="dateRange" placeholder="Select date range">
                </div>
                <div class="col-md-4">
                    <label for="categoryFilter" class="form-label">Categories</label>
                    <select class="form-select select2-multiple" id="categoryFilter" multiple="multiple"></select>
                </div>
                <div class="col-md-4">
                    <label for="itemFilter" class="form-label">Items</label>
                    <select class="form-select select2-multiple" id="itemFilter" multiple="multiple"></select>
                </div>
            </div>
            <div class="col-md-4">
            <label for="villaFilter" class="form-label">Villas</label>
            <select class="form-select select2-multiple" id="villaFilter" multiple="multiple"></select>
        </div>
            <div class="col-md-4">
    <label for="blocknumFilter" class="form-label">Blocks</label>
    <select class="form-select select2-multiple" id="blocknumFilter" multiple="multiple"></select>
</div>
<div class="col-md-4">
    <label for="stageFilter" class="form-label">Stages</label>
    <select class="form-select select2-multiple" id="stageFilter" multiple="multiple"></select>
</div>
            <div class="row mt-3">
                <div class="col-md-12 d-flex justify-content-between align-items-center">
                    <div>
                        <button id="applyFilters" class="btn btn-primary">
                            <i class="fas fa-filter me-2"></i>Apply Filters
                        </button>
                        <button id="resetFilters" class="btn btn-outline-secondary ms-2">
                            <i class="fas fa-undo me-2"></i>Reset
                        </button>
                    </div>
                    <div id="selectedCount" class="badge bg-info text-dark">
                        0 categories, 0 items selected
                    </div>
                </div>
            </div>
            <div class="row mt-2">
                <div class="col-md-12">
                    <div id="activeFilters" class="d-flex flex-wrap gap-2"></div>
                </div>
            </div>
        `;
        this.container.appendChild(filterSection);

        // Summary cards
        const summaryCardsRow = document.createElement('div');
        summaryCardsRow.className = 'row';
        summaryCardsRow.innerHTML = `
            <div class="col-md-3">
                <div class="card summary-card">
                    <div class="summary-value" id="totalCosts">$0</div>
                    <div class="summary-label">Total Cost</div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="card summary-card">
                    <div class="summary-value" id="totalCostsuptodate">$0</div>
                    <div class="summary-label">Total Cost Up To Date </div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="card summary-card">
                    <div class="summary-value" id="Filteredcost">$0</div>
                    <div class="summary-label">Filtered Data Cost</div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="card summary-card">
                    <div class="summary-value" id="Filteredcostuptodate">$0</div>
                    <div class="summary-label">Filtered Data Cost UptoDate</div>
                </div>
            </div>
            
            <div class="col-md-3">
                <div class="card summary-card">
                    <div class="summary-value" id="plannedDatesstart">N/A - N/A</div>
                    <div class="summary-label">Project Planned Start</div>
                    <div class="summary-value" id="plannedDatesfinish">N/A - N/A</div>
                    <div class="summary-label">Project Planned Finish</div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="card summary-card">
                    <div class="summary-value" id="actualDatesstart">N/A - N/A</div>
                    <div class="summary-label">First Project Actual Start </div>
                    <div class="summary-value" id="actualDatesfinish">N/A - N/A</div>
                    <div class="summary-label">Last Project Actual Recorded</div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="card summary-card">
                    <div class="summary-value" id="peakDayCost">$0</div>
                    <div class="summary-label">Peak Day Cost</div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="card summary-card">
                    <div class="summary-value" id="itemsCount">0</div>
                    <div class="summary-label">Active Items</div>
                </div>
            </div>
        `;
        this.container.appendChild(summaryCardsRow);



        // Inside createDashboard method, after the existing chartsRow1
// Inside createDashboard method
const chartsRow2 = document.createElement('div');
chartsRow2.className = 'row';
chartsRow2.innerHTML = `
    <div class="col-12">
        <div class="card">
            <div class="card-header">
                <h5 class="card-title mb-0">Project Progress Metrics</h5>
                <div>
                    <button id="downloadProjectMetricsChartsBtn" class="btn btn-secondary btn-sm">Download Charts as Image</button>
                </div>
            </div>
            <div class="card-body">
                <div class="chart-container project-metrics-grid" id="projectMetricsCharts">
                    <div class="chart-item">
                        <h6 class="text-center mb-3">Total Project Actual Percent</h6>
                        <canvas id="totalProjectActualPercentChart"></canvas>
                    </div>
                    
                    <div class="chart-item">
                        <h6 class="text-center mb-3">Planned Filterd UpTodate</h6>
                        <canvas id="plannedCostChart"></canvas>
                    </div>
                    <div class="chart-item">
                        <h6 class="text-center mb-3">Project Planned Up to Date</h6>
                        <canvas id="projectPlannedUpToDateChart"></canvas>
                    </div>
                    
                    
                    <div class="chart-item">
                        <h6 class="text-center mb-3">Actual Filterd UpTodate</h6>
                        <canvas id="actualCostChart"></canvas>
                    </div>
                    <div class="chart-item">
                        <h6 class="text-center mb-3">Project Actual Up to Date</h6>
                        <canvas id="projectActualUpToDateChart"></canvas>
                    </div>  
                </div>
            </div>
        </div>
    </div>
`;
this.container.appendChild(chartsRow2);

// Add toggle button above filter section
        const toggleViewButton = document.createElement('div');
        toggleViewButton.className = 'row mb-3';
      
        this.container.appendChild(toggleViewButton);
        // Charts row
        const chartsRow1 = document.createElement('div');
        chartsRow1.className = 'row';
        chartsRow1.innerHTML = `
            <div class="col-12">
                <div class="card">
                    <div class="card-header">
                        <h5 class="card-title mb-0">Cost Trend Data</h5>
                        <div>

                        <button id="toggleViewBtn" class="btn btn-primary btn-sm me-2">Switch to Weekly Table</button>
                            <button id="downloadTableBtn" class="btn btn-primary btn-sm me-2">Download Table as Excel</button>
                            <button id="downloadChartBtn" class="btn btn-secondary btn-sm">Download Chart as Image</button>
                            </div>
                    </div>
                    <div class="card-body">
                        <div class="chart-container" style="position: relative; height: 400px; margin-top: 20px;">
                            <canvas id="costTrendChart"></canvas>
                        </div>
                        <div class="table-container">
                            <table id="costTable" class="data-table styled-table"></table>
                        </div>
                    </div>
                </div>
                <div class="col-md-12">
                    <div class="card">
                        <div class="card-header">
                            <h5 class="card-title mb-0">Cost by Category</h5>
                            <div>
                                <button id="downloadCategoryDataBtn" class="btn btn-primary btn-sm me-2">Download Data as Excel</button>
                                <button id="downloadCategoryPieChartBtn" class="btn btn-secondary btn-sm me-2">Download Planned Chart</button>
                                <button id="downloadCategoryPieChartActualBtn" class="btn btn-secondary btn-sm">Download Actual Chart</button>
                            </div>
                        </div>
                        <div class="card-body">
                            <div class="chart-container" style="display: flex; gap: 20px; height: 600px;">
                                <div style="flex: 1;">
                                    <h6 class="text-center mb-3">Planned Cost by Category</h6>
                                    <canvas id="categoryPieChart"></canvas>
                                </div>
                                <div style="flex: 1;">
                                    <h6 class="text-center mb-3">Actual Cost by Category</h6>
                                    <canvas id="categoryPieChartActual"></canvas>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        this.container.appendChild(chartsRow1);








        // Top items chart
        const topItemsRow = document.createElement('div');
        topItemsRow.className = 'row';
        topItemsRow.innerHTML = `
            <div class="col-12">
                <div class="card">
                    <div class="card-header">
                        <h5 class="card-title mb-0">Top Items Chart</h5>
                        <div>
                            <button id="downloadTopItemsTableBtn" class="btn btn-primary btn-sm me-2">Download Data as Excel</button>
                            <button id="downloadTopItemsChartBtn" class="btn btn-secondary btn-sm">Download Chart as Image</button>
                        </div>
                    </div>
                    <div class="card-body">
                        <div class="chart-container" style="position: relative; height: 400px;">
                            <div id="topItemsChart" style="width: 100%; height: 100%;"></div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        this.container.appendChild(topItemsRow);

        // Data table
        const dataTableRow = document.createElement('div');
        dataTableRow.className = 'row';
       dataTableRow.innerHTML = `
       <div class="col-12">
    <div class="card">
        <div class="card-header">
            <h5 class="card-title mb-0">Detailed Cost Data</h5>
            <div class="space-x-2">
                <button id="downloadExcelCurrentBtn" class="btn btn-primary btn-sm">Download Current Page</button>
                <button id="downloadExcelAllBtn" class="btn btn-primary btn-sm">Download All Data</button>
            </div>
        </div>
        <div class="card-body">
            <div class="table-container">
                <table class="styled-table">
                    <thead>
                        <tr>
                            <th data-sort="villa" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer">
                                Villa <span class="sort-icon"><i class="fas fa-arrow-up sort-arrow sort-asc"></i><i class="fas fa-arrow-down sort-arrow sort-desc"></i></span>
                            </th>
                            <th data-sort="item" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer">
                                Item <span class="sort-icon"><i class="fas fa-arrow-up sort-arrow sort-asc"></i><i class="fas fa-arrow-down sort-arrow sort-desc"></i></span>
                            </th>
                            <th data-sort="category" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer">
                                Category <span class="sort-icon"><i class="fas fa-arrow-up sort-arrow sort-asc"></i><i class="fas fa-arrow-down sort-arrow sort-desc"></i></span>
                            </th>
                            <th data-sort="plannedDate" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer">
                                Planned Date <span class="sort-icon"><i class="fas fa-arrow-up sort-arrow sort-asc"></i><i class="fas fa-arrow-down sort-arrow sort-desc"></i></span>
                            </th>
                            <th data-sort="actualDate" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer">
                                Actual Date <span class="sort-icon"><i class="fas fa-arrow-up sort-arrow sort-asc"></i><i class="fas fa-arrow-down sort-arrow sort-desc"></i></span>
                            </th>
                            <th data-sort="varianceOfDates" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer">
                                Variance (Days) <span class="sort-icon"><i class="fas fa-arrow-up sort-arrow sort-asc"></i><i class="fas fa-arrow-down sort-arrow sort-desc"></i></span>
                            </th>
                            <th data-sort="plannedCost" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer">
                                Planned Cost <span class="sort-icon"><i class="fas fa-arrow-up sort-arrow sort-asc"></i><i class="fas fa-arrow-down sort-arrow sort-desc"></i></span>
                            </th>
                            <th data-sort="actualCost" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer">
                                Actual Cost <span class="sort-icon"><i class="fas fa-arrow-up sort-arrow sort-asc"></i><i class="fas fa-arrow-down sort-arrow sort-desc"></i></span>
                            </th>
                            <th data-sort="percentComplete" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer">
                                % Complete <span class="sort-icon"><i class="fas fa-arrow-up sort-arrow sort-asc"></i><i class="fas fa-arrow-down sort-arrow sort-desc"></i></span>
                            </th>
                            <th data-sort="cumulativePlannedCost" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer">
                                Cumulative Planned <span class="sort-icon"><i class="fas fa-arrow-up sort-arrow sort-asc"></i><i class="fas fa-arrow-down sort-arrow sort-desc"></i></span>
                            </th>
                            <th data-sort="cumulativeActualCost" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer">
                                Cumulative Actual <span class="sort-icon"><i class="fas fa-arrow-up sort-arrow sort-asc"></i><i class="fas fa-arrow-down sort-arrow sort-desc"></i></span>
                            </th>
                            <th data-sort="cumulativePlannedPercent" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer">
                                Cumulative Planned % <span class="sort-icon"><i class="fas fa-arrow-up sort-arrow sort-asc"></i><i class="fas fa-arrow-down sort-arrow sort-desc"></i></span>
                            </th>
                            <th data-sort="cumulativeActualPercent" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer">
                                Cumulative Actual % <span class="sort-icon"><i class="fas fa-arrow-up sort-arrow sort-asc"></i><i class="fas fa-arrow-down sort-arrow sort-desc"></i></span>
                            </th>
                        </tr>
                    </thead>
                    <tbody id="dataTableBody"></tbody>
                    <tfoot>
                        <tr>
                            <td colspan="6">Total</td>
                            <td id="totalCost">0.00 SAR</td>
                            <td id="totalCostActual">0.00 SAR</td>
                            <td id="totalActualPercent">0.00%</td>
                            <td colspan="4"></td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    </div>
</div>
`;
        this.container.appendChild(dataTableRow);

        // Toggle button
        

        return this.container;
    }
toggleView() {
        this.isWeeklyView = !this.isWeeklyView;
        const toggleBtn = document.getElementById('toggleViewBtn');
        toggleBtn.innerHTML = `
            <i class="fas fa-calendar-${this.isWeeklyView ? 'month' : 'week'} me-2"></i>
            Switch to ${this.isWeeklyView ? 'Monthly View' : 'Weekly Table'}
        `;
        this.updateDashboard(); // Refresh dashboard with new view
    }

     // Modify the toggleDashboard method to handle showing/hiding the dashboard
toggleDashboard() {
    if (this.container.style.display === 'none' || this.container.style.display === '') {
        this.container.style.display = 'block';
        document.getElementById('toggle-Dashborad').textContent = 'Hide All Project Dashboard';
    } else {
        this.container.style.display = 'none';
        document.getElementById('toggle-Dashborad').textContent = 'Show All Project Dashboard';
    }
}
// Create a method to initialize the dashboard when the button is clicked
async initDashboardOnClick() {
    try {
        this.container = this.createDashboard();
        document.body.appendChild(this.container);
        this.initDashboard();
        await this.fetchDataFromDynamoDB();
    } catch (error) {
        console.error('Dashboard initialization failed:', error);
        // Handle error
    }
}

// Create a method to create the toggle button
createToggleButton() {
    const toggleButton = document.createElement('button');
    toggleButton.id = 'toggle-Dashborad';
    toggleButton.textContent = 'Show All Project Dashboard';
    toggleButton.addEventListener('click', () => {
        if (!this.container) {
            this.initDashboardOnClick();
        } else {
            this.toggleDashboard();
        }
    });
    return toggleButton;
}
    async init() {
        try {
            await this.loadDependencies();
            if (!document.getElementById('toggle-Dashborad')) {
            document.body.appendChild(this.createToggleButton());
        }
           
        } catch (error) {
            console.error('Initialization failed:', error);
            const loadingIndicator = this.container.querySelector('.card');
            loadingIndicator.innerHTML = `
                <div class="card-body text-center text-danger">
                    <p>Failed to load required resources. Please check your internet connection.</p>
                    <button class="btn btn-primary" id="retryButton">Retry</button>
                </div>
            `;
            document.getElementById('retryButton').addEventListener('click', () => window.location.reload());
        }
    }

    initDashboard() {
   $('#dateRange').daterangepicker({
    opens: 'left',
    startDate: luxon.DateTime.now().minus({ months: 3 }).toJSDate(),
    endDate: luxon.DateTime.now().toJSDate(),
    locale: { 
        format: 'YYYY-MM-DD',
        applyLabel: 'Apply',
        cancelLabel: 'Cancel',
        fromLabel: 'From',
        toLabel: 'To',
        customRangeLabel: 'Custom',
        daysOfWeek: ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'],
        monthNames: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
        firstDay: 0
    },
    timePicker: false,
    autoUpdateInput: true
}, (start, end) => {
    // Force dates to start and end of day
    const startDate = new Date(start.toDate());
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(end.toDate());
    endDate.setHours(23, 59, 59, 999);
    if (this.constructionData.length > 0) this.updateDashboard(startDate, endDate);
});

    // Set up sorting event listeners
    document.querySelectorAll('.data-table th').forEach(header => {
        header.addEventListener('click', () => {
            const column = header.getAttribute('data-sort');
            if (this.sortColumn === column) {
                this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
            } else {
                this.sortColumn = column;
                this.sortDirection = 'asc';
            }
            // Reset all icons and aria-sort
            document.querySelectorAll('.data-table th').forEach(th => {
                th.setAttribute('aria-sort', 'none');
                const sortIcon = th.querySelector('.sort-icon');
                if (sortIcon) { // Fixed: Changed setIcon to sortIcon
                    sortIcon.querySelectorAll('.sort-arrow').forEach(icon => icon.classList.remove('active'));
                }
            });
            // Set active icon and aria-sort for the clicked header
            header.setAttribute('aria-sort', this.sortDirection);
            const sortIcon = header.querySelector('.sort-icon');
            if (this.sortDirection === 'asc') {
                sortIcon.querySelector('.sort-asc').classList.add('active');
            } else {
                sortIcon.querySelector('.sort-desc').classList.add('active');
            }
            this.updateDataTable();
        });
    });

    // Set up download button listeners (as previously added)
     // Add event listeners for download buttons
   const toggleBtn = document.getElementById('toggleViewBtn');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => this.toggleView());
        }
    $('#downloadExcelAllBtn').on('click', () => this.downloadAllDataAsExcel('Data_All'));
    $('#downloadExcelCurrentBtn').on('click', () => this.downloadTableAsExcel('dataTableBody', 'Data_Current_Page'));
    $('#downloadTableBtn').on('click', () => this.downloadTablecashAsExcel('costTable', 'cost_trend_data'));
    $('#downloadCategoryDataBtn').on('click', () => this.downloadCategoryDataAsExcel());
    $('#downloadTopItemsTableBtn').on('click', () => this.downloadTopItemsTableAsExcel());
    $('#downloadChartBtn').on('click', () => this.downloadChartAsImage('costTrendChart', 'cost_trend_chart'));
    $('#downloadCategoryPieChartBtn').on('click', () => this.downloadChartAsImage('categoryPieChart', 'category_pie_chart_planned'));
    $('#downloadCategoryPieChartActualBtn').on('click', () => this.downloadChartAsImage('categoryPieChartActual', 'category_pie_chart_actual'));
    $('#downloadTopItemsChartBtn').on('click', () => this.downloadChartAsImage('topItemsChart', 'top_items_chart'));
$('#downloadProjectMetricsChartsBtn').on('click', () => this.downloadChartAsImage('projectMetricsCharts', 'project_metrics_charts'));
    $(document).ready(() => {
        const initialStartDate = this.mindate;
        const initialEndDate = this.maxdate;
        $('#dateRange').data('daterangepicker').setStartDate(initialStartDate);
        $('#dateRange').data('daterangepicker').setEndDate(initialEndDate);
        this.updateDashboard(initialStartDate, initialEndDate);
    });
}

    
    async fetchDataFromDynamoDB() {
        const loadingIndicator = this.container.querySelector('.card');
        try {
             const [plannedResponse, actualResponse,planneddates, actualdates, nameArabicMap,planneddatesFinish,villaInfoMap] = await Promise.all([
                  this.fetchTableData(this.plannedTablecost) ,
                 this.fetchTableData(this.actualTablecost),
                 this.fetchTableData(this.plannedTabledates),
                 this.fetchTableData(this.actualTabledates),
                 this.retrieveSpecificRowDataFromDynamoDB(this.plannedTablecost, "nameArabic"),
                 this.fetchTableData(this.plannedTabledatesFinish),
                             this.fetchVillaInfo() // Add this line

             ]);

            this.constructionData = this.getConstructionData(plannedResponse, planneddates, nameArabicMap, planneddatesFinish, villaInfoMap);
        this.constructionDataActual = this.getConstructionData(actualResponse, actualdates, nameArabicMap, null, villaInfoMap);
            const minDatePlan = this.constructionData.reduce((min, entry) => min === null || entry.date < min ? entry.date : min, null);
            const maxDatePlan = this.constructionData.reduce((max, entry) => max === null || entry.finishDate > max ? entry.finishDate : max, null);
            const minDateAct = this.constructionDataActual.reduce((min, entry) => min === null || entry.date < min ? entry.date : min, null);
            const maxDateAct = this.constructionDataActual.reduce((max, entry) => max === null || entry.date > max ? entry.date : max, null);
            const minDateActView = this.constructionDataActual.reduce((min, entry) => min === null || entry.finishDateActualView < min ? entry.finishDateActualView : min, null);
            const maxDateActView = this.constructionDataActual.reduce((max, entry) => max === null || entry.finishDateActualView > max ? entry.finishDateActualView : max, null);


            this.minPlannedDate = minDatePlan ? new Date(minDatePlan) : null;
            this.maxPlannedDate = maxDatePlan ? new Date(maxDatePlan) : null;
            this.minActualDate = minDateAct ? new Date(minDateAct) : null;
            this.maxActualDate = maxDateAct ? new Date(maxDateAct) : null;
            this.minActualDateView = minDateActView ? new Date(minDateActView) : null;
            this.maxActualDateView = maxDateActView ? new Date(maxDateActView) : null;




            this.mindate = new Date([minDatePlan, minDateActView].filter(d => d).reduce((min, d) => min < d ? min : d, minDatePlan));
            this.maxdate = new Date([maxDatePlan, maxDateActView].filter(d => d).reduce((max, d) => max > d ? max : d, maxDatePlan));

            this.container.removeChild(loadingIndicator);
            this.initFilters();
            this.updateDashboard(this.mindate,this.maxdate);
        } catch (error) {
            console.error("Error fetching data from DynamoDB:", error);
            loadingIndicator.innerHTML = `
                <div class="card-body text-center text-danger">
                    <p>Error loading data: ${error.message}</p>
                    <button class="btn btn-primary" id="retryButton">Retry</button>
                </div>
            `;
            document.getElementById('retryButton').addEventListener('click', () => this.fetchDataFromDynamoDB());
        }
    }
//
getConstructionData(costs, dates, nameArabicMap, datesfinish = null, villaInfoMap = new Map()) {
    const constructionData = [];
    const EXCLUDED_KEYS = this.EXCLUDED_KEYS;

    for (const costObj of costs) {
        const villaID = costObj.villaID;
        if (!villaID) continue;

        // Get villa info
        const villaInfo = villaInfoMap.get(villaID) || { blocknum: 'N/A', stage: 'N/A' };

        for (const [key, cost] of Object.entries(costObj)) {
            if (EXCLUDED_KEYS.has(costObj.villaID) || key === 'villaID') continue;

            for (const dateObj of dates) {
                if (dateObj.villaID !== villaID) continue;

                for (const [dateKey, dateValue] of Object.entries(dateObj)) {
                    if (EXCLUDED_KEYS.has(dateObj.villaID) || dateKey === 'villaID') continue;
                    if (key !== dateKey) continue;

                    const formattedStartDate = this.convertExcelDateToJSDateForCalculations(parseFloat(dateValue));
                    let formattedFinishDateActualView=null;  
                    if (!datesfinish){ 
                    formattedFinishDateActualView = this.convertExcelDateToJSDateForDisplay(parseFloat(dateValue),true);
                    }                         
                    let formattedFinishDate = null;
                    
                    if (datesfinish) {
                        for (const finishDateObj of datesfinish) {
                            if (finishDateObj.villaID === villaID) {
                                const finishDateValue = finishDateObj[key];
                                if (finishDateValue) {
                                    formattedFinishDate = this.convertExcelDateToJSDateForCalculations(parseFloat(finishDateValue));
                                }
                                break;
                            }
                        }
                    }

                    constructionData.push({
                        date: formattedStartDate,
                        finishDate: formattedFinishDate,
                        finishDateActualView: formattedFinishDateActualView,
                        item: nameArabicMap[dateKey],
                        category: dateKey.split('-')[0],
                        cost: parseFloat(cost) || 0,
                        villa: villaID,
                        blocknum: villaInfo.blocknum, // Add blocknum
                        stage: villaInfo.stage // Add stage
                    });
                }
                break;
            }
        }
    }
    return constructionData;
}


 











 retrieveSpecificRowDataFromDynamoDB(table, villaID) {
    return new Promise((resolve, reject) => {
      // Validate input parameters
      if (!table || !villaID) {
        console.error("Invalid input: table and villaID are required");
        reject(new Error("Invalid input: table and villaID are required"));
        return;
      }
  
      const dynamoDB = new AWS.DynamoDB();
  
      // Initialize params object for getting the specific item
      const getParams = {
        TableName: table,
        Key: {
          villaID: { S: villaID }, // villaID is the primary key
        },
      };
  
      // Retrieve the item from the DynamoDB table
      dynamoDB.getItem(getParams, (err, data) => {
        if (err) {
          console.error(
            "Unable to retrieve item. Error JSON:",
            JSON.stringify(err, null, 2)
          );
          reject(err);
          return;
        }
  
        // Check if the item exists
        if (!data.Item) {
          console.log(`No data found for villaID: ${villaID}`);
          resolve(null); // Resolve with null if no data found
          return;
        }
  
        // Convert DynamoDB item to a more readable format
        const result = {};
        for (const [key, value] of Object.entries(data.Item)) {
          result[key] = value.S || value.N || value.BOOL || value.L || value.M; // Extract the value based on its type
        }
  
        // Log the retrieved data
        //console.log("Retrieved data:", JSON.stringify(result, null, 2));
  
        resolve(result); // Resolve the Promise with the retrieved data
      });
    });
  }

   
   

   

    initFilters() {
        const categories = [...new Set(this.constructionData.map(item => item.category))].filter(Boolean);
        const categoryFilter = document.getElementById("categoryFilter");
        categoryFilter.innerHTML = '';
        categories.forEach(category => {
            const option = document.createElement("option");
            option.value = option.textContent = category;
            categoryFilter.appendChild(option);
        });
// Add new filters for blocknum and stage
    const blocknums = [...new Set(this.constructionData.map(item => item.blocknum))].filter(Boolean);
    const blocknumFilter = document.getElementById("blocknumFilter");
        const villas = [...new Set(this.constructionData.map(item => item.villa))].filter(Boolean);

    blocknumFilter.innerHTML = '';
    blocknums.forEach(blocknum => {
        const option = document.createElement("option");
        option.value = option.textContent = blocknum;
        blocknumFilter.appendChild(option);
    });
    $(blocknumFilter).select2({ placeholder: "Select blocks", allowClear: true, width: '100%' });

    const stages = [...new Set(this.constructionData.map(item => item.stage))].filter(Boolean);
    const stageFilter = document.getElementById("stageFilter");
    stageFilter.innerHTML = '';
    stages.forEach(stage => {
        const option = document.createElement("option");
        option.value = option.textContent = stage;
        stageFilter.appendChild(option);
    });
    $(stageFilter).select2({ placeholder: "Select stages", allowClear: true, width: '100%' });

    // Update event listeners
    $(blocknumFilter).on('change', () => { this.updateSelectionCount(); });
    $(stageFilter).on('change', () => { this.updateSelectionCount(); });
     const villaFilter = document.getElementById("villaFilter");
    villaFilter.innerHTML = '';
    villas.forEach(villa => {
        const option = document.createElement("option");
        option.value = option.textContent = villa;
        villaFilter.appendChild(option);
    });
    $(villaFilter).select2({ placeholder: "Select villas", allowClear: true, width: '100%' });

    // Initialize other filters...
    
    // Update event listeners
    $(villaFilter).on('change', () => { this.updateSelectionCount(); });
        $(categoryFilter).select2({ placeholder: "Select categories", allowClear: true, width: '100%' });
        const itemFilter = document.getElementById("itemFilter");
        $(itemFilter).select2({ placeholder: "Select items", allowClear: true, width: '100%' });

        this.updateItemFilter();
        $(categoryFilter).on('change', () => { this.updateItemFilter(); this.updateSelectionCount(); });
        $(itemFilter).on('change', () => this.updateSelectionCount());
        document.getElementById("applyFilters").addEventListener("click", () => {
            this.updateDashboard();
            this.updateActiveFiltersDisplay();
        });
        document.getElementById("resetFilters").addEventListener("click", () => this.resetFilters());
        this.updateSelectionCount();
    }

    updateItemFilter() {
        const categoryFilter = document.getElementById("categoryFilter");
        const itemFilter = document.getElementById("itemFilter");
        const selectedCategories = $(categoryFilter).val() || [];
        const previouslySelected = $(itemFilter).val() || [];
        itemFilter.innerHTML = '';

        const filteredItems = selectedCategories.length > 0
            ? this.constructionData.filter(item => selectedCategories.includes(item.category))
            : this.constructionData;
        const items = [...new Set(filteredItems.map(item => item.item))].filter(Boolean);

        items.forEach(item => {
            const option = document.createElement("option");
            option.value = option.textContent = item;
            if (previouslySelected.includes(item)) option.selected = true;
            itemFilter.appendChild(option);
        });
        $(itemFilter).trigger('change');
    }

    updateSelectionCount() {
    const categoryCount = $('#categoryFilter').val()?.length || 0;
    const itemCount = $('#itemFilter').val()?.length || 0;
    const villaCount = $('#villaFilter').val()?.length || 0;
    const blockCount = $('#blocknumFilter').val()?.length || 0;
    const stageCount = $('#stageFilter').val()?.length || 0;
    
    document.getElementById("selectedCount").textContent = 
        `${categoryCount} categor${categoryCount === 1 ? 'y' : 'ies'}, ` +
        `${itemCount} item${itemCount === 1 ? '' : 's'}, ` +
        `${villaCount} villa${villaCount === 1 ? '' : 's'}, ` +
        `${blockCount} block${blockCount === 1 ? '' : 's'}, ` +
        `${stageCount} stage${stageCount === 1 ? '' : 's'} selected`;
}

    resetFilters() {
         $('#categoryFilter').val(null).trigger('change');
    $('#itemFilter').val(null).trigger('change');
    $('#blocknumFilter').val(null).trigger('change');
    $('#villaFilter').val(null).trigger('change');
    $('#stageFilter').val(null).trigger('change');
        const initialStart = this.mindate;
        const initialEnd = this.maxdate;
        $('#dateRange').data('daterangepicker').setStartDate(initialStart);
        $('#dateRange').data('daterangepicker').setEndDate(initialEnd);
        this.updateDashboard();
        this.updateActiveFiltersDisplay();
        this.updateSelectionCount();
    }

    updateActiveFiltersDisplay() {
        const activeFiltersContainer = document.getElementById("activeFilters");
        activeFiltersContainer.innerHTML = "";
        const dateRange = $('#dateRange').data('daterangepicker');
        const startDate = dateRange.startDate.format('YYYY-MM-DD');
        const endDate = dateRange.endDate.format('YYYY-MM-DD');
        
        const selectedCategories = Array.from(document.getElementById("categoryFilter").selectedOptions)
            .map(option => option.value)
            .filter(val => val !== "");
        if (selectedCategories.length > 0) {
            const categoryBadge = document.createElement("span");
            categoryBadge.className = "badge bg-success me-2";
            categoryBadge.textContent = `Categories: ${selectedCategories.join(", ")}`;
            activeFiltersContainer.appendChild(categoryBadge);
        }

        const selectedItems = Array.from(document.getElementById("itemFilter").selectedOptions)
            .map(option => option.value)
            .filter(val => val !== "");
        if (selectedItems.length > 0) {
            const itemBadge = document.createElement("span");
            itemBadge.className = "badge bg-info me-2";
            itemBadge.textContent = selectedItems.length <= 2 
                ? `Items: ${selectedItems.join(", ")}`
                : `Items: ${selectedItems.slice(0, 2).join(", ")} +${selectedItems.length - 2} more`;
            activeFiltersContainer.appendChild(itemBadge);
        }
        const selectedBlocks = Array.from(document.getElementById("blocknumFilter").selectedOptions)
        .map(option => option.value)
        .filter(val => val !== "");
    if (selectedBlocks.length > 0) {
        const blockBadge = document.createElement("span");
        blockBadge.className = "badge bg-warning me-2";
        blockBadge.textContent = `Blocks: ${selectedBlocks.join(", ")}`;
        activeFiltersContainer.appendChild(blockBadge);
    }

    const selectedStages = Array.from(document.getElementById("stageFilter").selectedOptions)
        .map(option => option.value)
        .filter(val => val !== "");
    if (selectedStages.length > 0) {
        const stageBadge = document.createElement("span");
        stageBadge.className = "badge bg-danger me-2";
        stageBadge.textContent = `Stages: ${selectedStages.join(", ")}`;
        activeFiltersContainer.appendChild(stageBadge);
    }

    // Add villa badge if villas are selected
    const selectedVillas = Array.from(document.getElementById("villaFilter").selectedOptions)
        .map(option => option.value)
        .filter(val => val !== "");
    if (selectedVillas.length > 0) {
        const villaBadge = document.createElement("span");
        villaBadge.className = "badge bg-primary me-2";
        villaBadge.textContent = selectedVillas.length <= 3 
            ? `Villas: ${selectedVillas.join(", ")}`
            : `Villas: ${selectedVillas.slice(0, 3).join(", ")} +${selectedVillas.length - 3} more`;
        activeFiltersContainer.appendChild(villaBadge);
    }
    }

   updateDashboard(startDate, endDate) {
    if (this.constructionData.length === 0 && this.constructionDataActual.length === 0) return;
    const dateRange = $('#dateRange').data('daterangepicker');
    const currentStart = dateRange.startDate.toDate();
    const currentEnd = dateRange.endDate.toDate();
    
    // Normalize dates to midnight to ensure full day coverage
    startDate = this.isValidDate(startDate) ? new Date(startDate.setHours(0, 0, 0, 0)) : new Date(currentStart.setHours(0, 0, 0, 0));
    endDate = this.isValidDate(endDate) ? new Date(endDate.setHours(23, 59, 59, 999)) : new Date(currentEnd.setHours(23, 59, 59, 999));

    const selectedCategories = Array.from(document.getElementById("categoryFilter").selectedOptions)
        .map(option => option.value)
        .filter(val => val !== "");
    const selectedItems = Array.from(document.getElementById("itemFilter").selectedOptions)
        .map(option => option.value)
        .filter(val => val !== "");
    const selectedBlocks = Array.from(document.getElementById("blocknumFilter").selectedOptions)
        .map(option => option.value)
        .filter(val => val !== "");
    const selectedStages = Array.from(document.getElementById("stageFilter").selectedOptions)
        .map(option => option.value)
        .filter(val => val !== "");
    const selectedVillas = Array.from(document.getElementById("villaFilter").selectedOptions)
        .map(option => option.value)
        .filter(val => val !== "");
    
    // Filter data based on all criteria
    this.currentFilteredData = this.constructionData.filter(entry => {
        const entryDate = new Date(entry.date);
        return entryDate >= startDate && entryDate <= endDate &&
               (selectedCategories.length === 0 || selectedCategories.includes(entry.category)) &&
               (selectedItems.length === 0 || selectedItems.includes(entry.item)) &&
               (selectedVillas.length === 0 || selectedVillas.includes(entry.villa)) &&
               (selectedBlocks.length === 0 || selectedBlocks.includes(entry.blocknum)) &&
               (selectedStages.length === 0 || selectedStages.includes(entry.stage));
    }).sort((a, b) => new Date(a.date) - new Date(b.date));

    // Apply same filters to actual data
    this.currentFilteredDataActual = this.constructionDataActual.filter(entry => {
        const entryDate = new Date(entry.date);
        return entryDate >= startDate && entryDate <= endDate &&
               (selectedCategories.length === 0 || selectedCategories.includes(entry.category)) &&
               (selectedItems.length === 0 || selectedItems.includes(entry.item)) &&
               (selectedVillas.length === 0 || selectedVillas.includes(entry.villa)) &&
               (selectedBlocks.length === 0 || selectedBlocks.includes(entry.blocknum)) &&
               (selectedStages.length === 0 || selectedStages.includes(entry.stage));
    }).sort((a, b) => new Date(a.date) - new Date(b.date));

    // Update the filteredDatawithoutdates to include all filters except date
    this.currentFilteredDatawithoutdates = this.constructionData.filter(entry => {
        return (selectedCategories.length === 0 || selectedCategories.includes(entry.category)) &&
               (selectedItems.length === 0 || selectedItems.includes(entry.item)) &&
               (selectedVillas.length === 0 || selectedVillas.includes(entry.villa)) &&
               (selectedBlocks.length === 0 || selectedBlocks.includes(entry.blocknum)) &&
               (selectedStages.length === 0 || selectedStages.includes(entry.stage));
    }).sort((a, b) => a.item.localeCompare(b.item));

    // Update the filteredDataActualwithoutdates similarly (without date filter)
    this.currentFilteredDataActualwithoutdates = this.constructionDataActual.filter(entry => {
        return (selectedCategories.length === 0 || selectedCategories.includes(entry.category)) &&
               (selectedItems.length === 0 || selectedItems.includes(entry.item)) &&
               (selectedVillas.length === 0 || selectedVillas.includes(entry.villa)) &&
               (selectedBlocks.length === 0 || selectedBlocks.includes(entry.blocknum)) &&
               (selectedStages.length === 0 || selectedStages.includes(entry.stage));
    }).sort((a, b) => a.item.localeCompare(b.item));

    if (startDate !== currentStart || endDate !== currentEnd) {
        $('#dateRange').data('daterangepicker').setStartDate(startDate);
        $('#dateRange').data('daterangepicker').setEndDate(endDate);
    }

    this.updateSummaryCards();
    this.updateCostTrendChart();
    this.updateCategoryPieChart();
    this.updateTopItemsChart();
    this.updateDataTable();
    this.updateProjectMetricsCharts();
}

    isValidDate(date) {
        return date instanceof Date && !isNaN(date.getTime());
    }







updateSummaryCards() {
    
    const filteredData = this.currentFilteredData;
    const filteredDataActual = this.currentFilteredDataActual;
    const filteredDataactualwithoutdates=this.currentFilteredDataActualwithoutdates;
    const filteredDatawithoutdates= this.currentFilteredDatawithoutdates;
    const dateRange = $('#dateRange').data('daterangepicker');
    const endDate = dateRange.endDate.toDate();
    const normalDate = new Date(endDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-');

    // 1. Calculate all base metrics
    const originalTotalPlanned = this.constructionData.reduce((sum, entry) => sum + entry.cost, 0);
    const originalTotalActual = this.constructionDataActual.reduce((sum, entry) => sum + entry.cost, 0);
    const filteredPlannedCost = this.currentFilteredDatawithoutdates
  .filter(entry => {
    // Keep entries where the start date is on or before endDate.
    return new Date(entry.date) <= endDate;
  })
  .reduce((sum, entry) => {
    const startDate = new Date(entry.date);
    const finishDate = entry.finishDate ? new Date(entry.finishDate) : null;

    let adjustedCost = 0;

    // Normalize endDate to the end of the day to ensure it includes the full day.
    const normalizedEndDate = new Date(endDate);
    normalizedEndDate.setHours(23, 59, 59, 999);

    /**
     * Helper function to count working days between two dates (inclusive).
     * Excludes Fridays (day 5 in JavaScript's getDay(), where Sunday is 0).
     * @param {Date} start The start date.
     * @param {Date} end The end date.
     * @returns {number} The number of working days.
     */
    const countWorkingDays = (start, end) => {
      let count = 0;
      const current = new Date(start);
      current.setHours(0, 0, 0, 0); // Normalize to start of day for iteration

      const endDay = new Date(end);
      endDay.setHours(23, 59, 59, 999); // Normalize to end of day for iteration

      while (current <= endDay) {
        const dayOfWeek = current.getDay(); // 0 = Sunday, 1 = Monday, ..., 5 = Friday, 6 = Saturday
        if (dayOfWeek !== 5) { // If it's not a Friday
          count++;
        }
        current.setDate(current.getDate() + 1); // Move to the next day
      }
      return count;
    };

    // Case 1: Entry has a defined finish date
    if (finishDate) {
      // Normalize finishDate to the end of the day for consistent comparisons
      finishDate.setHours(23, 59, 59, 999);

      // If the entry's finish date is on or before the normalizedEndDate,
      // it means the activity is fully completed by or on endDate.
      if (finishDate <= normalizedEndDate) {
        adjustedCost = entry.cost;
      } else {
        // The activity finishes *after* the normalizedEndDate, so we need to prorate.
        startDate.setHours(0, 0, 0, 0); // Normalize startDate

        const totalWorkingDays = countWorkingDays(startDate, finishDate);
        const elapsedWorkingDays = countWorkingDays(startDate, normalizedEndDate);

        // Prevent division by zero and ensure positive durations.
        if (totalWorkingDays > 0 && elapsedWorkingDays >= 0) {
          adjustedCost = (elapsedWorkingDays / totalWorkingDays) * entry.cost;
        } else if (elapsedWorkingDays < 0) {
          // This case should ideally not happen if startDate <= normalizedEndDate
          adjustedCost = 0;
        } else {
          // Edge case: totalWorkingDays is 0 (e.g., activity is only on a Friday, or start/finish are same Friday)
          // If the entry spans only non-working days or total duration is zero,
          // and endDate also falls within these non-working days relative to the entry, adjusted cost is 0.
          // If startDate is a working day and endDate is on or after it, then consider full cost IF it's a single working day activity.
          // This specific 'else' branch for totalWorkingDays <= 0 needs careful handling.
          // For activities spanning only a Friday, its total working days would be 0.
          // If a task is scheduled for only one day and that day is a Friday, and normalizedEndDate covers it:
          // countWorkingDays will be 0 for total and elapsed.
          // In such a case, if startDate is a Friday and finishDate is the same Friday,
          // and normalizedEndDate is on or after that Friday, what should be the cost?
          // The current logic means no cost. If you want to include cost for single-day Friday tasks if endDate covers it,
          // you'd need another specific check here. Assuming 'no cost on Fridays' means no work, so no cost.
          adjustedCost = 0; // If there are no working days in total duration, or calculation issues
        }
      }
    } else {
      // Case 2: Entry has no defined finish date.
      // If no finish date, and its start date is met by endDate, assume full cost.
      // This is because we assume the activity is ongoing and its cost is fully incurred
      // for the period it's relevant, regardless of working days if it's open-ended.
      adjustedCost = entry.cost;
    }

    return sum + adjustedCost;
  }, 0);
    const filteredActualCost = filteredDataActual.reduce((sum, entry) => sum + entry.cost, 0);

    // NEW: Calculate planned costs up to the filtered end date (ignoring other filters)


const plannedToDate = this.constructionData
  .filter(entry => {
    // Keep entries where the start date is on or before endDate.
    return new Date(entry.date) <= endDate;
  })
  .reduce((sum, entry) => {
    const startDate = new Date(entry.date);
    const finishDate = entry.finishDate ? new Date(entry.finishDate) : null;

    let adjustedCost = 0;

    // Normalize endDate to the end of the day to ensure it includes the full day.
    const normalizedEndDate = new Date(endDate);
    normalizedEndDate.setHours(23, 59, 59, 999);

    /**
     * Helper function to count working days between two dates (inclusive).
     * Excludes Fridays (day 5 in JavaScript's getDay(), where Sunday is 0).
     * @param {Date} start The start date.
     * @param {Date} end The end date.
     * @returns {number} The number of working days.
     */
    const countWorkingDays = (start, end) => {
      let count = 0;
      const current = new Date(start);
      current.setHours(0, 0, 0, 0); // Normalize to start of day for iteration

      const endDay = new Date(end);
      endDay.setHours(23, 59, 59, 999); // Normalize to end of day for iteration

      while (current <= endDay) {
        const dayOfWeek = current.getDay(); // 0 = Sunday, 1 = Monday, ..., 5 = Friday, 6 = Saturday
        if (dayOfWeek !== 5) { // If it's not a Friday
          count++;
        }
        current.setDate(current.getDate() + 1); // Move to the next day
      }
      return count;
    };

    // Case 1: Entry has a defined finish date
    if (finishDate) {
      // Normalize finishDate to the end of the day for consistent comparisons
      finishDate.setHours(23, 59, 59, 999);

      // If the entry's finish date is on or before the normalizedEndDate,
      // it means the activity is fully completed by or on endDate.
      if (finishDate <= normalizedEndDate) {
        adjustedCost = entry.cost;
      } else {
        // The activity finishes *after* the normalizedEndDate, so we need to prorate.
        startDate.setHours(0, 0, 0, 0); // Normalize startDate

        const totalWorkingDays = countWorkingDays(startDate, finishDate);
        const elapsedWorkingDays = countWorkingDays(startDate, normalizedEndDate);

        // Prevent division by zero and ensure positive durations.
        if (totalWorkingDays > 0 && elapsedWorkingDays >= 0) {
          adjustedCost = (elapsedWorkingDays / totalWorkingDays) * entry.cost;
        } else if (elapsedWorkingDays < 0) {
          // This case should ideally not happen if startDate <= normalizedEndDate
          adjustedCost = 0;
        } else {
          // Edge case: totalWorkingDays is 0 (e.g., activity is only on a Friday, or start/finish are same Friday)
          // If the entry spans only non-working days or total duration is zero,
          // and endDate also falls within these non-working days relative to the entry, adjusted cost is 0.
          // If startDate is a working day and endDate is on or after it, then consider full cost IF it's a single working day activity.
          // This specific 'else' branch for totalWorkingDays <= 0 needs careful handling.
          // For activities spanning only a Friday, its total working days would be 0.
          // If a task is scheduled for only one day and that day is a Friday, and normalizedEndDate covers it:
          // countWorkingDays will be 0 for total and elapsed.
          // In such a case, if startDate is a Friday and finishDate is the same Friday,
          // and normalizedEndDate is on or after that Friday, what should be the cost?
          // The current logic means no cost. If you want to include cost for single-day Friday tasks if endDate covers it,
          // you'd need another specific check here. Assuming 'no cost on Fridays' means no work, so no cost.
          adjustedCost = 0; // If there are no working days in total duration, or calculation issues
        }
      }
    } else {
      // Case 2: Entry has no defined finish date.
      // If no finish date, and its start date is met by endDate, assume full cost.
      // This is because we assume the activity is ongoing and its cost is fully incurred
      // for the period it's relevant, regardless of working days if it's open-ended.
      adjustedCost = entry.cost;
    }

    return sum + adjustedCost;
  }, 0);


    const actualToDate = this.constructionDataActual
        .filter(entry => new Date(entry.date) <= endDate)
        .reduce((sum, entry) => sum + entry.cost, 0);

    // Calculate total budget cost for filtered items (independent of dates)
     const uniqueFilteredItems = [...new Set(
        this.constructionData
            .filter(entry => {
                // Apply the same filter logic as in updateDashboard but without date check
                const selectedCategories = Array.from(document.getElementById("categoryFilter").selectedOptions)
                    .map(option => option.value)
                    .filter(val => val !== "");
                const selectedItems = Array.from(document.getElementById("itemFilter").selectedOptions)
                    .map(option => option.value)
                    .filter(val => val !== "");
                const selectedVillas = Array.from(document.getElementById("villaFilter").selectedOptions)
                    .map(option => option.value)
                    .filter(val => val !== "");
                const selectedBlocks = Array.from(document.getElementById("blocknumFilter").selectedOptions)
                    .map(option => option.value)
                    .filter(val => val !== "");
                const selectedStages = Array.from(document.getElementById("stageFilter").selectedOptions)
                    .map(option => option.value)
                    .filter(val => val !== "");

                return (selectedCategories.length === 0 || selectedCategories.includes(entry.category)) &&
                       (selectedItems.length === 0 || selectedItems.includes(entry.item)) &&
                       (selectedVillas.length === 0 || selectedVillas.includes(entry.villa)) &&
                       (selectedBlocks.length === 0 || selectedBlocks.includes(entry.blocknum)) &&
                       (selectedStages.length === 0 || selectedStages.includes(entry.stage));
            })
            .map(entry => entry.item)
    )].filter(Boolean);

  
        const totalBudgetForFilteredItemswithoutdates = this.constructionData
    .filter(entry => {
        // Apply all current filters except date
        const selectedCategories = Array.from(document.getElementById("categoryFilter").selectedOptions)
            .map(option => option.value)
            .filter(val => val !== "");
        const selectedItems = Array.from(document.getElementById("itemFilter").selectedOptions)
            .map(option => option.value)
            .filter(val => val !== "");
        const selectedVillas = Array.from(document.getElementById("villaFilter").selectedOptions)
            .map(option => option.value)
            .filter(val => val !== "");
        const selectedBlocks = Array.from(document.getElementById("blocknumFilter").selectedOptions)
            .map(option => option.value)
            .filter(val => val !== "");
        const selectedStages = Array.from(document.getElementById("stageFilter").selectedOptions)
            .map(option => option.value)
            .filter(val => val !== "");

        // Check if entry matches all active filters
        const categoryMatch = selectedCategories.length === 0 || selectedCategories.includes(entry.category);
        const itemMatch = selectedItems.length === 0 || selectedItems.includes(entry.item);
        const villaMatch = selectedVillas.length === 0 || selectedVillas.includes(entry.villa);
        const blockMatch = selectedBlocks.length === 0 || selectedBlocks.includes(entry.blocknum);
        const stageMatch = selectedStages.length === 0 || selectedStages.includes(entry.stage);

        return categoryMatch && itemMatch && villaMatch && blockMatch && stageMatch;
    })
    .reduce((sum, entry) => sum + entry.cost, 0);
  
    // Calculate total actual cost for filtered items (independent of dates)
    const totalActualForFilteredItemswithoutdates = this.constructionDataActual
    .filter(entry => {
        // Apply all current filters except date
        const selectedCategories = Array.from(document.getElementById("categoryFilter").selectedOptions)
            .map(option => option.value)
            .filter(val => val !== "");
        const selectedItems = Array.from(document.getElementById("itemFilter").selectedOptions)
            .map(option => option.value)
            .filter(val => val !== "");
        const selectedVillas = Array.from(document.getElementById("villaFilter").selectedOptions)
            .map(option => option.value)
            .filter(val => val !== "");
        const selectedBlocks = Array.from(document.getElementById("blocknumFilter").selectedOptions)
            .map(option => option.value)
            .filter(val => val !== "");
        const selectedStages = Array.from(document.getElementById("stageFilter").selectedOptions)
            .map(option => option.value)
            .filter(val => val !== "");

        // Check if entry matches all active filters
        const categoryMatch = selectedCategories.length === 0 || selectedCategories.includes(entry.category);
        const itemMatch = selectedItems.length === 0 || selectedItems.includes(entry.item);
        const villaMatch = selectedVillas.length === 0 || selectedVillas.includes(entry.villa);
        const blockMatch = selectedBlocks.length === 0 || selectedBlocks.includes(entry.blocknum);
        const stageMatch = selectedStages.length === 0 || selectedStages.includes(entry.stage);

        return categoryMatch && itemMatch && villaMatch && blockMatch && stageMatch;
    })
    .reduce((sum, entry) => sum + entry.cost, 0);













// Replace the existing calculation with:
this.dailyMetrics = this.calculateDailyCostMetrics(filteredData);
const avgPlannedDaily = this.dailyMetrics.avgPlannedDaily;
const peakPlannedDay = this.dailyMetrics.peakPlannedDay;
const plannedDailyCosts = this.dailyMetrics.plannedDailyCosts;


this.dailyMetrics = this.calculateDailyCostMetrics(filteredDataActual,true);
const avgActualDaily = this.dailyMetrics.avgPlannedDaily;
const peakActualDay = this.dailyMetrics.peakPlannedDay;
const actualDailyCosts = this.dailyMetrics.plannedDailyCosts;

    // 2. Calculate daily metrics
    const actualDays = [...new Set(filteredDataActual.map(entry => entry.date.toISOString().split('T')[0]))].length;
    // const avgActualDaily = actualDays > 0 ? filteredActualCost / actualDays : 0;

    // 3. Calculate peak day costs
    // const actualDailyCosts = {};






    // filteredDataActual.forEach(entry => {
    //     const dateStr = entry.date.toISOString().split('T')[0];
    //     actualDailyCosts[dateStr] = (actualDailyCosts[dateStr] || 0) + entry.cost;
    // });
    // const peakActualDay = Object.values(actualDailyCosts).length > 0 ? Math.max(...Object.values(actualDailyCosts)) : 0;

    // 4. Calculate all percentages
    const percentPlannedAllProject = originalTotalPlanned > 0 ? (filteredPlannedCost / originalTotalPlanned * 100).toFixed(2) : 0;
    const percentActualAllProject = originalTotalPlanned > 0 ? (originalTotalActual / originalTotalPlanned * 100).toFixed(2) : 0;
    const percentActualFiltered = filteredActualCost > 0 ? (filteredActualCost / totalBudgetForFilteredItemswithoutdates * 100).toFixed(2) : 0;
    const percentPlannedFiltered = filteredPlannedCost > 0 ? (filteredPlannedCost / totalBudgetForFilteredItemswithoutdates * 100).toFixed(2) : 0;
    const percentPlannedToDate = originalTotalPlanned > 0 ? (plannedToDate / originalTotalPlanned * 100).toFixed(2) : 0;
    const percentActualToDate = originalTotalPlanned > 0 ? (actualToDate / originalTotalPlanned * 100).toFixed(2) : 0;
    const percentActualOfTotalBudgetForItemswithoutdates = totalBudgetForFilteredItemswithoutdates > 0 ? 
        (totalActualForFilteredItemswithoutdates / totalBudgetForFilteredItemswithoutdates * 100).toFixed(2) : 0;
    const percentWeightForFilteredItemswithoutdates = totalBudgetForFilteredItemswithoutdates > 0 ? 
        (totalBudgetForFilteredItemswithoutdates / originalTotalPlanned * 100).toFixed(2) : 0;
        const percentWeightactualForFilteredItemswithoutdates = totalBudgetForFilteredItemswithoutdates > 0 ? 
        (totalActualForFilteredItemswithoutdates / originalTotalPlanned * 100).toFixed(2) : 0;


//pie charts
this.totalProjectActualPercentValue = parseFloat(percentActualAllProject);
    this.percentPlannedToDateValue = parseFloat(percentPlannedToDate);
    this.percentActualToDateValue = parseFloat(percentActualToDate);
    this.percentPlannedFilteredValue = parseFloat(percentPlannedFiltered);
    this.percentActualFilteredValue = parseFloat(percentActualFiltered);







    // 5. Items count
    const activitiesCount = uniqueFilteredItems.length;
  
    // 6. Update all cards in one function
    document.getElementById("totalCosts").innerHTML = `
        <div class="metric-section">
            <h4><strong>Project Totals</strong></h4>
            <div class="metric-row">
                <span class="metric-label">Total Project Budget :</span> 
                <span class="metric-value">${originalTotalPlanned.toLocaleString('en-US')} SAR</span>
            </div>
            <div class="metric-row">
                <span class="metric-label">Total Project Actual cost :</span> 
                <span class="metric-value">${originalTotalActual.toLocaleString('en-US')} SAR</span>
            </div>
            <div class="metric-row">
                <span class="metric-label">Total Project Actual percent:</span> 
                <span class="metric-value">${percentActualAllProject}%</span>
            </div>
        </div>
    `;
    
    document.getElementById("totalCostsuptodate").innerHTML = `
        <div class="metric-section">
            <h4> <strong>Total Project Up To Date :   ${normalDate}</strong></h4>
            <div class="metric-row">
                <span class="metric-label">Project Planned Cost:</span> 
                <span class="metric-value">${plannedToDate.toLocaleString('en-US')} SAR </span>
            </div>
            <div class="metric-row">
                <span class="metric-label">Project Actual Cost:</span> 
                <span class="metric-value">${actualToDate.toLocaleString('en-US')} SAR </span>
            </div>
            <div class="metric-row">
                <span class="metric-label">Project Planned  :</span> 
                <span class="metric-value">${percentPlannedToDate}%</span>
            </div>
            <div class="metric-row">
                <span class="metric-label">Project Actual  :</span> 
                <span class="metric-value">${percentActualToDate}%</span>
            </div>
            <div class="metric-row">
                <span class="metric-label">Project SPI :</span> 
                <span class="metric-value">${(percentActualToDate/percentPlannedToDate).toFixed(2)}</span>
            </div>
        </div> 
    `;
    
    document.getElementById("Filteredcost").innerHTML = `
        <div class="metric-section">
            <h4>Filtered Analysis Totals</h4>
            <div class="metric-row">
                <span class="metric-label">Total Budget for Filtered Items:</span> 
                <span class="metric-value">${totalBudgetForFilteredItemswithoutdates.toLocaleString('en-US')} SAR</span>
            </div>
            <div class="metric-row">
                <span class="metric-label">ًWeight for all project  for Filtered Items:</span> 
                <span class="metric-value">${percentWeightForFilteredItemswithoutdates}%</span>
            </div>
             <div class="metric-row">
                <span class="metric-label">Total Actual for Filtered Items:</span> 
                <span class="metric-value">${totalActualForFilteredItemswithoutdates.toLocaleString('en-US')} SAR</span>
            </div>
            <div class="metric-row">
                <span class="metric-label">ًActual % for all project  for Filtered Items:</span> 
                <span class="metric-value">${percentWeightactualForFilteredItemswithoutdates}%</span>
            </div>
            <div class="metric-row">
                <span class="metric-label">Actual % of Items Weight:</span> 
                <span class="metric-value">${percentActualOfTotalBudgetForItemswithoutdates}%</span>
            </div>
          
        </div>
    `;
    document.getElementById("Filteredcostuptodate").innerHTML = `
        <div class="metric-section">
            <h4>Filtered Analysis up to date</h4>
          
            
           
            
            <div class="metric-row">
                <span class="metric-label">Planned Cost (date filtered):</span> 
                <span class="metric-value">${filteredPlannedCost.toLocaleString('en-US')} SAR</span>
            </div>
            <div class="metric-row">
                <span class="metric-label">Actual Cost (date filtered):</span> 
                <span class="metric-value">${filteredActualCost.toLocaleString('en-US')} SAR</span>
            </div>
            <div class="metric-row">
                <span class="metric-label">Planned :</span> 
                <span class="metric-value">${percentPlannedFiltered}%</span>
            </div>
            <div class="metric-row">
                <span class="metric-label">Actual  :</span> 
                <span class="metric-value">${percentActualFiltered}%</span>
            </div>
            <div class="metric-row">
                <span class="metric-label">SPI : </span> 
                <span class="metric-value">${(percentActualFiltered / percentPlannedFiltered).toFixed(2)}</span>
            </div>
            
        </div>
    `;

    document.getElementById("peakDayCost").innerHTML = `
        <div class="metric-section">
            <h4>Daily Averages</h4>
            <div class="metric-row">
                <span class="metric-label">Planned Avg:</span> 
                <span class="metric-value">${avgPlannedDaily.toLocaleString('en-US', { maximumFractionDigits: 1 })} SAR</span>
            </div>
            <div class="metric-row">
                <span class="metric-label">Actual Avg:</span> 
                <span class="metric-value">${avgActualDaily.toLocaleString('en-US', { maximumFractionDigits: 1 })} SAR</span>
            </div>
        </div>
        <div class="metric-section">
            <h4>Peak Day Costs</h4>
            <div class="metric-row">
                <span class="metric-label">Planned Peak:</span> 
                <span class="metric-value">${peakPlannedDay.toLocaleString('en-US', { maximumFractionDigits: 1 })} SAR</span>
            </div>
            <div class="metric-row">
                <span class="metric-label">Actual Peak:</span> 
                <span class="metric-value">${peakActualDay.toLocaleString('en-US', { maximumFractionDigits: 1 })} SAR</span>
            </div>
        </div>
    `;

    document.getElementById("itemsCount").textContent = `Activities Count: ${activitiesCount}`;

// Add date cards
        const formatDate = date => date ? date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-') : 'N/A';
        
        document.getElementById("plannedDatesstart").textContent = `${formatDate(this.minPlannedDate)} `;
        document.getElementById("plannedDatesfinish").textContent = `${formatDate(this.maxPlannedDate)}`;

        document.getElementById("actualDatesstart").textContent = `${formatDate(this.minActualDateView)}`;
        document.getElementById("actualDatesfinish").textContent = `${formatDate(this.maxActualDateView)}`;



}


generateCostTable(periods, periodData, endDate) {
    const table = document.getElementById('costTable');
    if (!table) {
        console.error('Table with ID "costTable" not found');
        return;
    }
    table.innerHTML = '';

    // Helper function to count working days (excluding Fridays)
    const countWorkingDays = (start, end) => {
        let count = 0;
        const current = new Date(start);
        current.setHours(0, 0, 0, 0);
        const endDay = new Date(end);
        endDay.setHours(23, 59, 59, 999);
        while (current <= endDay) {
            if (current.getDay() !== 5) { // Exclude Friday
                count++;
            }
            current.setDate(current.getDate() + 1);
        }
        return count;
    };

    // Initialize table header
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    let headerHTML = '<th>Metric</th>';

    if (this.isWeeklyView) {
        // Weekly view: Generate week periods based on project start date and Thursday endings
        const projectStart = new Date(this.mindate);
        projectStart.setHours(0, 0, 0, 0);
        const projectEnd = new Date(this.maxdate);
        projectEnd.setHours(23, 59, 59, 999);

        // Calculate the first Thursday relative to projectStart
        const startDayOfWeek = projectStart.getDay();
        let daysToThursday = (4 - startDayOfWeek + 7) % 7;
        if (daysToThursday === 0) daysToThursday = 7; // Ensure first week includes start date

        const firstThursday = new Date(projectStart);
        firstThursday.setDate(projectStart.getDate() + daysToThursday);
        firstThursday.setHours(23, 59, 59, 999);

        // Generate week periods
        const weekPeriods = [];
        let currentThursday = new Date(firstThursday);
        let weekNumber = 1;

        while (currentThursday <= projectEnd) {
            const weekStart = new Date(currentThursday);
            weekStart.setDate(currentThursday.getDate() - 6);
            weekStart.setHours(0, 0, 0, 0);
            const weekEnd = new Date(currentThursday);
            weekEnd.setHours(23, 59, 59, 999);

            weekPeriods.push({
                weekNumber: `${weekNumber}`,
                weekStart,
                weekEnd,
                endDate: new Date(weekEnd) // Store end date for table
            });

            currentThursday.setDate(currentThursday.getDate() + 7);
            weekNumber++;
        }

        if (weekPeriods.length === 0) {
            table.innerHTML = '<tr><td colspan="2">No weekly data available</td></tr>';
            return;
        }

        // Calculate prorated costs for each week using filtered data
        const weeklyPeriodData = {};
        weekPeriods.forEach(({ weekNumber, weekStart, weekEnd, endDate }) => {
            const periodKey = weekNumber;
            weeklyPeriodData[periodKey] = {
                totalCost: 0,
                totalCostActual: 0,
                cumulativeCost: 0,
                cumulativeCostActual: 0,
                percentOfTotal: 0,
                percentOfTotalActual: 0,
                cumPercent: 0,
                cumPercentActual: 0,
                endDate // Store end date
            };

            // Prorate planned costs
            this.currentFilteredDatawithoutdates.forEach(entry => {
                const startDate = new Date(entry.date);
                const finishDate = entry.finishDate ? new Date(entry.finishDate) : null;
                let adjustedCost = 0;

                startDate.setHours(0, 0, 0, 0);
                if (finishDate) finishDate.setHours(23, 59, 59, 999);

                // Check if activity overlaps with the week
                if (startDate <= weekEnd && (!finishDate || finishDate >= weekStart)) {
                    const periodStart = new Date(Math.max(startDate, weekStart));
                    const periodEnd = new Date(Math.min(finishDate || weekEnd, weekEnd));
                    periodStart.setHours(0, 0, 0, 0);
                    periodEnd.setHours(23, 59, 59, 999);

                    if (finishDate) {
                        const totalWorkingDays = countWorkingDays(startDate, finishDate);
                        const elapsedWorkingDays = countWorkingDays(periodStart, periodEnd);
                        adjustedCost = totalWorkingDays > 0 ?
                            (elapsedWorkingDays / totalWorkingDays) * entry.cost : 0;
                    } else {
                        if (startDate >= weekStart && startDate <= weekEnd) {
                            adjustedCost = entry.cost;
                        }
                    }
                }
                weeklyPeriodData[periodKey].totalCost += adjustedCost;
            });

            // Actual costs (no proration)
            this.currentFilteredDataActualwithoutdates
                .filter(entry => {
                    const entryDate = new Date(entry.date);
                    return entryDate >= weekStart && entryDate <= weekEnd;
                })
                .forEach(entry => {
                    weeklyPeriodData[periodKey].totalCostActual += entry.cost;
                });
        });

        // Calculate cumulative values and percentages
        let cumulativeTotal = 0;
        let cumulativeTotalActual = 0;
        const grandTotal = this.currentFilteredDatawithoutdates.reduce((sum, entry) => sum + entry.cost, 0);

        weekPeriods.forEach(({ weekNumber }) => {
            const periodKey = weekNumber;
            cumulativeTotal += weeklyPeriodData[periodKey].totalCost;
            weeklyPeriodData[periodKey].cumulativeCost = cumulativeTotal;
            weeklyPeriodData[periodKey].percentOfTotal = grandTotal > 0 ?
                (weeklyPeriodData[periodKey].totalCost / grandTotal) * 100 : 0;
            weeklyPeriodData[periodKey].cumPercent = grandTotal > 0 ?
                (cumulativeTotal / grandTotal) * 100 : 0;

            cumulativeTotalActual += weeklyPeriodData[periodKey].totalCostActual;
            weeklyPeriodData[periodKey].cumulativeCostActual = cumulativeTotalActual;
            weeklyPeriodData[periodKey].percentOfTotalActual = grandTotal > 0 ?
                (weeklyPeriodData[periodKey].totalCostActual / grandTotal) * 100 : 0;
            weeklyPeriodData[periodKey].cumPercentActual = grandTotal > 0 ?
                (cumulativeTotalActual / grandTotal) * 100 : 0;
        });

        // Set headers
        weekPeriods.forEach(({ weekNumber }) => {
            headerHTML += `<th>Week ${weekNumber}</th>`;
        });
        headerRow.innerHTML = headerHTML;
        thead.appendChild(headerRow);

        // Add End Date row
        const dateRow = document.createElement('tr');
        let dateHTML = '<th>End Date</th>';
        weekPeriods.forEach(({ endDate }) => {
            const dateLabel = endDate ? endDate.toLocaleDateString('en-US', {
                month: 'short', day: 'numeric', year: 'numeric'
            }) : 'N/A';
            dateHTML += `<th>${dateLabel}</th>`;
        });
        dateRow.innerHTML = dateHTML;
        thead.appendChild(dateRow);

        table.appendChild(thead);

        // Define table body rows
        const tbody = document.createElement('tbody');
        const rows = [
            ['Planned Cost (SAR)', weekPeriods.map(({ weekNumber }) => {
                const value = weeklyPeriodData[weekNumber]?.totalCost ?? 0;
                return value.toLocaleString('en-US', { style: 'currency', currency: 'SAR' });
            })],
            ['Actual Cost (SAR)', weekPeriods.map(({ weekNumber }) => {
                const value = weeklyPeriodData[weekNumber]?.totalCostActual ?? 0;
                return value.toLocaleString('en-US', { style: 'currency', currency: 'SAR' });
            })],
            ['Planned Cumulative Cost (SAR)', weekPeriods.map(({ weekNumber }) => {
                const value = weeklyPeriodData[weekNumber]?.cumulativeCost ?? 0;
                return value.toLocaleString('en-US', { style: 'currency', currency: 'SAR' });
            })],
            ['Actual Cumulative Cost (SAR)', weekPeriods.map(({ weekNumber }) => {
                const value = weeklyPeriodData[weekNumber]?.cumulativeCostActual ?? 0;
                return value.toLocaleString('en-US', { style: 'currency', currency: 'SAR' });
            })],
            ['separator', []],
            ['Planned Period %', weekPeriods.map(({ weekNumber }) => {
                const value = weeklyPeriodData[weekNumber]?.percentOfTotal ?? 0;
                return value.toFixed(2) + '%';
            })],
            ['Actual Period %', weekPeriods.map(({ weekNumber }) => {
                const value = weeklyPeriodData[weekNumber]?.percentOfTotalActual ?? 0;
                return value.toFixed(2) + '%';
            })],
            ['Planned Cumulative %', weekPeriods.map(({ weekNumber }) => {
                const value = weeklyPeriodData[weekNumber]?.cumPercent ?? 0;
                return value.toFixed(2) + '%';
            })],
            ['Actual Cumulative %', weekPeriods.map(({ weekNumber }) => {
                const value = weeklyPeriodData[weekNumber]?.cumPercentActual ?? 0;
                return value.toFixed(2) + '%';
            })]
        ];

        // Create and append each row
        rows.forEach(([label, values]) => {
            const row = document.createElement('tr');
            if (label === 'separator') {
                row.className = 'separator';
                row.innerHTML = `<td colspan="${weekPeriods.length + 1}"></td>`;
                tbody.appendChild(row);
            } else {
                const isCostRow = label.includes('Cost');
                const className = isCostRow ? 'cost' : 'percent';
                let rowHTML = `<th scope="row" class="${className}">${label}</th>`;
                values.forEach(value => {
                    rowHTML += `<td class="${className}">${value}</td>`;
                });
                row.innerHTML = rowHTML;
                tbody.appendChild(row);
            }
        });
        table.appendChild(tbody);

    } else {
        // Monthly view (unchanged from original)
        periods.forEach(period => {
            const [year, month] = period.split('-');
            const periodLabel = new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
            headerHTML += `<th>${periodLabel}</th>`;
        });
        headerRow.innerHTML = headerHTML;
        thead.appendChild(headerRow);

        // Add End Date row for monthly view
        const dateRow = document.createElement('tr');
        let dateHTML = '<th>End Date</th>';
        periods.forEach(period => {
            const [year, month] = period.split('-');
            const monthEnd = new Date(year, Number(month), 0);
            const dateLabel = monthEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            dateHTML += `<th>${dateLabel}</th>`;
        });
        dateRow.innerHTML = dateHTML;
        thead.appendChild(dateRow);

        table.appendChild(thead);

        const grandTotal = this.currentFilteredDatawithoutdates.reduce((sum, entry) => sum + entry.cost, 0);
        periods.forEach(period => {
            if (!periodData[period]) {
                periodData[period] = {
                    totalCost: 0,
                    totalCostActual: 0,
                    cumulativeCost: 0,
                    cumulativeCostActual: 0,
                    percentOfTotal: 0,
                    cumPercent: 0,
                    percentOfTotalActual: 0,
                    cumPercentActual: 0
                };
            }
        });

        const tbody = document.createElement('tbody');
        const rows = [
            ['Planned Cost (SAR)', periods.map(p => {
                const value = periodData[p]?.totalCost ?? 0;
                return value.toLocaleString('en-US', { style: 'currency', currency: 'SAR' });
            })],
            ['Actual Cost (SAR)', periods.map(p => {
                const value = periodData[p]?.totalCostActual ?? 0;
                return value.toLocaleString('en-US', { style: 'currency', currency: 'SAR' });
            })],
            ['Planned Cumulative Cost (SAR)', periods.map(p => {
                const value = periodData[p]?.cumulativeCost ?? 0;
                return value.toLocaleString('en-US', { style: 'currency', currency: 'SAR' });
            })],
            ['Actual Cumulative Cost (SAR)', periods.map(p => {
                const value = periodData[p]?.cumulativeCostActual ?? 0;
                return value.toLocaleString('en-US', { style: 'currency', currency: 'SAR' });
            })],
            ['separator', []],
            ['Planned Period %', periods.map(p => {
                const value = periodData[p]?.percentOfTotal ?? 0;
                return value.toFixed(2) + '%';
            })],
            ['Actual Period %', periods.map(p => {
                const value = periodData[p]?.percentOfTotalActual ?? 0;
                return value.toFixed(2) + '%';
            })],
            ['Planned Cumulative %', periods.map(p => {
                const value = periodData[p]?.cumPercent ?? 0;
                return value.toFixed(2) + '%';
            })],
            ['Actual Cumulative %', periods.map(p => {
                const value = periodData[p]?.cumPercentActual ?? 0;
                return value.toFixed(2) + '%';
            })]
        ];

        rows.forEach(([label, values]) => {
            const row = document.createElement('tr');
            if (label === 'separator') {
                row.className = 'separator';
                row.innerHTML = `<td colspan="${periods.length + 1}"></td>`;
                tbody.appendChild(row);
            } else {
                const isCostRow = label.includes('Cost');
                const className = isCostRow ? 'cost' : 'percent';
                let rowHTML = `<th scope="row" class="${className}">${label}</th>`;
                values.forEach(value => {
                    rowHTML += `<td class="${className}">${value}</td>`;
                });
                row.innerHTML = rowHTML;
                tbody.appendChild(row);
            }
        });
        table.appendChild(tbody);
    }
}

updateCostTrendChart() {
        const data = this.currentFilteredDatawithoutdates;
        const dataActual = this.currentFilteredDataActual;
        if (data.length === 0 && dataActual.length === 0) return;

        const dateRange = $('#dateRange').data('daterangepicker');
        const endDate = dateRange.endDate.toDate();

        // Helper function to count working days (excluding Fridays)
        const countWorkingDays = (start, end) => {
            let count = 0;
            const current = new Date(start);
            current.setHours(0, 0, 0, 0);
            const endDay = new Date(end);
            endDay.setHours(23, 59, 59, 999);
            while (current <= endDay) {
                if (current.getDay() !== 5) { // Exclude Friday
                    count++;
                }
                current.setDate(current.getDate() + 1);
            }
            return count;
        };

        const periodData = {};
        const allPeriodKeys = new Set();

        // Aggregate data by month for the chart
        data.forEach(entry => {
            const startDate = new Date(entry.date);
            const finishDate = entry.finishDate ? new Date(entry.finishDate) : null;
            const entryStartMonth = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}`;
            const entryEndMonth = finishDate ? `${finishDate.getFullYear()}-${String(finishDate.getMonth() + 1).padStart(2, '0')}` : null;

            // Determine the range of months this entry spans
            let currentMonth = new Date(startDate);
            currentMonth.setDate(1);
            currentMonth.setHours(0, 0, 0, 0);
            const endMonth = finishDate ? new Date(finishDate.getFullYear(), finishDate.getMonth() + 1, 0) : new Date(endDate);
            endMonth.setHours(23, 59, 59, 999);

            while (currentMonth <= endMonth && currentMonth <= endDate) {
                const periodKey = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}`;
                allPeriodKeys.add(periodKey);
                if (!periodData[periodKey]) {
                    periodData[periodKey] = { totalCost: 0, totalCostActual: 0, cumulativeCost: 0, cumulativeCostActual: 0 };
                }

                // Calculate prorated cost for this month
                let adjustedCost = 0;
                const monthStart = new Date(currentMonth);
                const monthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
                monthEnd.setHours(23, 59, 59, 999);
                const normalizedEndDate = new Date(Math.min(monthEnd, endDate));

                if (startDate <= normalizedEndDate) {
                    if (finishDate) {
                        finishDate.setHours(23, 59, 59, 999);
                        const periodStart = new Date(Math.max(startDate, monthStart));
                        periodStart.setHours(0, 0, 0, 0);
                        const periodEnd = new Date(Math.min(finishDate, normalizedEndDate));
                        periodEnd.setHours(23, 59, 59, 999);

                        const totalWorkingDays = countWorkingDays(startDate, finishDate);
                        const elapsedWorkingDays = countWorkingDays(periodStart, periodEnd);
                        adjustedCost = totalWorkingDays > 0 ? (elapsedWorkingDays / totalWorkingDays) * entry.cost : 0;
                    } else {
                        // No finish date; include full cost if startDate is in or before this month
                        if (startDate <= monthEnd) {
                            adjustedCost = entry.cost;
                        }
                    }
                }
                periodData[periodKey].totalCost += adjustedCost;

                // Move to next month
                currentMonth.setMonth(currentMonth.getMonth() + 1);
            }
        });

        // Actual costs (no proration, as per updateSummaryCards)
        dataActual.forEach(entry => {
            const date = new Date(entry.date);
            const periodKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            allPeriodKeys.add(periodKey);
            if (!periodData[periodKey]) {
                periodData[periodKey] = { totalCost: 0, totalCostActual: 0, cumulativeCost: 0, cumulativeCostActual: 0 };
            }
            periodData[periodKey].totalCostActual += entry.cost;
        });

        // Sort periods chronologically
        const periods = Array.from(allPeriodKeys).sort((a, b) => {
            const [yearA, monthA] = a.split('-').map(n => parseInt(n));
            const [yearB, monthB] = b.split('-').map(n => parseInt(n));
            return yearA !== yearB ? yearA - yearB : monthA - monthB;
        });

        const grandTotal = this.currentFilteredDatawithoutdates.reduce((sum, entry) => sum + entry.cost, 0);
        if (grandTotal === 0) {
            console.warn("Grand total of planned cost is zero. Percentage calculations will be zero.");
        }
        const grandTotalActual = this.currentFilteredDataActualwithoutdates.reduce((sum, entry) => sum + entry.cost, 0);

        // Calculate cumulative values and percentages
        let cumulativeTotal = 0;
        let cumulativeTotalActual = 0;
        let plannedHasCompleted = false;
        periods.forEach(period => {
            const periodInfo = periodData[period] || { totalCost: 0, totalCostActual: 0, cumulativeCost: 0, cumulativeCostActual: 0 };

            cumulativeTotal += periodInfo.totalCost;
            periodInfo.cumulativeCost = cumulativeTotal;
            periodInfo.percentOfTotal = grandTotal > 0 ? (periodInfo.totalCost / grandTotal) * 100 : 0;
            periodInfo.cumPercent = grandTotal > 0 ? (cumulativeTotal / grandTotal) * 100 : 0;

            cumulativeTotalActual += periodInfo.totalCostActual;
            periodInfo.cumulativeCostActual = cumulativeTotalActual;
            periodInfo.percentOfTotalActual = grandTotal > 0 ? (periodInfo.totalCostActual / grandTotal) * 100 : 0;
            periodInfo.cumPercentActual = grandTotal> 0 ? (cumulativeTotalActual / grandTotal) * 100 : 0;

            if (plannedHasCompleted) {
                periodInfo.totalCost = 0;
                periodInfo.percentOfTotal = 0;
                periodInfo.cumulativeCost = grandTotal;
                periodInfo.cumPercent = 100;
            } else if (periodInfo.cumPercent >= 100) {
                plannedHasCompleted = true;
                periodInfo.cumulativeCost = grandTotal;
                periodInfo.cumPercent = 100;
            }
        });

        // Generate table
        this.generateCostTable(periods, periodData, endDate);

        // Prepare chart data (monthly only)
        const periodLabels = periods.map(p => {
            const [year, month] = p.split('-');
            return new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        });

        const datasets = [
            { 
                label: 'Monthly Planned Cost (SAR)', 
                data: periods.map(p => periodData[p].totalCost || 0), 
                backgroundColor: 'rgba(54, 162, 235, 0.7)', 
                borderColor: 'rgba(54, 162, 235, 1)', 
                yAxisID: 'y' 
            },
            { 
                label: 'Monthly Actual Cost (SAR)', 
                data: periods.map(p => periodData[p].totalCostActual || 0), 
                backgroundColor: 'rgba(75, 192, 192, 0.7)', 
                borderColor: 'rgba(75, 192, 192, 1)', 
                yAxisID: 'y' 
            },
            { 
                label: 'Planned Cumulative Cost (SAR)', 
                data: periods.map(p => periodData[p].cumulativeCost || 0), 
                borderColor: 'rgba(255, 99, 132, 1)', 
                backgroundColor: 'rgba(255, 99, 132, 0.2)', 
                type: 'line', 
                yAxisID: 'y1' 
            },
            { 
                label: 'Actual Cumulative Cost (SAR)', 
                data: periods.map(p => periodData[p].cumulativeCostActual || 0), 
                borderColor: 'rgba(153, 102, 255, 1)', 
                backgroundColor: 'rgba(153, 102, 255, 0.2)', 
                type: 'line', 
                yAxisID: 'y1' 
            }
        ];

        const ctx = document.getElementById('costTrendChart').getContext('2d');
        if (this.costTrendChart) this.costTrendChart.destroy();

        this.costTrendChart = new Chart(ctx, {
            type: 'bar',
            data: { labels: periodLabels, datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { 
                        title: { 
                            display: true, 
                            text: 'Month', 
                            font: { size: 16, weight: 'bold' } 
                        },
                        ticks: { font: { size: 14 } }
                    },
                    y: { 
                        type: 'linear', 
                        position: 'left', 
                        title: { 
                            display: true, 
                            text: 'Monthly Cost (SAR)', 
                            font: { size: 16, weight: 'bold' } 
                        }, 
                        ticks: { 
                            callback: value => value.toLocaleString(),
                            font: { size: 14 } 
                        }, 
                        beginAtZero: true 
                    },
                    y1: { 
                        type: 'linear', 
                        position: 'right', 
                        title: { 
                            display: true, 
                            text: 'Cumulative Cost (SAR)', 
                            font: { size: 16, weight: 'bold' } 
                        }, 
                        ticks: { 
                            callback: value => value.toLocaleString(),
                            font: { size: 14 } 
                        }, 
                        grid: { drawOnChartArea: false }, 
                        beginAtZero: true 
                    }
                },
                plugins: {
                    tooltip: { bodyFont: { size: 14 }, titleFont: { size: 16, weight: 'bold' } },
                    legend: { display: true, position: 'top', labels: { font: { size: 14 } } },
                    datalabels: {
                        display: true,
                        font: { size: 10, weight: 'normal' },
                        formatter: (value, context) => {
                            const periodKey = periods[context.dataIndex];
                            const currentPeriodData = periodData[periodKey] || {};
                            switch (context.datasetIndex) {
                                case 0: return currentPeriodData.percentOfTotal ? `${currentPeriodData.percentOfTotal.toFixed(2)}%` : '0.00%';
                                case 1: return currentPeriodData.percentOfTotalActual ? `${currentPeriodData.percentOfTotalActual.toFixed(2)}%` : '0.00%';
                                case 2: return currentPeriodData.cumPercent ? `${currentPeriodData.cumPercent.toFixed(2)}%` : '0.00%';
                                case 3: return currentPeriodData.cumPercentActual ? `${currentPeriodData.cumPercentActual.toFixed(2)}%` : '0.00%';
                                default: return '';
                            }
                        },
                        color: context => {
                            const colors = ['#FFC000', '#000000', '#00FF00', '#0066FF'];
                            return colors[context.datasetIndex] || '#000000';
                        },
                        anchor: context => context.datasetIndex < 2 ? 'center' : 'end',
                        align: context => context.datasetIndex < 2 ? 'center' : 'top',
                        offset: context => context.datasetIndex < 2 ? 0 : 5
                    }
                }
            },
            plugins: [ChartDataLabels]
        });
    }

    

    getCategoryColor(category) {
    const colorMap = {
        'Civil': '#4e79a7',
        'Mechanical': '#f28e2b',
        'Electerical': '#e15759',
        'Architectural': '#76b7b2',
        'Fence': '#59a14f'
    };
    
    // Return existing color if already assigned
    if (this.categoryColorMap.has(category)) {
        return this.categoryColorMap.get(category);
    }
    
    // Use predefined color or generate a new deterministic color
    let color = colorMap[category];
    if (!color) {
        let hash = 0;
        for (let i = 0; i < category.length; i++) {
            hash = category.charCodeAt(i) + ((hash << 5) - hash);
        }
        color = `hsl(${hash % 360}, 70%, 50%)`;
    }
    
    // Store the color for future consistency
    this.categoryColorMap.set(category, color);
    return color;
}

  updateCategoryPieChart() {
    const data = this.currentFilteredData;
    const dataActual = this.currentFilteredDataActual;
    const datatotal = this.currentFilteredDatawithoutdates; // Total Budget for Filtered Items
    const selectedCategories = Array.from(document.getElementById("categoryFilter").selectedOptions).map(option => option.value);
    const selectedItems = Array.from(document.getElementById("itemFilter").selectedOptions).map(option => option.value);
    const dateRange = $('#dateRange').data('daterangepicker');
    const endDate = dateRange.endDate.toDate();

    /**
     * Helper function to count working days between two dates (inclusive).
     * Excludes Fridays (day 5 in JavaScript's getDay(), where Sunday is 0).
     * @param {Date} start The start date.
     * @param {Date} end The end date.
     * @returns {number} The number of working days.
     */
    const countWorkingDays = (start, end) => {
        let count = 0;
        const current = new Date(start);
        current.setHours(0, 0, 0, 0);

        const endDay = new Date(end);
        endDay.setHours(23, 59, 59, 999);

        while (current <= endDay) {
            const dayOfWeek = current.getDay();
            if (dayOfWeek !== 5) {
                count++;
            }
            current.setDate(current.getDate() + 1);
        }
        return count;
    };

    const filteredDataActual = dataActual.filter(entry => 
        entry.category && 
        (selectedCategories.length === 0 || selectedCategories.includes(entry.category)) && 
        (selectedItems.length === 0 || selectedItems.includes(entry.item))
    );

    const filteredDatatotal = datatotal.filter(entry => 
        entry.category && 
        (selectedCategories.length === 0 || selectedCategories.includes(entry.category)) && 
        (selectedItems.length === 0 || selectedItems.includes(entry.item))
    );

    const filteredData = data.filter(entry => {
        const dateCondition = new Date(entry.date) <= endDate;
        const categoryCondition = entry.category && (selectedCategories.length === 0 || selectedCategories.includes(entry.category));
        const itemCondition = selectedItems.length === 0 || selectedItems.includes(entry.item);
        
        return dateCondition && categoryCondition && itemCondition;
    });

    // Create category data with the adjusted costs
    const categoryData = {};
    const categoryDataActual = {};
    const categoryDatatotal = {}; // This represents the total budget for filtered items

    // Process total budget data (datatotal) - no date filtering, just category/item filtering
    filteredDatatotal.forEach(entry => {
        if (entry.category) {
            categoryDatatotal[entry.category] = (categoryDatatotal[entry.category] || 0) + entry.cost;
        }
    });

    // Process planned data with date and working days adjustments
    filteredData.forEach(entry => {
        const startDate = new Date(entry.date);
        const finishDate = entry.finishDate ? new Date(entry.finishDate) : null;
        let adjustedCost = entry.cost;

        const normalizedEndDate = new Date(endDate);
        normalizedEndDate.setHours(23, 59, 59, 999);

        if (finishDate) {
            finishDate.setHours(23, 59, 59, 999);

            if (finishDate > normalizedEndDate) {
                const totalWorkingDays = countWorkingDays(startDate, finishDate);
                const elapsedWorkingDays = countWorkingDays(startDate, normalizedEndDate);

                if (totalWorkingDays > 0 && elapsedWorkingDays >= 0) {
                    adjustedCost = (elapsedWorkingDays / totalWorkingDays) * entry.cost;
                } else {
                    adjustedCost = 0;
                }
            }
        }

        if (entry.category) {
            categoryData[entry.category] = (categoryData[entry.category] || 0) + adjustedCost;
        }
    });

    // Process actual data
    filteredDataActual.forEach(entry => {
        if (entry.category) {
            categoryDataActual[entry.category] = (categoryDataActual[entry.category] || 0) + entry.cost;
        }
    });

    const categories = [...new Set([...Object.keys(categoryData), ...Object.keys(categoryDataActual), ...Object.keys(categoryDatatotal)])].sort();
    const plannedCosts = categories.map(cat => categoryData[cat] || 0);
    const actualCosts = categories.map(cat => categoryDataActual[cat] || 0);
    const totalBudgetCosts = categories.map(cat => categoryDatatotal[cat] || 0); // Total budget costs
    
    // Calculate totals for each dataset
    const totalPlannedCost = plannedCosts.reduce((sum, cost) => sum + cost, 0);
    const totalActualCost = actualCosts.reduce((sum, cost) => sum + cost, 0);
    const totalBudgetCost = totalBudgetCosts.reduce((sum, cost) => sum + cost, 0); // Total budget

    

    // Precompute colors for all categories
    const categoryColors = categories.map(cat => this.getCategoryColor(cat));

    this.categoryChartData = { categories, plannedCosts, actualCosts, totalBudgetCosts };

    const createPieChart = (ctx, id, costs, chartTotal, title) => {
        if (this[id]) this[id].destroy();
        if (categories.length > 0 && costs.reduce((sum, cost) => sum + cost, 0) > 0) {
            this[id] = new Chart(ctx, {
                type: 'pie',
                data: {
                    labels: categories.map((cat, i) => {
                        const cost = costs[i];
                        const percentage = chartTotal > 0 ? (cost / chartTotal * 100).toFixed(2) : 0;
                        return `${cat} (${cost.toLocaleString()} SAR, ${percentage}%)`;
                    }),
                    datasets: [{
                        data: costs,
                        backgroundColor: categoryColors,
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { 
                            position: id === 'categoryPieChart' ? 'right' : 'left', 
                            labels: { font: { size: 12 }, padding: 20 } 
                        },
                        tooltip: {
                            callbacks: {
                                label: context => {
                                    const label = context.label.split(' (')[0];
                                    const value = context.raw || 0;
                                    const percentage = chartTotal > 0 ? Math.round(value / chartTotal * 100) : 0;
                                    let suffix = '';
                                    if (id === 'categoryPieChartActual') {
                                        suffix = ' of actual total';
                                    } else if (id === 'categoryPieChartTotal') {
                                        suffix = ' of total budget';
                                    }
                                    return `${label}: ${value.toLocaleString()} SAR (${percentage}%${suffix})`;
                                }
                            }
                        },
                        datalabels: {
                            formatter: (value) => {
                                const percentage = chartTotal > 0 ? (value / chartTotal * 100).toFixed(2) : 0;
                                return `${percentage}%`;
                            },
                            color: '#fff',
                            font: { weight: 'bold', size: 12 }
                        }
                    }
                },
                plugins: [ChartDataLabels]
            });
        } else {
            ctx.font = '16px Arial';
            ctx.fillStyle = '#666';
            ctx.textAlign = 'center';
            let chartType = 'planned';
            if (id === 'categoryPieChartActual') chartType = 'actual';
            else if (id === 'categoryPieChartTotal') chartType = 'total budget';
            ctx.fillText(`No ${chartType} data available`, ctx.canvas.width / 2, ctx.canvas.height / 2);
        }
    };

    // Create charts with their respective totals
    createPieChart(document.getElementById('categoryPieChart').getContext('2d'), 'categoryPieChart', plannedCosts, totalBudgetCost, 'Planned');
    createPieChart(document.getElementById('categoryPieChartActual').getContext('2d'), 'categoryPieChartActual', actualCosts, totalBudgetCost, 'Actual');
    
    // If you have a third chart for total budget, create it here:
    // createPieChart(document.getElementById('categoryPieChartTotal').getContext('2d'), 'categoryPieChartTotal', totalBudgetCosts, totalBudgetCost, 'Total Budget');
}

















    updateTopItemsChart() {
    const data = this.currentFilteredData;
    const dataActual = this.currentFilteredDataActual;
    const datatotal = this.currentFilteredDatawithoutdates; // Total Budget for Filtered Items
    const selectedCategories = Array.from(document.getElementById("categoryFilter").selectedOptions).map(option => option.value);
    const selectedItems = Array.from(document.getElementById("itemFilter").selectedOptions).map(option => option.value);
    const dateRange = $('#dateRange').data('daterangepicker');
    const endDate = dateRange.endDate.toDate();

    /**
     * Helper function to count working days between two dates (inclusive).
     * Excludes Fridays (day 5 in JavaScript's getDay(), where Sunday is 0).
     * @param {Date} start The start date.
     * @param {Date} end The end date.
     * @returns {number} The number of working days.
     */
    const countWorkingDays = (start, end) => {
        let count = 0;
        const current = new Date(start);
        current.setHours(0, 0, 0, 0);

        const endDay = new Date(end);
        endDay.setHours(23, 59, 59, 999);

        while (current <= endDay) {
            const dayOfWeek = current.getDay();
            if (dayOfWeek !== 5) {
                count++;
            }
            current.setDate(current.getDate() + 1);
        }
        return count;
    };

    // Filter data based on selected categories and items
    const filteredDataActual = dataActual.filter(entry => 
        entry.item && 
        (selectedCategories.length === 0 || selectedCategories.includes(entry.category)) && 
        (selectedItems.length === 0 || selectedItems.includes(entry.item))
    );

    const filteredDatatotal = datatotal.filter(entry => 
        entry.item && 
        (selectedCategories.length === 0 || selectedCategories.includes(entry.category)) && 
        (selectedItems.length === 0 || selectedItems.includes(entry.item))
    );

    const filteredData = data.filter(entry => {
        const dateCondition = new Date(entry.date) <= endDate;
        const categoryCondition = selectedCategories.length === 0 || selectedCategories.includes(entry.category);
        const itemCondition = entry.item && (selectedItems.length === 0 || selectedItems.includes(entry.item));
        
        return dateCondition && categoryCondition && itemCondition;
    });

    const itemData = {};
    const itemDataActual = {};
    const itemDatatotal = {}; // This represents the total budget for filtered items

    // Process total budget data (datatotal) - no date filtering, just category/item filtering
    filteredDatatotal.forEach(entry => {
        if (entry.item) {
            itemDatatotal[entry.item] = (itemDatatotal[entry.item] || { planned: 0, actual: 0, category: entry.category });
            itemDatatotal[entry.item].planned += entry.cost;
            itemDatatotal[entry.item].category = entry.category;
        }
    });

    // Process planned data with date and working days adjustments
    filteredData.forEach(entry => {
        const startDate = new Date(entry.date);
        const finishDate = entry.finishDate ? new Date(entry.finishDate) : null;
        let adjustedCost = entry.cost;

        const normalizedEndDate = new Date(endDate);
        normalizedEndDate.setHours(23, 59, 59, 999);

        if (finishDate) {
            finishDate.setHours(23, 59, 59, 999);

            if (finishDate > normalizedEndDate) {
                const totalWorkingDays = countWorkingDays(startDate, finishDate);
                const elapsedWorkingDays = countWorkingDays(startDate, normalizedEndDate);

                if (totalWorkingDays > 0 && elapsedWorkingDays >= 0) {
                    adjustedCost = (elapsedWorkingDays / totalWorkingDays) * entry.cost;
                } else {
                    adjustedCost = 0;
                }
            }
        }

        if (entry.item) {
            itemData[entry.item] = (itemData[entry.item] || { planned: 0, actual: 0, category: entry.category });
            itemData[entry.item].planned += adjustedCost;
            itemData[entry.item].category = entry.category;
        }
    });

    // Process actual data
    filteredDataActual.forEach(entry => {
        if (entry.item) {
            itemDataActual[entry.item] = (itemDataActual[entry.item] || { planned: 0, actual: 0, category: entry.category });
            itemDataActual[entry.item].actual += entry.cost;
            itemDataActual[entry.item].category = entry.category;
        }
    });

    // Combine all item data, prioritizing total budget for sorting
    const allItems = [...new Set([...Object.keys(itemData), ...Object.keys(itemDataActual), ...Object.keys(itemDatatotal)])];
    
    const combinedItemData = {};
    allItems.forEach(item => {
        combinedItemData[item] = {
            planned: itemData[item]?.planned || 0,
            actual: itemDataActual[item]?.actual || 0,
            totalBudget: itemDatatotal[item]?.planned || 0,
            category: itemData[item]?.category || itemDataActual[item]?.category || itemDatatotal[item]?.category || 'Other'
        };
    });

    // Sort by total budget (not adjusted planned cost) to get top items
    const sortedItems = Object.entries(combinedItemData)
        .sort((a, b) => b[1].totalBudget - a[1].totalBudget)
        .slice(0, 10);

    const items = sortedItems.map(item => item[0]);
    const plannedCosts = sortedItems.map(item => item[1].planned);
    const actualCosts = sortedItems.map(item => item[1].actual);
    const totalBudgetCosts = sortedItems.map(item => item[1].totalBudget);
    const categories = sortedItems.map(item => item[1].category);

    //console.log('Chart Data:', { items, plannedCosts, actualCosts, totalBudgetCosts, categories });

    if (!items.length || !totalBudgetCosts.length) {
        console.error('No data available for top items chart');
        return;
    }

    this.topItemsChartData = { items, plannedCosts, actualCosts, totalBudgetCosts, categories };

    const chartDom = document.getElementById('topItemsChart');
    if (!chartDom) {
        console.error('Chart container topItemsChart not found');
        return;
    }

    if (this.topItemsChart) this.topItemsChart.dispose();
    this.topItemsChart = echarts.init(chartDom);

    const formatNumber = value => value.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    const formatSAR = value => `${formatNumber(value)} SAR`;

    const option = {
        tooltip: {
            trigger: 'axis',
            axisPointer: { type: 'shadow' },
            formatter: params => {
                const index = params[0].dataIndex;
                const totalBudget = totalBudgetCosts[index];
                return `${params[0].name}<br/>` +
                       `Total Budget: ${formatSAR(totalBudget)}<br/>` +
                       `Planned (Adjusted): ${formatSAR(params[0].value)}<br/>` +
                       `Actual: ${formatSAR(params[1].value)}`;
            }
        },
        legend: { 
            data: ['Planned ', 'Actual'], 
            top: '5%', 
            textStyle: { color: '#333', fontSize: 12 } 
        },
        grid: { left: '30%', right: '15%', bottom: '15%', top: '15%', containLabel: true },
        xAxis: {
            type: 'value',
            axisLabel: { formatter: formatNumber, align: 'right', rotate: 45, fontSize: 10, margin: 10 },
            axisLine: { show: true },
            splitLine: { show: true, lineStyle: { color: '#eee' } },
            minInterval: 1000000
        },
        yAxis: {
            type: 'category',
            data: items,
            axisLabel: { interval: 0, align: 'right', margin: 15, fontSize: 11, rotate: 0, width: 200, overflow: 'break', lineHeight: 14 },
            axisTick: { alignWithLabel: true, length: 5 },
            axisLine: { show: true }
        },
        series: [
            {
                name: 'Planned ',
                type: 'bar',
                data: plannedCosts,
                itemStyle: { color: '#aaa' },
                label: { show: true, position: 'right', formatter: params => formatSAR(params.value), color: '#333', fontSize: 10 },
                barWidth: '40%',
                barGap: '30%'
            },
            {
                name: 'Actual',
                type: 'bar',
                data: actualCosts,
                itemStyle: { color: '#b1b' },
                label: { show: true, position: 'right', formatter: params => formatSAR(params.value), color: '#333', fontSize: 10 },
                barWidth: '40%',
                barGap: '30%'
            }
        ]
    };

    this.topItemsChart.setOption(option);

    this.topItemsChart.on('legendselectchanged', params => {
        console.log('Legend select changed:', params);
    });


    const handleResize = () => {
        this.topItemsChart.resize();
        const containerWidth = chartDom.offsetWidth;
        const leftMargin = containerWidth > 600 ? '30%' : '40%';
        const fontSize = containerWidth > 600 ? 11 : 9;
        const labelFontSize = containerWidth > 600 ? 10 : 8;
        const labelWidth = containerWidth > 600 ? 200 : 150;
        this.topItemsChart.setOption({
            grid: { left: leftMargin, right: containerWidth > 600 ? '15%' : '20%' },
            xAxis: { axisLabel: { fontSize: labelFontSize, rotate: containerWidth > 600 ? 45 : 60 } },
            yAxis: { axisLabel: { fontSize, width: labelWidth } },
            legend: { textStyle: { fontSize: containerWidth > 600 ? 12 : 10 } },
            series: [{ label: { fontSize: labelFontSize } }, { label: { fontSize: labelFontSize } }]
        });
    };
    setTimeout(handleResize, 0);
    window.addEventListener('resize', handleResize);

    document.getElementById('downloadTopItemsTableBtn').addEventListener('click', () => this.downloadTopItemsTableAsExcel());
    document.getElementById('downloadTopItemsChartBtn').addEventListener('click', () => this.downloadChartAsImage('topItemsChart', 'top_items_chart'));
}










 updateDataTable() {
    const plannedData = this.currentFilteredData || [];
    const actualData = this.currentFilteredDataActual || [];
    const rowsPerPage = 82;
    this.currentPage = this.currentPage && this.currentPage > 0 ? this.currentPage : 1;

    //console.log('plannedData:', plannedData, 'actualData:', actualData);

    if (!plannedData.length && !actualData.length) {
        const tableBody = document.getElementById('dataTableBody');
        tableBody.innerHTML = '<tr><td colspan="13">No data available</td></tr>';
        document.getElementById('totalCost').textContent = '0.00 SAR';
        document.getElementById('totalCostActual').textContent = '0.00 SAR';
        document.getElementById('totalActualPercent').textContent = '0.00%';
        const paginationContainer = document.getElementById('pagination');
        if (paginationContainer) paginationContainer.remove();
        return;
    }

    if (!this.originalData?.length && plannedData?.length) {
        this.originalData = [...this.constructionData];
        this.originalDataActual = [...this.constructionDataActual];
    }

const _formatDate = date => {
    if (!date) return 'N/A';
    // Format as YYYY-MM-DD without time
    const d = new Date(date);
    return d.toISOString().split('T')[0];
};    const _formatCurrency = amount => (amount || 0).toLocaleString('en-US', { style: 'currency', currency: 'SAR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const _formatPercentage = value => `${(value || 0).toFixed(2)}%`;

    const cacheKey = JSON.stringify({
        planned: plannedData.map(d => `${d.villa}_${d.item}_${d.date}_${d.cost}_${d.category}`),
        actual: actualData.map(d => `${d.villa}_${d.item}_${d.date}_${d.cost}_${d.category}`)
    });

    if (this.lastCacheKey !== cacheKey) {
        this.cachedTableData = null;
        this.lastCacheKey = cacheKey;
    }

    if (!this.cachedTableData) {
        const combinedDataMap = new Map();
        plannedData.forEach(entry => {
            const key = `${entry.villa}_${entry.item}`;
            if (!combinedDataMap.has(key)) {
                combinedDataMap.set(key, {
                    villa: entry.villa || 'N/A',
                    item: entry.item || 'N/A',
                    category: entry.category || 'Uncategorized',
                    plannedDate: null,
                    actualDate: null,
                    plannedCost: 0,
                    actualCost: 0,
                });
            }
            const data = combinedDataMap.get(key);
            data.plannedCost += entry.cost || 0;
            data.category = entry.category || data.category;
            if (!data.plannedDate || (entry.date && entry.date < data.plannedDate)) {
                data.plannedDate = entry.date;
            }
        });

        actualData.forEach(entry => {
            const key = `${entry.villa}_${entry.item}`;
            if (!combinedDataMap.has(key)) {
                combinedDataMap.set(key, {
                    villa: entry.villa || 'N/A',
                    item: entry.item || 'N/A',
                    category: entry.category || 'Uncategorized',
                    plannedDate: null,
                    actualDate: null,
                    plannedCost: 0,
                    actualCost: 0,
                });
            }
            const data = combinedDataMap.get(key);
            data.actualCost += entry.cost || 0;
            if (!data.actualDate || (entry.date && entry.date < data.actualDate)) {
                data.actualDate = entry.date;
            }
        });

        this.cachedTableData = Array.from(combinedDataMap.values());
    }

    let tableData = [...this.cachedTableData];

    const sortData = (data, column, direction) => {
        return data.sort((a, b) => {
            let valueA = a[column] || (column.includes('Date') ? null : column.includes('Cost') || column.includes('Percent') ? 0 : '');
            let valueB = b[column] || (column.includes('Date') ? null : column.includes('Cost') || column.includes('Percent') ? 0 : '');
            if (!valueA && !valueB) return 0;
            if (!valueA) return direction * -1;
            if (!valueB) return direction * 1;

            if (column.includes('Date')) {
                valueA = valueA ? new Date(valueA).getTime() : 0;
                valueB = valueB ? new Date(valueB).getTime() : 0;
            } else if (column.includes('Cost') || column.includes('Percent') || column === 'varianceOfDates') {
                valueA = column === 'varianceOfDates' ? parseFloat(valueA) || 0 : Number(valueA) || 0;
                valueB = column === 'varianceOfDates' ? parseFloat(valueB) || 0 : Number(valueB) || 0;
            } else {
                valueA = valueA.toString().toLowerCase();
                valueB = valueB.toString().toLowerCase();
            }
            return valueA < valueB ? -1 * direction : valueA > valueB ? 1 * direction : 0;
        });
    };

    tableData = sortData(tableData, this.sortColumn || 'villa', this.sortDirection === 'asc' ? 1 : -1);

    let cumulativePlannedCost = 0, cumulativeActualCost = 0, totalPlannedCost = 0, totalActualCost = 0;
    tableData.forEach(entry => {
        totalPlannedCost += entry.plannedCost || 0;
        totalActualCost += entry.actualCost || 0;
    });

    tableData.forEach(entry => {
        entry.varianceOfDates = entry.plannedDate && entry.actualDate
            ? Math.round((  entry.plannedDate.getTime()-entry.actualDate.getTime()) / (1000 * 60 * 60 * 24))
            : 'N/A';
        entry.percentComplete = entry.plannedCost > 0 ? (entry.actualCost / entry.plannedCost) * 100 : 0;
        cumulativePlannedCost += entry.plannedCost || 0;
        cumulativeActualCost += entry.actualCost || 0;
        entry.cumulativePlannedCost = cumulativePlannedCost;
        entry.cumulativeActualCost = cumulativeActualCost;
        entry.cumulativePlannedPercent = totalPlannedCost > 0 ? (cumulativePlannedCost / totalPlannedCost) * 100 : 0;
        entry.cumulativeActualPercent = totalPlannedCost > 0 ? (cumulativeActualCost / totalPlannedCost) * 100 : 0;
    });

    const totalPercentComplete = totalPlannedCost > 0 ? (totalActualCost / totalPlannedCost) * 100 : 0;

    const totalPages = Math.ceil(tableData.length / rowsPerPage);
    this.currentPage = Math.min(this.currentPage, totalPages) || 1;
    const startIndex = (this.currentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    const visibleRows = tableData.slice(startIndex, endIndex);

    //console.log('totalPages:', totalPages, 'currentPage:', this.currentPage, 'visibleRows:', visibleRows);

    let rowsHTML = visibleRows.map(entry => `
        <tr class="hover:bg-gray-50">
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${entry.villa || 'N/A'}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">${entry.item || 'N/A'}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">${entry.category || 'Uncategorized'}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">${_formatDate(entry.plannedDate)}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">${_formatDate(entry.actualDate)}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">${entry.varianceOfDates}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">${_formatCurrency(entry.plannedCost)}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">${_formatCurrency(entry.actualCost)}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">${_formatPercentage(entry.percentComplete)}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">${_formatCurrency(entry.cumulativePlannedCost)}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">${_formatCurrency(entry.cumulativeActualCost)}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">${_formatPercentage(entry.cumulativePlannedPercent)}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">${_formatPercentage(entry.cumulativeActualPercent)}</td>
        </tr>
    `).join('');

    document.getElementById('dataTableBody').innerHTML = rowsHTML || '<tr><td colspan="13">No data available</td></tr>';
    document.getElementById('totalCost').textContent = _formatCurrency(totalPlannedCost);
    document.getElementById('totalCostActual').textContent = _formatCurrency(totalActualCost);
    document.getElementById('totalActualPercent').textContent = _formatPercentage(totalPercentComplete);

    const maxPageButtons = 5;
    const halfMax = Math.floor(maxPageButtons / 2);
    let startPage = Math.max(1, this.currentPage - halfMax);
    let endPage = Math.min(totalPages, startPage + maxPageButtons - 1);
    if (endPage === totalPages) {
        startPage = Math.max(1, endPage - maxPageButtons + 1);
    }

    const pageButtons = [];
    for (let i = startPage; i <= endPage; i++) {
        if (i < totalPages) {
            pageButtons.push(`
                <button class="page-btn px-4 py-2 rounded ${i === this.currentPage ? 'bg-blue-500 text-white' : 'bg-gray-200'}" data-page="${i}">${i}</button>
            `);
        }
    }

    if (endPage < totalPages - 1) {
        pageButtons.push('<span class="px-4 py-2">...</span>');
    }
    if (totalPages > 1 && endPage < totalPages) {
        pageButtons.push(`
            <button class="page-btn px-4 py-2 rounded ${totalPages === this.currentPage ? 'bg-blue-500 text-white' : 'bg-gray-200'}" data-page="${totalPages}">${totalPages}</button>
        `);
    } else if (totalPages === endPage && totalPages > 1) {
        pageButtons.push(`
            <button class="page-btn px-4 py-2 rounded ${totalPages === this.currentPage ? 'bg-blue-500 text-white' : 'bg-gray-200'}" data-page="${totalPages}">${totalPages}</button>
        `);
    }

    let paginationHTML = `
        <div id="pagination" class="flex justify-center mt-4 space-x-2">
            <button id="firstPage" class="px-4 py-2 bg-gray-200 rounded ${this.currentPage === 1 ? 'opacity-50 cursor-not-allowed' : ''}" ${this.currentPage === 1 ? 'disabled' : ''}>First</button>
            <button id="prevPage" class="px-4 py-2 bg-gray-200 rounded ${this.currentPage === 1 ? 'opacity-50 cursor-not-allowed' : ''}" ${this.currentPage === 1 ? 'disabled' : ''}>Previous</button>
            ${pageButtons.join('')}
            <button id="nextPage" class="px-4 py-2 bg-gray-200 rounded ${this.currentPage === totalPages ? 'opacity-50 cursor-not-allowed' : ''}" ${this.currentPage === totalPages ? 'disabled' : ''}>Next</button>
            <button id="lastPage" class="px-4 py-2 bg-gray-200 rounded ${this.currentPage === totalPages ? 'opacity-50 cursor-not-allowed' : ''}" ${this.currentPage === totalPages ? 'disabled' : ''}>Last</button>
        </div>
    `;

    let paginationContainer = document.getElementById('pagination');
    if (!paginationContainer) {
        const tableContainer = document.getElementById('dataTableBody').closest('.table-container') || document.body;
        paginationContainer = document.createElement('div');
        paginationContainer.id = 'pagination';
        tableContainer.appendChild(paginationContainer);
    }
    paginationContainer.innerHTML = paginationHTML;

    const updatePage = (page) => {
        if (page !== this.currentPage && page >= 1 && page <= totalPages) {
            this.currentPage = page;
            this.updateDataTable();
        }
    };

    document.getElementById('firstPage')?.addEventListener('click', () => updatePage(1));
    document.getElementById('prevPage')?.addEventListener('click', () => updatePage(this.currentPage - 1));
    document.getElementById('nextPage')?.addEventListener('click', () => updatePage(this.currentPage + 1));
    document.getElementById('lastPage')?.addEventListener('click', () => updatePage(totalPages));

    document.querySelectorAll('.page-btn').forEach(button => {
        button.addEventListener('click', () => {
            const page = parseInt(button.getAttribute('data-page'));
            updatePage(page);
        });
    });

    const headers = document.querySelectorAll('th[data-sort]');
    headers.forEach(header => {
        header.removeEventListener('click', header.clickHandler);
        header.clickHandler = () => {
            const column = header.getAttribute('data-sort');
            this.sortDirection = this.sortColumn === column ? (this.sortDirection === 'asc' ? 'desc' : 'asc') : 'asc';
            this.sortColumn = column;
            this.currentPage = 1;

            headers.forEach(h => {
                const icon = h.querySelector('.sort-icon');
                if (icon) icon.querySelectorAll('.sort-arrow').forEach(i => i.classList.remove('active'));
            });
            const icon = header.querySelector('.sort-icon');
            if (icon) {
                icon.querySelector(this.sortDirection === 'asc' ? '.sort-asc' : '.sort-desc').classList.add('active');
            }

            tableData = sortData(tableData, column, this.sortDirection === 'asc' ? 1 : -1);
            this.updateDataTable();
        };
        header.addEventListener('click', header.clickHandler);
    });

   
}

downloadTableAsExcel(tableId, filenamePrefix) {
    const table = document.getElementById(tableId);
    const tableData = [];
    const headers = ['Villa', 'Item', 'Category', 'Planned Date', 'Actual Date', 'Variance (Days)', 'Planned Cost', 'Actual Cost', '% Complete', 'Cumulative Planned', 'Cumulative Actual', 'Cumulative Planned %', 'Cumulative Actual %'];
    tableData.push(headers);

    const rows = table.querySelectorAll('tr');
    for (let i = 0; i < rows.length; i++) {
        if (!rows[i].className.includes('separator')) {
            const cells = Array.from(rows[i].querySelectorAll('td'));
            const rowData = cells.map((td, index) => {
                let cellText = td.innerText.trim();
                
                // Handle date columns (Planned Date and Actual Date)
                if (index === 3 || index === 4) {
                    if (cellText && cellText !== 'N/A') {
                        // Create date in local timezone to avoid day shift
                        const dateParts = cellText.split('-');
                        if (dateParts.length === 3) {
                            const year = parseInt(dateParts[0]);
                            const month = parseInt(dateParts[1]) - 1; // Month is 0-indexed
                            const day = parseInt(dateParts[2]);
                            return new Date(year, month, day);
                        }
                        return cellText;
                    }
                    return cellText;
                }
                
                if (index === 0 || index === 1 || index === 2 || index === 5) return cellText;
                if (cellText.startsWith('SAR')) return parseFloat(cellText.replace('SAR', '').replace(/,/g, '')) || 0;
                if (cellText.endsWith('%')) return parseFloat(cellText.replace('%', '')) || 0;
                return cellText;
            });
            tableData.push(rowData);
        }
    }

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(tableData);
    
    // Set column widths and date formatting
    ws['!cols'] = headers.map((_, i) => ({ wch: i === 0 ? 30 : 15 }));
    
    // Apply date formatting to date columns
    const range = XLSX.utils.decode_range(ws['!ref']);
    for (let R = range.s.r + 1; R <= range.e.r; ++R) {
        // Format Planned Date column (index 3)
        const plannedDateCell = XLSX.utils.encode_cell({r: R, c: 3});
        if (ws[plannedDateCell] && ws[plannedDateCell].v instanceof Date) {
            ws[plannedDateCell].z = 'yyyy-mm-dd';
            ws[plannedDateCell].t = 'd';
        }
        
        // Format Actual Date column (index 4)
        const actualDateCell = XLSX.utils.encode_cell({r: R, c: 4});
        if (ws[actualDateCell] && ws[actualDateCell].v instanceof Date) {
            ws[actualDateCell].z = 'yyyy-mm-dd';
            ws[actualDateCell].t = 'd';
        }
    }
    
    XLSX.utils.book_append_sheet(wb, ws, 'Cost Trend Data');
    const timestamp = new Date().toISOString().replace(/[:.-]/g, '').split('T')[0] + '_' + new Date().toTimeString().split(' ')[0].replace(/:/g, '');
    XLSX.writeFile(wb, `${filenamePrefix}_${timestamp}.xlsx`);
}

downloadAllDataAsExcel(filenamePrefix) {
    const tableData = [];
    const headers = ['Villa', 'Item', 'Category', 'Planned Date', 'Actual Date', 'Variance (Days)', 'Planned Cost', 'Actual Cost', '% Complete', 'Cumulative Planned', 'Cumulative Actual', 'Cumulative Planned %', 'Cumulative Actual %'];
    tableData.push(headers);

    // Helper function to format dates as Date objects for Excel (local timezone)
    const _formatDateForExcel = date => {
        if (!date) return 'N/A';
        if (date instanceof Date) {
            // Create new date in local timezone to avoid day shift
            return new Date(date.getFullYear(), date.getMonth(), date.getDate());
        }
        // If it's a string, parse it carefully
        const dateStr = date.toString();
        const dateParts = dateStr.split('-');
        if (dateParts.length === 3) {
            const year = parseInt(dateParts[0]);
            const month = parseInt(dateParts[1]) - 1; // Month is 0-indexed
            const day = parseInt(dateParts[2]);
            return new Date(year, month, day);
        }
        return dateStr;
    };
    
    const _formatCurrency = amount => (amount || 0);
    const _formatPercentage = value => (value || 0);

    this.cachedTableData.forEach(entry => {
        const rowData = [
            entry.villa || 'N/A',
            entry.item || 'N/A',
            entry.category || 'Uncategorized',
            _formatDateForExcel(entry.plannedDate),
            _formatDateForExcel(entry.actualDate),
            entry.varianceOfDates,
            _formatCurrency(entry.plannedCost),
            _formatCurrency(entry.actualCost),
            _formatPercentage(entry.percentComplete),
            _formatCurrency(entry.cumulativePlannedCost),
            _formatCurrency(entry.cumulativeActualCost),
            _formatPercentage(entry.cumulativePlannedPercent),
            _formatPercentage(entry.cumulativeActualPercent)
        ];
        tableData.push(rowData);
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(tableData);
    
    // Set column widths
    ws['!cols'] = headers.map((_, i) => ({ wch: i === 0 ? 30 : 15 }));
    
    // Apply date formatting to date columns
    const range = XLSX.utils.decode_range(ws['!ref']);
    for (let R = range.s.r + 1; R <= range.e.r; ++R) {
        // Format Planned Date column (index 3)
        const plannedDateCell = XLSX.utils.encode_cell({r: R, c: 3});
        if (ws[plannedDateCell] && ws[plannedDateCell].v instanceof Date) {
            ws[plannedDateCell].z = 'yyyy-mm-dd';
            ws[plannedDateCell].t = 'd';
        }
        
        // Format Actual Date column (index 4)
        const actualDateCell = XLSX.utils.encode_cell({r: R, c: 4});
        if (ws[actualDateCell] && ws[actualDateCell].v instanceof Date) {
            ws[actualDateCell].z = 'yyyy-mm-dd';
            ws[actualDateCell].t = 'd';
        }
    }
    
    XLSX.utils.book_append_sheet(wb, ws, 'Cost Trend Data');
    const timestamp = new Date().toISOString().replace(/[:.-]/g, '').split('T')[0] + '_' + new Date().toTimeString().split(' ')[0].replace(/:/g, '');
    XLSX.writeFile(wb, `${filenamePrefix}_${timestamp}.xlsx`);
}

    downloadChartAsImage(chartId, filenamePrefix) {
    let element;
    if (chartId === 'projectMetricsCharts') {
        // Capture the entire chart container for project metrics
        element = document.querySelector('#projectMetricsCharts').closest('.chart-container');
    } else {
        element = document.getElementById(chartId);
    }

    if (!element) {
        console.error(`Element with ID ${chartId} not found`);
        return;
    }

    html2canvas(element).then(canvas => {
        const link = document.createElement('a');
        link.download = `${filenamePrefix}_${new Date().toISOString().replace(/[:.-]/g, '').split('T')[0]}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    });
}

    downloadCategoryDataAsExcel() {
        const tableData = [['Category', 'Planned Cost (SAR)', 'Actual Cost (SAR)']];
        this.categoryChartData.categories.forEach((category, index) => {
            tableData.push([category, this.categoryChartData.plannedCosts[index] || 0, this.categoryChartData.actualCosts[index] || 0]);
        });

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(tableData);
        ws['!cols'] = [{ wch: 25 }, { wch: 15 }, { wch: 15 }];
        XLSX.utils.book_append_sheet(wb, ws, 'Category Data');
        const timestamp = new Date().toISOString().replace(/[:.-]/g, '').split('T')[0] + '_' + new Date().toTimeString().split(' ')[0].replace(/:/g, '');
        XLSX.writeFile(wb, `category_data_${timestamp}.xlsx`);
    }

    downloadTopItemsTableAsExcel() {
        const tableData = [['Item', 'Planned Cost (SAR)', 'Actual Cost (SAR)', 'Category']];
        this.topItemsChartData.items.forEach((item, index) => {
            tableData.push([item, this.topItemsChartData.plannedCosts[index], this.topItemsChartData.actualCosts[index], this.topItemsChartData.categories[index]]);
        });

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(tableData);
        ws['!cols'] = [{ wch: 30 }, { wch: 15 }, { wch: 15 }, { wch: 20 }];
        XLSX.utils.book_append_sheet(wb, ws, 'Top Items Data');
        const timestamp = new Date().toISOString().replace(/[:.-]/g, '').split('T')[0] + '_' + new Date().toTimeString().split(' ')[0].replace(/:/g, '');
        XLSX.writeFile(wb, `top_items_data_${timestamp}.xlsx`);
    }

   downloadTablecashAsExcel(tableId, filenamePrefix) {
    const table = document.getElementById(tableId);
    const tableData = [];

    // Extract headers from the first row
    const headerRow = table.querySelector('thead tr:nth-child(1)');
    const headers = Array.from(headerRow.querySelectorAll('th')).map(th => th.innerText.trim());
    tableData.push(headers);

    // Extract the End Date row (second row in thead)
    const dateRow = table.querySelector('thead tr:nth-child(2)');
    if (dateRow) {
        const dateCells = Array.from(dateRow.querySelectorAll('th')).map(th => th.innerText.trim());
        tableData.push(dateCells);
    }

    // Process body rows
    const bodyRows = table.querySelectorAll('tbody tr');
    for (let row of bodyRows) {
        if (!row.className.includes('separator')) {
            const cells = Array.from(row.querySelectorAll('td'));
            const rowData = cells.map((td, index) => {
                let cellText = td.innerText.trim();
                if (index === 0) return cellText; // Keep text as is for the first column (Metric)
                if (cellText.endsWith(' SAR')) return parseFloat(cellText.replace(' SAR', '').replace(/,/g, '')) || 0;
                if (cellText.endsWith('%')) return parseFloat(cellText.replace('%', '')) || 0;
                return cellText;
            });
            tableData.push(rowData);
        }
    }

    // Create Excel file
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(tableData);
    ws['!cols'] = headers.map((_, i) => ({ wch: i === 0 ? 30 : 15 }));
    XLSX.utils.book_append_sheet(wb, ws, 'Cost Trend Data');
    const timestamp = new Date().toISOString().replace(/[:.-]/g, '').split('T')[0] + '_' + new Date().toTimeString().split(' ')[0].replace(/:/g, '');
    XLSX.writeFile(wb, `${filenamePrefix}_${timestamp}.xlsx`);
}
}
//project dashboard
const dashboard = new ConstructionCostDashboard(dynamoDBClient,
     plannedCostsTable, ActualCostsTable,plannedDatesTable,ActualDatesTable,EXCLUDED_KEYS,plannedDatesFinishTable,wajhaspecialquerytable,fetchTableData);
dashboard.init();




