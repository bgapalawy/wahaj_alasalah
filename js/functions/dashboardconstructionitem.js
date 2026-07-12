//construction items dashboard








//
function setupConstructionItemsDashboardWithToggle(SelectedConstuctionItem, SelectedConstuctionItemForpopup) {
    // Check for existing toggle button and dashboard container
    let toggleButton = document.getElementById('ConstructionItems_toggleDashboardBtn');
    let dashboardContainer = document.getElementById('ConstructionItems_dashboardContainer');

    // If the toggle button exists, remove it to avoid duplicates
    if (toggleButton) {
        toggleButton.remove();
    }

    // If the dashboard container exists, remove it to avoid duplicates
    if (dashboardContainer) {
        dashboardContainer.remove();
    }

    // Create and append the toggle button
    toggleButton = document.createElement('button');
    toggleButton.id = 'ConstructionItems_toggleDashboardBtn';
    toggleButton.textContent = 'Show Construction Item Dashboard';
    document.body.appendChild(toggleButton);

    // Create the dashboard container
    dashboardContainer = document.createElement('div');
    dashboardContainer.id = 'ConstructionItems_dashboardContainer';
    dashboardContainer.style.display = 'none'; // Initially hidden
    document.body.appendChild(dashboardContainer);

    let isDashboardVisible = false;

    // Modified dashboard function
    function loadAndRunConstructionItemsDashboard(container, layer = null) {
        const conItem = SelectedConstuctionItem;

        // --- 1. DYNAMICALLY LOAD DEPENDENCIES (CSS, FONTS, LIBS) ---
        function loadDependencies(callback) {
            const stylesAndFonts = `
                <link rel="preconnect" href="https://fonts.googleapis.com">
                <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
                <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;800&display=swap" rel="stylesheet">
                <style>
                    .construction-dashboard {
                        max-width: 100%;
                        padding: 20px;
                        font-family: 'Inter', sans-serif;
                        background-color: #f9fafb;
                    }
                    .construction-dashboard .chart-container {
                        position: relative;
                        height: 300px;
                        width: 100%;
                        margin-top: 15px;
                        background-color: #ffffff;
                    }
                    .construction-dashboard .input-group label {
                        display: block;
                        margin-bottom: 0.25rem;
                        font-weight: 500;
                        color: #374151;
                    }
                    .construction-dashboard .input-group input {
                        width: 100%;
                        padding: 0.5rem;
                        border: 1px solid #d1d5db;
                        border-radius: 0.375rem;
                        background: #fff;
                        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
                    }
                    .construction-dashboard .input-group input:focus {
                        outline: none;
                        border-color: #3b82f6;
                        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
                    }
                    .toggle-view-btn, .download-btn {
                        background: #4a6baf;
                        color: white;
                        border: none;
                        padding: 5px 10px;
                        border-radius: 4px;
                        cursor: pointer;
                        margin-bottom: 10px;
                        margin-right: 10px;
                    }
                    .toggle-view-btn:hover, .download-btn:hover {
                        background: #3a5a9f;
                    }
                    .table-container {
                        min-width: 1300px;
                        overflow-x: auto;
                        box-shadow: 0 0 20px rgba(0, 0, 0, 0.1);
                        border-radius: 8px;
                        margin-top: 20px;
                    }
                    #ConstructionItems_comparisonTable {
                        width: 100%;
                        border-collapse: collapse;
                        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                        margin: 0;
                        background: white;
                        border: 1px solid #ddd;
                    }
                    #ConstructionItems_comparisonTable th {
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
                    }
                    #ConstructionItems_comparisonTable th:first-child {
                        writing-mode: horizontal-tb;
                        text-align: left;
                        padding: 8px 12px;
                        min-width: auto;
                        max-width: none;
                        border-radius: 8px 0 0 0;
                        border-right: 2px solid #2980b9;
                    }
                    #ConstructionItems_comparisonTable th:last-child {
                        border-radius: 0 8px 0 0;
                        border-right: none;
                    }
                    #ConstructionItems_comparisonTable td {
                        padding: 6px 4px;
                        font-size: 12px;
                        text-align: center;
                        border-bottom: 1px solid #e0e0e0;
                        border-right: 1px solid #e0e0e0;
                    }
                    #ConstructionItems_comparisonTable td:first-child {
                        writing-mode: horizontal-tb;
                        transform: none;
                        text-align: left;
                        font-weight: 600;
                        color: #2c3e50;
                        padding: 8px 12px;
                        border-right: 2px solid #2980b9;
                        background-color: #f8f9fa;
                    }
                    #ConstructionItems_comparisonTable tr:nth-child(1) td,
                    #ConstructionItems_comparisonTable tr:nth-child(2) td {
                        writing-mode: horizontal-tb;
                        background-color: #e9f7fe;
                        font-size: 10px;
                        padding: 3px 2px;
                        min-width: 22px;
                        max-width: 34px;
                        font-weight: 500;
                    }
                    #ConstructionItems_comparisonTable tr:nth-child(1) td:first-child,
                    #ConstructionItems_comparisonTable tr:nth-child(2) td:first-child {
                        writing-mode: horizontal-tb;
                        transform: none;
                        padding: 8px 12px;
                        min-width: auto;
                        max-width: none;
                        background-color: #f8f9fa;
                        border-right: 2px solid #2980b9;
                    }
                    #ConstructionItems_comparisonTable thead tr {
                        border-bottom: 2px solid #2980b9;
                    }
                    #ConstructionItems_comparisonTable tr:nth-child(3) td,
                    #ConstructionItems_comparisonTable tr:nth-child(5) td,
                    #ConstructionItems_comparisonTable tr:nth-child(8) td,
                    #ConstructionItems_comparisonTable tr:nth-child(10) td {
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
                    .separator {
                        height: 7px;
                        background-color: black;
                    }
                    .separator td {
                        padding: 0 !important;
                        height: 7px;
                        background-color: black;
                    }
                    #ConstructionItems_comparisonTable tr:hover td {
                        background-color: #f1f9ff;
                    }
                    @media (max-width: 768px) {
                        #ConstructionItems_comparisonTable th {
                            font-size: 9px;
                            min-width: 14px;
                            max-width: 20px;
                            padding: 2px 1px;
                        }
                        #ConstructionItems_comparisonTable th:first-child {
                            padding: 6px 8px;
                        }
                        #ConstructionItems_comparisonTable tr:nth-child(1) td,
                        #ConstructionItems_comparisonTable tr:nth-child(2) td {
                            font-size: 8px;
                            min-width: 12px;
                            max-width: 18px;
                            padding: 2px 1px;
                        }
                        #ConstructionItems_comparisonTable td {
                            font-size: 10px;
                            padding: 3px 2px;
                        }
                        #ConstructionItems_comparisonTable td:first-child {
                            padding: 6px 8px;
                        }
                            @media (max-width: 1024px) {
    .construction-dashboard .grid-cols-4 {
        grid-template-columns: repeat(3, minmax(0, 1fr));
    }
}
@media (max-width: 768px) {
    .construction-dashboard .grid-cols-4 {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }
}
@media (max-width: 640px) {
    .construction-dashboard .grid-cols-4 {
        grid-template-columns: repeat(1, minmax(0, 1fr));
    }
}
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

            loadScript('https://cdn.tailwindcss.com', () => {
                loadScript('https://cdn.jsdelivr.net/npm/chart.js', () => {
                    loadScript('https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2.0.0', () => {
                        loadScript('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js', () => {
                            if (typeof XLSX === 'undefined') {
                                console.error('XLSX library failed to initialize.');
                            }
                            callback();
                        });
                    });
                });
            });
        }

        // --- 2. DEFINE THE DASHBOARD APPLICATION LOGIC ---
        function initializeDashboard() {
            function downloadTablecashAsExcel(tableId, filenamePrefix) {
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
                                if (cellText.endsWith(' SAR')) return parseFloat(cellText.replace(' SAR', '').replace(/,/g, '')) || 0;
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
                    const timestamp = new Date().toISOString().replace(/[:.-]/g, '').split('T')[0] + '_' + new Date().toTimeString().split(' ')[0].replace(/:/g, '');
                    XLSX.writeFile(wb, `${filenamePrefix}_${timestamp}.xlsx`);
                } catch (error) {
                    console.error('Error exporting table to Excel:', error);
                    alert('Failed to export table to Excel. Please check the console for details.');
                }
            }

            function getDashboardHTML() {
    return `
    <div class="construction-dashboard">
        <h2 class="text-2xl font-bold text-center text-gray-800 mb-6">Construction Items Performance: ${SelectedConstuctionItemForpopup} : ${conItem}</h2>
        <div class="flex flex-col gap-6">
            <div class="p-6 bg-white rounded-lg shadow-sm border border-gray-200">
                <h3 class="text-lg font-semibold text-gray-700 mb-3">Set Specific Date for Analysis</h3>
                <div class="input-group">
                    <label for="ConstructionItems_specificDate" class="text-gray-600">Select Date:</label>
                    <input type="date" id="ConstructionItems_specificDate" class="mt-1 block w-full">
                </div>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <div class="p-6 bg-white rounded-lg shadow-sm border border-gray-200">
                    <h3 class="text-lg font-semibold text-gray-700 mb-2">Total Budget Cost</h3>
                    <p id="ConstructionItems_totalPlannedValue" class="text-2xl font-bold text-gray-900">$0.00</p>
                    <h3 class="text-lg font-semibold text-gray-700 mb-2">Total Actual Value</h3>
                    <p id="ConstructionItems_totalActualValue" class="text-2xl font-bold text-gray-900">$0.00</p>
                </div>
                <div class="p-6 bg-white rounded-lg shadow-sm border border-gray-200">
                    <h3 class="text-lg font-semibold text-gray-700 mb-2">Planned Value (Up to Date)</h3>
                    <p id="ConstructionItems_plannedValueUpToDate" class="text-2xl font-bold text-gray-900">$0.00</p>

                     <h3 class="text-lg font-semibold text-gray-700 mb-2">Actual Value (Up to Date)</h3>
                    <p id="ConstructionItems_actualValueUpToDate" class="text-2xl font-bold text-gray-900">$0.00</p>
                </div>
               
                <div class="p-6 bg-white rounded-lg shadow-sm border border-gray-200">
                    <h3 class="text-lg font-semibold text-gray-700 mb-2">Planned Start Date</h3>
                    <p id="ConstructionItems_minPlannedStartDate" class="text-2xl font-bold text-gray-900">N/A</p>
                    <h3 class="text-lg font-semibold text-gray-700 mb-2">Planned Finish Date</h3>
                    <p id="ConstructionItems_maxPlannedFinishDate" class="text-2xl font-bold text-gray-900">N/A</p>
                </div>
                <div class="p-6 bg-white rounded-lg shadow-sm border border-gray-200">
                    <h3 class="text-lg font-semibold text-gray-700 mb-2">First Actual Start Date</h3>
                    <p id="ConstructionItems_minActualDate" class="text-2xl font-bold text-gray-900">N/A</p>
                    <h3 class="text-lg font-semibold text-gray-700 mb-2">Last Actual Recorded Date</h3>
                    <p id="ConstructionItems_maxActualDate" class="text-2xl font-bold text-gray-900">N/A</p>
                </div>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                <div class="p-6 bg-white rounded-lg shadow-sm border border-gray-200">
                    <h3 class="text-lg font-semibold text-gray-700 mb-2">Overall % Actual</h3>
                    <p id="ConstructionItems_overallActualVsPlannedPercentage" class="text-xl font-bold text-gray-900">0.00%</p>
                    <div class="chart-container" style="height: 200px;"><canvas id="ConstructionItems_chartOverallActualVsPlannedPercentage"></canvas></div>
                </div>
                <div class="p-6 bg-white rounded-lg shadow-sm border border-gray-200">
                    <h3 class="text-lg font-semibold text-gray-700 mb-2">Actual (Selected Date)</h3>
                    <p id="ConstructionItems_dateSpecificActualVsPlannedPercentage" class="text-xl font-bold text-gray-900">0.00%</p>
                    <div class="chart-container" style="height: 200px;"><canvas id="ConstructionItems_chartDateActualVsPlannedPercentage"></canvas></div>
                </div>
                <div class="p-6 bg-white rounded-lg shadow-sm border border-gray-200">
                    <h3 class="text-lg font-semibold text-gray-700 mb-2">Planned % Completion (Selected Date)</h3>
                    <p id="ConstructionItems_dateSpecificPlannedPercentage" class="text-xl font-bold text-gray-900">0.00%</p>
                    <div class="chart-container" style="height: 200px;"><canvas id="ConstructionItems_chartDateSpecificPlannedPercentage"></canvas></div>
                </div>
            </div>
            <div class="p-6 bg-white rounded-lg shadow-sm border border-gray-200">
                <h3 class="text-lg font-semibold text-gray-700 mb-3">Actual vs Planned Over Time</h3>
                <button id="ConstructionItems_toggleViewBtn" class="toggle-view-btn">Switch to Weekly View</button>
                <button id="ConstructionItems_downloadExcelBtn" class="download-btn">Download Table as Excel</button>
                <button id="ConstructionItems_downloadChartBtn" class="download-btn">Download Chart as Image</button>
                <div class="chart-container"><canvas id="ConstructionItems_chartActualVsPlannedOverTime"></canvas></div>
                <div class="table-container">
                    <table id="ConstructionItems_comparisonTable" class="data-table">
                        <thead></thead>
                        <tbody></tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>
    `;
}

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
// Update the formatDate function to handle null values
function formatDate(date, isFinishDate = false) {
    if (!date) return 'N/A';
    const convertedDate = convertExcelDateToJSDateForDisplay(date, isFinishDate);
    if (!convertedDate || !(convertedDate instanceof Date) || isNaN(convertedDate.getTime())) return 'N/A';
    const day = String(convertedDate.getDate()).padStart(2, '0');
    const month = String(convertedDate.getMonth() + 1).padStart(2, '0');
    const year = convertedDate.getFullYear();
    return `${day}/${month}/${year}`;
}




function convertExcelDateToJSDateForDisplay(date, isFinishDate = false) {
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
// Function for date conversion used only for retrieval and display
  

            async function retrieveDynamoDBData() {
                const [mockPlannedCosts, mockActualCosts, mockPlannedDates, mockActualDates, mockPlannedDatesFinish] = await Promise.all([
                    retrieveAndCountDataFromDynamoDB(plannedCostsTable, conItem),
                    retrieveAndCountDataFromDynamoDB(ActualCostsTable, conItem),
                    retrieveAndCountDataFromDynamoDB(plannedDatesTable, conItem),
                    retrieveAndCountDataFromDynamoDB(ActualDatesTable, conItem),
                    retrieveAndCountDataFromDynamoDB(plannedDatesFinishTable, conItem),
                ]);

                return {
                    plannedCosts: transformRetrievedDataToMap(mockPlannedCosts),
                    actualCosts: transformRetrievedDataToMap(mockActualCosts),
                    plannedDates: transformRetrievedDataToMap(mockPlannedDates),
                    actualDates: transformRetrievedDataToMap(mockActualDates),
                    planneddatesfinish: transformRetrievedDataToMap(mockPlannedDatesFinish)
                };
            }

            function transformRetrievedDataToMap(data) {
                const transformedObject = {};

                data.retrievedData.forEach(item => {
                    const key = item.villaID;
                    const value = item[conItem];
                    transformedObject[key] = value;
                });

                return transformedObject;
            }

            // Modify the processProjectData function to use the appropriate conversion function
            function processProjectData(rawData) {
                const { plannedCosts, actualCosts, plannedDates, actualDates, planneddatesfinish } = rawData;
                const activitiesMap = new Map();

                for (const key in plannedCosts) {
                    if (Object.hasOwnProperty.call(plannedCosts, key)) {
                        activitiesMap.set(key, {
                            id: key,
                            plannedCost: parseFloat(plannedCosts[key]) || 0,
                            plannedDate: convertExcelDateToJSDateForCalculations(parseFloat(plannedDates[key])),
                            planneddatefinish: convertExcelDateToJSDateForCalculations(parseFloat(planneddatesfinish[key])),
                            actualDateView: null,
                            actualCost: 0,
                            actualDate: null,
                            plannedDateView: convertExcelDateToJSDateForDisplay(parseFloat(plannedDates[key])),
                            planneddatefinishView: convertExcelDateToJSDateForDisplay(parseFloat(planneddatesfinish[key])),

                        });
                    }
                }

                for (const key in actualCosts) {
                    if (Object.hasOwnProperty.call(actualCosts, key)) {
                        let activity = activitiesMap.get(key) || {
                            id: key,
                            plannedCost: 0,
                            plannedDate: null,
                            planneddatefinish: null
                        };
                        activity.actualCost = parseFloat(actualCosts[key]) || 0;
                        activity.actualDate = convertExcelDateToJSDateForCalculations(parseFloat(actualDates[key]));
                        activity.actualDateView=convertExcelDateToJSDateForDisplay(parseFloat(actualDates[key]));
                        activitiesMap.set(key, activity);
                    }
                }

                return Array.from(activitiesMap.values());
            }

            const countWorkingDays = (start, end) => {
                let count = 0;
                const current = new Date(start);
                current.setHours(0, 0, 0, 0);

                const endDay = new Date(end);
                endDay.setHours(23, 59, 59, 999);

                while (current <= endDay) {
                    const dayOfWeek = current.getDay();
                    if (dayOfWeek !== 5) { // Exclude Friday
                        count++;
                    }
                    current.setDate(current.getDate() + 1);
                }
                return count;
            };

         function calculateDashboardMetrics(processedData, specificDate) {
    let totalPlannedCost = 0;
    let totalActualCost = 0;
    let plannedCostUpToDate = 0;
    let actualCostUpToDate = 0;
    let minPlannedStartDate = null;
    let maxPlannedFinishDate = null;
    let minActualDate = null;
    let maxActualDate = null;
    let minactualdateViewer=null;
    let maxActualDateViewer = null;
let minPlannedStartDateView = null;
let maxPlannedFinishDateView = null;
    // Set the time of specificDate to the end of the day
    specificDate.setHours(23, 59, 59, 999);

    processedData.forEach(activity => {
        const plannedStartDate = new Date(activity.plannedDate);
        const plannedFinishDate = new Date(activity.planneddatefinish);
        const plannedStartDateView = new Date(activity.plannedDateView);
        const plannedFinishDateView = new Date(activity.planneddatefinishView);
        const actualDate = activity.actualDate ? new Date(activity.actualDate) : null;
      const actualdateViewer = activity.actualDateView ? new Date(activity.actualDateView) : null;
        // Update total costs
        totalPlannedCost += activity.plannedCost || 0;
        totalActualCost += activity.actualCost || 0;

        // Calculate planned cost up to specific date
        if (plannedStartDate <= specificDate) {
            if (plannedFinishDate <= specificDate) {
                // If the activity is fully within the date range, add all of its cost
                plannedCostUpToDate += activity.plannedCost || 0;
            } else {
                // If the activity spans beyond the specific date, prorate the cost
                const totalDays = countWorkingDays(plannedStartDate, plannedFinishDate);
                const daysWithinRange = countWorkingDays(plannedStartDate, specificDate);
                const proRatedCost = (activity.plannedCost || 0) * (daysWithinRange / totalDays);
                plannedCostUpToDate += proRatedCost;
            }
        }

        // Update actual cost up to specific date
        if (actualDate && actualDate <= specificDate) {
            actualCostUpToDate += activity.actualCost || 0;
        }

        // Update date ranges
        if (plannedStartDateView && (!minPlannedStartDateView || plannedStartDateView < minPlannedStartDateView)) minPlannedStartDateView = plannedStartDateView;
        if (plannedFinishDateView && (!maxPlannedFinishDateView || plannedFinishDateView > maxPlannedFinishDateView)) maxPlannedFinishDateView = plannedFinishDateView;
        if (actualdateViewer) {
            if (!minactualdateViewer || actualdateViewer < minactualdateViewer) minactualdateViewer = actualdateViewer;
            if (!maxActualDateViewer || actualdateViewer > maxActualDateViewer) maxActualDateViewer = actualdateViewer;
        }
        if (plannedStartDate && (!minPlannedStartDate || plannedStartDate < minPlannedStartDate)) minPlannedStartDate = plannedStartDate;
        if (plannedFinishDate && (!maxPlannedFinishDate || plannedFinishDate > maxPlannedFinishDate)) maxPlannedFinishDate = plannedFinishDate;
        if (actualDate) {
            if (!minActualDate || actualDate < minActualDate) minActualDate = actualDate;
            if (!maxActualDate || actualDate > maxActualDate) maxActualDate = actualDate;
        }
    });

    return {
        totalPlannedCost,
        totalActualCost,
        plannedCostUpToDate,
        actualCostUpToDate,
        overallActualVsPlannedPercentage: totalPlannedCost > 0 ? (totalActualCost / totalPlannedCost) * 100 : 0,
        dateSpecificActualVsPlannedPercentage: plannedCostUpToDate > 0 ? (actualCostUpToDate / plannedCostUpToDate) * 100 : 0,
        dateSpecificPlannedPercentage: totalPlannedCost > 0 ? (plannedCostUpToDate / totalPlannedCost) * 100 : 0,
        minPlannedStartDate,
        maxPlannedFinishDate,
        minActualDate,
        maxActualDate,
        minactualdateViewer,
    maxActualDateViewer,
    minPlannedStartDateView ,
 maxPlannedFinishDateView,
    };
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
                            Object.keys(periods).forEach(periodKey => {
                                const period = periods[periodKey];
                                const weekStart = new Date(period.startDate);
                                const weekEnd = new Date(period.endDate);
                                weekStart.setHours(0, 0, 0, 0);
                                weekEnd.setHours(23, 59, 59, 999);

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

                        let periodKey = null;
                        if (viewType === 'weekly') {
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

                const start = new Date(projectStartDate);
                start.setHours(0, 0, 0, 0);

                const diffTime = d - start;
                const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

                const startDayOfWeek = start.getDay();
                let daysToThursday = (4 - startDayOfWeek + 7) % 7;
                if (daysToThursday === 0) daysToThursday = 7;

                if (diffDays < daysToThursday) {
                    return "1";
                }

                const adjustedDiffDays = diffDays - daysToThursday;
                const weekNumber = Math.floor(adjustedDiffDays / 7) + 2;
                return `${weekNumber}`;
            }

            function generateCostTable(periods, periodData, viewType) {
                const table = document.getElementById('ConstructionItems_comparisonTable');
                if (!table) return;

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
                let dateHTML = '<th>End Date</th>';
                periods.forEach(period => {
                    let dateLabel;
                    if (viewType === 'weekly') {
                        const endDate = periodData[period]?.endDate;
                        dateLabel = endDate ? endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A';
                    } else {
                        const [year, month] = period.split('-');
                        const monthEnd = new Date(year, Number(month), 0);
                        dateLabel = monthEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                    }
                    dateHTML += `<th>${dateLabel}</th>`;
                });
                dateRow.innerHTML = dateHTML;
                thead.appendChild(dateRow);

                table.appendChild(thead);

                const tbody = document.createElement('tbody');
                const rows = [
                    ['Planned Period Cost (SAR)', periods.map(p => periodData[p]?.totalCost.toLocaleString('en-US', { style: 'currency', currency: 'SAR' }) || 'N/A')],
                    ['Actual Period Cost (SAR)', periods.map(p => periodData[p]?.totalCostActual.toLocaleString('en-US', { style: 'currency', currency: 'SAR' }) || 'N/A')],
                    ['Planned Cumulative Cost (SAR)', periods.map(p => periodData[p]?.cumulativeCost.toLocaleString('en-US', { style: 'currency', currency: 'SAR' }) || 'N/A')],
                    ['Actual Cumulative Cost (SAR)', periods.map(p => periodData[p]?.cumulativeCostActual.toLocaleString('en-US', { style: 'currency', currency: 'SAR' }) || 'N/A')],
                    ['separator', []],
                    ['Planned Period %', periods.map(p => periodData[p]?.percentOfTotal.toFixed(2) + '%' || 'N/A')],
                    ['Actual Period % of Planned', periods.map(p => periodData[p]?.percentOfTotalActual.toFixed(2) + '%' || 'N/A')],
                    ['Planned Cumulative %', periods.map(p => periodData[p]?.cumPercent.toFixed(2) + '%' || 'N/A')],
                    ['Actual Cumulative % of Planned', periods.map(p => periodData[p]?.cumPercentActual.toFixed(2) + '%' || 'N/A')]
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

            function downloadChartImage(canvasId) {
                const canvas = document.getElementById(canvasId);
                if (!canvas) {
                    console.error(`Canvas with ID ${canvasId} not found`);
                    return;
                }

                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = canvas.width;
                tempCanvas.height = canvas.height;
                const tempCtx = tempCanvas.getContext('2d');

                tempCtx.drawImage(canvas, 0, 0);

                tempCtx.globalCompositeOperation = 'destination-over';
                tempCtx.fillStyle = '#ffffff';
                tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

                const link = document.createElement('a');
                link.href = tempCanvas.toDataURL('image/png');
                const timestamp = new Date().toISOString().replace(/[:.-]/g, '').split('T')[0];
                link.download = `Cost_Trend_Chart_${timestamp}.png`;
                link.click();

                link.remove();
                tempCanvas.remove();
            }

            function createCostTrendChart(canvasId, periods, periodData) {
                const ctx = document.getElementById(canvasId);
                if (!ctx) return;
                if (charts[canvasId]) charts[canvasId].destroy();

                const labels = periods.map(period => {
                    const [year, month] = period.split('-');
                    return new Date(year, Number(month) - 1, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
                });

                const datasets = [
                    {
                        label: 'Planned Period Cost (SAR)',
                        data: periods.map(p => periodData[p]?.totalCost || 0),
                        backgroundColor: 'rgba(100, 149, 237, 0.5)',
                        borderColor: 'rgba(100, 149, 237, 1)',
                        yAxisID: 'y'
                    },
                    {
                        label: 'Actual Period Cost (SAR)',
                        data: periods.map(p => periodData[p]?.totalCostActual || 0),
                        backgroundColor: 'rgba(152, 251, 152, 0.5)',
                        borderColor: 'rgba(152, 251, 152, 1)',
                        yAxisID: 'y'
                    },
                    {
                        label: 'Planned Cumulative Cost (SAR)',
                        data: periods.map(p => periodData[p]?.cumulativeCost || 0),
                        borderColor: 'rgba(255, 105, 180, 1)',
                        backgroundColor: 'rgba(255, 105, 180, 0.3)',
                        type: 'line',
                        yAxisID: 'y1'
                    },
                    {
                        label: 'Actual Cumulative Cost (SAR)',
                        data: periods.map(p => periodData[p]?.cumulativeCostActual || 0),
                        borderColor: 'rgba(147, 112, 219, 1)',
                        backgroundColor: 'rgba(147, 112, 219, 0.3)',
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
                                title: { display: true, text: 'Month', font: { size: 16, weight: 'bold' } },
                                ticks: { font: { size: 14 } }
                            },
                            y: {
                                type: 'linear',
                                position: 'left',
                                title: { display: true, text: 'Period Cost (SAR)', font: { size: 16, weight: 'bold' } },
                                ticks: {
                                    callback: value => value.toLocaleString('en-US', { style: 'currency', currency: 'SAR' }),
                                    font: { size: 14 }
                                },
                                beginAtZero: true
                            },
                            y1: {
                                type: 'linear',
                                position: 'right',
                                title: { display: true, text: 'Cumulative Cost (SAR)', font: { size: 16, weight: 'bold' } },
                                ticks: {
                                    callback: value => value.toLocaleString('en-US', { style: 'currency', currency: 'SAR' }),
                                    font: { size: 14 }
                                },
                                grid: { drawOnChartArea: false },
                                beginAtZero: true
                            }
                        },
                        plugins: {
                            tooltip: {
                                bodyFont: { size: 14 },
                                titleFont: { size: 16, weight: 'bold' },
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
                                labels: { font: { size: 14 } }
                            },
                            datalabels: {
                                display: true,
                                font: { size: 10, weight: 'normal' },
                                formatter: (value, context) => {
                                    const dataIndex = context.dataIndex;
                                    const periodKey = periods[dataIndex];
                                    const currentPeriodData = periodData[periodKey];
                                    switch (context.datasetIndex) {
                                        case 0: return currentPeriodData?.percentOfTotal.toFixed(2) + '%';
                                        case 1: return currentPeriodData?.percentOfTotalActual.toFixed(2) + '%';
                                        case 2: return currentPeriodData?.cumPercent.toFixed(2) + '%';
                                        case 3: return currentPeriodData?.cumPercentActual.toFixed(2) + '%';
                                        default: return '';
                                    }
                                },
                                color: context => {
                                    const colors = ['#00008B', '#006400', '#C71585', '#4B0082'];
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
                if (!ctx) return;
                if (charts[canvasId]) charts[canvasId].destroy();

                charts[canvasId] = new Chart(ctx, {
                    type: 'pie',
                    data: {
                        labels,
                        datasets: [{
                            data,
                            backgroundColor: backgroundColors,
                            hoverOffset: 4,
                            borderWidth: 0
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        backgroundColor: '#ffffff',
                        plugins: {
                            legend: { display: false },
                            title: { display: false },
                            tooltip: {
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
    const processedData = processProjectData(rawData);
    const specificDateInput = document.getElementById('ConstructionItems_specificDate').value;
    const specificDate = specificDateInput ? new Date(specificDateInput + 'T00:00:00') : new Date();
    specificDate.setHours(0, 0, 0, 0);

    const metrics = calculateDashboardMetrics(processedData, specificDate);

    const tableData = aggregateWeeklyMonthlyData(processedData, isWeeklyView ? 'weekly' : 'monthly');
    const chartData = aggregateWeeklyMonthlyData(processedData, 'monthly'); // Always use monthly for chart

     const formatCurrency = (value) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'SAR' }).format(value);

    // Update existing metrics
    document.getElementById('ConstructionItems_totalPlannedValue').textContent = formatCurrency(metrics.totalPlannedCost);
    document.getElementById('ConstructionItems_totalActualValue').textContent = formatCurrency(metrics.totalActualCost);
    document.getElementById('ConstructionItems_plannedValueUpToDate').textContent = formatCurrency(metrics.plannedCostUpToDate);
    document.getElementById('ConstructionItems_actualValueUpToDate').textContent = formatCurrency(metrics.actualCostUpToDate);
    document.getElementById('ConstructionItems_overallActualVsPlannedPercentage').textContent = `${metrics.overallActualVsPlannedPercentage.toFixed(2)}%`;
    document.getElementById('ConstructionItems_dateSpecificActualVsPlannedPercentage').textContent = `${metrics.dateSpecificActualVsPlannedPercentage.toFixed(2)}%`;
    document.getElementById('ConstructionItems_dateSpecificPlannedPercentage').textContent = `${metrics.dateSpecificPlannedPercentage.toFixed(2)}%`;

    // Debug logging
    console.log("Raw minActualDate:", metrics.minActualDate);
    console.log("Raw maxActualDate:", metrics.maxActualDate);
    console.log("Raw minPlannedStartDate:", metrics.minPlannedStartDate);
    console.log("Raw maxPlannedFinishDate:", metrics.maxPlannedFinishDate);

    // Update date metrics using convertExcelDateToJSDateForDisplay
    const minActualDate = convertExcelDateToJSDateForDisplay(metrics.minActualDate,true);
    const maxActualDate = convertExcelDateToJSDateForDisplay(metrics.maxActualDate,true);
    const minPlannedStartDate = formatDate(metrics.minPlannedStartDate, false);
const maxPlannedFinishDate = formatDate(metrics.maxPlannedFinishDate, true);

    console.log("Converted minActualDate:", minActualDate);
    console.log("Converted maxActualDate:", maxActualDate);
    console.log("Converted minPlannedStartDate:", minPlannedStartDate);
    console.log("Converted maxPlannedFinishDate:", maxPlannedFinishDate);

    document.getElementById('ConstructionItems_minActualDate').textContent = formatDate(metrics.minactualdateViewer);
    document.getElementById('ConstructionItems_maxActualDate').textContent = formatDate(metrics.maxActualDateViewer);
    document.getElementById('ConstructionItems_minPlannedStartDate').textContent = formatDate(metrics.minPlannedStartDateView);
    document.getElementById('ConstructionItems_maxPlannedFinishDate').textContent = formatDate(metrics.maxPlannedFinishDateView);


    const percentageColors = ['#10B981', '#E5E7EB'];
    createPieChart('ConstructionItems_chartOverallActualVsPlannedPercentage', ['Achieved', 'Remaining'], [metrics.overallActualVsPlannedPercentage, 100 - metrics.overallActualVsPlannedPercentage], percentageColors);
    createPieChart('ConstructionItems_chartDateActualVsPlannedPercentage', ['Achieved', 'Remaining'], [metrics.dateSpecificActualVsPlannedPercentage, 100 - metrics.dateSpecificActualVsPlannedPercentage], percentageColors);
    createPieChart('ConstructionItems_chartDateSpecificPlannedPercentage', ['Completed', 'Remaining'], [metrics.dateSpecificPlannedPercentage, 100 - metrics.dateSpecificPlannedPercentage], percentageColors);

    generateCostTable(tableData.sortedPeriods, tableData.periods, isWeeklyView ? 'weekly' : 'monthly');
    createCostTrendChart('ConstructionItems_chartActualVsPlannedOverTime', chartData.sortedPeriods, chartData.periods);

    
}
document.getElementById('ConstructionItems_downloadExcelBtn').addEventListener('click', () => {
        downloadTablecashAsExcel('ConstructionItems_comparisonTable', 'Cost_Data');
    });

    document.getElementById('ConstructionItems_downloadChartBtn').addEventListener('click', () => {
        downloadChartImage('ConstructionItems_chartActualVsPlannedOverTime');
    });
            const today = new Date();
            document.getElementById('ConstructionItems_specificDate').value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

            document.getElementById('ConstructionItems_toggleViewBtn').addEventListener('click', () => {
                isWeeklyView = !isWeeklyView;
                document.getElementById('ConstructionItems_toggleViewBtn').textContent = isWeeklyView ? 'Switch to Monthly View' : 'Switch to Weekly View';
                renderDashboard();
            });

            document.getElementById('ConstructionItems_specificDate').addEventListener('change', renderDashboard);

            renderDashboard();
        }

        loadDependencies(initializeDashboard);
    }

    toggleButton.addEventListener('click', () => {
        isDashboardVisible = !isDashboardVisible;
        if (isDashboardVisible) {
            dashboardContainer.style.display = 'block';
            toggleButton.textContent = 'Hide Construction Item Dashboard';
            loadAndRunConstructionItemsDashboard(dashboardContainer);
        } else {
            dashboardContainer.style.display = 'none';
            toggleButton.textContent = 'Show Construction Item Dashboard';
            dashboardContainer.innerHTML = '';
        }
    });
}