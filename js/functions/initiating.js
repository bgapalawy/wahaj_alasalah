


//initiate table columns data from my array in code
//intiatingTableColumns();
//function intiatingTableColumns() {
  //   for (var i = 1; i <= villaIDcounts; i++) {
  //     let villaID = `V_${i}`;
  //     addConstructioncolumnsDataToDynamoDB(
  //       WajhaDatatable,
  //       villaID,
  //       activities,
  //       "NotStarted"
  //     );
  //   }
  // }
  // Function to add construction data to DynamoDB using the activities array
  function addConstructioncolumnsDataToDynamoDB(
    table,
    villaID,
    activities,
    status
  ) {
    // Validate input parameters
    if (!table || !villaID || !activities || !Array.isArray(activities)) {
      console.error(
        "Invalid input: table, villaID, and activities array are required"
      );
      return;
    }
  
    // Initialize params object for getting the existing item
    const getParams = {
      TableName: table,
      Key: {
        villaID: { S: villaID },
      },
    };
  
    const dynamoDB = new AWS.DynamoDB();
  
    // Get the existing item from the DynamoDB table
    dynamoDB.getItem(getParams, (err, getData) => {
      if (err) {
        console.error(
          "Unable to retrieve item. Error JSON:",
          JSON.stringify(err, null, 2)
        );
        return;
      }
  
      // If no existing item, create a new item
      const updatedItem = getData.Item
        ? { ...getData.Item }
        : { villaID: { S: villaID } };
  
      // Iterate over the activities array and add columns to the DynamoDB item
      activities.forEach((activity) => {
        const { TableItemID } = activity;
  
        // Add the activity with the specified status
        updatedItem[TableItemID] = { S: status };
      });
  
      // Initialize params object for updating the item
      const putParams = {
        TableName: table,
        Item: updatedItem,
      };
  
      // Update the item in the DynamoDB table
      dynamoDB.putItem(putParams, (err, putData) => {
        if (err) {
          console.error(
            "Unable to add item. Error JSON:",
            JSON.stringify(err, null, 2)
          );
        } else {
          console.log("Added/updated item:", JSON.stringify(putData, null, 2));
        }
      });
    });
  }
  
  

//initiating invoice from progress table for first time 
//intiatingTableinvoicefromprogress();
function intiatingTableinvoicefromprogress() {
    for (var i = 1; i <= villaIDcounts; i++) {
        let villaID = `V_${i}`;
        
        retrieveSpecificRowDataFromDynamoDB(WajhaDatatable, villaID)
        .then((retrievedData) => {
            let uploadingNewValues = retrievedData;

            // Update the values in the object
            Object.keys(uploadingNewValues).forEach(key => {
                let value = uploadingNewValues[key];
                uploadingNewValues[key] = value==="Completed"?"ReadyToPay":value==="NotStarted"?"NotStarted":
                value==="Notes"?"InProgress":value==="NCR"?"InProgress":value==="Rejected"?"InProgress"
                :value;
            });
            
            // Now add the modified data to the new DynamoDB table
             addDataToDynamoDB(wajhaInvoicetable, uploadingNewValues);
        })
        .then((data) => {
            console.log(`Data added successfully for villa ID: ${villaID}`, data);
        })
        .catch((error) => {
            console.error(`Error processing villa ID ${villaID}:`, error);
        });
    }
}




//download activities as excel sheet

// Call the new download function with your data
//downloadAsExcelSheet(activities, 'construction_activities.csv');
function downloadAsExcelSheet(data, fileName = 'data.csv') {
  if (!data || data.length === 0) {
    console.warn("No data to download.");
    return;
  }

  // Helper function to escape values for CSV
  // Values containing commas, double quotes, or newlines must be enclosed in double quotes.
  // Double quotes within the value must be escaped by doubling them.
  const escapeCsvValue = (value) => {
    // Convert value to string
    let stringValue = String(value);

    // Handle arrays specifically
    if (Array.isArray(value)) {
      stringValue = `[${value.map(item => String(item).replace(/"/g, '""')).join(", ")}]`;
    } else if (value === undefined || value === null) {
      stringValue = "";
    } else {
        stringValue = String(value);
    }

    // Check if the value needs to be quoted
    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
      // Escape internal double quotes by doubling them
      stringValue = stringValue.replace(/"/g, '""');
      // Enclose the whole value in double quotes
      return `"${stringValue}"`;
    }
    return stringValue;
  };

  // 1. Collect all unique headers (column names) from all objects
  const allHeadersSet = new Set();
  data.forEach(rowObject => {
    Object.keys(rowObject).forEach(key => {
      allHeadersSet.add(key);
    });
  });
  const headers = Array.from(allHeadersSet);

  // Create the CSV content
  let csvContent = "";

  // Add UTF-8 BOM to ensure correct character encoding in Excel
  csvContent = '\uFEFF'; // This is the BOM for UTF-8

  // Add headers as the first row
  csvContent += headers.map(escapeCsvValue).join(',') + '\n';

  // Add data rows
  data.forEach(rowObject => {
    const rowValues = headers.map(header => {
      return escapeCsvValue(rowObject[header]);
    });
    csvContent += rowValues.join(',') + '\n';
  });

  // Create a Blob from the CSV content
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });

  // Create a temporary URL for the Blob
  const url = URL.createObjectURL(blob);

  // Create a temporary anchor element and trigger the download
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', fileName);
  link.style.visibility = 'hidden'; // Make it invisible
  document.body.appendChild(link); // Append to body to make it clickable
  link.click(); // Programmatically click the link
  document.body.removeChild(link); // Clean up the DOM
  URL.revokeObjectURL(url); // Release the object URL
}


