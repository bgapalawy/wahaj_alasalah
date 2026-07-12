







class ExcelDatabaseManager {
 constructor() {
    // Initialize DynamoDB clients
    this.dynamoDb = new AWS.DynamoDB();
    this.dynamoDb2 = new AWS.DynamoDB.DocumentClient();
    
    // Constants
    this.progressTable = WajhaDatatable;
    this.invoiceTable = wajhaInvoicetable;
    this.primaryKeyName = "villaID";
    
    // Store DOM elements
    this.container = null;
    this.downloadButton = null;
    
    // Initialize the UI
    this.initUploadExcel();
  }


  createUploadExcelContainer() {
    this.container = document.createElement("div");
    this.container.id = "containeruplaodexcel";
    document.body.appendChild(this.container);

    const containeruplaodexcelstatus = document.createElement("div");
    containeruplaodexcelstatus.id = "status";
    document.body.appendChild(containeruplaodexcelstatus);

    return this.container;
  }

  createHeader() {
    const header2 = document.createElement("h1");
    header2.textContent = "Upload or Download Excel to Database";
    this.container.appendChild(header2);
  }

  createSheetNameInput() {
    const sheetNameInput = document.createElement("input");
    sheetNameInput.type = "text";
    sheetNameInput.id = "sheetNameInput";
    sheetNameInput.placeholder = "Enter name of the tab in excel sheet";
    this.container.appendChild(sheetNameInput);
  }

  createTableSelect() {
    const tableSelect = document.createElement("select");
    tableSelect.id = "tableSelect";

    const tables = [
      { value: WajhaDatatable, text: "Wajha progress All" },
      { value: wajhaInvoicetable, text: "Wajha Invoice total" },
      { value: wajhaspecialquerytable, text: "Wajha special query" },
      { value: plannedDatesTable, text: "Wajha planned Dates table" },
      { value: plannedCostsTable, text: "Wajha planned costs table" },
      { value: ActualDatesTable, text: "Wajha Actual Dates table" },
      { value: ActualCostsTable, text: "Wajha Actual costs table" },
      { value: plannedDatesFinishTable, text: "Wajha planned Dates Finish table" }
    ];

    tables.forEach(table => {
      const option = document.createElement("option");
      option.value = table.value;
      option.textContent = table.text;
      tableSelect.appendChild(option);
    });

    this.container.appendChild(tableSelect);
    return tableSelect;
  }

  createFileInput() {
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.id = "fileInput";
    fileInput.accept = ".xlsx, .xls, .xlsm";
    this.container.appendChild(fileInput);
  }

  createUploadButton() {
    const uploadButton = document.createElement("button");
    uploadButton.textContent = "Upload to Database";
    uploadButton.id="Upload_xlsx_to_Database";
    uploadButton.onclick = () => this.processFile();
    this.container.appendChild(uploadButton);
  }

  createDownloadButton() {
    this.downloadButton = document.createElement("button");
    this.downloadButton.textContent = "Download Table Data";
    this.downloadButton.style.cssText = `
      margin: 10px 0;
      padding: 10px;
      background-color: #4CAF50;
      color: white;
      border: none;
      border-radius: 5px;
      cursor: pointer;
    `;
    this.downloadButton.onclick = () => this.downloadTableData();
    this.container.appendChild(this.downloadButton);
    return this.downloadButton;
  }

  createConvertButtons() {
    const button_convert_readyToPay_to_Paid = document.createElement("button");
    button_convert_readyToPay_to_Paid.innerHTML = "button_convert_readyToPay_to_Paid";
    button_convert_readyToPay_to_Paid.id = "button_convert_readyToPay_to_Paid";
    button_convert_readyToPay_to_Paid.onclick = () => this.convertReadyToPayToPaid();
    this.container.appendChild(button_convert_readyToPay_to_Paid);

    const button_convert_Completed_fromProgresstable__to_readyToPay = document.createElement("button");
    button_convert_Completed_fromProgresstable__to_readyToPay.innerHTML = "button_convert_Completed_fromProgresstable__to_readyToPay";
    button_convert_Completed_fromProgresstable__to_readyToPay.id = "button_convert_Completed_fromProgresstable__to_readyToPay";
    button_convert_Completed_fromProgresstable__to_readyToPay.onclick = () => this.convertCompleted_fromProgresstable_ToPaid();
    this.container.appendChild(button_convert_Completed_fromProgresstable__to_readyToPay);
  }

  createToggleButton() {
    const toggleButton = document.createElement("button");
    toggleButton.textContent = "Show Upload Panel";
    toggleButton.id = "uploadingpanel";
    
    toggleButton.onclick = () => {
      if (this.container.style.display === "none") {
        this.container.style.display = "block";
        toggleButton.textContent = "Hide Upload Panel";
      } else {
        this.container.style.display = "none";
        toggleButton.textContent = "Show Upload Panel";
      }
    };
    
    document.body.appendChild(toggleButton);
  }

  initUploadExcel() {
    this.createUploadExcelContainer();
    this.createHeader();
    this.createSheetNameInput();
    this.createTableSelect();
    this.createFileInput();
    this.createUploadButton();
    this.createDownloadButton();
    this.createConvertButtons();
    this.createToggleButton();

    this.container.style.cssText = `
      padding: 20px;
      background-color: #f5f5f5;
      border: 1px solid #ddd;
      border-radius: 5px;
      margin: 20px;
      box-shadow: 0 2px 5px rgba(0,0,0,0.1);
    `;
    this.container.style.display = "none";
  }

  createProgressBar() {
    let progressContainer = document.getElementById("progress-container");

    if (!progressContainer) {
      progressContainer = document.createElement("div");
      progressContainer.id = "progress-container";
      progressContainer.style.width = "100%";
      progressContainer.style.backgroundColor = "#f0f0f0";
      progressContainer.style.borderRadius = "5px";
      progressContainer.style.marginTop = "10px";
      this.container.appendChild(progressContainer);

      const progressBar = document.createElement("div");
      progressBar.id = "progress-bar";
      progressBar.style.width = "0%";
      progressBar.style.height = "25px";
      progressBar.style.backgroundColor = "#4CAF50";
      progressBar.style.borderRadius = "5px";
      progressBar.style.transition = "width 0.5s ease-in-out";

      const progressText = document.createElement("div");
      progressText.id = "progress-text";
      progressText.style.textAlign = "center";
      progressText.style.marginTop = "5px";

      progressContainer.appendChild(progressBar);
      progressContainer.appendChild(progressText);
    }

    return {
      progressBar: document.getElementById("progress-bar"),
      progressText: document.getElementById("progress-text"),
    };
  }

  processFile() {
  const fileInput = document.getElementById("fileInput");
  const sheetNameInput = document.getElementById("sheetNameInput");
  const statusDiv = document.getElementById("status");
  const { progressBar, progressText } = this.createProgressBar();
  const tableSelect = document.getElementById("tableSelect");
  const tableName = tableSelect.value;

  const file = fileInput.files[0];
  const sheetName = sheetNameInput.value.trim();

  if (!file) {
    alert("Please select a file.");
    return;
  }

  if (!sheetName) {
    alert("Please enter a sheet name.");
    return;
  }

  // Define which tables contain dates
  const dateTables = [
    plannedDatesTable,
    ActualDatesTable,
    plannedDatesFinishTable
  ];

  const isDateTable = dateTables.includes(tableName);

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: "array", cellDates: true }); // Add cellDates: true

      const sheet = workbook.Sheets[sheetName];
      if (!sheet) {
        alert(`Sheet "${sheetName}" not found in the Excel file.`);
        return;
      }

      const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      const headers = jsonData[0];
      const rows = jsonData.slice(1);

      let successCount = 0;
      let errorCount = 0;
      const totalRows = rows.filter((row) => row.length > 0).length;

      const primaryKeyHeader = headers[0];

      const updateProgress = (processed) => {
        const progressPercentage = Math.round((processed / totalRows) * 100);
        progressBar.style.width = `${progressPercentage}%`;
        progressText.textContent = `Uploading: ${processed}/${totalRows} (${progressPercentage}%)`;
      };

      rows.forEach((row, index) => {
        if (
          row.length === 0 ||
          row.every(
            (cell) => cell === undefined || cell === null || cell === ""
          )
        ) {
          updateProgress(index + 1);
          return;
        }

        const primaryKeyValue = row[0];
        const updateExpression = [];
        const expressionAttributeNames = {};
        const expressionAttributeValues = {};

        headers.slice(1).forEach((header, index) => {
          const columnValue = row[index + 1];

          if (
            columnValue !== undefined &&
            columnValue !== null &&
            columnValue !== ""
          ) {
            const safeHeaderName = `#attr${index}`;
            const safeValueName = `:val${index}`;

            updateExpression.push(`${safeHeaderName} = ${safeValueName}`);
            expressionAttributeNames[safeHeaderName] = header;

            // Handle date values differently for date tables
            if (isDateTable && columnValue instanceof Date) {
              // Convert to UTC date string to avoid timezone issues
              const utcDate = new Date(Date.UTC(
                columnValue.getFullYear(),
                columnValue.getMonth(),
                columnValue.getDate()
              ));
              const excelSerial = this.dateToExcelSerial(utcDate);
              expressionAttributeValues[safeValueName] = {
                N: String(excelSerial)
              };
            } else {
              expressionAttributeValues[safeValueName] = {
                S: String(columnValue).trim(),
              };
            }
          }
        });

        if (updateExpression.length === 0) {
          successCount++;
          updateProgress(index);
          return;
        }

        const params = {
          TableName: tableName,
          Key: {
            [primaryKeyHeader]: { S: String(primaryKeyValue).trim() },
          },
          UpdateExpression: "SET " + updateExpression.join(", "),
          ExpressionAttributeNames: expressionAttributeNames,
          ExpressionAttributeValues: expressionAttributeValues,
          ReturnValues: "UPDATED_NEW",
        };

        this.dynamoDb.updateItem(params, (err, data) => {
          if (err) {
            console.error(
              `Error updating row with ${primaryKeyHeader}: ${primaryKeyValue}`,
              err
            );
            errorCount++;
          } else {
            successCount++;
          }

          updateProgress(index + 1);

          if (successCount + errorCount === totalRows) {
            progressBar.style.backgroundColor =
              errorCount > 0 ? "#FF6347" : "#4CAF50";
            alert(
              `Upload completed. Successful: ${successCount}, Errors: ${errorCount}`
            );
          }
        });
      });
    } catch (error) {
      console.error("Error processing file:", error);
      alert("Error processing file. Check console for details.");
    }
  };
  reader.readAsArrayBuffer(file);
}

// Add this new method to convert Date to Excel serial number
dateToExcelSerial(date) {
  const excelBaseDate = new Date(Date.UTC(1900, 0, 1));
  const diff = date - excelBaseDate;
  const days = diff / (24 * 60 * 60 * 1000);
  // Excel incorrectly considers 1900 as a leap year, so we need to add 1 day for dates after Feb 28, 1900
  return days >= 59 ? days + 1 : days;
}

  downloadTableData() {
    const tableSelect = document.getElementById("tableSelect");
    const selectedTable = tableSelect.value;
    const statusDiv = document.getElementById("status");

    const downloadProgressContainer = document.createElement("div");
    downloadProgressContainer.id = "download-progress-container";
    downloadProgressContainer.style.cssText = `
      width: 100%;
      background-color: #f0f0f0;
      border-radius: 5px;
      margin-top: 10px;
    `;

    const downloadProgressBar = document.createElement("div");
    downloadProgressBar.id = "download-progress-bar";
    downloadProgressBar.style.cssText = `
      width: 0%;
      height: 25px;
      background-color: #4CAF50;
      border-radius: 5px;
      transition: width 0.5s ease-in-out;
    `;

    downloadProgressContainer.appendChild(downloadProgressBar);
    this.container.appendChild(downloadProgressContainer);

    const params = {
      TableName: selectedTable,
    };

    const allItems = [];

    const scanTable = (params) => {
      this.dynamoDb.scan(params, (err, data) => {
        if (err) {
          console.error("Error scanning table:", err);
          statusDiv.textContent = "Error downloading data";
          return;
        }

        data.Items.forEach((item) => {
          const convertedItem = AWS.DynamoDB.Converter.unmarshall(item);
          allItems.push(convertedItem);
        });

        const progressPercentage = Math.round(
          (allItems.length / (data.ScannedCount || 1)) * 100
        );
        downloadProgressBar.style.width = `${progressPercentage}%`;

        if (data.LastEvaluatedKey) {
          params.ExclusiveStartKey = data.LastEvaluatedKey;
          scanTable(params);
        } else {
          this.processAndDownloadData(allItems, selectedTable);
        }
      });
    };

    scanTable(params);
  }

  async convertCompleted_fromProgresstable_ToPaid() {
    const tableSelect = document.getElementById("tableSelect");
    tableSelect.value = wajhaInvoicetable;
    this.downloadButton.click();

    const { progressBar, progressText } = this.createProgressBar();
    
    let successCount = 0;
    let errorCount = 0;
    const totalItems = villaIDcounts;

    const updateProgress = (processed) => {
      const progressPercentage = Math.round((processed / totalItems) * 100);
      progressBar.style.width = `${progressPercentage}%`;
      progressText.textContent = `Processing: ${processed}/${totalItems} (${progressPercentage}%)`;
    };

    for (let i = 1; i <= villaIDcounts; i++) {
      const keyValue = `V_${i}`;

      let progressItem;
      try {
        const progressResult = await this.dynamoDb2.get({
          TableName: this.progressTable,
          Key: { [this.primaryKeyName]: keyValue }
        }).promise();
        progressItem = progressResult.Item;
        if (!progressItem) {
          updateProgress(i);
          continue;
        }
      } catch (err) {
        console.error(`Error fetching Progress for ${keyValue}:`, err);
        errorCount++;
        updateProgress(i);
        continue;
      }

      let invoiceItem;
      try {
        const invoiceResult = await this.dynamoDb2.get({
          TableName: this.invoiceTable,
          Key: { [this.primaryKeyName]: keyValue }
        }).promise();
        invoiceItem = invoiceResult.Item || { [this.primaryKeyName]: keyValue };
      } catch (err) {
        console.error(`Error fetching Invoice for ${keyValue}:`, err);
        errorCount++;
        updateProgress(i);
        continue;
      }

      let updated = false;

      for (const attr in progressItem) {
        if (attr === this.primaryKeyName) continue;

        if (typeof progressItem[attr] !== "undefined") {
          if (invoiceItem[attr] === "Paid") {
            continue;
          }

          if (progressItem[attr] === "Completed") {
            invoiceItem[attr] = "ReadyToPay";
          } else if (progressItem[attr] === "NotStarted") {
            invoiceItem[attr] = "NotStarted";
          } else {
            invoiceItem[attr] = "InProgress";
          }
          updated = true;
        }
      }

      if (updated) {
        try {
          await this.dynamoDb2.put({
            TableName: this.invoiceTable,
            Item: invoiceItem
          }).promise();
          console.log(`Updated invoice for ${keyValue}`);
          successCount++;
        } catch (err) {
          console.error(`Error updating Invoice for ${keyValue}:`, err);
          errorCount++;
        }
      }

      updateProgress(i);
    }

    progressBar.style.backgroundColor = errorCount > 0 ? "#FF6347" : "#4CAF50";
    alert(`Conversion completed. Successful: ${successCount}, Errors: ${errorCount}`);
  }

  async convertReadyToPayToPaid() {
    const tableSelect = document.getElementById("tableSelect");
    tableSelect.value = wajhaInvoicetable;
    this.downloadButton.click();

    const { progressBar, progressText } = this.createProgressBar();
    
    let successCount = 0;
    let errorCount = 0;
    const totalItems = villaIDcounts;

    const updateProgress = (processed) => {
      const progressPercentage = Math.round((processed / totalItems) * 100);
      progressBar.style.width = `${progressPercentage}%`;
      progressText.textContent = `Processing: ${processed}/${totalItems} (${progressPercentage}%)`;
    };

    for (let i = 1; i <= villaIDcounts; i++) {
      const keyValue = `V_${i}`;
      const getParams = {
        TableName: wajhaInvoicetable,
        Key: { ["villaID"]: keyValue },
      };

      let item;
      try {
        const result = await this.dynamoDb2.get(getParams).promise();
        item = result.Item;
        if (!item) {
          updateProgress(i);
          continue;
        }
      } catch (err) {
        console.error(`Error fetching ${keyValue}:`, err);
        errorCount++;
        updateProgress(i);
        continue;
      }

      let updated = false;
      for (const attr in item) {
        if (item[attr] === 'ReadyToPay') {
          item[attr] = 'Paid';
          updated = true;
        }
      }

      if (!updated) {
        updateProgress(i);
        continue;
      }

      const putParams = {
        TableName: wajhaInvoicetable,
        Item: item,
      };

      try {
        await this.dynamoDb2.put(putParams).promise();
        console.log(`Updated ${keyValue}`);
        successCount++;
      } catch (err) {
        console.error(`Error updating ${keyValue}:`, err);
        errorCount++;
      }

      updateProgress(i);
    }

    progressBar.style.backgroundColor = errorCount > 0 ? "#FF6347" : "#4CAF50";
    alert(`Conversion completed. Successful: ${successCount}, Errors: ${errorCount}`);
  }

  




















  processAndDownloadData(data, tableName) {
    if (data.length === 0) {
      alert("No data found in the table");
      return;
    }

    // Define table types
    const tableTypes = {
      [WajhaDatatable]: 'text',
      [wajhaInvoicetable]: 'text',
      [wajhaspecialquerytable]: 'text',
      [plannedDatesTable]: 'date',
      [plannedCostsTable]: 'float',
      [ActualDatesTable]: 'date',
      [ActualCostsTable]: 'float',
      [plannedDatesFinishTable]: 'date'
    };

    const tableType = tableTypes[tableName] || 'text'; // Default to text if table not recognized

    const sortedData = data.sort((a, b) => {
      const aNum = a.villaIDNUM ? Number(a.villaIDNUM) : 0;
      const bNum = b.villaIDNUM ? Number(b.villaIDNUM) : 0;

      if (isNaN(aNum)) return -1;
      if (isNaN(bNum)) return 1;

      return aNum - bNum;
    });

    const reorderColumns = (dataArray) => {
      if (dataArray.length === 0) return [];

      const allKeys = new Set();
      dataArray.forEach((item) => {
        Object.keys(item).forEach((key) => allKeys.add(key));
      });

      const preferredOrder = ["villaIDNUM", "villaID"];
      const remainingColumns = Array.from(allKeys)
        .filter((key) => !preferredOrder.includes(key))
        .sort((a, b) => a.localeCompare(b));

      const columnOrder = [...preferredOrder, ...remainingColumns];

      return dataArray.map((item) => {
        const reorderedItem = {};
        columnOrder.forEach((key) => {
          if (item.hasOwnProperty(key)) {
            let value = item[key];
            // Skip villaID and villaIDNUM as they are identifiers
            if (key !== 'villaID' && key !== 'villaIDNUM') {
              if (tableType === 'date' && typeof value === 'string' && !isNaN(value) && value.trim() !== '' && Number(value) > 0 && Number(value) < 2958465) {
                // Convert Excel serial date to formatted date string
                value = excelSerialToDate(Number(value));
              } else if (tableType === 'date' && typeof value === 'number' && value > 0 && value < 2958465) {
                value = excelSerialToDate(value);
              } else if (tableType === 'float' && typeof value === 'string' && !isNaN(value) && value.trim() !== '') {
                // Ensure float values remain numbers
                value = parseFloat(value);
              } else if (tableType === 'float' && typeof value === 'number') {
                value = value; // Keep as-is
              }
              // For text tables, keep value as-is (string or otherwise)
            }
            reorderedItem[key] = value;
          }
        });
        return reorderedItem;
      });
    };

    const processedData = reorderColumns(sortedData);
    const worksheet = XLSX.utils.json_to_sheet(processedData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, tableName);
if (tableType === 'date') {
    const range = XLSX.utils.decode_range(worksheet['!ref']);
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const header = XLSX.utils.encode_col(C) + "1";
      const columnName = worksheet[header]?.v;
      if (columnName && columnName !== 'villaID' && columnName !== 'villaIDNUM') {
        for (let R = range.s.r + 1; R <= range.e.r; ++R) {
          const cell = XLSX.utils.encode_cell({r:R, c:C});
          if (worksheet[cell]) {
            // Set cell format to Excel date format
            worksheet[cell].z = 'yyyy-mm-dd';
            // Tell Excel this is a date
            if (typeof worksheet[cell].v === 'string') {
              const dateValue = new Date(worksheet[cell].v);
              if (!isNaN(dateValue.getTime())) {
                worksheet[cell].t = 'd'; // Date type
                worksheet[cell].v = dateValue;
              }
            }
          }
        }
      }
    }
  }
    const excelBuffer = XLSX.write(workbook, {
      bookType: "xlsx",
      type: "array",
    });

    const blob = new Blob([excelBuffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `${tableName}_sorted_data_${new Date().toISOString().split("T")[0]}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    URL.revokeObjectURL(url);

    const downloadProgressBar = document.getElementById("download-progress-bar");
    if (downloadProgressBar) {
      downloadProgressBar.style.width = "100%";
      setTimeout(() => {
        downloadProgressBar.parentElement.remove();
      }, 2000);
    }

    alert(`Download Complete\nTotal Records: ${processedData.length}`);
  }

  // Include the excelSerialToDate function
  excelSerialToDate(serial) {
    if (!serial || serial === "" || isNaN(serial) || serial <= 0) {
      return "";
    }

    // Adjust for Excel's leap year bug
    let adjustedSerial = serial;
    if (serial >= 60) adjustedSerial--;

    // Excel base date: January 1, 1900
    const excelBaseDate = new Date(Date.UTC(1900, 0, 1));
    const date = new Date(excelBaseDate.getTime() + adjustedSerial * 24 * 60 * 60 * 1000);

    // Validate the resulting date
    if (isNaN(date.getTime())) {
      return "";
    }

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

}

// Initialize the application
const excelDbManager = new ExcelDatabaseManager();