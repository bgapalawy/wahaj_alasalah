// graph of activities categorized
function createActivityGraphcategorized(activitiesData, blockingarray, currentActivityId = null) { // Added statusColorMap to params for clarity
 
 
    // --- 1. Define Color Palettes & Styling Constants ---
    const categoryColors = [ // Example palette - expand or use a generator if many categories
        '#A7C7E7', // Light Blue
        '#B0E57C', // Light Green
        '#FFDAB9', // Peach
        '#F8C8DC', // Pink
        '#E6E6FA', // Lavender
        '#FFFACD', // Lemon Chiffon
        '#ADD8E6', // Light Blue (repeat if necessary)
    ];
    let categoryColorIndex = 0;
    const categoryColorMap = {}; // To store assigned colors per category
  
    const defaultActivityColor = '#E0E0E0'; // Default grey if status not found
    const blockingEdgeColor = '#FF0000'; // Red for blocking relationships
    const currentActivityBorderColor = '#000000'; // Blue border for current activity star
    const blockingActivityBorderColor = blockingEdgeColor; // Red border for blocking activity star
    
    // --- 2. Prepare Data ---
    const nodes = new vis.DataSet();
    const edges = new vis.DataSet();
  
    // --- 2.5 Identify Blocking Activity IDs ---
    // Create a Set for efficient lookup of which activities are blockers
   
    const blockingActivityIds = new Set(
      Array.isArray(blockingarray) ? blockingarray.map(b => b.id) : []
  );
  
    // Group activities by top-level category
    const categories = {};
    activitiesData.forEach((activity) => {
        const parts = activity.nameArabic.split(" - ");
        const category = parts[0];
        const activityLabel = parts.length > 1 ? parts.slice(1).join(" - ") : activity.nameArabic; // Handle names without " - "
  
        if (!categories[category]) {
            categories[category] = [];
            // Assign a color to the new category
            if (!categoryColorMap[category]) {
                categoryColorMap[category] = categoryColors[categoryColorIndex % categoryColors.length];
                categoryColorIndex++;
            }
        }
        categories[category].push({ ...activity, shortLabel: activityLabel }); // Store activity with short label
    });
  
    // --- 3. Add Nodes and Hierarchy Edges ---
    for (const category in categories) {
        const activities = categories[category];
  
        // Add Category Node
        nodes.add({
            id: category,
            label: `<b>${category}</b>`, // Bold category name
            level: 0,
            shape: "box",
            color: {
                background: categoryColorMap[category] || '#DDDDDD',
                border: '#555555',
                highlight: {
                    background: categoryColorMap[category] || '#DDDDDD',
                    border: '#222222'
                }
            },
            font: { multi: 'html', size: 16, face: 'Arial', color: '#000000' },
            margin: 15,
            widthConstraint: { minimum: 150 },
        });
  
        // Add Activity Nodes and Edges from Category
        activities.forEach((activity) => {
            let activityColor = statusColorMap[activity.status] || defaultActivityColor;
            let nodeShape = "box"; // Default shape
            let nodeBorderColor = '#888888'; // Default border color
            let nodeBorderWidth = 1; // Default border width
            let tooltipSuffix = ''; // To add info to tooltip
            let nodeSize=25;
            // *** MODIFICATION START ***
            const isCurrent = activity.id === currentActivityId;
            const isBlocking = blockingActivityIds.has(activity.id);
  
            if (isCurrent) {
                nodeShape = "star"; ///star
                nodeBorderColor = currentActivityBorderColor;
                nodeBorderWidth = 2; // Make border slightly thicker
                tooltipSuffix += ' CURRENT ACTIVITY';
                activityColor = currentActivityBorderColor;
                nodeSize =75;
  
                
            } else if (isBlocking) {
               activityColor = blockingActivityBorderColor;
                nodeShape = "star";
                nodeBorderColor = blockingActivityBorderColor;
                nodeBorderWidth = 2; // Make border slightly thicker
                tooltipSuffix += ' BLOCKING ACTIVITY';
                nodeSize =75;
            }
            // *** MODIFICATION END ***
  
            nodes.add({
                id: activity.id,
                label: activity.shortLabel,
                title: `Status: ${activity.status}${tooltipSuffix}`, // Add suffix to tooltip
                level: 1,
                shape: nodeShape, // Use the determined shape
                size: nodeSize, 
                color: {
                    background: activityColor,
                    border: nodeBorderColor, // Use the determined border color
                    highlight: {
                        background: activityColor,
                        border: activityColor // Keep red border on selection/hover, or adjust if needed
                    }
                },
                borderWidth: nodeBorderWidth, // Use determined border width
                font: { size: 12, face: 'Tahoma', color: '#333333' },
                margin: 10,
                widthConstraint: { minimum: 100 },
                shapeProperties: {
                    // Only apply borderRadius if it's a box, stars don't use it
                    borderRadius: nodeShape === 'box' ? 4 : 0
                }
            });
  
            // Edge from Category to Activity (Subtle)
            edges.add({
                from: category,
                to: activity.id,
                arrows: { to: { enabled: false } },
                color: {
                    color: '#CCCCCC',
                    highlight: '#AAAAAA'
                },
                smooth: { type: 'cubicBezier' }
            });
        });
    }
  
    // --- 4. Add Blocking Edges ---
    if (blockingarray && Array.isArray(blockingarray)) {
        blockingarray.forEach(block => {
            if (block.from && block.to) { // Ensure valid block object
                edges.add({
                    from: block.from,
                    to: block.to,
                    arrows: { to: { enabled: true, scaleFactor: 0.8, type: 'arrow' } },
                    color: {
                        color: blockingEdgeColor,
                        highlight: {
                          background: blockingEdgeColor,
                          border: blockingEdgeColor // Keep red border on selection/hover, or adjust if needed
                      }
                    },
                    width: 2,
                    dashes: [5, 5],
                    smooth: { type: 'curvedCW', roundness: 0.2 }
                });
               
            }
        });
    }
  
    // --- 5. Create Containers ---
    const mainContainer = document.createElement("div");
    mainContainer.style.position = "relative";
    mainContainer.style.width = "100%";
    mainContainer.style.height = "600px";
  
    const graphContainer = document.createElement("div");
    graphContainer.id = "mynetwork"; // Make sure this ID is unique if you have multiple graphs on a page
    graphContainer.style.width = "100%";
    graphContainer.style.height = "100%";
    graphContainer.style.border = "1px solid lightgray";
    mainContainer.appendChild(graphContainer);
  
    const legendContainer = document.createElement("div");
    legendContainer.style.position = "absolute";
    legendContainer.style.bottom = "10px";
    legendContainer.style.right = "10px";
    legendContainer.style.padding = "10px";
    legendContainer.style.backgroundColor = "rgba(255, 255, 255, 0.9)";
    legendContainer.style.border = "1px solid #CCC";
    legendContainer.style.borderRadius = "5px";
    legendContainer.style.boxShadow = "2px 2px 5px rgba(0,0,0,0.2)";
    legendContainer.innerHTML = "<b>Legend:</b><br>";
  
    // Populate Status Legend
    Object.keys(statusColorMap).forEach((status) => {
        const color = statusColorMap[status];
        legendContainer.innerHTML += `
            <span style="display:inline-block; width:15px; height:15px; background-color:${color}; border: 1px solid #888; margin-right: 5px; vertical-align: middle;"></span>
            <span style="vertical-align: middle;">${status}</span><br>
        `;
    });
     // Add legend entry for blocking edges
     legendContainer.innerHTML += `
        <span style="display:inline-block; width:15px; height:2px; border-top: 2px dashed ${blockingEdgeColor}; margin-right: 5px; vertical-align: middle;"></span>
        <span style="vertical-align: middle;">Blocking Relationship</span><br>
    `;
    // *** Add legend entries for special node types ***
    legendContainer.innerHTML += `
        <span style="display:inline-block; font-size: 18px; width: 15px; text-align: center; color:${currentActivityBorderColor}; margin-right: 5px; vertical-align: middle;">★</span>
        <span style="vertical-align: middle;">Current Activity</span><br>
    `;
    legendContainer.innerHTML += `
        <span style="display:inline-block; font-size: 18px; width: 15px; text-align: center; color:${blockingActivityBorderColor}; margin-right: 5px; vertical-align: middle;">★</span>
        <span style="vertical-align: middle;">Blocking Activity</span><br>
    `;
    // *** End legend modification ***
  
    mainContainer.appendChild(legendContainer);
  
  
    // --- 6. Configure Options ---
    const data = { nodes, edges };
    const options = {
        layout: {
            hierarchical: {
                enabled: true,
                direction: "UD",
                sortMethod: "directed",
                levelSeparation: 150,
                nodeSpacing: 180,
                treeSpacing: 250,
                blockShifting: true,
                edgeMinimization: true,
                parentCentralization: true,
            },
        },
        physics: {
            enabled: false, // Keep physics disabled for hierarchical
        },
        nodes: {
           // shape: 'box', // Default shape is now determined dynamically per node
            size: 25,
            font: {
                size: 14,
                color: '#333333',
                face: 'Arial'
            },
            // borderWidth: 1, // Default border width is now determined dynamically
            borderWidthSelected: 3,
        },
        edges: {
            width: 1,
            smooth: {
                enabled: true,
                type: "continuous",
                roundness: 0.5
            },
            color: {
                color: '#848484',
                highlight: '#FFCC00',
                hover: '#55AAFF',
                opacity: 1.0
            },
            arrows: {
                to: { enabled: true, scaleFactor: 0.7, type: 'arrow' }
            },
        },
        
        interaction: {
            hover: true,
            tooltipDelay: 200,
            navigationButtons: true,
            keyboard: {
                enabled: true,
                speed: { x: 10, y: 10, zoom: 0.05 },
                bindToWindow: false
            },
            zoomView: true,
            dragView: true
        },
    };
  
    // --- 7. Create Network ---
    // Ensure vis is loaded before calling this
    if (typeof vis === 'undefined') {
        console.error("vis.js library not loaded!");
        // Optionally return an error message or an empty container
        const errorDiv = document.createElement('div');
        errorDiv.textContent = 'Error: vis.js library not found.';
        return errorDiv;
    }
    const network = new vis.Network(graphContainer, data, options);
  
    network.once("stabilizationIterationsDone", function () {
        network.fit({
            animation: {
                duration: 500,
                easingFunction: "easeInOutQuad",
            },
        });
    });
     // Optional: Focus on the current node if it exists
     if (currentActivityId && nodes.get(currentActivityId)) {
      network.once('afterDrawing', function() { // Ensure drawing is complete
           setTimeout(() => { // Timeout helps ensure rendering is stable
              network.focus(currentActivityId, {
                  scale: 0.5, // Optional: Set zoom level when focusing
                  animation: { duration: 800, easingFunction: 'easeOutQuad' }
              });
               network.selectNodes([currentActivityId], false); // Optionally select the node
          }, 100); // Small delay might be needed
      });
  }
  
    // --- 8. Return the Main Container ---
    return mainContainer;
  }
  






  
function findRootCauseBlockingActivities(
    activityId,
    activities,
    visited = new Set()
  ) {
    const activity = activities.find((act) => act.id === activityId);
  
    if (!activity) {
      console.error(`Activity with ID ${activityId} not found.`);
      return [];
    }
  
    // Avoid infinite loops by checking if the activity has already been visited
    if (visited.has(activityId)) {
      return [];
    }
  
    // Mark the current activity as visited
    visited.add(activityId);
  
    // If the activity is completed, it's not blocking
    if (activity.status === "Completed") {
      return [];
    }
  
    // If the activity has no predecessors, it is a root cause
    if (activity.predecessors.length === 0) {
      return [
        {
          id: activity.id,
          name: activity.name,
          nameArabic: activity.nameArabic,
          status:activity.status
        },
      ];
    }
  
    // Collect blocking activities from predecessors
    let blockingActivities = [];
    for (const predecessorId of activity.predecessors) {
      const predecessorBlockingActivities = findRootCauseBlockingActivities(
        predecessorId,
        activities,
        visited
      );
      blockingActivities = blockingActivities.concat(
        predecessorBlockingActivities
      );
    }
  
    // If all predecessors are resolved or completed, this activity is a root cause
    const allPredecessorsResolved = activity.predecessors.every(
      (predecessorId) => {
        const predecessor = activities.find((act) => act.id === predecessorId);
        return predecessor && predecessor.status === "Completed";
      }
    );
  
    if (allPredecessorsResolved) {
      blockingActivities.push({
        id: activity.id,
        name: activity.name,
        nameArabic: activity.nameArabic,
        status:activity.status
      });
    }
  
    return blockingActivities;
  }
  
  
  // Main function to check blocking activities
  function createelementsofblockingactivities(activityIdToCheck, activities, layer,SelectedConstuctionItemForpopup) {
    // Create the main header
    //console.log(SelectedConstuctionItemForFileName);
    var h2 = document.createElement("h1");
    h2.textContent = "Blocking Activities Checker";
    h2.className = "header";
  
    // Create the results div
    var resultsDiv = document.createElement("div");
    resultsDiv.id = "results";
    resultsDiv.className = "results-div";
  
    // Populate the inner HTML of the results div
    resultsDiv.innerHTML = `
      <span class="statueHeader">
        Villa Status<br>
        ${SelectedConstuctionItemForpopup}<br>
        Villa ID: ${layer.feature.properties.villaID}<br>
        Block: ${layer.feature.properties.blocknum}<br>
        Villa: ${layer.feature.properties.villanum}
      </span>
    `;
  
    // Find blocking activities
    var blockingActivities = findRootCauseBlockingActivities(activityIdToCheck, activities);
  
    // Process the results
    if (blockingActivities.length > 0) {
      if (blockingActivities[0].id !== activityIdToCheck) {
        resultsDiv.innerHTML += `<h3 class="not-ready">Activity "${activities.find(act => act.id === activityIdToCheck).name}" is NOT ready to begin due to blocking activities:</h3>`;
        blockingActivities.forEach((blockingActivity, index)=> {
          //ID: ${blockingActivity.id},
          // English Name: ${blockingActivity.name},
          //Arabic Name:
          resultsDiv.innerHTML += `
          <span style="display: inline-block; direction: ltr; margin-right: 10px;">
              #: ${index + 1} : ${blockingActivity.nameArabic} 
          </span>
          <span style="display: inline-block; direction: ltr; margin-right: 10px;">
              Status: ${blockingActivity.status}
          </span><br>
      `;
             
        });
      } else {
        resultsDiv.innerHTML += `<h3 class="ready">Activity "${activities.find(act => act.id === activityIdToCheck).name}" is ready to begin.</h3>`;
      }
    } else {
      resultsDiv.innerHTML += `<h3 class="completed">Activity "${activities.find(act => act.id === activityIdToCheck).name}" is completed.</h3>`;
    }
  
    // Append the main header to resultsDiv
    resultsDiv.prepend(h2);
  
    return resultsDiv; // Return the resultsDiv element
  }
  
  
  
  
  //grap relations
  function createActivityGraph(activitiesData, blockingActivitiesInfo = [], currentActivityId = null) { // Added currentActivityId parameter
  
    // --- 1. Define Color Palettes & Styling Constants ---
    const defaultActivityColor = '#FFFFFF';
    const predecessorEdgeColor = '#555555';
    const blockingNodeIconColor = '#FF0000';   // Bright Red for blocking icon
    const currentNodeIconColor = '#000000';    // Black for current node icon (or choose another color e.g., '#FFD700' for gold)
  
    const categoryColorPalette = {
        'Civil': '#A7C7E7',       // Light Blue
        'Mechanical': '#B0E57C',   // Light Green
        'Architectural': '#FFDAB9', // Peach
        'Electrical': '#F8C8DC',   // Pink
        'Fence': '#E6E6FA',      // Lavender
        'Default': '#DDDDDD'
    };
  
    // Helper to get category
    const getCategory = (tableItemId) => {
        if (!tableItemId || typeof tableItemId !== 'string') return 'Default';
        return tableItemId.split('-')[0] || 'Default';
    };
  
    // --- 2. Prepare Data & Blocking Info ---
    const nodes = new vis.DataSet();
    const edges = new vis.DataSet();
    const categoriesUsed = new Set();
  
    // Create a Set of blocking activity IDs for efficient lookup
    const blockingIds = new Set(
        Array.isArray(blockingActivitiesInfo) ? blockingActivitiesInfo.map(b => b.id) : []
    );
    let blockingLegendNeeded = blockingIds.size > 0; // Check if we need to add blocking style to legend
    let currentLegendNeeded = currentActivityId !== null; // Check if we need the current activity legend
  
    // --- 3. Add Nodes ---
    activitiesData.forEach((activity) => {
        const category = getCategory(activity.TableItemID);
        categoriesUsed.add(category);
        const nodeStatusColor = statusColorMap[activity.status] || defaultActivityColor;
        const nodeCategoryBorderColor = categoryColorPalette[category] || categoryColorPalette['Default'];
  
        const isBlocking = blockingIds.has(activity.id); // Check if this node is a root cause blocker
        const isCurrent = activity.id === currentActivityId; // Check if this is the current node
  
        // Base node properties
        let nodeOptions = {
            id: activity.id,
            label: activity.nameArabic, // Assuming Arabic name is primary label
            shape: "box",
            font: { size: 12, face: 'Tahoma', color: '#333333' },
            margin: { top: 10, right: 10, bottom: 10, left: 10 }, // Default margins
            widthConstraint: { minimum: 120, maximum: 250 },
            borderWidth: 2, // Default border width
            borderWidthSelected: 4, // Default selected border width
            color: {
                background: nodeStatusColor,
                border: nodeCategoryBorderColor, // Default border color based on category
                highlight: {
                    background: nodeStatusColor,
                    border: '#FF5555' // Highlight border (can be different for blocking)
                },
                hover: {
                    background: nodeStatusColor,
                    border: '#2B7CE9' // Hover border (can be different for blocking)
                }
            },
            shapeProperties: {
                borderDashes: false // Default: solid border
            }
            // title and icon will be set below based on blocking/current status
        };
  
        // Base tooltip (HTML for vis.js tooltips)
        // let tooltip = `<b>ID:</b> ${activity.TableItemID}<br><b>Name:</b> ${activity.name}<br><b>Status:</b> ${activity.status}`; // More detailed example
        let tooltip = `Status: \"${activity.status}\"`; // Base tooltip
  
        let iconAdded = false; // Flag to track if an icon was added
  
  
   // Check if the icon is to be added for the current activity
  if (isCurrent) {
    nodeOptions.label = `${activity.nameArabic}  \n  Current activity \n Status: \"${activity.status}\" `; // Clear label to show only icon
    nodeOptions.shape = 'icon'; // Ensure shape is set to icon for the star
    nodeOptions.icon = {
        face: 'FontAwesome', // Correctly set font family
        weight: "900", // Use "900" for Solid style
        code: "\uf005", // Unicode for solid star (fa-star)
        size: 125, // Adjusted size
        color: currentNodeIconColor // Color for the icon
    };
    tooltip += `....=> Current Activity`; // Add note to tooltip
    iconAdded = true;
  } else if (isBlocking) {
    // ... existing blocking activity configurations
  
    // Add red star icon
    nodeOptions.label = `${activity.nameArabic} \n  Blocking activity \n Status: \"${activity.status}\"  `; // Clear label to show only icon
    nodeOptions.shape = 'icon'; // Ensure shape is set to icon for the star
    nodeOptions.icon = {
        face: 'FontAwesome', // Correctly set font family
        weight: "900", // "900" for Solid style
        code: "\uf005", // Unicode for solid star (fa-star)
        size: 125, // Adjusted size
        color: blockingNodeIconColor // Red color for the icon
    };
    tooltip += `.....=> is The Root Cause Of Blocking`; // Add note to tooltip
    iconAdded = true;
  }
  
        // Adjust margin if an icon was added to prevent overlap with text
        if (iconAdded) {
            nodeOptions.margin = { top: 20, right: 20, bottom: 20, left: 20 }; // Increase bottom margin
        }
  
  
        nodeOptions.title = tooltip; // Assign the final tooltip
  
        nodes.add(nodeOptions);
    });
  
    // --- 4. Add Predecessor Edges ---
    activitiesData.forEach((activity) => {
        if (activity.predecessors && Array.isArray(activity.predecessors)) {
            activity.predecessors.forEach(predecessorId => {
                if (nodes.get(predecessorId)) {
                    edges.add({
                        from: predecessorId,
                        to: activity.id,
                        arrows: { to: { enabled: true, scaleFactor: 0.7, type: 'arrow' } },
                        color: {
                            color: predecessorEdgeColor,
                            highlight: '#000000',
                            hover: '#2B7CE9'
                        },
                        smooth: { type: 'cubicBezier', forceDirection: 'horizontal', roundness: 0.4 }
                    });
                } else {
                    console.warn(`Predecessor ID ${predecessorId} for activity ${activity.id} not found.`);
                }
            });
        }
    });
  
    // --- 5. Create Containers ---
    const mainContainer = document.createElement("div");
    mainContainer.style.position = "relative";
    mainContainer.style.width = "100%";
    mainContainer.style.height = "800px"; // Adjust height as needed
  
    const graphContainer = document.createElement("div");
    graphContainer.id = "mynetwork_predecessor_"+ Date.now(); // More unique ID
    graphContainer.style.width = "100%";
    graphContainer.style.height = "100%";
    graphContainer.style.border = "1px solid lightgray";
    mainContainer.appendChild(graphContainer);
  
    // Legend container
    const legendContainer = document.createElement("div");
    legendContainer.style.position = "absolute";
    legendContainer.style.bottom = "15px";
    legendContainer.style.right = "15px";
    legendContainer.style.padding = "12px";
    legendContainer.style.backgroundColor = "rgba(255, 255, 255, 0.95)";
    legendContainer.style.border = "1px solid #BBB";
    legendContainer.style.borderRadius = "6px";
    legendContainer.style.boxShadow = "2px 2px 6px rgba(0,0,0,0.2)";
    legendContainer.style.fontSize = "11px";
    legendContainer.style.fontFamily = "Tahoma, sans-serif"; // Match node font if desired
    legendContainer.style.maxHeight = "50%"; // Adjusted max height maybe needed
    legendContainer.style.overflowY = "auto";
    legendContainer.style.zIndex = "10"; // Ensure legend is above the graph
  
    let legendHtml = "<b>Legend</b><br><hr style='margin: 3px 0;'>";
  
    // Status Legend
    if (Object.keys(statusColorMap).length > 0) {
        legendHtml += "<b>Status (Fill):</b><br>";
        Object.keys(statusColorMap).forEach((status) => {
            const color = statusColorMap[status];
            legendHtml += `
                <span style="display:inline-block; width:12px; height:12px; background-color:${color}; border: 1px solid #888; margin-right: 4px; vertical-align: middle;"></span>
                <span style="vertical-align: middle;">${status}</span><br>
            `;
        });
         legendHtml += "<hr style='margin: 3px 0;'>";
    }
  
    // Category Legend
    if (categoriesUsed.size > 0) {
        legendHtml += "<b>Category (Border):</b><br>";
        categoriesUsed.forEach((category) => {
            const color = categoryColorPalette[category] || categoryColorPalette['Default'];
                legendHtml += `
                <span style="display:inline-block; width:12px; height:12px; border: 2px solid ${color}; margin-right: 4px; vertical-align: middle;"></span>
                <span style="vertical-align: middle;">${category}</span><br>
            `;
        });
        legendHtml += "<hr style='margin: 3px 0;'>";
    }
  
  
    legendHtml += "<b>Indicators:</b><br>";
  
    // Dependency Line Legend
     legendHtml += `
        <span style="display:inline-block; width:15px; height:1px; border-top: 2px solid ${predecessorEdgeColor}; margin-right: 4px; vertical-align: middle;"></span> &#x2192;
        <span style="vertical-align: middle;">Dependency</span><br>
    `;
  
     // Current Activity Legend (only if needed)
    if (currentLegendNeeded) {
         legendHtml += `
            <i class="fa-solid fa-star" style="color:${currentNodeIconColor}; margin-right: 4px; vertical-align: middle; font-size: 12px;"></i>
            <span style="vertical-align: middle;">Current Activity</span><br>
        `;
    }
  
    // Blocking Explanation Legend (only if needed)
    if (blockingLegendNeeded) {
        //  legendHtml += `
        //     <span style="display:inline-block; width:12px; height:12px; border: 3px dashed ${blockingNodeBorderColor}; margin-right: 4px; vertical-align: middle;"></span>
        //     <span style="vertical-align: middle;">Blocking Border</span><br>
        // `;
        legendHtml += `
            <i class="fa-solid fa-star" style="color:${blockingNodeIconColor}; margin-right: 4px; vertical-align: middle; font-size: 12px;"></i>
            <span style="vertical-align: middle;">Root Cause Blocker</span><br>
        `;
    }
  
    legendContainer.innerHTML = legendHtml;
    mainContainer.appendChild(legendContainer);
  
  
    // --- 6. Configure Options ---
    const data = { nodes, edges };
    const options = {
        locale: 'en', // Set locale if you want English UI elements, 'ar' for Arabic
        layout: {
            hierarchical: {
                enabled: true,
                direction: "LR", // Left to Right flow
                sortMethod: "directed", // Sort based on edge direction
                levelSeparation: 500, // Increase space between levels
                nodeSpacing: 150,     // Increase space between nodes in the same level
                treeSpacing: 300,     // Increase space between different trees (if any)
                blockShifting: true,
                edgeMinimization: true,
                parentCentralization: true,
            },
        },
        physics: { enabled: false }, // Disable physics for hierarchical layout stability
        nodes: {
            // Default node styles (most are now set individually)
            // shape: 'box',
            // font: { size: 12, face: 'Tahoma' },
        },
        edges: {
              smooth: {
                 enabled: true,
                 type: "cubicBezier",
                 forceDirection: "horizontal", // Crucial for LR hierarchical
                 roundness: 0.4
              },
            arrows: { to: { enabled: true, scaleFactor: 0.7 } },
            color: { color: predecessorEdgeColor, highlight: '#000000', hover: '#2B7CE9' }, // Consistent edge color
            width: 1.5,
        },
        interaction: {
            hover: true,
            tooltipDelay: 250,
            navigationButtons: true, // Show zoom/fit buttons
            keyboard: { enabled: true, bindToWindow: false }, // Enable keyboard navigation (within the container)
            zoomView: true,
            dragView: true,
            selectConnectedEdges: false, // Don't select edges when node is selected
        },
    };
  
    // --- 7. Create Network ---
    const network = new vis.Network(graphContainer, data, options);
  
    network.once("stabilizationIterationsDone", function () {
        // Optional: Fit the network to view after stabilization if needed
        // network.fit({ animation: { duration: 500, easingFunction: 'easeInOutQuad' } });
        // console.log("Graph stabilization complete.");
    });
  
     // Optional: Focus on the current node if it exists
    if (currentActivityId && nodes.get(currentActivityId)) {
        network.once('afterDrawing', function() { // Ensure drawing is complete
             setTimeout(() => { // Timeout helps ensure rendering is stable
                network.focus(currentActivityId, {
                    scale: 0.5, // Optional: Set zoom level when focusing
                    animation: { duration: 800, easingFunction: 'easeOutQuad' }
                });
                 network.selectNodes([currentActivityId], false); // Optionally select the node
            }, 100); // Small delay might be needed
        });
    }
  
  
    // --- 8. Return the Main Container ---
    return mainContainer;
  }
  
