// villa dashboard






//
function loadAndRunPopupDashboard(containerId, layer) {
    let container;
    // Handle case where containerId is an HTML element
    if (containerId instanceof HTMLElement) {
        container = containerId;
    } else if (typeof containerId === 'string') {
        container = document.getElementById(containerId);
    } else {
        console.error(`Invalid containerId: ${containerId}. Expected a string ID or HTMLElement.`);
        alert('Unable to load dashboard: Invalid container.');
        return;
    }

    if (!container) {
        console.error(`Container not found for ID or element: ${containerId}`);
        alert('Unable to load dashboard: Container not found.');
        return;
    }

   

    const villa = `V_${layer.feature.properties.villaID}`;

    // --- 1. DYNAMICALLY LOAD DEPENDENCIES (CSS, FONTS, LIBS) ---
    function loadDependencies() {
        const stylesAndFonts = `
            <link rel="preconnect" href="https://fonts.googleapis.com">
            <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
            <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap" rel="stylesheet">
            <style>
                .popup-dashboard {
                    max-width: 850px;
                    max-height: 90vh;
                    overflow-y: auto;
                    padding: 20px;
                    font-family: 'Poppins', sans-serif;
                    background: linear-gradient(145deg, #f8fafc, #e5e7eb);
                    border-radius: 16px;
                    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
                    scrollbar-width: thin;
                    scrollbar-color: #6b7280 #e5e7eb;
                }
                .popup-dashboard::-webkit-scrollbar {
                    width: 8px;
                }
                .popup-dashboard::-webkit-scrollbar-track {
                    background: #e5e7eb;
                    border-radius: 4px;
                }
                .popup-dashboard::-webkit-scrollbar-thumb {
                    background: #6b7280;
                    border-radius: 4px;
                }
                .popup-title {
                    font-size: 1.5rem;
                    font-weight: 700;
                    color: #1f2937;
                    text-align: center;
                    margin-bottom: 16px;
                    letter-spacing: 0.5px;
                }
                .popup-stat {
                    font-size: 0.875rem;
                    color: #4b5563;
                    line-height: 1.5;
                }
                .input-group {
                    background: #ffffff;
                    padding: 16px;
                    border-radius: 12px;
                    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
                    margin-bottom: 16px;
                }
                .input-group label {
                    font-size: 0.875rem;
                    font-weight: 600;
                    color: #374151;
                    margin-bottom: 8px;
                    display: block;
                }
                .input-group input {
                    width: 100%;
                    padding: 10px;
                    border: 1px solid #d1d5db;
                    border-radius: 8px;
                    background: #fff;
                    font-size: 0.875rem;
                    transition: border-color 0.2s, box-shadow 0.2s;
                }
                .input-group input:focus {
                    outline: none;
                    border-color: #2563eb;
                    box-shadow: 0 0 0 3px rgba(37, 140, 255, 0.1);
                }
                .toggle-view-btn, .download-btn {
                    background: linear-gradient(90deg, #2563eb, #1d4ed8);
                    color: white;
                    border: none;
                    padding: 10px 16px;
                    border-radius: 8px;
                    cursor: pointer;
                    font-size: 0.875rem;
                    font-weight: 600;
                    transition: transform 0.2s, background 0.2s;
                    margin-right: 8px;
                    margin-bottom: 12px;
                }
                .toggle-view-btn:hover, .download-btn:hover {
                    background: linear-gradient(90deg, #1d4ed8, #1e40af);
                    transform: translateY(-1px);
                }
                .toggle-view-btn:active, .download-btn:active {
                    transform: translateY(0);
                }

                .chart-container {
                    position: relative;
    height: 100px; /* Reduced from 140px to make it smaller */
    max-height: 100px; /* Ensure it doesn't exceed this height */
    background: #ffffff;
    border-radius: 12px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
    padding: 8px; /* Reduced padding slightly */
    margin-bottom: 12px; /* Reduced margin slightly */
                }
                .table-container {
                    overflow-x: auto;
                    background: #ffffff;
                    border-radius: 12px;
                    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
                    margin-top: 16px;
                    padding: 8px;
                }
                #popup_comparisonTable {
                    width: 100%;
                    border-collapse: separate;
                    border-spacing: 0;
                    font-size: 0.875rem;
                    background: #ffffff;
                    border: 1px solid #e5e7eb;
                    border-radius: 12px;
                    overflow: hidden;
                }
                #popup_comparisonTable th {
                    background: linear-gradient(180deg, #2563eb, #1d4ed8);
                    color: #ffffff;
                    font-weight: 600;
                    font-size: 0.75rem;
                    padding: 8px 4px;
                    text-align: center;
                    border-right: 1px solid rgba(255, 255, 255, 0.1);
                    border-bottom: 2px solid #1e40af;
                    writing-mode: vertical-rl;
                    transform: rotate(180deg);
                    min-width: 24px;
                    max-width: 32px;
                }
                #popup_comparisonTable tr:nth-child(2) th {
                    writing-mode: horizontal-tb;
                    transform: none;
                    font-size: 0.75rem;
                    padding: 6px 4px;
                    background: #3b82f6;
                    border-bottom: 1px solid #1e40af;
                }
                #popup_comparisonTable th:first-child {
                    writing-mode: horizontal-tb;
                    transform: none;
                    text-align: left;
                    padding: 12px 16px;
                    min-width: 120px;
                    max-width: none;
                    border-right: 2px solid #1e40af;
                    background: linear-gradient(180deg, #2563eb, #1d4ed8);
                }
                #popup_comparisonTable td {
                    padding: 8px 4px;
                    text-align: center;
                    border-bottom: 1px solid #e5e7eb;
                    border-right: 1px solid #e5e7eb;
                    font-size: 0.75rem;
                    color: #1f2937;
                }
                #popup_comparisonTable td:first-child {
                    text-align: left;
                    font-weight: 600;
                    padding: 12px 16px;
                    border-right: 2px solid #1e40af;
                    background: #f9fafb;
                }
                #popup_comparisonTable tr:nth-child(even) td {
                    background: #f9fafb;
                }
                #popup_comparisonTable tr:hover td {
                    background: #eff6ff;
                    transition: background 0.2s;
                }
                .percent {
                    font-weight: 600;
                    color: #15803d;
                }
                .cost {
                    font-weight: 600;
                    color: #7c3aed;
                }
                .separator {
                    height: 4px;
                    background: #6b7280;
                }
                .separator td {
                    padding: 0;
                    height: 4px;
                    background: #6b7280;
                }
                .metric-card {
    background: #ffffff;
    border-radius: 12px;
    padding: 5px; /* Reduced from 16px */
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
    transition: transform 0.2s;
    
}
                .metric-card:hover {
                    transform: translateY(-2px);
                }
                .metric-card h3 {
                    font-size: 0.875rem;
                    font-weight: 600;
                    color: #4b5563;
                    margin-bottom: 8px;
                }
                .metric-card p {
                    font-size: 0.875rem;
                    font-weight: 600;
                    color: #1f2937;
                }
            </style>
        `;
        document.head.insertAdjacentHTML('beforeend', stylesAndFonts);

        function loadScript(src, done) {
            if (document.querySelector(`script[src="${src}"]`)) {
                done();
                return;
            }
            const script = document.createElement('script');
            script.src = src;
            script.onload = () => done();
            script.onerror = () => {
                console.error(`Failed to load script: ${src}`);
                done();
            };
            document.head.appendChild(script);
        }

        return new Promise(resolve => {
            loadScript('https://cdn.tailwindcss.com', () => {
                loadScript('https://cdn.jsdelivr.net/npm/chart.js', () => {
                    loadScript('https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2.0.0', () => {
                        loadScript('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js', () => {
                            if (typeof XLSX === 'undefined') {
                                console.error('XLSX library failed to initialize.');
                            }
                            resolve();
                        });
                    });
                });
            });
        });
    }

    // --- 2. DEFINE THE DASHBOARD APPLICATION LOGIC ---
    async function initializeDashboard() {
        function downloadTableAsExcel(tableId, filenamePrefix) {
            try {
                const table = document.getElementById(tableId);
                if (!table) throw new Error(`Table with ID ${tableId} not found`);

                const tableData = [];
                const headerRow = table.querySelector('tr:nth-child(1)');
                const headers = Array.from(headerRow.querySelectorAll('th')).map(th => th.innerText.trim());
                if (headers.length === 0) throw new Error('No headers found in the table');
                tableData.push(headers);

                const dateRow = table.querySelector('tr:nth-child(2)');
                const dateHeaders = Array.from(dateRow.querySelectorAll('th')).map(th => th.innerText.trim());
                tableData.push(dateHeaders);

                const rows = table.querySelectorAll('tr');
                for (let i = 2; i < rows.length; i++) {
                    if (!rows[i].className.includes('separator')) {
                        const cells = Array.from(rows[i].querySelectorAll('th, td'));
                        if (cells.length === 0) continue;
                        const rowData = cells.map((cell, index) => {
                            let cellText = cell.innerText.trim();
                            if (index === 0) return cellText;
                            if (cellText.includes('SAR')) return parseFloat(cellText.replace(/[^0-9.-]+/g, '')) || 0;
                            if (cellText.endsWith('%')) return parseFloat(cellText.replace('%', '')) || 0;
                            return cellText;
                        });
                        tableData.push(rowData);
                    }
                }

                if (tableData.length <= 2) throw new Error('No data rows found in the table');

                const wb = XLSX.utils.book_new();
                const ws = XLSX.utils.aoa_to_sheet(tableData);
                ws['!cols'] = headers.map((_, i) => ({ wch: i === 0 ? 30 : 15 }));
                XLSX.utils.book_append_sheet(wb, ws, 'Cost Trend Data');
                const timestamp = new Date().toISOString().replace(/[:.-]/g, '').split('T')[0];
                XLSX.writeFile(wb, `${filenamePrefix}_${timestamp}.xlsx`);
            } catch (error) {
                console.error('Error exporting table to Excel:', error);
                alert('Failed to export table to Excel.');
            }
        }

        function downloadChartImage(canvasId) {
            const canvas = document.getElementById(canvasId);
            if (!canvas) return;

            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = canvas.width * 2;
            tempCanvas.height = canvas.height * 2;
            const tempCtx = tempCanvas.getContext('2d');
            tempCtx.scale(2, 2);

            tempCtx.fillStyle = '#ffffff';
            tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
            tempCtx.drawImage(canvas, 0, 0);

            const link = document.createElement('a');
            link.href = tempCanvas.toDataURL('image/png');
            const timestamp = new Date().toISOString().replace(/[:.-]/g, '').split('T')[0];
            link.download = `popup_chart_${timestamp}.png`;
            link.click();

            link.remove();
            tempCanvas.remove();
        }

        function getDashboardHTML() {
    return `
        <div class="popup-dashboard">
            <h2 class="popup-title">
                Performance Dashboard
                <div class="popup-stat">
                    Villa ID: ${layer.feature.properties.villaID}<br>
                    Block: ${layer.feature.properties.blocknum}<br>
                    Villa: ${layer.feature.properties.villanum}
                </div>
            </h2>
            <div class="input-group">
                <label for="popup-date-input" class="text-gray-600">Select Analysis Date:</label>
                <input type="date" id="popup-date-input" class="mt-1">
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                <div class="metric-card">
                    <h3>Total Budget Cost</h3>
                    <p id="popup-total-planned-value">0 SAR</p>
                    <h3>Total Actual Value</h3>
                    <p id="popup-total-actual-value">0 SAR</p>
                </div>
                <div class="metric-card">
                    <h3>Planned (Up to Date)</h3>
                    <p id="popup-planned-value-up-to-date">0 SAR</p>
                     <h3>Actual (Up to Date)</h3>
                    <p id="popup-actual-value-up-to-date">0 SAR</p>
                </div>
                <div class="metric-card">
                    <h3>Planned Start</h3>
                    <p id="popup-min-planned-start-date">N/A</p>
                     <h3>Planned Finish</h3>
                    <p id="popup-max-planned-finish-date">N/A</p>
                </div>
                <div class="metric-card">
                    <h3>Actual Start Date</h3>
                    <p id="popup-min-actual-date">N/A</p>
                    <h3>Latest Actual Recorded Date</h3>
                    <p id="popup-max-actual-date">N/A</p>
                </div>
                
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                <div class="metric-card">
                    <h3 class="mb-2">Overall % Actual</h3>
                    <p id="popup-overall-actual-vs-planned-percentage" class="mb-2">0.00%</p>
                    <div class="chart-container"><canvas id="popup-chart-overall-percentage"></canvas></div>
                </div>
                <div class="metric-card">
                    <h3 class="mb-2">Actual (Selected Date)</h3>
                    <p id="popup-date-specific-actual-vs-planned-percentage" class="mb-2">0.00%</p>
                    <div class="chart-container"><canvas id="popup-chart-date-actual-percentage"></canvas></div>
                </div>
                <div class="metric-card">
                    <h3 class="mb-2">Planned % (Selected Date)</h3>
                    <p id="popup-date-specific-planned-percentage" class="mb-2">0.00%</p>
                    <div class="chart-container"><canvas id="popup-chart-date-specific-planned"></canvas></div>
                </div>
            </div>
            <div class="metric-card">
                <h3 class="text-sm font-semibold text-gray-700 mb-2">Actual vs Planned Over Time</h3>
                <div class="flex flex-wrap gap-2 mb-4">
                    <button id="popup-toggle-view-btn" class="toggle-view-btn">Switch to Weekly Table</button>
                    <button id="popup-download-excel-btn" class="download-btn">Download Table</button>
                    <button id="popup-download-chart-btn" class="download-btn">Download Chart</button>
                </div>
                <div class="chart-container" style="height: 200px;"><canvas id="popup-chart-actual-vs-planned-over-time"></canvas></div>
                <div class="table-container">
                    <table id="popup_comparisonTable">
                        <thead></thead>
                        <tbody></tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
}
//
        container.innerHTML = getDashboardHTML();

        let charts = {};
        let isWeeklyView = false;

       

function convertExcelDateToJSDateForCalculations(excelDate) {
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






        async function retrieveDynamoDBData() {
            try {
                const [mockPlannedCosts, mockActualCosts, mockPlannedDates, mockActualDates, mockPlannedDatesFinish] = await Promise.all([
                    retrieveSpecificRowDataFromDynamoDB(plannedCostsTable, villa),
                    retrieveSpecificRowDataFromDynamoDB(ActualCostsTable, villa),
                    retrieveSpecificRowDataFromDynamoDB(plannedDatesTable, villa),
                    retrieveSpecificRowDataFromDynamoDB(ActualDatesTable, villa),
                    retrieveSpecificRowDataFromDynamoDB(plannedDatesFinishTable, villa),
                ]);

                

                return {
                    plannedCosts: mockPlannedCosts,
                    actualCosts: mockActualCosts,
                    plannedDates: mockPlannedDates,
                    actualDates: mockActualDates,
                    planneddatesfinish: mockPlannedDatesFinish
                };
            } catch (error) {
                console.error('Error retrieving DynamoDB data:', error);
                alert('Failed to load data for the dashboard.');
                return {};
            }
        }

        function processProjectData(rawData) {
    const { plannedCosts, actualCosts, plannedDates, actualDates, planneddatesfinish } = rawData;
    const activitiesMap = new Map();
    let minPlannedStartDate = null;
    let maxPlannedStartDate = null;
    let minPlannedFinishDate = null;
    let maxPlannedFinishDate = null;
    let minActualDate = null;
    let maxActualDate = null;

    // Process planned costs and dates
    for (const key in plannedCosts) {
        if (Object.hasOwnProperty.call(plannedCosts, key)) {
            const plannedDate = convertExcelDateToJSDateForCalculations(parseFloat(plannedDates[key]));
            const plannedFinishDate = convertExcelDateToJSDateForCalculations(parseFloat(planneddatesfinish[key]));
            activitiesMap.set(key, {
                id: key,
                plannedCost: parseFloat(plannedCosts[key]) || 0,
                plannedDate: plannedDate,
                planneddatefinish: plannedFinishDate,
                actualCost: 0,
                actualDate: null,
            });

            // Update min/max planned dates
            if (plannedDate) {
                if (!minPlannedStartDate || plannedDate < minPlannedStartDate) {
                    minPlannedStartDate = new Date(plannedDate);
                }
                if (!maxPlannedStartDate || plannedDate > maxPlannedStartDate) {
                    maxPlannedStartDate = new Date(plannedDate);
                }
            }
            if (plannedFinishDate) {
                if (!minPlannedFinishDate || plannedFinishDate < minPlannedFinishDate) {
                    minPlannedFinishDate = new Date(plannedFinishDate);
                }
                if (!maxPlannedFinishDate || plannedFinishDate > maxPlannedFinishDate) {
                    maxPlannedFinishDate = new Date(plannedFinishDate);
                }
            }
        }
    }

    // Process actual costs and dates
    for (const key in actualCosts) {
        if (Object.hasOwnProperty.call(actualCosts, key)) {
            const actualDateRaw = actualDates[key];
            const actualDate = actualDateRaw ? convertExcelDateToJSDateForCalculations(parseFloat(actualDateRaw)) : null;
            let activity = activitiesMap.get(key) || {
                id: key,
                plannedCost: 0,
                plannedDate: null,
                planneddatefinish: null,
            };
            activity.actualCost = parseFloat(actualCosts[key]) || 0;
            activity.actualDate = actualDate;
            activitiesMap.set(key, activity);

            // Update min/max actual dates
            if (actualDate) {
                if (!minActualDate || actualDate < minActualDate) {
                    minActualDate = new Date(actualDate);
                }
                if (!maxActualDate || actualDate > maxActualDate) {
                    maxActualDate = new Date(actualDate);
                }
            }
        }
    }

    const activities = Array.from(activitiesMap.values());
    return {
        activities,
        minPlannedStartDate,
        maxPlannedStartDate,
        minPlannedFinishDate,
        maxPlannedFinishDate,
        minActualDate,
        maxActualDate
    };
}

        const countWorkingDays = (start, end) => {
            if (!start || !end || !(start instanceof Date) || !(end instanceof Date)) {
                console.warn(`Invalid dates for countWorkingDays: start=${start}, end=${end}`);
                return 0;
            }
            let count = 0;
            const current = new Date(start);
            current.setHours(0, 0, 0, 0);

            const endDay = new Date(end);
            endDay.setHours(23, 59, 59, 999);

            while (current <= endDay) {
                const dayOfWeek = current.getDay();
                if (dayOfWeek !== 5) { // Exclude Friday (5)
                    count++;
                }
                current.setDate(current.getDate() + 1);
            }
            return count;
        };

        function calculateDashboardMetrics(processedData, specificDate) {
            let totalPlannedCost = 0,
                totalActualCost = 0,
                plannedCostUpToDate = 0,
                actualCostUpToDate = 0;

            const normalizedSpecificDate = new Date(specificDate);
            normalizedSpecificDate.setHours(23, 59, 59, 999);

            processedData.forEach(activity => {
                totalPlannedCost += activity.plannedCost;
                totalActualCost += activity.actualCost;

                if (activity.plannedDate) {
                    const activityStartDate = new Date(activity.plannedDate);
                    const activityFinishDate = activity.planneddatefinish ? new Date(activity.planneddatefinish) : null;
                    activityStartDate.setHours(0, 0, 0, 0);

                    if (activityFinishDate) {
                        activityFinishDate.setHours(23, 59, 59, 999);
                        if (activityFinishDate <= normalizedSpecificDate) {
                            const totalWorkingDays = countWorkingDays(activityStartDate, activityFinishDate);
                            if (totalWorkingDays > 0) {
                                plannedCostUpToDate += activity.plannedCost;
                            }
                        } else {
                            const totalWorkingDays = countWorkingDays(activityStartDate, activityFinishDate);
                            const elapsedWorkingDays = countWorkingDays(activityStartDate, normalizedSpecificDate);
                            if (totalWorkingDays > 0 && elapsedWorkingDays > 0) {
                                plannedCostUpToDate += (elapsedWorkingDays / totalWorkingDays) * activity.plannedCost;
                            }
                        }
                    } else {
                        const activityPlannedDayOfWeek = activityStartDate.getDay();
                        if (activityPlannedDayOfWeek !== 5 && activityStartDate <= normalizedSpecificDate) {
                            plannedCostUpToDate += activity.plannedCost;
                        }
                    }
                }

                if (activity.actualDate && activity.actualDate <= normalizedSpecificDate) {
                    actualCostUpToDate += activity.actualCost;
                }
            });

            const metrics = {
                totalPlannedCost,
                totalActualCost,
                plannedCostUpToDate,
                actualCostUpToDate,
                overallActualVsPlannedPercentage: totalPlannedCost > 0 ? (totalActualCost / totalPlannedCost) * 100 : 0,
                dateSpecificActualVsPlannedPercentage: plannedCostUpToDate > 0 ? (actualCostUpToDate / totalPlannedCost) * 100 : 0,
                dateSpecificPlannedPercentage: totalPlannedCost > 0 ? (plannedCostUpToDate / totalPlannedCost) * 100 : 0
            };

            return metrics;
        }

function aggregateWeeklyMonthlyData(processedData, viewType) {
    const periods = {};
    const allPeriodKeys = [];

    const dates = processedData
        .flatMap(activity => [
            activity.plannedDate,
            activity.planneddatefinish,
            activity.actualDate
        ])
        .filter(date => date instanceof Date && !isNaN(date.getTime()));

    if (dates.length === 0) {
        console.warn('No valid dates found in processed data');
        return { periods: {}, sortedPeriods: [] };
    }

    const minDate = new Date(Math.min(...dates));
    const maxDate = new Date(Math.max(...dates));
    minDate.setHours(0, 0, 0, 0);
    maxDate.setHours(23, 59, 59, 999);

    if (viewType === 'weekly') {
        // Adjust to make Thursday the end of the week (Thursday is day 4)
        let current = new Date(minDate);
        const dayOfWeek = current.getDay();
        let daysToThursday = (4 - dayOfWeek + 7) % 7;
        if (daysToThursday === 0) daysToThursday = 7; // Ensure first week includes at least one day

        const firstWeekEnd = new Date(current);
        firstWeekEnd.setDate(current.getDate() + daysToThursday);
        firstWeekEnd.setHours(23, 59, 59, 999);

        const firstWeekStart = new Date(minDate); // Start from minDate
        firstWeekStart.setHours(0, 0, 0, 0);

        periods["1"] = {
            totalCost: 0,
            totalCostActual: 0,
            cumulativeCost: 0,
            cumulativeCostActual: 0,
            percentOfTotal: 0,
            percentOfTotalActual: 0,
            cumPercent: 0,
            cumPercentActual: 0,
            startDate: firstWeekStart,
            endDate: firstWeekEnd
        };
        allPeriodKeys.push("1");

        // Subsequent weeks will run from Friday to the following Thursday
        current = new Date(firstWeekEnd);
        current.setDate(current.getDate() + 1); // Start of the next week is Friday
        let weekCounter = 2;

        while (current <= maxDate) {
            const weekStart = new Date(current);
            const weekEnd = new Date(current);
            weekEnd.setDate(current.getDate() + 6); // End of the week is the following Thursday

            periods[`${weekCounter}`] = {
                totalCost: 0,
                totalCostActual: 0,
                cumulativeCost: 0,
                cumulativeCostActual: 0,
                percentOfTotal: 0,
                percentOfTotalActual: 0,
                cumPercent: 0,
                cumPercentActual: 0,
                startDate: weekStart,
                endDate: weekEnd
            };
            allPeriodKeys.push(`${weekCounter}`);

            current.setDate(current.getDate() + 7); // Move to the next Friday
            weekCounter++;
        }
    } else {
        // Monthly view remains the same
        let current = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
        while (current <= maxDate) {
            const periodKey = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`;
            periods[periodKey] = {
                totalCost: 0,
                totalCostActual: 0,
                cumulativeCost: 0,
                cumulativeCostActual: 0,
                percentOfTotal: 0,
                percentOfTotalActual: 0,
                cumPercent: 0,
                cumPercentActual: 0
            };
            allPeriodKeys.push(periodKey);
            current.setMonth(current.getMonth() + 1);
        }
    }

    // Planned cost allocation
    processedData.forEach(activity => {
        if (activity.plannedDate && activity.planneddatefinish && activity.plannedCost > 0) {
            const start = new Date(activity.plannedDate);
            const end = new Date(activity.planneddatefinish);
            start.setHours(0, 0, 0, 0);
            end.setHours(23, 59, 59, 999);

            const totalWorkingDays = countWorkingDays(start, end);
            if (totalWorkingDays <= 0) return; // Skip if no working days

            if (viewType === 'weekly') {
                // Iterate through each week in periods
                Object.keys(periods).forEach(periodKey => {
                    const period = periods[periodKey];
                    const weekStart = new Date(period.startDate);
                    const weekEnd = new Date(period.endDate);
                    weekStart.setHours(0, 0, 0, 0);
                    weekEnd.setHours(23, 59, 59, 999);

                    // Determine overlap between activity and week
                    const overlapStart = start > weekStart ? start : weekStart;
                    const overlapEnd = end < weekEnd ? end : weekEnd;

                    if (overlapStart <= overlapEnd) {
                        const workingDaysInWeek = countWorkingDays(overlapStart, overlapEnd);
                        if (workingDaysInWeek > 0) {
                            const costForWeek = (workingDaysInWeek / totalWorkingDays) * activity.plannedCost;
                            periods[periodKey].totalCost += costForWeek;
                        }
                    }
                });
            } else {
                // Monthly view allocation
                let current = new Date(start);
                while (current <= end) {
                    const dayOfWeek = current.getDay();
                    if (dayOfWeek !== 5) { // Exclude Friday
                        const periodKey = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`;
                        if (!periods[periodKey]) {
                            periods[periodKey] = {
                                totalCost: 0,
                                totalCostActual: 0,
                                cumulativeCost: 0,
                                cumulativeCostActual: 0,
                                percentOfTotal: 0,
                                percentOfTotalActual: 0,
                                cumPercent: 0,
                                cumPercentActual: 0
                            };
                            allPeriodKeys.push(periodKey);
                        }
                        const dailyCost = activity.plannedCost / totalWorkingDays;
                        periods[periodKey].totalCost += dailyCost;
                    }
                    current.setDate(current.getDate() + 1);
                }
            }
        }
    });

    // Actual cost allocation
    processedData.forEach(activity => {
        if (activity.actualDate && activity.actualCost > 0) {
            let actualDate = new Date(activity.actualDate);
            if (!(actualDate instanceof Date) || isNaN(actualDate.getTime())) {
                console.warn(`Invalid actualDate for activity ${activity.id}:`, activity.actualDate);
                return;
            }
            actualDate.setHours(0, 0, 0, 0);

            // Find the period (week) that contains actualDate
            let periodKey = null;
            if (viewType === 'weekly') {
                // Iterate through periods to find the matching week
                for (const key of Object.keys(periods)) {
                    const period = periods[key];
                    const weekStart = new Date(period.startDate);
                    const weekEnd = new Date(period.endDate);
                    weekStart.setHours(0, 0, 0, 0);
                    weekEnd.setHours(23, 59, 59, 999);

                    if (actualDate >= weekStart && actualDate <= weekEnd) {
                        periodKey = key;
                        break;
                    }
                }
                // If no period found, create a new one
                if (!periodKey) {
                    periodKey = getWeekNumber(actualDate, minDate);
                    if (!periods[periodKey]) {
                        const currentDay = actualDate.getDay();
                        let daysToThursday = (4 - currentDay + 7) % 7;
                        if (daysToThursday === 0) daysToThursday = 7;

                        const weekEnd = new Date(actualDate);
                        weekEnd.setDate(actualDate.getDate() + daysToThursday);
                        weekEnd.setHours(23, 59, 59, 999);

                        const weekStart = new Date(weekEnd);
                        weekStart.setDate(weekEnd.getDate() - 6);
                        weekStart.setHours(0, 0, 0, 0);

                        periods[periodKey] = {
                            totalCost: 0,
                            totalCostActual: 0,
                            cumulativeCost: 0,
                            cumulativeCostActual: 0,
                            percentOfTotal: 0,
                            percentOfTotalActual: 0,
                            cumPercent: 0,
                            cumPercentActual: 0,
                            startDate: weekStart,
                            endDate: weekEnd
                        };
                        allPeriodKeys.push(periodKey);
                    }
                }
            } else {
                // Monthly view
                periodKey = `${actualDate.getFullYear()}-${String(actualDate.getMonth() + 1).padStart(2, '0')}`;
                if (!periods[periodKey]) {
                    periods[periodKey] = {
                        totalCost: 0,
                        totalCostActual: 0,
                        cumulativeCost: 0,
                        cumulativeCostActual: 0,
                        percentOfTotal: 0,
                        percentOfTotalActual: 0,
                        cumPercent: 0,
                        cumPercentActual: 0
                    };
                    allPeriodKeys.push(periodKey);
                }
            }

            periods[periodKey].totalCostActual += activity.actualCost;
        }
    });

    const sortedPeriods = allPeriodKeys.sort((a, b) => {
        if (viewType === 'weekly') {
            return Number(a) - Number(b);
        } else {
            const [yearA, monthA] = a.split('-').map(Number);
            const [yearB, monthB] = b.split('-').map(Number);
            if (yearA !== yearB) return yearA - yearB;
            return monthA - monthB;
        }
    });

    let cumulativeCost = 0;
    let cumulativeCostActual = 0;
    const grandTotal = processedData.reduce((sum, activity) => sum + (activity.plannedCost || 0), 0);
    let plannedHasCompleted = false;

    sortedPeriods.forEach(period => {
        const periodInfo = periods[period];

        cumulativeCost += periodInfo.totalCost;
        periodInfo.cumulativeCost = cumulativeCost;
        periodInfo.percentOfTotal = grandTotal > 0 ? (periodInfo.totalCost / grandTotal) * 100 : 0;
        periodInfo.cumPercent = grandTotal > 0 ? (cumulativeCost / grandTotal) * 100 : 0;

        cumulativeCostActual += periodInfo.totalCostActual;
        periodInfo.cumulativeCostActual = cumulativeCostActual;
        periodInfo.percentOfTotalActual = grandTotal > 0 ? (periodInfo.totalCostActual / grandTotal) * 100 : 0;
        periodInfo.cumPercentActual = grandTotal > 0 ? (cumulativeCostActual / grandTotal) * 100 : 0;

        if (plannedHasCompleted || periodInfo.cumPercent >= 100) {
            periodInfo.cumulativeCost = grandTotal;
            periodInfo.cumPercent = 100;
            plannedHasCompleted = true;
        }
    });

    return { periods, sortedPeriods };
}
        function getWeekNumber(date, projectStartDate) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);

    // Set start to projectStartDate
    const start = new Date(projectStartDate);
    start.setHours(0, 0, 0, 0);

    // Calculate the difference in days between the date and project start
    const diffTime = d - start;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    // Find the day of the week for projectStartDate (0 = Sunday, ..., 6 = Saturday)
    const startDayOfWeek = start.getDay();
    // Calculate days to the next Thursday (end of week)
    let daysToThursday = (4 - startDayOfWeek + 7) % 7;
    if (daysToThursday === 0) daysToThursday = 7; // Ensure the first week includes the start date

    // Calculate the week number
    if (diffDays < daysToThursday) {
        return "1"; // Date falls in the first week
    }

    // Adjust diffDays to account for the first week
    const adjustedDiffDays = diffDays - daysToThursday;
    const weekNumber = Math.floor(adjustedDiffDays / 7) + 2; // +2 to account for first week and 1-based indexing

    return `${weekNumber}`;
}
       function generateCostTable(periods, periodData, viewType) {
    const table = document.getElementById('popup_comparisonTable');
    if (!table) {
        console.error('Comparison table not found');
        return;
    }

    table.innerHTML = '';

    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    let headerHTML = '<th>Metric</th>';
    periods.forEach(period => {
        let label;
        if (viewType === 'weekly') {
            label = `Week ${period}`;
        } else {
            const [year, month] = period.split('-');
            label = new Date(year, Number(month) - 1, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        }
        headerHTML += `<th>${label}</th>`;
    });
    headerRow.innerHTML = headerHTML;
    thead.appendChild(headerRow);

    const dateRow = document.createElement('tr');
    let dateHTML = '<th>End Date</th>'; // Label changed for clarity
    periods.forEach(period => {
        let dateLabel;
        if (viewType === 'weekly') {
            // For weekly view, use the endDate, which is now Thursday
            const endDate = periodData[period]?.endDate;
            dateLabel = endDate ? endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A';
        } else {
            const [year, month] = period.split('-');
            // Set to the last day of the month
            const monthEnd = new Date(year, Number(month), 0); // 0th day of next month = last day of current month
            dateLabel = monthEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        }
        dateHTML += `<th>${dateLabel}</th>`;
    });
    dateRow.innerHTML = dateHTML;
    thead.appendChild(dateRow);

    table.appendChild(thead);

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

        function createCostTrendChart(canvasId, periods, periodData) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) {
        console.error(`Canvas not found: ${canvasId}`);
        return;
    }
    if (charts[canvasId]) charts[canvasId].destroy();

    const labels = periods.map(period => {
        const [year, month] = period.split('-');
        return new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    });

    const datasets = [
        {
            label: 'Planned Cost (SAR)',
            data: periods.map(p => periodData[p]?.totalCost ?? 0),
            backgroundColor: 'rgba(59, 130, 246, 0.6)',
            borderColor: 'rgba(59, 130, 246, 1)',
            yAxisID: 'y'
        },
        {
            label: 'Actual Cost (SAR)',
            data: periods.map(p => periodData[p]?.totalCostActual ?? 0),
            backgroundColor: 'rgba(34, 197, 94, 0.6)',
            borderColor: 'rgba(34, 197, 94, 1)',
            yAxisID: 'y'
        },
        {
            label: 'Planned Cumulative Cost (SAR)',
            data: periods.map(p => periodData[p]?.cumulativeCost ?? 0),
            borderColor: 'rgba(236, 72, 153, 1)',
            backgroundColor: 'rgba(236, 72, 153, 0.3)',
            type: 'line',
            yAxisID: 'y1'
        },
        {
            label: 'Actual Cumulative Cost (SAR)',
            data: periods.map(p => periodData[p]?.cumulativeCostActual ?? 0),
            borderColor: 'rgba(139, 92, 246, 1)',
            backgroundColor: 'rgba(139, 92, 246, 0.3)',
            type: 'line',
            yAxisID: 'y1'
        }
    ];

    charts[canvasId] = new Chart(ctx, {
        type: 'bar',
        data: { labels, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            backgroundColor: '#ffffff',
            scales: {
                x: {
                    title: { display: true, text: 'Month', font: { size: 14, family: 'Poppins' } },
                    ticks: { font: { size: 12, family: 'Poppins' } }
                },
                y: {
                    type: 'linear',
                    position: 'left',
                    title: { display: true, text: 'Period Cost (SAR)', font: { size: 14, family: 'Poppins' } },
                    ticks: {
                        callback: value => value.toLocaleString('en-US', { style: 'currency', currency: 'SAR', minimumFractionDigits: 0 }),
                        font: { size: 12, family: 'Poppins' }
                    },
                    beginAtZero: true
                },
                y1: {
                    type: 'linear',
                    position: 'right',
                    title: { display: true, text: 'Cumulative Cost (SAR)', font: { size: 14, family: 'Poppins' } },
                    ticks: {
                        callback: value => value.toLocaleString('en-US', { style: 'currency', currency: 'SAR', minimumFractionDigits: 0 }),
                        font: { size: 12, family: 'Poppins' }
                    },
                    grid: { drawOnChartArea: false },
                    beginAtZero: true
                }
            },
            plugins: {
                tooltip: {
                    bodyFont: { size: 12, family: 'Poppins' },
                    titleFont: { size: 14, family: 'Poppins' },
                    callbacks: {
                        label: context => {
                            const value = context.raw;
                            return `${context.dataset.label}: ${value.toLocaleString('en-US', { style: 'currency', currency: 'SAR' })}`;
                        }
                    }
                },
                legend: {
                    display: true,
                    position: 'top',
                    labels: { font: { size: 12, family: 'Poppins' } }
                },
                datalabels: {
                    display: true,
                    font: { size: 10, family: 'Poppins' },
                    formatter: (value, context) => {
                        const dataIndex = context.dataIndex;
                        const periodKey = periods[dataIndex];
                        const currentPeriodData = periodData[periodKey] || {};
                        switch (context.datasetIndex) {
                            case 0: return (currentPeriodData.percentOfTotal ?? 0).toFixed(2) + '%';
                            case 1: return (currentPeriodData.percentOfTotalActual ?? 0).toFixed(2) + '%';
                            case 2: return (currentPeriodData.cumPercent ?? 0).toFixed(2) + '%';
                            case 3: return (currentPeriodData.cumPercentActual ?? 0).toFixed(2) + '%';
                            default: return '';
                        }
                    },
                    color: context => {
                        const colors = ['#1e3a8a', '#166534', '#be185d', '#6d28d9'];
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

        function createPieChart(canvasId, labels, data, backgroundColors) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) {
        console.error(`Canvas not found: ${canvasId}`);
        return;
    }
    if (charts[canvasId]) charts[canvasId].destroy();

    charts[canvasId] = new Chart(ctx, {
        type: 'pie',
        data: {
            labels,
            datasets: [{
                data,
                backgroundColor: ['#22c55e', '#d1d5db'],
                hoverOffset: 8,
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true, // Changed to true to respect aspect ratio
            aspectRatio: 1, // Ensures a square chart (1:1 ratio)
            layout: {
                padding: 5 // Reduced padding inside the chart
            },
            plugins: {
                legend: { display: false },
                title: { display: false },
                tooltip: {
                    bodyFont: { size: 12, family: 'Poppins' },
                    titleFont: { size: 14, family: 'Poppins' },
                    callbacks: {
                        label: context => `${context.label}: ${context.parsed.toFixed(2)}%`
                    }
                }
            }
        }
    });
}

        async function renderDashboard() {
    const rawData = await retrieveDynamoDBData();
    const { activities, minPlannedStartDate, maxPlannedStartDate, minPlannedFinishDate, maxPlannedFinishDate, minActualDate, maxActualDate } = processProjectData(rawData);
    const specificDateInput = document.getElementById('popup-date-input').value;
    const specificDate = specificDateInput ? new Date(specificDateInput + 'T00:00:00') : new Date();
    specificDate.setHours(0, 0, 0, 0);

    const metrics = calculateDashboardMetrics(activities, specificDate);
    const { periods, sortedPeriods } = aggregateWeeklyMonthlyData(activities, isWeeklyView ? 'weekly' : 'monthly');

    const formatCurrency = (value) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'SAR' }).format(value);
    function formatDate(date) {
    if (!date || !(date instanceof Date)) return 'N/A';
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
}
    // Update existing metrics
    document.getElementById('popup-total-planned-value').textContent = formatCurrency(metrics.totalPlannedCost);
    document.getElementById('popup-total-actual-value').textContent = formatCurrency(metrics.totalActualCost);
    document.getElementById('popup-planned-value-up-to-date').textContent = formatCurrency(metrics.plannedCostUpToDate);
    document.getElementById('popup-actual-value-up-to-date').textContent = formatCurrency(metrics.actualCostUpToDate);
    document.getElementById('popup-overall-actual-vs-planned-percentage').textContent = `${metrics.overallActualVsPlannedPercentage.toFixed(2)}%`;
    document.getElementById('popup-date-specific-actual-vs-planned-percentage').textContent = `${metrics.dateSpecificActualVsPlannedPercentage.toFixed(2)}%`;
    document.getElementById('popup-date-specific-planned-percentage').textContent = `${metrics.dateSpecificPlannedPercentage.toFixed(2)}%`;

    // Update new date metrics
    document.getElementById('popup-min-planned-start-date').textContent = formatDate(minPlannedStartDate);
    document.getElementById('popup-max-planned-finish-date').textContent = formatDate(maxPlannedFinishDate);
    document.getElementById('popup-min-actual-date').textContent = formatDate(minActualDate);
    document.getElementById('popup-max-actual-date').textContent = formatDate(maxActualDate);

    createPieChart('popup-chart-overall-percentage', ['Achieved', 'Remaining'], [metrics.overallActualVsPlannedPercentage, 100 - metrics.overallActualVsPlannedPercentage], ['#22c55e', '#d1d5db']);
    createPieChart('popup-chart-date-actual-percentage', ['Achieved', 'Remaining'], [metrics.dateSpecificActualVsPlannedPercentage, 100 - metrics.dateSpecificActualVsPlannedPercentage], ['#22c55e', '#d1d5db']);
    createPieChart('popup-chart-date-specific-planned', ['Completed', 'Remaining'], [metrics.dateSpecificPlannedPercentage, 100 - metrics.dateSpecificPlannedPercentage], ['#22c55e', '#d1d5db']);

    generateCostTable(sortedPeriods, periods, isWeeklyView ? 'weekly' : 'monthly');
    if (!isWeeklyView) {
        createCostTrendChart('popup-chart-actual-vs-planned-over-time', sortedPeriods, periods);
    }
}

        const today = new Date();
        document.getElementById('popup-date-input').value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

        const toggleViewBtn = document.getElementById('popup-toggle-view-btn');
        const downloadExcelBtn = document.getElementById('popup-download-excel-btn');
        const downloadChartBtn = document.getElementById('popup-download-chart-btn');
toggleViewBtn.textContent = 'Switch to Weekly Table'; // Set initial text to switch to weekly
toggleViewBtn.addEventListener('click', () => {
    isWeeklyView = !isWeeklyView;
    toggleViewBtn.textContent = isWeeklyView ? 'Switch to Monthly Table' : 'Switch to Weekly Table';
    renderDashboard();
});

        downloadExcelBtn.addEventListener('click', () => {
            downloadTableAsExcel('popup_comparisonTable', `Villa_${villa}_Cost_Data`);
        });

        downloadChartBtn.addEventListener('click', () => {
            downloadChartImage('popup-chart-actual-vs-planned-over-time');
        });

        document.getElementById('popup-date-input').addEventListener('change', renderDashboard);

        await renderDashboard();
    }

    loadDependencies().then(initializeDashboard);
}