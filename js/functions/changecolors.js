// statusColorSelector.js
class StatusColorSelector {
    constructor(containerId, colorMaps, options = {}) {
        // Store references to the original color maps
        this.originalColorMaps = {
          inspection: colorMaps.statusColorMap,
          schedule: colorMaps.statusColorMapsch,
          invoice: colorMaps.statusColorMapInvoice,
          general: colorMaps.generalColorPalette,
          generalchoose:colorMaps.generalchoose

        };
    
        // Create working copies of the color maps
        this.colorMaps = {
          inspection: {...colorMaps.statusColorMap},
          schedule: {...colorMaps.statusColorMapsch},
          invoice: {...colorMaps.statusColorMapInvoice},
          general: {...colorMaps.generalColorPalette},
          generalchoose: {...colorMaps.generalchoose}
        };
    
        this.currentMap = options.initialMap || 'inspection';
        this.customColors = {};
        this.container = document.getElementById(containerId);
        
        if (!this.container) {
          console.error(`Container element with ID '${containerId}' not found`);
          return;
        }
    
        this.init();
      }
  
      init() {
        this.createStyles();
        this.render();
        this.setupEventListeners();
      }
  
    createStyles() {
      const style = document.createElement('style');
      style.textContent = `
        .status-color-selector {
          font-family: Arial, sans-serif;
          max-width: 1000px;
          margin: 0 auto;
          padding: 20px;
        }
        .scs-button-group {
          display: flex;
          gap: 10px;
          margin-bottom: 20px;
          flex-wrap: wrap;
        }
        .scs-button-group button {
          padding: 8px 16px;
          background-color: #e0e0e0;
          border: 1px solid #ccc;
          border-radius: 4px;
          cursor: pointer;
        }
        .scs-button-group button.active {
          background-color: #1976d2;
          color: white;
        }
        .scs-color-pickers {
          margin-top: 20px;
          border-top: 1px solid #eee;
          padding-top: 20px;
        }
        .scs-color-item {
          display: flex;
          align-items: center;
          margin-bottom: 15px;
          flex-wrap: wrap;
          gap: 10px;
        }
        .scs-color-item label {
          width: 150px;
          font-weight: bold;
        }
        .scs-color-preview {
          width: 30px;
          height: 30px;
          border: 1px solid #ddd;
          margin: 0 10px;
        }
        .scs-current-mapping {
          margin-top: 30px;
          background-color: #f5f5f5;
          padding: 15px;
          border-radius: 4px;
        }
        .scs-color-options {
          display: flex;
          gap: 8px;
          margin-top: 10px;
          flex-wrap: wrap;
          width: 100%;
          margin-left: 160px;
        }
        .scs-color-option {
          width: 30px;
          height: 30px;
          border: 1px solid #ddd;
          cursor: pointer;
          transition: transform 0.2s;
          position: relative;
        }
        .scs-color-option:hover {
          transform: scale(1.1);
        }
        .scs-color-option::after {
          content: attr(title);
          position: absolute;
          top: -30px;
          left: 50%;
          transform: translateX(-50%);
          background: #333;
          color: white;
          padding: 3px 6px;
          border-radius: 4px;
          font-size: 12px;
          opacity: 0;
          transition: opacity 0.2s;
          pointer-events: none;
          white-space: nowrap;
        }
        .scs-color-option:hover::after {
          opacity: 1;
        }
        .scs-color-controls {
          display: flex;
          align-items: center;
          gap: 10px;
        }
      `;
      document.head.appendChild(style);
    }
  
    render() {
      this.container.className = 'status-color-selector';
      this.container.innerHTML = '';
  
      // Title
      const title = document.createElement('h1');
      title.textContent = 'Status Color Selector';
      this.container.appendChild(title);
  
      // Button Group
      const buttonGroup = document.createElement('div');
      buttonGroup.className = 'scs-button-group';
      
      const buttonTypes = [
        { type: 'inspection', label: 'Inspection Status' },
        { type: 'schedule', label: 'Schedule Status' },
        { type: 'invoice', label: 'Invoice Status' },
        { type: 'general', label: 'General Palette' }
      ];
      
      buttonTypes.forEach(btn => {
        const button = document.createElement('button');
        button.textContent = btn.label;
        button.dataset.type = btn.type;
        if (btn.type === this.currentMap) button.classList.add('active');
        buttonGroup.appendChild(button);
      });
      
      this.container.appendChild(buttonGroup);
  
      // Color Pickers
      this.colorPickers = document.createElement('div');
      this.colorPickers.className = 'scs-color-pickers';
      this.container.appendChild(this.colorPickers);
  
      // Current Mapping
      const currentMapping = document.createElement('div');
      currentMapping.className = 'scs-current-mapping';
      
      const mappingTitle = document.createElement('h3');
      mappingTitle.textContent = 'Current Color Mapping:';
      currentMapping.appendChild(mappingTitle);
      
      this.mappingPre = document.createElement('pre');
      currentMapping.appendChild(this.mappingPre);
      
      this.container.appendChild(currentMapping);
  
      this.renderColorPickers();
      this.updateCurrentMappingDisplay();
    }
  
    renderColorPickers() {
      this.colorPickers.innerHTML = this.currentMap === 'general' 
        ? '<h3>Customize General Palette:</h3>'
        : '<h3>Customize Status Colors:</h3>';
      
      const currentMapData = this.colorMaps[this.currentMap];
      
      for (const [status, defaultColor] of Object.entries(currentMapData)) {
        const colorItem = document.createElement('div');
        colorItem.className = 'scs-color-item';
        
        const colorId = `scs-color-${status}`;
        const currentColor = this.customColors[status] || defaultColor;
        
        // Label
        const label = document.createElement('label');
        label.htmlFor = colorId;
        label.textContent = status;
        colorItem.appendChild(label);
        
        // Color Controls
        const colorControls = document.createElement('div');
        colorControls.className = 'scs-color-controls';
        
        // Preview
        const preview = document.createElement('div');
        preview.className = 'scs-color-preview';
        preview.style.backgroundColor = currentColor;
        colorControls.appendChild(preview);
        
        // Color Input
        const colorInput = document.createElement('input');
        colorInput.type = 'color';
        colorInput.id = colorId;
        colorInput.value = currentColor;
        colorInput.dataset.status = status;
        colorControls.appendChild(colorInput);
        
        // Color Text
        const colorText = document.createElement('span');
        colorText.textContent = currentColor;
        colorControls.appendChild(colorText);
        
        colorItem.appendChild(colorControls);
        
        // Color Options
        const optionsContainer = document.createElement('div');
        optionsContainer.className = 'scs-color-options';
        
        for (const [name, color] of Object.entries(this.colorMaps.generalchoose)) {
          const colorOption = document.createElement('div');
          colorOption.className = 'scs-color-option';
          colorOption.style.backgroundColor = color;
          colorOption.title = `${name}: ${color}`;
          colorOption.dataset.color = color;
          optionsContainer.appendChild(colorOption);
        }
        
        colorItem.appendChild(optionsContainer);
        this.colorPickers.appendChild(colorItem);
      }
    }
  
    setupEventListeners() {
      // Button clicks
      this.container.querySelectorAll('.scs-button-group button').forEach(button => {
        button.addEventListener('click', (e) => {
          this.container.querySelectorAll('.scs-button-group button').forEach(btn => {
            btn.classList.remove('active');
          });
          e.target.classList.add('active');
          
          this.currentMap = e.target.dataset.type;
          this.renderColorPickers();
          this.updateCurrentMappingDisplay();
        });
      });
      
      // Color input changes
      this.container.addEventListener('input', (e) => {
        if (e.target.matches('input[type="color"]')) {
          const status = e.target.dataset.status;
          const newColor = e.target.value;
          
          this.customColors[status] = newColor;
          
          const preview = e.target.previousElementSibling;
          preview.style.backgroundColor = newColor;
          
          const colorText = e.target.nextElementSibling;
          colorText.textContent = newColor;
          
          this.updateCurrentMappingDisplay();
        }
      });
      
      // Color option clicks
      this.container.addEventListener('click', (e) => {
        if (e.target.matches('.scs-color-option')) {
          const color = e.target.dataset.color;
          const status = e.target.closest('.scs-color-item').querySelector('label').textContent;
          
          this.customColors[status] = color;
          
          const colorInput = this.container.querySelector(`#scs-color-${status}`);
          if (colorInput) {
            colorInput.value = color;
            const preview = colorInput.previousElementSibling;
            preview.style.backgroundColor = color;
            const colorText = colorInput.nextElementSibling;
            colorText.textContent = color;
          }
          
          this.updateCurrentMappingDisplay();
        }
      });
    }
  
    updateCurrentMappingDisplay() {
        const currentMapData = this.colorMaps[this.currentMap];
        const mergedMap = {...currentMapData, ...this.customColors};
        this.mappingPre.textContent = JSON.stringify(mergedMap, null, 2);
        
        // Update the original color maps with any customizations
        this.updateSourceMaps();
      }
      updateSourceMaps() {
        // Update the original maps with any custom colors
        for (const [status, color] of Object.entries(this.customColors)) {
          if (this.colorMaps[this.currentMap][status]) {
            // Update both working copy and original map
            this.colorMaps[this.currentMap][status] = color;
            this.originalColorMaps[this.currentMap][status] = color;
          }
        }
      }
  
    // Method to get all original color maps with modifications
  getAllColorMaps() {
    return {
      statusColorMap: {...this.originalColorMaps.inspection},
      statusColorMapsch: {...this.originalColorMaps.schedule},
      statusColorMapInvoice: {...this.originalColorMaps.invoice},
      generalColorPalette: {...this.originalColorMaps.general}
    };
  }
  }


  
  // How to use:
  // 1. In your HTML, create a container div:
  //    <div id="color-selector-container"></div>
 // 2. Create the selector with your maps
 function initializeColorSelector() {
  // Create the container for the color selector
  const containerDiv = document.createElement('div');
  containerDiv.id = 'color-selector-container';
  document.body.appendChild(containerDiv); // Append to the body or a specific parent

  // Create the toggle button
  const toggleButton = document.createElement('button');
  toggleButton.id = 'toggle-Change-Colors-Standard';
  toggleButton.textContent = 'Change Colors Standard';
  document.body.appendChild(toggleButton); // Append to the body or a specific parent

  // Create the color selector
  const colorSelector = new StatusColorSelector('color-selector-container', {
      statusColorMap,
      statusColorMapsch,
      statusColorMapInvoice,
      generalColorPalette,
      generalchoose
  }, {
      initialMap: 'inspection' // optional
  });
  const updatedMaps = colorSelector.getAllColorMaps();
  // Function to toggle visibility of the color selector results
  function toggleResults() {
      const container = document.getElementById('color-selector-container');
      if (container.style.display === 'none' || container.style.display === '') {
          container.style.display = 'block';
          toggleButton.textContent = 'Hide Colors Standard';
      } else {
          container.style.display = 'none';
          toggleButton.textContent = 'Change Colors Standard';
      }
  }

  // Set initial visibility
  containerDiv.style.display = 'none';

  // Add event listener for the button
  toggleButton.addEventListener('click', toggleResults);
}

// Call the function to initialize everything
initializeColorSelector();

  // 3. Any changes will now update the original maps
  // To get all updated maps:
  