
function retrievebuttonclickgeneraldata() {
  const button_submit = document.getElementById('Submit_button');
  const MonitoringTypeSelect = document.getElementById('MonitoringType');
  const constructTypeSelect = document.getElementById('constructType');
  const subItemsSelect = document.getElementById('subItems');
  const villaIDSelect = document.getElementById('villaIDSelect');
  const blocknumSelect = document.getElementById('blocknumSelect');
  const stageSelect = document.getElementById('stageSelect');
  const finishDateInput = document.querySelector(".date-input-container");
  const filterSubmitButton = document.getElementById("Filter_submit");
  const resetFilterButton = document.getElementById("Reset_filter");

  if (!MonitoringTypeSelect || !button_submit || !constructTypeSelect || !subItemsSelect || !villaIDSelect || !blocknumSelect || !stageSelect || !finishDateInput) {
      console.error("One or more UI components could not be found. Aborting submit action.");
      return;
  }

  // Reset all filters
  Array.from(villaIDSelect.options).forEach(option => option.selected = false);
  Array.from(blocknumSelect.options).forEach(option => option.selected = false);
  Array.from(stageSelect.options).forEach(option => option.selected = false);
  if (typeof jQuery !== 'undefined' && typeof jQuery.fn.select2 !== 'undefined') {
    jQuery('#villaIDSelect').val(null).trigger('change');
    jQuery('#blocknumSelect').val(null).trigger('change');
    jQuery('#stageSelect').val(null).trigger('change');
  }
  const checkboxes = document.querySelectorAll('.color-checkbox');
  checkboxes.forEach(checkbox => checkbox.checked = false);

  // Clear the counts container
  let container = document.getElementById("countsContainer");
  if (container) {
    container.innerHTML = "";
  }

  if (MonitoringTypeSelect.disabled) {
    button_submit.innerHTML = "Get Data";
    constructTypeSelect.disabled = false;
    subItemsSelect.disabled = false;
    MonitoringTypeSelect.disabled = false;
    finishDateInput.querySelector("input").disabled = false;
    villaIDSelect.disabled = false;
    blocknumSelect.disabled = false;
    stageSelect.disabled = false;
    if (filterSubmitButton) filterSubmitButton.disabled = false;
    if (resetFilterButton) resetFilterButton.disabled = false;
  } else {
    button_submit.innerHTML = "Edit Search";
    constructTypeSelect.disabled = true;
    subItemsSelect.disabled = true;
    MonitoringTypeSelect.disabled = true;
    finishDateInput.querySelector("input").disabled = true;
    villaIDSelect.disabled = false;
    blocknumSelect.disabled = false;
    stageSelect.disabled = false;
    if (filterSubmitButton) filterSubmitButton.disabled = false;
    if (resetFilterButton) resetFilterButton.disabled = false;
    setupConstructionItemsDashboardWithToggle(SelectedConstuctionItem, SelectedConstuctionItemForpopup);
    if (SelectedConstuctionItem !== "" && monitoringselectionvalue !== "") {
      if (dateContainer) dateContainer.hidden = true;
      const readyToPayButton = document.getElementById("button_convert_readyToPay_to_Paid");
      if (readyToPayButton) readyToPayButton.style.display = "none";

      if (monitoringselectionvalue === "1" && SelectedConstuctionItem !== "") {
        updateProgress(10, "Retrieving status data...");
        retrieveAndCountDataFromDynamoDB(WajhaDatatable, SelectedConstuctionItem)
          .then((counts) => {
            const filteredCounts = { retrievedData: counts.retrievedData };
            datainheaderkeys = filteredCounts;
            createStatusElements(filteredCounts, 'status');
            coloringvillas(statusColorMap, filteredCounts.retrievedData);
            updateProgress(100, `Processing complete progress of ${SelectedConstuctionItem}`);
          })
          .catch((error) => {
            console.error("Error retrieving counts:", error);
            updateProgress(100, `Error processing data for ${SelectedConstuctionItem}`);
          });
      
      } else if (monitoringselectionvalue === "2" && SelectedConstuctionItem !== "") {
        if (dateContainer) dateContainer.hidden = false;
        const finishDateValue = finishDateInput.querySelector("input").value;
        const finishSerial = dateToExcelSerial(finishDateValue);
        Cuttoff_Day = finishSerial;
        
        updateProgress(10, "Retrieving all project data...");

        const allDataPromise = ui.getdynamoDBClientData(WajhaDatatable, 5000);
        const scheduleDataPromise = ui.getdynamoDBClientData(plannedDatesTable, 5000);

        Promise.all([allDataPromise, scheduleDataPromise])
          .then(([allVillaData, allScheduleData]) => {
            updateProgress(40, "Mapping data for quick access...");

            const allVillaDataMap = new Map(allVillaData.map(item => [item.villaID, item]));
            const scheduleDataMap = new Map(allScheduleData.map(item => [item.villaID, item]));
            const villaMapFinal = new Map();

            updateProgress(60, "Processing schedule logic for all villas...");

            // =================== START: MODIFIED LOGIC ===================
            // Step 3: Iterate from villa 1 to 590 and process them using the in-memory maps.
            // This ensures all villas are considered, just like the other functions.
            for (let i = 1; i <= villaIDcounts; i++) { // villaIDcounts is 590
                const villaID = `V_${i}`;
                const fullVillaRecord = allVillaDataMap.get(villaID);

                // Only process villas that were found in the database.
                if (fullVillaRecord) {
                    const status = fullVillaRecord[SelectedConstuctionItem];
                    const scheduleDate = scheduleDataMap.get(villaID)?.[SelectedConstuctionItem];
                    let finalValue;

                    if (status === "NCR" || status === "Rejected" || status === "Notes") {
                        finalValue = "InProgress";
                    } else if (status === "Completed") {
                        finalValue = "Completed";
                    } else if (status === "NotStarted") {
                        if (scheduleDate > Cuttoff_Day) {
                            finalValue = "NotStarted";
                        } else {
                            let activities2 = JSON.parse(JSON.stringify(activities));
                            updateActivityStatus(activities2, fullVillaRecord);
                            
                            const blockingActivities = findRootCauseBlockingActivities(SelectedConstuctionItemID, activities2);
                            
                            if (blockingActivities.length > 0) {
                                finalValue = (blockingActivities[0].id !== SelectedConstuctionItemID) ? "blocked" : "ready";
                            } else {
                                finalValue = "Completed"; // No blocking activities means it should have been completed
                            }
                        }
                    }
                    if (finalValue !== undefined) {
                      villaMapFinal.set(villaID, finalValue);
                    }
                }
            }
            // =================== END: MODIFIED LOGIC =====================
            
            updateProgress(90, "Applying colors and finalizing UI...");
            datainheaderkeysscheduling = villaMapFinal;
            
            const transformedData = Array.from(villaMapFinal.entries()).map(([villaID, status]) => ({
              villaID: villaID,
              [SelectedConstuctionItem]: status
            }));
            
            const resultschmap = { retrievedData: transformedData };
            createStatusElements(resultschmap, 'sch');
            coloringvillas(statusColorMapsch, resultschmap.retrievedData);
            
            updateProgress(100, `Processing complete schedule of ${SelectedConstuctionItem}`);
          })
          .catch((error) => {
            console.error("Error during optimized schedule processing:", error);
            updateProgress(100, "Error processing data. Please try again.");
          });

      } else if (monitoringselectionvalue === "3" && SelectedConstuctionItem !== "") {
        if (readyToPayButton) readyToPayButton.style.display = "flex";
        updateProgress(10, "Retrieving status data...");
        retrieveAndCountDataFromDynamoDB(wajhaInvoicetable, SelectedConstuctionItem)
          .then((counts) => {
            const filteredCounts = { retrievedData: counts.retrievedData };
            createStatusElements(filteredCounts, 'invoice');
            coloringvillas(statusColorMapInvoice, filteredCounts.retrievedData);
            updateProgress(100, `Processing complete Invoice of ${SelectedConstuctionItem}`);
          })
          .catch((error) => {
            console.error("Error retrieving counts:", error);
            updateProgress(100, `Error processing data for ${SelectedConstuctionItem}`);
          });
      } else if (monitoringselectionvalue === "6" && SelectedConstuctionItem !== "") {
        updateProgress(10, "Retrieving status data...");
        retrieveAndCountDataFromDynamoDB(wajhaspecialquerytable, SelectedConstuctionItem)
          .then((counts) => {
            const filteredCounts = { retrievedData: counts.retrievedData };
            const defaultColor = notFoundColor || '#cccccc';
            const colorPaletteArray = Object.values(generalColorPalette);
            const colorPaletteCount = colorPaletteArray.length;

            if (colorPaletteCount === 0) {
              console.error("Error: generalColorPalette is empty!");
              updateProgress(100, `Error processing data: Color palette is empty.`);
              return;
            }

            updateProgress(30, "Counting status frequencies...");
            const statusCounts = {};
            filteredCounts.retrievedData.forEach((item) => {
              const status = item[SelectedConstuctionItem] != null ? String(item[SelectedConstuctionItem]) : "Undefined/Null";
              statusCounts[status] = (statusCounts[status] || 0) + 1;
            });

            const sortedStatuses = Object.keys(statusCounts).sort(
              (a, b) => statusCounts[b] - a[1]
            );

            updateProgress(50, "Assigning colors based on frequency...");
            const statusColorMap2 = new Map();
            sortedStatuses.forEach((status, index) => {
              const colorIndex = index % colorPaletteCount;
              statusColorMap2.set(status, colorPaletteArray[colorIndex]);
            });

            activeColorMap = statusColorMap2;

            updateProgress(70, "Applying colors to elements...");
            filteredCounts.retrievedData.forEach((item) => {
              const documentElement = document.getElementById(item.villaID);
              if (documentElement) {
                const status = item[SelectedConstuctionItem] != null ? String(item[SelectedConstuctionItem]) : "Undefined/Null";
                const assignedColor = statusColorMap2.get(status) || defaultColor;
                documentElement.style.fill = assignedColor;
                const specificTooltip = tooltip[item.villaID];
                if (specificTooltip && specificTooltip._container) {
                  const tooltipElement = specificTooltip._container;
                  if (status === "Undefined/Null") {
                    tooltipElement.classList.add('showTextonnotfoundvilla');
                  } else {
                    tooltipElement.classList.remove('showTextonnotfoundvilla');
                  }
                }
              }
            });

            updateProgress(90, "Generating status legend...");
            createStatusElements(filteredCounts, 'general', statusColorMap2);
            updateProgress(100, `Processing complete for column: ${SelectedConstuctionItem}`);
          })
          .catch((error) => {
            console.error(`Error retrieving/processing data for column ${SelectedConstuctionItem}:`, error);
            updateProgress(100, `Error processing data for ${SelectedConstuctionItem}`);
          });
      } else {
        for (let i = 1; i <= villaIDcounts; i++) {
          const documentElement = document.getElementById(`V_${i}`);
          if (documentElement) {
            documentElement.style.fill = default_color || '#ffffff';
            documentElement.style.opacity = 1;
          }
        }
        let container = document.getElementById("countsContainer");
        if (container) {
          container.innerHTML = "";
        }
      }
    }
  }

  function dateToExcelSerial(dateString) {
    const [day, month, year] = dateString.split("/").map(Number);
    const date = new Date(year, month - 1, day);
    const excelBaseDate = new Date(1900, 0, 1);
    let serial = Math.floor((date - excelBaseDate) / (1000 * 60 * 60 * 24)) + 1;
    if (date >= new Date(1900, 1, 29)) serial++;
    return serial;
  }

  function updateProgress(percentage, message) {
    const newContainer = document.getElementById("newContainer");
    if (!newContainer) {
      console.error("Fatal: The 'newContainer' element was not found in the DOM.");
      return;
    }

    let progressContainer = document.getElementById("progressContainer");
    if (!progressContainer) {
      progressContainer = document.createElement("div");
      progressContainer.id = "progressContainer";
      progressContainer.style.width = "100%";
      progressContainer.style.backgroundColor = "#f3f3f3";
      progressContainer.style.borderRadius = "5px";
      progressContainer.style.margin = "10px 0";

      const progressBar = document.createElement("div");
      progressBar.id = "progressBar";
      progressBar.style.width = "0%";
      progressBar.style.height = "20px";
      progressBar.style.backgroundColor = "#4caf50";
      progressBar.style.borderRadius = "5px";
      progressBar.style.transition = "width 0.5s ease";

      progressContainer.appendChild(progressBar);
      newContainer.appendChild(progressContainer);
    }

    const progressBar = document.getElementById("progressBar");
    progressBar.style.width = `${percentage}%`;

    let statusMessage = document.getElementById("statusMessage");
    if (!statusMessage) {
      statusMessage = document.createElement("div");
      statusMessage.id = "statusMessage";
      statusMessage.style.marginTop = "10px";
      statusMessage.style.fontSize = "14px";
      statusMessage.style.color = "#333";
      newContainer.appendChild(statusMessage);
    }
    statusMessage.textContent = message;
  }
}










async function sendbuttondataonevillitem(villaID) {
  const selectedRadio = document.querySelector('input[name="villaStat"]:checked');
  const dataToSend = {
    villaID: `V_${villaID}`,
  };
  const actualDatesPayload = {
    villaID: `V_${villaID}`,
  };
  const actualCostsPayload = {
    villaID: `V_${villaID}`,
  };

  if (selectedRadio) {
    const selectedValue = selectedRadio.value;
    const mainDataPayload = { ...dataToSend };
    mainDataPayload[SelectedConstuctionItem] = selectedValue;

    if (selectedValue === "Completed") {
      const completionDateInput = document.querySelector('#completionDate');
      let completionDate = completionDateInput.value;

      if (!completionDate) {
        // If no date is provided, use today's date
        const today = new Date();
        completionDate = today.toISOString().split('T')[0]; // Format as YYYY-MM-DD
        completionDateInput.value = completionDate; // Update the input field
      }

      const excelSerialDate = dateToExcelSerial(completionDate);
      if (excelSerialDate === null) {
        alert("Invalid completion date. Please select a valid date.");
        return;
      }
      console.log("Input completion date:", completionDate); // Debug log
      console.log("Storing completion date serial:", excelSerialDate); // Debug log
      actualDatesPayload[SelectedConstuctionItem] = excelSerialDate;

      try {
        const plannedCosts = await retrieveSpecificRowDataFromDynamoDB(plannedCostsTable, `V_${villaID}`);
        const plannedCost = plannedCosts[SelectedConstuctionItem]
          ? parseFloat(plannedCosts[SelectedConstuctionItem])
          : 0;

        if (plannedCost > 0) {
          actualCostsPayload[SelectedConstuctionItem] = String(plannedCost);
        } else {
          console.warn(`No planned cost found for ${SelectedConstuctionItem} in villa V_${villaID}`);
          alert(`No planned cost found for ${SelectedConstuctionItem}. Actual cost not updated.`);
          actualCostsPayload[SelectedConstuctionItem] = 0;
        }
      } catch (error) {
        console.error(`Error fetching planned cost for ${SelectedConstuctionItem}:`, error);
        alert("Failed to fetch planned cost. Actual cost not updated.");
        actualCostsPayload[SelectedConstuctionItem] = 0;
      }
    } else {
      // Explicitly clear the date and cost for non-Completed statuses
      actualDatesPayload[SelectedConstuctionItem] = "";
      actualCostsPayload[SelectedConstuctionItem] = 0;
      const completionDateInput = document.querySelector('#completionDate');
      if (completionDateInput) {
        completionDateInput.value = '';
      }
    }

    if (SelectedConstuctionItem !== "") {
      const documentElement = document.getElementById(villaID);
      if (documentElement) {
        if (monitoringselectionvalue === "3") {
          documentElement.style.fill = statusColorMapInvoice[selectedValue] || "#F2F2F2";
        } else if (monitoringselectionvalue === "1") {
          documentElement.style.fill = statusColorMap[selectedValue] || "#F2F2F2";
        }
      }

      try {
        // Update main status table
        await addDataToDynamoDB(WajhaDatatable, mainDataPayload);

        // Update ActualDatesTable
        const updateDateParams = {
          TableName: ActualDatesTable,
          Key: { villaID: `V_${villaID}` },
          UpdateExpression: `SET #item = :value`,
          ExpressionAttributeNames: { '#item': SelectedConstuctionItem },
          ExpressionAttributeValues: { ':value': actualDatesPayload[SelectedConstuctionItem] },
        };
        await new AWS.DynamoDB.DocumentClient().update(updateDateParams).promise();

        // Update ActualCostsTable
        await addDataToDynamoDB(ActualCostsTable, actualCostsPayload);

        // Conditional Invoice Table Update
        if (selectedValue === "Completed" && old_villaStatus !== "Completed") {
          const invoiceDataPayload = { ...dataToSend };
          invoiceDataPayload[SelectedConstuctionItem] = "ReadyToPay";
          await addDataToDynamoDB(wajhaInvoicetable, invoiceDataPayload);
          const MonitoringTypeSelect = document.getElementById('MonitoringType');
          if (MonitoringTypeSelect) {
            MonitoringTypeSelect.disabled = false;
            retrievebuttonclickgeneraldata();
          }
          await getbuttondata(villaID, wajhaInvoicetable);
        } else if (selectedValue !== "Completed" && old_villaStatus === "Completed") {
          const invoiceStatusData = await getbuttondata(villaID, wajhaInvoicetable);
          let oldinvoicestatus = invoiceStatusData;
          if (oldinvoicestatus === "Paid") {
            const userConfirmed = confirm(
              `Item '${SelectedConstuctionItem}' was previously 'Completed' and 'Paid' in last Invoices. \nAre you sure you want to change its status to '${selectedValue}'`
            );

            if (userConfirmed) {
              const invoiceDataPayload = { ...dataToSend };
              invoiceDataPayload[SelectedConstuctionItem] = selectedValue === "NotStarted" ? "NotStarted" : "InProgress";
              await addDataToDynamoDB(wajhaInvoicetable, invoiceDataPayload);
              await getbuttondata(villaID, wajhaInvoicetable);
              const MonitoringTypeSelect = document.getElementById('MonitoringType');
              if (MonitoringTypeSelect) {
                MonitoringTypeSelect.disabled = false;
                retrievebuttonclickgeneraldata();
              }
              await addDataToDynamoDB(WajhaDatatable, mainDataPayload);
              await getbuttondata(villaID, WajhaDatatable);
            } else {
              const invoiceDataPayload2 = { ...dataToSend };
              invoiceDataPayload2[SelectedConstuctionItem] = old_villaStatus;
              await addDataToDynamoDB(WajhaDatatable, invoiceDataPayload2);
              await getbuttondata(villaID, WajhaDatatable);
            }
          } else if (selectedValue === "NotStarted") {
            const invoiceDataPayload = { ...dataToSend };
            invoiceDataPayload[SelectedConstuctionItem] = "NotStarted";
            await addDataToDynamoDB(wajhaInvoicetable, invoiceDataPayload);
            const MonitoringTypeSelect = document.getElementById('MonitoringType');
            if (MonitoringTypeSelect) {
              MonitoringTypeSelect.disabled = false;
              retrievebuttonclickgeneraldata();
            }
            await getbuttondata(villaID, wajhaInvoicetable);
          } else {
            const invoiceDataPayload = { ...dataToSend };
            invoiceDataPayload[SelectedConstuctionItem] = "InProgress";
            await addDataToDynamoDB(wajhaInvoicetable, invoiceDataPayload);
            const MonitoringTypeSelect = document.getElementById('MonitoringType');
            if (MonitoringTypeSelect) {
              MonitoringTypeSelect.disabled = false;
              retrievebuttonclickgeneraldata();
            }
            await getbuttondata(villaID, wajhaInvoicetable);
          }
        } else if (selectedValue === "NotStarted") {
          const invoiceDataPayload = { ...dataToSend };
          invoiceDataPayload[SelectedConstuctionItem] = "NotStarted";
          await addDataToDynamoDB(wajhaInvoicetable, invoiceDataPayload);
          const MonitoringTypeSelect = document.getElementById('MonitoringType');
          if (MonitoringTypeSelect) {
            MonitoringTypeSelect.disabled = false;
            retrievebuttonclickgeneraldata();
          }
          await getbuttondata(villaID, wajhaInvoicetable);
        } else {
          const invoiceDataPayload = { ...dataToSend };
          invoiceDataPayload[SelectedConstuctionItem] = "InProgress";
          await addDataToDynamoDB(wajhaInvoicetable, invoiceDataPayload);
          const MonitoringTypeSelect = document.getElementById('MonitoringType');
          if (MonitoringTypeSelect) {
            MonitoringTypeSelect.disabled = false;
            retrievebuttonclickgeneraldata();
          }
          await getbuttondata(villaID, wajhaInvoicetable);
        }

        alert(`Status updated to ${selectedValue}`);
      } catch (error) {
        console.error("Error updating tables:", error);
        alert("Update failed. Please try again.");
        if (documentElement && old_villaStatus) {
          documentElement.style.fill = statusColorMap[old_villaStatus] || "#F2F2F2";
        }
      }
    } else {
      alert("Please select a construction item first.");
    }
  } else {
    console.log("No villa status selected.");
    alert("Please select a status for the villa.");
  }













function dateToExcelSerial(dateString) {
  if (!dateString || typeof dateString !== 'string') {
    return null; // Handle invalid input
  }

  // Parse the date string (e.g., "2025-06-28") in UTC
  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  // Validate the date
  if (isNaN(date.getTime())) {
    return null; // Invalid date
  }

  // Excel base date: January 1, 1900
  const excelBaseDate = new Date(Date.UTC(1900, 0, 1));
  
  // Calculate days difference and add 1 (because Excel serial 1 = January 1, 1900)
  let serial = Math.floor((date - excelBaseDate) / (1000 * 60 * 60 * 24)) + 1;

  // Adjust for Excel's leap year bug (Excel incorrectly includes Feb 29, 1900)
  // If the date is March 1, 1900 or later, add 1 to compensate
  if (serial >= 61) {
    serial++;
  }

  return serial;
}}



function getbuttondata(villaID, table) {
  const dynamoDB = new AWS.DynamoDB.DocumentClient();

  const params = {
    TableName: table,
    Key: {
      villaID: `V_${villaID}`,
    },
  };

  return new Promise((resolve, reject) => {
    dynamoDB.get(params, (err, data) => {
      if (err) {
        console.error("Error retrieving data:", err);
        reject(err);
        return;
      }

      const currentStatus =
        data.Item && data.Item[SelectedConstuctionItem]
          ? data.Item[SelectedConstuctionItem]
          : null;

      if (table === WajhaDatatable) {
        old_villaStatus = currentStatus;

        if (currentStatus) {
          const radioToSelect = document.querySelector(
            `input[name="villaStat"][value="${currentStatus}"]`
          );
          if (radioToSelect) {
            radioToSelect.checked = true;
          }
        }

        // Fetch dates from related tables
        const actualDatesParams = {
          TableName: ActualDatesTable,
          Key: { villaID: `V_${villaID}` },
        };
        const plannedStartDatesParams = {
          TableName: plannedDatesTable,
          Key: { villaID: `V_${villaID}` },
        };
        const plannedFinishDatesParams = {
          TableName: plannedDatesFinishTable,
          Key: { villaID: `V_${villaID}` },
        };

        Promise.all([
          dynamoDB.get(actualDatesParams).promise(),
          dynamoDB.get(plannedStartDatesParams).promise(),
          dynamoDB.get(plannedFinishDatesParams).promise(),
        ])
          .then(([actualDatesData, plannedStartDatesData, plannedFinishDatesData]) => {
            const completionDateKey = SelectedConstuctionItem;

            // Handle completion date
            const completionDateInput = document.querySelector("#completionDate");
            const completionDateSerial =
              actualDatesData.Item && actualDatesData.Item[completionDateKey]
                ? actualDatesData.Item[completionDateKey]
                : null;
            if (
              currentStatus === "Completed" &&
              completionDateSerial &&
              completionDateSerial !== "" &&
              !isNaN(completionDateSerial)
            ) {
              const formattedDate = excelSerialToDate(Number(completionDateSerial));
              if (completionDateInput) {
                completionDateInput.value = formattedDate;
              }
            } else if (completionDateInput) {
              completionDateInput.value = "";
            }

            // Handle planned start date
            const plannedStartDateInput = document.querySelector("#plannedStartDate");
            const plannedStartDateSerial =
              plannedStartDatesData.Item && plannedStartDatesData.Item[completionDateKey]
                ? plannedStartDatesData.Item[completionDateKey]
                : null;
            if (
              plannedStartDateSerial &&
              plannedStartDateSerial !== "" &&
              !isNaN(plannedStartDateSerial)
            ) {
              const formattedStartDate = excelSerialToDate(Number(plannedStartDateSerial));
              if (plannedStartDateInput) {
                plannedStartDateInput.value = formattedStartDate;
              }
            } else if (plannedStartDateInput) {
              plannedStartDateInput.value = "";
            }

            // Handle planned finish date
            const plannedFinishDateInput = document.querySelector("#plannedFinishDate");
            const plannedFinishDateSerial =
              plannedFinishDatesData.Item && plannedFinishDatesData.Item[completionDateKey]
                ? plannedFinishDatesData.Item[completionDateKey]
                : null;
            if (
              plannedFinishDateSerial &&
              plannedFinishDateSerial !== "" &&
              !isNaN(plannedFinishDateSerial)
            ) {
              const formattedFinishDate = excelSerialToDate(Number(plannedFinishDateSerial));
              if (plannedFinishDateInput) {
                plannedFinishDateInput.value = formattedFinishDate;
              }
            } else if (plannedFinishDateInput) {
              plannedFinishDateInput.value = "";
            }
          })
          .catch((err) => {
            console.error("Error retrieving dates from DynamoDB:", err);
          });
      } else if (table === wajhaInvoicetable) {
        old_villaStatusInvoice = currentStatus;
        if (currentStatus) {
          const radioToSelect = document.querySelector(
            `input[name="villaInvoice"][value="${currentStatus}"]`
          );
          if (radioToSelect) {
            radioToSelect.checked = true;
          }
        }
      }

      resolve(currentStatus);
    });
  });

  function excelSerialToDate(serial) {
  if (!serial || serial === "" || isNaN(serial) || serial <= 0) {
    return "";
  }

  // Excel base date: January 1, 1900 (but Excel incorrectly treats 1900 as a leap year)
  // Excel serial date 1 = January 1, 1900
  // Excel serial date 2 = January 2, 1900, etc.
  
  // Create base date as January 1, 1900
  const excelBaseDate = new Date(Date.UTC(1900, 0, 1));
  
  // Calculate the actual date by adding (serial - 1) days
  // We subtract 1 because Excel serial 1 = January 1, 1900 (0 days from base)
  let daysToAdd = serial - 1;
  
  // Adjust for Excel's leap year bug (Excel incorrectly includes Feb 29, 1900)
  // If serial >= 61 (March 1, 1900 or later), subtract 1 day to compensate
  if (serial >= 61) {
    daysToAdd--;
  }
  
  const date = new Date(excelBaseDate.getTime() + daysToAdd * 24 * 60 * 60 * 1000);

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



























function sendbuttondataonevillitemInvoice(villaID) {
  // Find the currently selected radio button for villa status
  const selectedRadio = document.querySelector(
    'input[name="villaInvoice"]:checked'
  );

  // Prepare the basic data structure to send
  const dataToSend = {
    villaID: `V_${villaID}`, // Add the villa prefix
  };

  // Proceed only if a radio button is selected
  if (selectedRadio) {
    const selectedValue = selectedRadio.value; // Get the selected status value

    // Add the selected status under the key defined by 'SelectedConstuctionItem'
    // Create a copy for potential modification in Scenario 1 without affecting Scenario 2 logic
    const mainDataPayload = { ...dataToSend };
    mainDataPayload[SelectedConstuctionItem] = selectedValue;


    // Proceed only if a construction item has been selected
    if (SelectedConstuctionItem !== "") {
      // --- Update UI Color ---
      const documentElement = document.getElementById(villaID); // Assuming villaID matches an SVG element ID
      if (documentElement) {
        // Apply background fill color based on the selected status using a predefined map
        if (monitoringselectionvalue === "3" )
        documentElement.style.fill = statusColorMapInvoice[selectedValue] || "#F2F2F2"; // Default grey if status not in map
        else if (monitoringselectionvalue === "1" )
          documentElement.style.fill = statusColorMap[selectedValue] || "#F2F2F2"; // Default grey if status not in map

      }








      if (selectedValue !== "Paid" && old_villaStatusInvoice === "Paid") {
        getbuttondata(villaID, wajhaInvoicetable)
                       .then((invoiceStatusData) => {
                          
                          //console.log("Fetched old invoice status:", oldinvoicestatus);
                          
                            //console.log("Status changed from Completed.");
                            // Ask for user confirmation before proceeding
                            const userConfirmed = confirm(
                               `Item '${SelectedConstuctionItem}' was previously 'Paid ' in last Invoices . \nAre you sure you want to change its status to '${selectedValue}'`
                            );
               
                            if (userConfirmed) {
                               //console.log("User confirmed change from Completed status.");
                               // Action: Update the invoice table to reflect the new status (e.g., remove 'ReadyToPay' or set to new status)
                            dataToSend[SelectedConstuctionItem]=selectedValue;
                               addDataToDynamoDB(wajhaInvoicetable, dataToSend)
                                 .then(invoiceUpdateData => {
                                     //console.log(`Invoice table updated for item ${SelectedConstuctionItem} to status ${selectedValue}.`);
                                     // You might still want to fetch the *previous* invoice status for logging or other logic if needed
                                     getbuttondata(villaID, wajhaInvoicetable).then();
                                     //status => console.log("Previous invoice status was:", status));
               
                                     // TODO: Review why button_submit is clicked twice. Is this intentional?
                                      const MonitoringTypeSelect = document.getElementById('MonitoringType');
    if (MonitoringTypeSelect) {
      MonitoringTypeSelect.disabled = false;
      retrievebuttonclickgeneraldata();
    }
                                     
                                 })
                                 .catch(error => {
                                     console.error(`Error updating invoice table status to ${selectedValue}:`, error);
                                     alert("Failed to update invoice table status. Please check manually."); // User feedback on error
                                 });
               
                            } else {
                               //console.log("User cancelled change from Completed status.");
                               // Optional: Revert UI changes if desired (e.g., set fill color back)
                               // if (documentElement) {
                               //    documentElement.style.fill = statusColorMap[old_villaStatus] || "#F2F2F2";
                               // }
                               // Optional: Inform the user the main status *was* updated, but the invoice wasn't touched.
                               // alert("Main status updated, but invoice status remains unchanged as requested.");
               
                               // Note: The main table (WajhaDatatable) was already updated before this check.
                               // Reverting that would require another database call and more complex logic.
                            }








                          
                          
                              
                            
                          


        
                          
                       })
                       .catch((error) => {
                         console.error("Error getting data from invoice table:", error);
                       });





         
      }

      else  {
        
        // Modify the data payload for the invoice table
        // Create a separate payload copy for the invoice table update
        const invoiceDataPayload = { ...dataToSend };
        invoiceDataPayload[SelectedConstuctionItem] = selectedValue; // Set invoice status
        //console.log("updated.....1");
        // Update the invoice table
        addDataToDynamoDB(wajhaInvoicetable, invoiceDataPayload)
          .then((invoiceData) => { // 'invoiceData' is the response from the *second* update
            //console.log("Invoice table updated successfully to ReadyToPay.");
            // TODO: Review why button_submit is clicked twice. Is this intentional?
             const MonitoringTypeSelect = document.getElementById('MonitoringType');
    if (MonitoringTypeSelect) {
      MonitoringTypeSelect.disabled = false;
      retrievebuttonclickgeneraldata();
    }
            
            getbuttondata(villaID, wajhaInvoicetable).then();
            //status => console.log("Previous invoice status was:", status));

          })
          .catch((error) => {
            console.error("Error adding ReadyToPay data to invoice table:", error);
            alert("Failed to update invoice table. Please check manually."); // User feedback on error
          });


      }




    
       

      // Removed the premature success alert from here.

    } else {
      // Alert if no construction item is selected
      alert("Please select a construction item first."); // Alert message (Consider localizing)
    }
  } else {
    // Log if no radio button was selected
    console.log("No villa status selected.");
    alert("Please select a status for the villa."); // User feedback
  }
}

