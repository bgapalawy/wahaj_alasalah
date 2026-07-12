
var map = L.map("main_map", {
  dragging: false,
  minZoom: 17.5,
  maxZoom: 18,
  attributionControl: false,
  transform: true,
  zoomControl: false, // Disable zoom controls
  scrollWheelZoom: false, // Disable scroll wheel zoom
  doubleClickZoom: false, // Disable double-click zoom
  touchZoom: false, // Disable touch zoom
});
map.setView([-0.004768967622973434, 0.00407695770263672], 3);

//villa data
villa_data = poly.features.filter(function (feature) {
  return feature.properties.blocknum !== 0;
});

villa_data_layer = L.geoJSON(villa_data, {
  style: function (feature) {
    return { className: "my_style_villa" };
  },
}).addTo(map);
let popup ;

//adding id and left pop up and right pop up and show text on villa
villa_data_layer.eachLayer(function (layer) {
  //set villa id in path
  layer._path.id = `V_${layer.feature.properties.villaID}`;

  //show vill num on villa
 
  layer
    .bindTooltip(`${layer.feature.properties.villanum}`, {
      permanent: true,
      direction: "center",
      className: "showTextonvilla",
    })
    .openTooltip();
    tooltip[`V_${layer.feature.properties.villaID}`]= layer.getTooltip();
   
  //left-click popup 
layer.on("click", function (e) {
    getbuttondata(layer.feature.properties.villaID, WajhaDatatable);
    getbuttondata(layer.feature.properties.villaID, wajhaInvoicetable);
    const subItemsValue = document.getElementById("subItems").value;
    if (subItemsValue != "") {
        document.getElementById("subItems").disabled = true;
        document.getElementById("constructType").disabled = true;

        // Create a container for both views
        const popupContainer = document.createElement("div");
        popupContainer.classList.add("popup-container");

        // Create navigation button
        const navButton = document.createElement("button");
        navButton.textContent = "Show Dashboard";
        navButton.id = "toggle-view-btn-villa";
        navButton.classList.add("toggle-view-btn-villa");
        navButton.onclick = function() {
            togglePopupView(popupContainer, layer);
        };

        // Create container for main content
        const mainContent = document.createElement("div");
        mainContent.classList.add("popup-content", "main-content");
        mainContent.innerHTML = createLeftClickPopupContent(SelectedConstuctionItemForpopup, layer);

        // Create container for dashboard (initially hidden)
        const dashboardContent = document.createElement("div");
        dashboardContent.classList.add("popup-content", "dashboard-content");
        dashboardContent.style.display = "none";

        // Append everything
        popupContainer.appendChild(navButton);
        popupContainer.appendChild(mainContent);
        popupContainer.appendChild(dashboardContent);

        this.bindPopup(popupContainer).openPopup();

        
        handleFileOperations();
        loadAndRunPopupDashboard(dashboardContent, layer);

    } else {
        alert("Select Construction Item to generate");
    }
});

  // Right-click popup (prevents stacking)
layer.on("contextmenu", function (e) {
  if (document.getElementById("subItems").value != "") {
    document.getElementById("subItems").disabled = true;
    document.getElementById("constructType").disabled = true;

    const villaID = `V_${layer.feature.properties.villaID}`; // Replace with the actual villaID
    retrieveSpecificRowDataFromDynamoDB(WajhaDatatable, villaID)
      .then((retrievedData) => {
        // Update the activities array based on the retrieved data
        let activities2 = activities;
        updateActivityStatus(activities2, retrievedData);

        const rightClickPopupElement = document.createElement("div");
        rightClickPopupElement.classList.add("right-click-popup"); // Add CSS class for styling
       // Find blocking activities
       var blockingActivities = findRootCauseBlockingActivities(SelectedConstuctionItemID, activities2);
        const rightClickPopupContent2 = createelementsofblockingactivities(
          SelectedConstuctionItemID,
          activities2,
          layer,SelectedConstuctionItemForpopup
        );
        const seperateelement = document.createElement("div");
        seperateelement.classList.add("seperateelement"); // Add CSS class for styling
        rightClickPopupElement.appendChild(seperateelement);
        rightClickPopupElement.appendChild(rightClickPopupContent2);
        rightClickPopupElement.appendChild(seperateelement);
        const ChangeGraph = document.createElement("button");
       ChangeGraph.innerHTML = "ChangeGraph";
    ChangeGraph.id = "ChangeGraph";
    ChangeGraph.textContent = "Show Categorized Graph";
        rightClickPopupElement.appendChild(ChangeGraph);
        rightClickPopupElement.appendChild(seperateelement);

        // 3. Track which graph is currently shown
let showingCategorized = false;
        const rightClickPopupContent = createActivityGraph(activities2,blockingActivities,SelectedConstuctionItemID);
        const rightClickPopupContentcategorized =createActivityGraphcategorized(activities2, blockingActivities,SelectedConstuctionItemID)
        rightClickPopupElement.appendChild(rightClickPopupContent);
        
        // 5. Toggle logic
        ChangeGraph.onclick = function () {
          // Remove whichever graph is currently present
          if (rightClickPopupElement.contains(rightClickPopupContent)) {
              rightClickPopupElement.removeChild(rightClickPopupContent);
          }
          if (rightClickPopupElement.contains(rightClickPopupContentcategorized)) {
              rightClickPopupElement.removeChild(rightClickPopupContentcategorized);
          }
      
          // Toggle and append the new one
          if (showingCategorized) {
              rightClickPopupElement.appendChild(rightClickPopupContent);
              ChangeGraph.textContent = "Show Categorized Graph";
              
                

          } else {
              rightClickPopupElement.appendChild(rightClickPopupContentcategorized);
              ChangeGraph.textContent = "Show Normal Graph";
              

          }
          showingCategorized = !showingCategorized;
      };


        // Close any previously opened popups (optional)
        map.closePopup();
        this.bindPopup(rightClickPopupElement).openPopup(); // Bind and open immediately
      })
      .catch((error) => {
        console.error("Error retrieving data:", error);
      });
  } else {
    alert("Select Construction Item to generate");
  }
});
});

































 





















//////////not villa
not_villa = poly.features.filter(function (feature) {
  return (
    feature.properties.blocknum === 0 && feature.properties.TxtMemo === " "
  );
});
not_villa_layer = L.geoJSON(not_villa, {
  style: function (feature) {
    return { className: "Not_villa" };
  },
}).addTo(map);

////////blocks icon

not_villa_blocks = poly.features.filter(function (feature) {
  return (
    feature.properties.TxtMemo !== " " && feature.properties.blocknum === 0
  );
});

not_villa_blocks_layer = L.geoJSON(not_villa_blocks, {
  style: function (feature) {
    return { className: "Not_villa_block" };
  },
}).addTo(map);

//show text on blocks  by tooltip

not_villa_blocks_layer.eachLayer(function (layer) {
  if (
    layer.feature.properties.TxtMemo === "BLOCK-7" ||
    layer.feature.properties.TxtMemo === "BLOCK-27" ||
    layer.feature.properties.TxtMemo === "BLOCK-28"
  ) {
    layer
      .bindTooltip(
        `<span class="showblocknumText1">${layer.feature.properties.TxtMemo}<span>`,
        {
          permanent: true,
          opacity: 0.9,
          direction: "center",
        }
      )
      .openTooltip();
  } else {
    layer
      .bindTooltip(
        `<span class="showblocknumText2">${layer.feature.properties.TxtMemo}<span>`,
        {
          permanent: true,
          opacity: 0.9,
          direction: "center",
        }
      )
      .openTooltip();
  }
});
