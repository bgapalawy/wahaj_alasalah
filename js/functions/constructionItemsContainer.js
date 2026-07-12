
class UIComponents {
  constructor(submitHandler,getdynamoDBClientData, getdynamoDBClientColumns) {
    this.elements = {};
    this.submitHandler = submitHandler;
     this.getdynamoDBClientData=getdynamoDBClientData;
    this.getdynamoDBClientColumns=getdynamoDBClientColumns;
    this.monitoringOptions = [
      { value: "1", text: "تقدم الاعمال" },
      { value: "2", text: "البرنامج الزمني" },
      { value: "3", text: "المستخلصات" },
      { value: "6", text: "استعلام مخصص" },
    ];
    this.constructionOptions = [
      { value: "1", text: "انشائي" },
      { value: "2", text: "معماري" },
      { value: "3", text: "ميكانيكا" },
      { value: "4", text: "كهرباء" },
      { value: "5", text: "اسوار" },
    ];
    this.constructionTypes = {
      "1": { data: typeof Civil !== 'undefined' ? Civil : {}, name: "Civil" },
      "2": { data: typeof Architectural !== 'undefined' ? Architectural : {}, name: "Architectural" },
      "3": { data: typeof Mechanical !== 'undefined' ? Mechanical : {}, name: "Mechanical" },
      "4": { data: typeof Electerical !== 'undefined' ? Electerical : {}, name: "Electerical" },
      "5": { data: typeof Fence !== 'undefined' ? Fence : {}, name: "Fence" },
    };
    this.selectedBlocknums = [];
    this.selectedStages = [];
    this.selectedVillaIDs = [];
  }

  async init() {
    this.createHeaderElements();
    this.createMonitoringElements();
    this.createConstructionElements();
    this.createSubItemElements();
    this.createMiscElements();
    this.assembleHeader();
    this.appendToDOM();
    await this.populateInitialDropdowns();
    this.setupEventListeners();
    // Initialize Select2 for searchable dropdowns
    this.initializeSelect2();
    // Set global filtersubmit for retrievebuttonclickgeneraldata
    window.filtersubmit = this.elements.filtersubmit;
   
    return this.elements;
  }

  createHeaderElements() {
    this.elements.newContainer = this.createContainer();
    this.elements.dateContainer = this.createDateContainerElement();
    this.elements.defaultViewButton = this.createButton("Default-View", "Default View", this.handleDefaultView.bind(this));
    this.elements.finishDateInput = this.createDateInput("حتي تاريخ :", "dd/mm/yyyy");
    this.elements.title = this.createTitleElement("h1", "<span>mostafa elgabalawy</span>");
    this.elements.title2 = this.createTitleElement("h2", "");
    this.elements.header = document.createElement("header");
  }

  createMonitoringElements() {
    this.elements.typeLabelMonitoring = this.createElement('label', { 
      for: 'MonitoringType', 
      textContent: 'Select Monitoring Type:' 
    });
    this.elements.MonitoringTypeSelect = this.createElement('select', { 
      id: 'MonitoringType', 
      onchange: this.handleMonitoringTypeChange.bind(this) 
    });
  }

  createConstructionElements() {
    this.elements.typeLabelConstruction = this.createElement('label', { 
      for: 'constructType', 
      textContent: 'Select Construction Type:' 
    });
    this.elements.constructTypeSelect = this.createElement('select', { 
      id: 'constructType', 
      onchange: this.handleConstructionTypeChange.bind(this) 
    });
  }

  createSubItemElements() {
    this.elements.subItemLabel = this.createElement('label', { 
      for: 'subItems', 
      textContent: 'Select Sub-Item:' 
    });
    this.elements.subItemsSelect = this.createElement('select', { 
      id: 'subItems', 
      onchange: this.handleSubItemChange.bind(this) 
    });
  }

  createMiscElements() {
    // Container for monitoring controls
    this.elements.monitoringContainer = this.createElement('div', {
        id: 'monitoringContainer',
        className: 'monitoring-container'
    });
    
    // Container for filters, initially hidden
    this.elements.filtersContainer = this.createElement('div', {
        id: 'filtersContainer',
        className: 'filters-container',
        style: { display: 'none' } // Hidden by default
    });
    
    // Button to show/hide the filter container
    this.elements.toggleFiltersButton = this.createButton(
        'toggleFiltersBtn',
        'Show Filters',
        this.handleToggleFilters.bind(this)
    );
    this.elements.toggleFiltersButton.style.marginBottom = '10px';


    this.elements.itemList = this.createElement('ul', { id: 'itemList' });
    this.elements.button_submit = this.createElement('button', { 
      id: 'Submit_button', 
      textContent: 'Submit', 
      onclick: this.submitHandler 
    });
    this.elements.villaIDLabel = this.createElement('label', {
      for: 'villaIDSelect',
      textContent: 'Select Villa ID(s):'
    });
    this.elements.villaIDSelect = this.createElement('select', {
      id: 'villaIDSelect',
      multiple: 'multiple',
      onchange: this.handleVillaIDChange.bind(this)
    });
    this.elements.blocknumLabel = this.createElement('label', {
      for: 'blocknumSelect',
      textContent: 'Select Block Number(s):'
    });
    this.elements.blocknumSelect = this.createElement('select', {
      id: 'blocknumSelect',
      multiple: 'multiple',
      onchange: this.handleBlocknumChange.bind(this)
    });
    this.elements.stageLabel = this.createElement('label', {
      for: 'stageSelect',
      textContent: 'Select Stage(s):'
    });
    this.elements.stageSelect = this.createElement('select', {
      id: 'stageSelect',
      multiple: 'multiple',
      onchange: this.handleStageChange.bind(this)
    });
    
    // Filter submit button is now hidden
    this.elements.filtersubmit = this.createElement('button', {
      id: 'Filter_submit',
      textContent: 'Apply Filters',
      onclick: this.handleFilterSubmit.bind(this),
      style: { display: 'none' } 
    });
    
    this.elements.resetFilterButton = this.createElement('button', {
      id: 'Reset_filter',
      textContent: 'Reset Filters',
      onclick: this.handleResetFilter.bind(this)
    });
  this.elements.filterCountDisplay = this.createElement('div', {
        id: 'filterCountDisplay',
        className: 'filter-count-display',
        style: {
            margin: '10px 0',
            fontWeight: 'bold',
            fontSize: '16px',
            color: '#333'
        }
    });}

  createContainer() {
    const container = document.createElement("div");
    container.className = "newContainer";
    container.id = "newContainer";
    return container;
  }

  createDateContainerElement() {
    return document.createElement("div");
  }

  createButton(id, text, handler) {
    const btn = document.createElement("button");
    btn.id = id;
    btn.textContent = text;
    if (handler) btn.onclick = handler;
    return btn;
  }

  createDateInput(labelText, placeholder) {
    const container = document.createElement("div");
    container.className = "date-input-container";
    const label = document.createElement("label");
    label.textContent = labelText;
    Object.assign(label.style, {
      display: "block",
      marginBottom: "5px"
    });
    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = placeholder;
    if (typeof flatpickr !== 'undefined') {
      flatpickr(input, { dateFormat: "d/m/Y", allowInput: true });
    }
    container.append(label, input);
    return container;
  }

  createTitleElement(tag, content) {
    const el = document.createElement(tag);
    el.innerHTML = content;
    el.style.display = "block";
    return el;
  }

  createLogo() {
    const logoDiv = document.createElement("div");
    logoDiv.className = "logo";
    const logoImg = document.createElement("img");
    logoImg.src = "../pic/GMCS2.png";
    logoImg.alt = "photo";
    logoImg.loading = "lazy";
    logoDiv.appendChild(logoImg);
    return logoDiv;
  }

  createElement(tag, props = {}) {
    const element = document.createElement(tag);
    Object.entries(props).forEach(([key, value]) => {
      if (key === 'textContent' || key === 'innerHTML') {
        element[key] = value;
      } else if (key === 'style' && typeof value === 'object') {
        Object.assign(element.style, value);
      } else if (typeof value === 'function') {
        if (key.startsWith('on')) {
          element[key.toLowerCase()] = value;
        }
      } else {
        element.setAttribute(key, value);
      }
    });
    return element;
  }

  createTodayDateElement() {
    const today = new Date();
    const dateString = today.toLocaleDateString('en-GB', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric' 
    }).replace(/\//g, '-');
    const dateElement = this.createElement('div', { 
      class: 'today-date', 
      textContent: `Today's Date: ${dateString}` 
    });
    return dateElement;
  }

  assembleHeader() {
    this.elements.header.append(
      this.elements.defaultViewButton,
      this.createLogo(),
      this.elements.title,
      this.elements.title2
    );
  }

  appendToDOM() {
    this.elements.newContainer.appendChild(this.createTodayDateElement());
    document.body.append(this.elements.header, this.elements.newContainer);
    this.elements.dateContainer.appendChild(this.elements.finishDateInput);
    this.appendFormElements();
  }

  appendFormElements() {
    // Append monitoring controls to their own container
    this.elements.monitoringContainer.append(
        this.elements.filterCountDisplay, // Add the count display here
        this.elements.typeLabelMonitoring,
        this.elements.MonitoringTypeSelect,
        this.elements.typeLabelConstruction,
        this.elements.constructTypeSelect,
        this.elements.subItemLabel,
        this.elements.subItemsSelect,
        this.elements.itemList,
        this.elements.button_submit
    );

    // Append filter controls to the dedicated filter container
    this.elements.filtersContainer.append(
        this.elements.villaIDLabel,
        this.elements.villaIDSelect,
        this.elements.blocknumLabel,
        this.elements.blocknumSelect,
        this.elements.stageLabel,
        this.elements.stageSelect,
        this.elements.resetFilterButton
    );

    // Append the new containers and the toggle button to the main container
    const mainElements = [
      this.elements.monitoringContainer,
      this.elements.toggleFiltersButton,
      this.elements.filtersContainer,
      this.elements.filtersubmit, // Hidden, but kept for any dependent logic
    ];

    mainElements.forEach(element => {
        if (element && element instanceof HTMLElement) {
            this.elements.newContainer.appendChild(element);
        } else {
            console.error('Invalid element found during DOM append:', element);
        }
    });

    this.setupDateContainer();
  }

  setupDateContainer() {
    if (this.elements.dateContainer && this.elements.MonitoringTypeSelect.value === "2") {
      this.elements.newContainer.appendChild(this.elements.dateContainer);
    }
  }

  async populateInitialDropdowns() {
    this.populateSelect(this.elements.MonitoringTypeSelect, this.monitoringOptions, "--Choose an option--");
    this.populateSelect(this.elements.constructTypeSelect, this.constructionOptions, "--Choose an option--");
    this.populateSelect(this.elements.subItemsSelect, [], "--Choose a subitem--");
    this.populateSelect(this.elements.villaIDSelect, [{ value: "", text: "Loading villa IDs..." }], "");
    this.populateSelect(this.elements.blocknumSelect, [{ value: "", text: "Loading block numbers..." }], "");
    this.populateSelect(this.elements.stageSelect, [{ value: "", text: "Loading stages..." }], "");
    this.elements.villaIDSelect.disabled = true;
    this.elements.blocknumSelect.disabled = true;
    this.elements.stageSelect.disabled = true;

    try {
      const tableName = wajhaspecialquerytable;
      const data = await this.getdynamoDBClientData(tableName, 1000);
      data.forEach(item => {
        if (item.villaID) {
          villaBlockStageMap.set(item.villaID, { 
            blocknum: item.blocknum, 
            stage: item.stage 
          });
        }
      });
      const villaIDs = [...new Set(data.map(item => item.villaID).filter(val => val != null))].sort();
      const blocknums = [...new Set(data.map(item => item.blocknum).filter(val => val != null))].sort();
      const stages = [...new Set(data.map(item => item.stage).filter(val => val != null))].sort();
      const villaIDOptions = villaIDs.map(id => ({ value: id, text: id }));
      const blocknumOptions = blocknums.map(num => ({ value: num, text: num }));
      const stageOptions = stages.map(stage => ({ value: stage, text: stage }));
      this.populateSelect(this.elements.villaIDSelect, villaIDOptions, "--Select Villa ID(s)--");
      this.populateSelect(this.elements.blocknumSelect, blocknumOptions, "--Select Block Number(s)--");
      this.populateSelect(this.elements.stageSelect, stageOptions, "--Select Stage(s)--");
    } catch (error) {
      console.error("Failed to populate dropdowns:", error);
      this.populateSelect(this.elements.villaIDSelect, [{ value: "", text: "Error loading villa IDs" }], "");
      this.populateSelect(this.elements.blocknumSelect, [{ value: "", text: "Error loading block numbers" }], "");
      this.populateSelect(this.elements.stageSelect, [{ value: "", text: "Error loading stages" }], "");
    } finally {
      this.elements.villaIDSelect.disabled = false;
      this.elements.blocknumSelect.disabled = false;
      this.elements.stageSelect.disabled = false;
    }
  }

  populateSelect(selectElement, optionsData, defaultOptionText) {
    selectElement.innerHTML = '';
    if (defaultOptionText) {
      const defaultOpt = this.createOptionElement('', defaultOptionText);
      selectElement.appendChild(defaultOpt);
    }
    optionsData.forEach(optionInfo => {
      const option = this.createOptionElement(optionInfo.value, optionInfo.text);
      selectElement.appendChild(option);
    });
  }

  createOptionElement(value, text) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = text;
    return option;
  }

  initializeSelect2() {
    if (typeof jQuery !== 'undefined' && typeof jQuery.fn.select2 !== 'undefined') {
      jQuery('#villaIDSelect').select2({
        placeholder: "--Select Villa ID(s)--",
        allowClear: true,
        width: '200px'
      });
      jQuery('#blocknumSelect').select2({
        placeholder: "--Select Block Number(s)--",
        allowClear: true,
        width: '200px'
      });
      jQuery('#stageSelect').select2({
        placeholder: "--Select Stage(s)--",
        allowClear: true,
        width: '200px'
      });
      // Re-attach change handlers after Select2 initialization
      jQuery('#villaIDSelect').on('change', this.handleVillaIDChange.bind(this));
      jQuery('#blocknumSelect').on('change', this.handleBlocknumChange.bind(this));
      jQuery('#stageSelect').on('change', this.handleStageChange.bind(this));
    } else {
      console.warn("jQuery or Select2 not loaded. Searchable dropdowns will not be initialized.");
    }
  }

  setupEventListeners() {
    document.addEventListener('DOMContentLoaded', this.initializeFormControls.bind(this));
  }

  initializeFormControls() {
    this.setupFormContainer();
  }

  setupFormContainer() {
    if (!this.isValidContainer(this.elements.newContainer)) {
      console.error("The 'newContainer' element is not defined or is not a valid HTMLElement.");
      return;
    }
    this.appendFormElements();
    this.ensureContainerInDOM();
  }

  isValidContainer(container) {
    return typeof container !== 'undefined' && container instanceof HTMLElement;
  }

  ensureContainerInDOM() {
    if (!this.elements.newContainer.parentNode) {
      document.body.appendChild(this.elements.newContainer);
    }
  }

  handleToggleFilters() {
    const container = this.elements.filtersContainer;
    const button = this.elements.toggleFiltersButton;
    if (container.style.display === 'none') {
        container.style.display = 'block';
        button.textContent = 'Hide Filters';
    } else {
        container.style.display = 'none';
        button.textContent = 'Show Filters';
    }
  }

  handleResetFilter() {
    // Reset selections
    this.selectedVillaIDs = [];
    this.selectedBlocknums = [];
    this.selectedStages = [];
    
    // Clear dropdowns
    const villaIDSelect = this.elements.villaIDSelect;
    const blockSelect = this.elements.blocknumSelect;
    const stageSelect = this.elements.stageSelect;
    
    if (villaIDSelect) {
      Array.from(villaIDSelect.options).forEach(option => option.selected = false);
      villaIDSelect.value = "";
      if (typeof jQuery !== 'undefined' && typeof jQuery.fn.select2 !== 'undefined') {
        jQuery('#villaIDSelect').val(null).trigger('change');
      }
    }
    if (blockSelect) {
      Array.from(blockSelect.options).forEach(option => option.selected = false);
      blockSelect.value = "";
      if (typeof jQuery !== 'undefined' && typeof jQuery.fn.select2 !== 'undefined') {
        jQuery('#blocknumSelect').val(null).trigger('change');
      }
    }
    if (stageSelect) {
      Array.from(stageSelect.options).forEach(option => option.selected = false);
      stageSelect.value = "";
      if (typeof jQuery !== 'undefined' && typeof jQuery.fn.select2 !== 'undefined') {
        jQuery('#stageSelect').val(null).trigger('change');
      }
    }

    // Reset status checkboxes
    const checkboxes = document.querySelectorAll('.color-checkbox');
    checkboxes.forEach(checkbox => checkbox.checked = false);

    // Clear the counts container
    let container = document.getElementById("countsContainer");
    if (container) {
      container.innerHTML = "";
    }

    // Reset activeColorMap
    activeColorMap = new Map();

    // Reset all villas to default color
    for (let i = 1; i <= (typeof villaIDcounts !== 'undefined' ? villaIDcounts : 0); i++) {
      const villaID = `V_${i}`;
      const documentElement = document.getElementById(villaID);
      if (documentElement) {
        documentElement.style.fill = '#FFFFFF';
        documentElement.style.opacity = 1;
      }
    }

    // Call retrievebuttonclickgeneraldata to restore original data
    if (typeof retrievebuttonclickgeneraldata !== 'undefined') {
      const MonitoringTypeSelect = document.getElementById('MonitoringType');
      if (MonitoringTypeSelect) {
        MonitoringTypeSelect.disabled = false;
        retrievebuttonclickgeneraldata();
      }
    } else {
      console.warn("retrievebuttonclickgeneraldata function is not defined.");
    }

    // Ensure no filters are applied
    if (typeof datainheaderkeys !== 'undefined' && datainheaderkeys.retrievedData) {
      coloringvillas(statusColorMap, datainheaderkeys.retrievedData);
    }
  }

  handleFilterSubmit() {
    // Reset selections
    this.selectedVillaIDs = [];
    this.selectedBlocknums = [];
    this.selectedStages = [];
    
    // Get current selections
    const villaIDSelect = this.elements.villaIDSelect;
    const blockSelect = this.elements.blocknumSelect;
    const stageSelect = this.elements.stageSelect;
    
    this.selectedVillaIDs = villaIDSelect ? 
      Array.from(villaIDSelect.selectedOptions).map(option => String(option.value)).filter(val => val !== "") : [];
    this.selectedBlocknums = blockSelect ? 
      Array.from(blockSelect.selectedOptions).map(option => String(option.value)).filter(val => val !== "") : [];
    this.selectedStages = stageSelect ? 
      Array.from(stageSelect.selectedOptions).map(option => String(option.value)).filter(val => val !== "") : [];

    // Log selections for debugging
    //console.log("Applying filters - VillaIDs:", this.selectedVillaIDs, "Blocks:", this.selectedBlocknums, "Stages:", this.selectedStages);

    // Apply filters
    if (typeof datainheaderkeys !== 'undefined' && datainheaderkeys && datainheaderkeys.retrievedData) {
      const colorMap = monitoringselectionvalue === "6" ? activeColorMap : 
                       monitoringselectionvalue === "2" ? statusColorMapsch : 
                       monitoringselectionvalue === "3" ? statusColorMapInvoice : statusColorMap;
      applyfilteredColorsToVillas(colorMap, datainheaderkeys.retrievedData);
    } else if (typeof datainheaderkeysscheduling !== 'undefined' && datainheaderkeysscheduling) {
      const schedulingData = Array.from(datainheaderkeysscheduling.entries())
        .map(([villaID, status]) => ({ villaID, [SelectedConstuctionItem]: status }));
      applyfilteredColorsToVillas(statusColorMapsch, schedulingData);
    } else {
      // If no data is loaded, filter villas using villaBlockStageMap
      const hasFilters = this.selectedVillaIDs.length > 0 || this.selectedBlocknums.length > 0 || this.selectedStages.length > 0;
      for (let i = 1; i <= (typeof villaIDcounts !== 'undefined' ? villaIDcounts : 0); i++) {
        const villaID = `V_${i}`;
        const documentElement = document.getElementById(villaID);
        if (documentElement) {
          if (hasFilters) {
            const villaInfo = villaBlockStageMap.get(villaID);
            const isVisible = villaInfo && 
              (this.selectedVillaIDs.length === 0 || this.selectedVillaIDs.includes(villaID)) &&
              (this.selectedBlocknums.length === 0 || this.selectedBlocknums.includes(String(villaInfo.blocknum))) &&
              (this.selectedStages.length === 0 || this.selectedStages.includes(String(villaInfo.stage)));
            documentElement.style.opacity = isVisible ? 1 : 0.3;
            documentElement.style.fill = isVisible ? 
              (typeof default_color !== 'undefined' ? default_color : '#ffffff') : 
              (typeof notFoundColor !== 'undefined' ? notFoundColor : '#808080');
            //console.log(`Villa ${villaID}: isVisible=${isVisible}, blocknum=${villaInfo?.blocknum}, stage=${villaInfo?.stage}`);
          } else {
            documentElement.style.fill = typeof default_color !== 'undefined' ? default_color : '#ffffff';
            documentElement.style.opacity = 1;
          }
        }
      }
      //console.warn("No data available to apply filters; using villaBlockStageMap for filtering.");
    }
  }
#isHandlingChange = false;
  handleVillaIDChange() {
    if (this.#isHandlingChange) return; // Prevent recursive calls
    this.#isHandlingChange = true;

    try {
      const select = this.elements.villaIDSelect;
      this.selectedVillaIDs = Array.from(select.selectedOptions)
        .map(option => String(option.value))
        .filter(val => val !== "");

      // Reset other dropdowns without triggering change events
      this.resetDropdownSilently('blocknumSelect');
      this.resetDropdownSilently('stageSelect');
      this.selectedBlocknums = [];
      this.selectedStages = [];

      //console.log("Selected Villa IDs:", this.selectedVillaIDs);
      this.handleFilterSubmit();
    } finally {
      this.#isHandlingChange = false;
    }
  }

  handleBlocknumChange() {
    if (this.#isHandlingChange) return; // Prevent recursive calls
    this.#isHandlingChange = true;

    try {
      const select = this.elements.blocknumSelect;
      this.selectedBlocknums = Array.from(select.selectedOptions)
        .map(option => String(option.value))
        .filter(val => val !== "");

      // Reset other dropdowns without triggering change events
      this.resetDropdownSilently('villaIDSelect');
      this.resetDropdownSilently('stageSelect');
      this.selectedVillaIDs = [];
      this.selectedStages = [];

      //console.log("Selected blocks:", this.selectedBlocknums);
      this.handleFilterSubmit();
    } finally {
      this.#isHandlingChange = false;
    }
  }

  handleStageChange() {
    if (this.#isHandlingChange) return; // Prevent recursive calls
    this.#isHandlingChange = true;

    try {
      const select = this.elements.stageSelect;
      this.selectedStages = Array.from(select.selectedOptions)
        .map(option => String(option.value))
        .filter(val => val !== "");

      // Reset other dropdowns without triggering change events
      this.resetDropdownSilently('villaIDSelect');
      this.resetDropdownSilently('blocknumSelect');
      this.selectedVillaIDs = [];
      this.selectedBlocknums = [];

      //console.log("Selected stages:", this.selectedStages);
      this.handleFilterSubmit();
    } finally {
      this.#isHandlingChange = false;
    }
  }

  // Helper method to reset a dropdown silently (without triggering change events)
  resetDropdownSilently(selectId) {
    const select = this.elements[selectId];
    if (select) {
      Array.from(select.options).forEach(option => (option.selected = false));
      select.value = "";
      if (typeof jQuery !== 'undefined' && typeof jQuery.fn.select2 !== 'undefined') {
        // Update Select2 without triggering change event
        jQuery(`#${selectId}`).val(null).trigger('change.select2');
      }
    }
  }
  async handleMonitoringTypeChange() {
    monitoringselectionvalue = this.elements.MonitoringTypeSelect.value;

    const readyToPayButton = document.getElementById("button_convert_readyToPay_to_Paid");
    const button_convert_Completed = document.getElementById("button_convert_Completed_fromProgresstable__to_readyToPay");

    if (readyToPayButton && button_convert_Completed) {
      const isInvoiceMode = (monitoringselectionvalue === "3");
      readyToPayButton.style.display = isInvoiceMode ? "block" : "none";
      button_convert_Completed.style.display = isInvoiceMode ? "flex" : "none";
    } else {
      console.warn("Invoice related buttons not found.");
    }

    if (this.elements.dateContainer) {
      const isScheduleMode = (monitoringselectionvalue === "2");
      this.elements.newContainer.append(this.elements.dateContainer);
      this.elements.dateContainer.hidden = !isScheduleMode;
    } else {
      console.warn("Element 'dateContainer' not found or defined.");
    }

    if (monitoringselectionvalue === "6") {
      this.elements.typeLabelConstruction.textContent = 'Select Column:';
      this.elements.typeLabelConstruction.hidden = false;
      this.elements.constructTypeSelect.hidden = false;
      this.elements.subItemLabel.hidden = true;
      this.elements.subItemsSelect.hidden = true;
      this.elements.subItemsSelect.innerHTML = '';
      this.elements.itemList.innerHTML = '';

      try {
        this.populateSelect(this.elements.constructTypeSelect, [{ value: "", text: "Loading columns..." }], "");
        this.elements.constructTypeSelect.disabled = true;

        const tableName = wajhaspecialquerytable;
        const columnNames = await this.getdynamoDBClientColumns(tableName, 1000);

        if (!Array.isArray(columnNames)) {
          throw new Error("Did not receive a valid array of column names.");
        }

        const filteredColumnNames = columnNames.filter(name => name !== "villaID");
        const columnOptions = filteredColumnNames.map(name => ({ value: name, text: name }));
        this.populateSelect(this.elements.constructTypeSelect, columnOptions, "--Select a Column--");
      } catch (error) {
        console.error("Failed to get dynamoDBClient columns:", error);
        this.populateSelect(this.elements.constructTypeSelect, [{ value: "", text: "Error loading columns" }], "");
      } finally {
        this.elements.constructTypeSelect.disabled = false;
      }
    } else {
      this.elements.typeLabelConstruction.textContent = 'Select Construction Type:';
      this.elements.typeLabelConstruction.hidden = false;
      this.elements.constructTypeSelect.hidden = false;
      this.elements.subItemLabel.hidden = false;
      this.elements.subItemsSelect.hidden = false;
      this.populateSelect(this.elements.constructTypeSelect, this.constructionOptions, "--Choose an option--");
      this.elements.subItemsSelect.innerHTML = "";
      this.elements.itemList.innerHTML = "";
      SelectedConstuctionItem = "";
    }

    if (monitoringselectionvalue !== "6") {
      this.handleConstructionTypeChange();
    } else {
      SelectedConstuctionItem = "";
      if (this.elements.title2) this.elements.title2.innerHTML = "No Item Selected";
    }
  }

  handleConstructionTypeChange() {
    const selectedValue = this.elements.constructTypeSelect.value;
    SelectedConstuctionItem = "";
    SelectedConstuctionItemForFileName = "";
    SelectedConstuctionItemForpopup = "";
    SelectedConstuctionItemID = null;
    this.elements.itemList.innerHTML = "";
    if (this.elements.title2) this.elements.title2.innerHTML = "No Item Selected";

    if (monitoringselectionvalue === "6") {
      this.elements.subItemsSelect.hidden = true;
      this.elements.subItemLabel.hidden = true;
      this.populateSelect(this.elements.subItemsSelect, [], "");
      if (this.elements.title2) this.elements.title2.innerHTML = `${selectedValue}`;
      SelectedConstuctionItem = selectedValue;
    } else {
      this.elements.subItemsSelect.hidden = false;
      this.elements.subItemLabel.hidden = false;

      const typeInfo = this.constructionTypes[selectedValue];
      const items = typeInfo ? typeInfo.data : {};
      const subItemOptions = Object.keys(items).map(key => ({
        value: key,
        text: items[key][1] || `Item ${key}`
      }));

      this.populateSelect(this.elements.subItemsSelect, subItemOptions, "--Choose a sub-item--");
    }
  }

  handleSubItemChange() {
    const selectedSubItemValue = this.elements.subItemsSelect.value;
    const selectedTypeValue = this.elements.constructTypeSelect.value;
    this.elements.defaultViewButton.click();
    this.elements.itemList.innerHTML = "";
    SelectedConstuctionItem = "";
    SelectedConstuctionItemForFileName = "";
    SelectedConstuctionItemForpopup = "";
    SelectedConstuctionItemID = null;
    if (this.elements.title2) this.elements.title2.innerHTML = "No Item Selected";

    if (!selectedSubItemValue || !selectedTypeValue) return;

    const typeInfo = this.constructionTypes[selectedTypeValue];
    if (!typeInfo) {
      console.error(`Construction type info not found for value: ${selectedTypeValue}`);
      return;
    }

    const items = typeInfo.data;
    const typeName = typeInfo.name;
    const itemData = items[selectedSubItemValue];

    if (!itemData) {
      console.error(`Sub-item data not found for key: ${selectedSubItemValue} in type: ${typeName}`);
      return;
    }

    const tableItemIdToFind = `${typeName}-${selectedSubItemValue}`;
    const selectedActivity = typeof activities !== 'undefined' ? activities.find(activity => activity.TableItemID === tableItemIdToFind) : null;

    if (selectedActivity && itemData) {
      SelectedConstuctionItem = tableItemIdToFind;
      SelectedConstuctionItemForFileName = `${tableItemIdToFind}-${itemData[1]}`;
      SelectedConstuctionItemForpopup = itemData[1];
      SelectedConstuctionItemID = selectedActivity.id;
      this.elements.title2.innerHTML = SelectedConstuctionItemForpopup;

      const listItem = this.createElement('li', {
        textContent: `${SelectedConstuctionItem} - ${itemData[1]}`
      });
      this.elements.itemList.appendChild(listItem);
    } else {
      console.error(`Selected activity with TableItemID '${tableItemIdToFind}' not found in the 'activities' array.`);
    }
  }

  handleDefaultView() {
    if (monitoringselectionvalue !== "" && SelectedConstuctionItem !== "") {
      if (typeof retrieveAndCountDataFromDynamoDB !== 'undefined' && typeof WajhaDatatable !== 'undefined') {
        // retrieveAndCountDataFromDynamoDB(WajhaDatatable, SelectedConstuctionItem);
      }
    }

    if (typeof map !== 'undefined') {
      map.setView([-0.004768967622973434, 0.00407695770263672], 20);
      map.closePopup();
    }

    const closeButton = document.querySelector(".leaflet-popup-close-button");
    if (closeButton) closeButton.click();
  }

 

  getElements() {
    return this.elements;
  }
}

const ui = new UIComponents(retrievebuttonclickgeneraldata,getdynamoDBClientData, getdynamoDBClientColumns);

const {
  newContainer,
  dateContainer,
  defaultViewButton,
  finishDateInput,
  title,
  title2,
  header,
  typeLabelMonitoring,
  MonitoringTypeSelect,
  typeLabelConstruction,
  constructTypeSelect,
  subItemLabel,
  subItemsSelect,
  itemList,
  button_submit,
  villaIDSelect,
  blocknumSelect,
  stageSelect,
  filtersubmit,
  resetFilterButton
} = ui.init();

//


function createColumnGraph(countsArrayInput, type = 'default', selectedKeys = null) {
  if (!Array.isArray(countsArrayInput)) {
    console.error("Invalid data format passed to createColumnGraph. Expected an array of [key, count] pairs.", countsArrayInput);
    return;
  }

  const originalTotal = countsArrayInput.reduce((sum, [, count]) => sum + count, 0);
  let countsArray = [...countsArrayInput];
  if (selectedKeys && selectedKeys.length > 0) {
    countsArray = countsArray.filter(([key]) => selectedKeys.includes(key));
  }

  const internalUndefinedKey = 'Undefined/Null';
  const displayUndefinedKey = '(No Data Found)';
  countsArray.sort((a, b) => b[1] - a[1]);

  let chartContainer = document.getElementById("barChartContainer");
  const chartContainerExists = !!chartContainer;

  if (!chartContainer) {
    chartContainer = document.createElement("div");
    chartContainer.id = "barChartContainer";
    chartContainer.style.display = 'none';
    document.body.appendChild(chartContainer);
  }
  chartContainer.innerHTML = "";

  let toggleBtn = document.getElementById("toggleBarChartBtn");
  if (!toggleBtn && !chartContainerExists) {
    toggleBtn = document.createElement("button");
    toggleBtn.id = "toggleBarChartBtn";
    toggleBtn.textContent = "Show Bar Charts";
    toggleBtn.onclick = function () {
      if (chartContainer.style.display === 'none') {
        chartContainer.style.display = 'block';
        toggleBtn.textContent = "Hide Bar Charts";
      } else {
        chartContainer.style.display = 'none';
        toggleBtn.textContent = "Show Bar Charts";
      }
    };
    chartContainer.parentNode.insertBefore(toggleBtn, chartContainer);
  } else if (toggleBtn) {
    if (chartContainer.style.display === 'none') {
      toggleBtn.textContent = "Show Bar Charts";
    } else {
      toggleBtn.textContent = "Hide Bar Charts";
    }
  }

  const title = document.createElement("h3");
  title.textContent = typeof SelectedConstuctionItemForpopup !== 'undefined' && SelectedConstuctionItemForpopup !== "" ? SelectedConstuctionItemForpopup : (typeof SelectedConstuctionItem !== 'undefined' ? SelectedConstuctionItem : "Chart");
  title.style.textAlign = "center";
  title.style.marginBottom = "20px";
  chartContainer.appendChild(title);

  const chartsWrapper = document.createElement("div");
  chartsWrapper.className = "two-charts-wrapper";
  chartContainer.appendChild(chartsWrapper);

  const generalColors = Array.isArray(statusColorMaps.general) ? statusColorMaps.general : Object.values(statusColorMaps.general || {});
  const generalColorCount = generalColors.length;
  const notFoundColorFallback = '#cccccc';
  const currentNotFoundColor = typeof notFoundColor !== 'undefined' ? notFoundColor : notFoundColorFallback;

  const countChart = document.createElement("div");
  countChart.className = "vertical-bar-chart";
  const countTitle = document.createElement("div");
  countTitle.className = "chart-label";
  countTitle.textContent = "Counts";
  countChart.appendChild(countTitle);

  const maxCount = countsArray.length ? Math.max(1, ...countsArray.map(([, count]) => count)) : 1;

  countsArray.forEach(([key, count], i) => {
    let color;
    const displayKey = key === internalUndefinedKey ? displayUndefinedKey : key;

    if (key === internalUndefinedKey) {
      color = typeof notFoundColor !== 'undefined' ? notFoundColor : notFoundColorFallback;
    } else if (type === 'general') {
      color = generalColorCount > 0 ? generalColors[i % generalColorCount] : '#dddddd';
    } else {
      const colorMap = statusColorMaps[type] || statusColorMaps.default || {};
      color = colorMap[key] || currentNotFoundColor;
    }

    const barContainer = document.createElement("div");
    barContainer.className = "bar-container";

    const bar = document.createElement("div");
    bar.className = "bar";
    const barHeight = maxCount === 0 ? 0 : (count / maxCount) * 180;
    bar.style.height = (count > 0 ? Math.max(5, barHeight) : 0) + "px";
    bar.style.backgroundColor = color;
    bar.title = `${displayKey}: ${count}`;

    const countLabel = document.createElement("div");
    countLabel.className = "bar-count";
    countLabel.textContent = count;

    const keyLabel = document.createElement("div");
    keyLabel.className = "bar-key";
    keyLabel.textContent = displayKey;

    barContainer.appendChild(bar);
    barContainer.appendChild(countLabel);
    barContainer.appendChild(keyLabel);
    countChart.appendChild(barContainer);
  });

  const percentChart = document.createElement("div");
  percentChart.className = "vertical-bar-chart";
  const percentTitle = document.createElement("div");
  percentTitle.className = "chart-label";
  percentTitle.textContent = "Percent (%)";
  percentChart.appendChild(percentTitle);

  const maxPercentValue = countsArray.length ? Math.max(1, ...countsArray.map(([, count]) => (originalTotal === 0 ? 0 : (count / originalTotal) * 100))) : 1;

  countsArray.forEach(([key, count], i) => {
    let color;
    const displayKey = key === internalUndefinedKey ? displayUndefinedKey : key;
    const percent = originalTotal === 0 ? 0 : (count / originalTotal) * 100;

    if (key === internalUndefinedKey) {
      color = typeof notFoundColor !== 'undefined' ? notFoundColor : notFoundColorFallback;
    } else if (type === 'general') {
      color = generalColorCount > 0 ? generalColors[i % generalColorCount] : '#dddddd';
    } else {
      const colorMap = statusColorMaps[type] || statusColorMaps.default || {};
      color = colorMap[key] || currentNotFoundColor;
    }

    const barContainer = document.createElement("div");
    barContainer.className = "bar-container";

    const bar = document.createElement("div");
    bar.className = "bar";
    const barHeight = maxPercentValue === 0 ? 0 : (percent / maxPercentValue) * 180;
    bar.style.height = (percent > 0 ? Math.max(5, barHeight) : 0) + "px";
    bar.style.backgroundColor = color;
    bar.title = `${displayKey}: ${percent.toFixed(1)}% (of original total)`;

    const percentLabel = document.createElement("div");
    percentLabel.className = "bar-percent";
    percentLabel.textContent = percent.toFixed(1) + "%";

    const keyLabel = document.createElement("div");
    keyLabel.className = "bar-key";
    keyLabel.textContent = displayKey;

    barContainer.appendChild(bar);
    barContainer.appendChild(percentLabel);
    barContainer.appendChild(keyLabel);
    percentChart.appendChild(barContainer);
  });

  chartsWrapper.appendChild(countChart);
  chartsWrapper.appendChild(percentChart);

  if (!document.getElementById("barChartStyles")) {
    const style = document.createElement("style");
    style.id = "barChartStyles";
    style.textContent = `
      select#villaIDSelect, select#blocknumSelect, select#stageSelect {
        width: 200px;
        padding: 5px;
        margin: 10px 0;
        border: 1px solid #ccc;
        border-radius: 4px;
        height: 100px;
      }
      .select2-container .select2-selection--multiple {
        min-height: 100px;
        border: 1px solid #ccc;
        border-radius: 4px;
      }
      label[for="villaIDSelect"], label[for="blocknumSelect"], label[for="stageSelect"] {
        display: block;
        margin: 5px 0;
        font-weight: bold;
      }
      #Filter_submit {
      
        padding: 8px 16px;
        margin: 10px 0;
        background-color: #2196F3;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        
      }
      #Filter_submit:hover {
        background-color: #1976D2;
      }
      #barChartContainer {
        width: 98%;
        max-width: 1200px;
        margin: 30px auto 10px auto;
        padding: 24px 12px 18px 12px;
        background: #fdfdff;
        border-radius: 13px;
        box-shadow: 0 3px 12px rgba(0,0,0,0.08);
        border: 1px solid #e8e8ee;
      }
      .two-charts-wrapper {
        display: flex;
        gap: 25px;
        justify-content: center;
        align-items: flex-end;
        margin-top: 20px;
        margin-bottom: 10px;
        flex-wrap: wrap;
      }
      .vertical-bar-chart {
        display: flex;
        flex-direction: row;
        align-items: flex-end;
        justify-content: center;
        height: 280px;
        min-width: 280px;
        background: transparent;
        padding: 35px 10px 10px 10px;
        border-radius: 7px;
        flex: 1 1 400px;
        max-width: 800px;
        position: relative;
        border: 1px solid #eee;
        background-color: #f9f9fc;
        overflow-x: auto;
        overflow-y: hidden;
      }
      .chart-label {
        position: absolute;
        top: 8px;
        left: 15px;
        font-weight: bold;
        font-size: 1.05em;
        color: #334;
        background: #eef1f5;
        padding: 3px 10px;
        border-radius: 5px;
      }
      .bar-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        width: auto;
        margin: 0 8px;
        min-width: 50px;
        text-align: center;
      }
      .bar {
        width: 22px;
        min-height: 5px;
        border-radius: 6px 6px 0 0;
        transition: height 0.4s ease-out, background-color 0.3s;
        box-shadow: inset 0 -2px 4px rgba(0,0,0,0.1);
        cursor: pointer;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .bar:hover {
        opacity: 0.85;
      }
      .bar-count, .bar-percent {
        font-weight: bold;
        margin-top: 7px;
        font-size: 0.95em;
        color: #333;
      }
      .bar-percent {
        color: #2a9d8f;
      }
      .bar-key {
        margin-top: 6px;
        font-size: 0.9em;
        color: #555;
        word-break: break-word;
        line-height: 1.2;
        max-width: 100px;
      }
      @media (max-width: 900px) {
        .two-charts-wrapper {
          flex-direction: column;
          gap: 30px;
          align-items: center;
        }
        .vertical-bar-chart {
          max-width: 95%;
          min-width: 300px;
          justify-content: flex-start;
        }
        #barChartContainer {
          max-width: 600px;
        }
      }
      @media (max-width: 600px) {
        #barChartContainer { padding: 14px 2vw; width: 96%; }
        .vertical-bar-chart { height: 260px; min-width: 280px; }
        .bar-container { margin: 0 5px; min-width: 40px;}
        .bar { width: 18px; }
        .bar-key { font-size: 0.85em; max-width: 50px;}
        .chart-label { font-size: 1em; left: 10px;}
      }
      .counts-container {
        display: flex;
        flex-wrap: wrap;
        gap: 15px;
        justify-content: center;
        padding: 10px;
        margin-top: 10px;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .counterKeyDiv {
        display: flex;
        align-items: center;
        background-color: #f0f2f5;
        border-radius: 8px;
        padding: 5px 20px;
        box-shadow: 0 1px 3px rgba(0,0,0,0.07);
      }
      .counter {
        font-weight: bold;
        padding: 6px 10px;
        border-radius: 6px;
        margin-right: 8px;
        color: white;
        min-width: 30px;
        text-align: center;
        font-size: 1.1em;
      }
      .key {
        font-size: 0.95em;
        color: #333;
      }
    `;
    document.head.appendChild(style);
  }
}

function createStatusElements(data, type, customColorMap = null) {
  const internalUndefinedKey = 'Undefined/Null';
  const displayUndefinedKey = '(No Data Found)';

  let countsArray;
  if (data && data.retrievedData && Array.isArray(data.retrievedData)) {
    const countsMap = new Map();
    let columnName;

    if (monitoringselectionvalue === "6" && SelectedConstuctionItem) {
      columnName = SelectedConstuctionItem;
    } else {
      columnName = data.retrievedData.length > 0
        ? Object.keys(data.retrievedData[0]).find(key => key !== "villaID")
        : null;
    }

    if (columnName && data.retrievedData.some(item => columnName in item)) {
      data.retrievedData.forEach((item) => {
        const value = item[columnName];
        const key = (value === null || typeof value === 'undefined')
          ? internalUndefinedKey
          : String(value);
        countsMap.set(key, (countsMap.get(key) || 0) + 1);
      });
    }
    countsArray = Array.from(countsMap.entries());
  } else {
    console.error("Invalid data format passed to createStatusElements:", data);
    countsArray = [];
  }

  let container = document.getElementById("countsContainer");
  if (!container) {
    container = document.createElement("div");
    container.id = "countsContainer";
    container.className = "counts-container";
    const headerElement = document.querySelector('header');
    if (headerElement) {
      headerElement.appendChild(container);
    } else {
      console.warn("Header element not found, appending counts container to body.");
      document.body.insertBefore(container, document.body.firstChild);
    }
  }
  container.innerHTML = "";

  const buttonContainer = document.createElement("div");
  buttonContainer.className = "button-container";
  buttonContainer.style.margin = "10px 0";
  buttonContainer.style.display = "none";

  const applyButton = document.createElement("button");
  applyButton.textContent = "Apply Selected Colors to Villas";
  applyButton.className = "apply-button";
  applyButton.style.padding = "8px 16px";
  applyButton.style.backgroundColor = "#4CAF50";
  applyButton.style.color = "white";
  applyButton.style.border = "none";
  applyButton.style.borderRadius = "4px";
  applyButton.style.cursor = "pointer";
  buttonContainer.appendChild(applyButton);
  container.appendChild(buttonContainer);

  countsArray.sort((a, b) => b[1] - a[1]);

  const generalColors = Array.isArray(statusColorMaps.general) ? statusColorMaps.general : Object.values(statusColorMaps.general || {});
  const generalColorCount = generalColors.length;
  const selectedColors = {};
  const selectedKeys = new Set();

  activeColorMap = customColorMap || new Map();

  countsArray.forEach(([key, count], index) => {
    let color;
    const displayKey = key === internalUndefinedKey ? displayUndefinedKey : key;

    if (activeColorMap.has(key)) {
      color = activeColorMap.get(key);
    } else if (type === 'general') {
      color = generalColorCount > 0 ? generalColors[index % generalColorCount] : notFoundColor || '#cccccc';
    } else {
      const colorMap = statusColorMaps[type] || statusColorMaps.default || {};
      color = colorMap[key] || notFoundColor || '#cccccc';
    }

    activeColorMap.set(key, color);

    const counterKeyDiv = document.createElement("div");
    counterKeyDiv.className = "counterKeyDiv";
    counterKeyDiv.style.backgroundColor = "#FFFFF0";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "color-checkbox";
    checkbox.dataset.key = key;
    checkbox.dataset.color = color;
    checkbox.style.marginRight = "5px";

    checkbox.addEventListener('change', function() {
      if (this.checked) {
        selectedKeys.add(key);
        selectedColors[key] = color;
      } else {
        selectedKeys.delete(key);
        delete selectedColors[key];
      }

      buttonContainer.style.display = selectedKeys.size > 0 ? "block" : "none";
      createColumnGraph(countsArray, type, Array.from(selectedKeys));

      if (!selectedKeys.size) {
        const MonitoringTypeSelect = document.getElementById('MonitoringType');
        if (MonitoringTypeSelect) {
          MonitoringTypeSelect.disabled = false;
          retrievebuttonclickgeneraldata();
        }
      }
    });

    const counterElement = document.createElement("div");
    counterElement.className = "counter";
    counterElement.style.backgroundColor = color;
    counterElement.textContent = count;
    counterElement.style.color = key === internalUndefinedKey && notfoundtextcolor ? notfoundtextcolor : '#000000';

    const keyElement = document.createElement("div");
    keyElement.className = "key";
    keyElement.textContent = displayKey;

    counterKeyDiv.append(checkbox, counterElement, keyElement);
    container.appendChild(counterKeyDiv);
  });

  applyButton.addEventListener('click', function() {
    applyfilteredColorsToVillas(selectedColors, data.retrievedData || data);
  });

  const headerElement = document.querySelector('header');
  if (headerElement) {
    headerElement.style.marginBottom = container.hasChildNodes() ? (type === 'general' ? "250px" : "150px") : "0px";
    headerElement.style.marginTop = "20px";
  }

  createColumnGraph(countsArray, type, Array.from(selectedKeys));
}

function applyfilteredColorsToVillas(selectedColors, allData) {
  if (!allData || !Array.isArray(allData)) {
    console.error("No valid data provided to applyfilteredColorsToVillas");
    return;
  }

  const enrichedData = allData.map(item => {
    const blockStageInfo = villaBlockStageMap.get(item.villaID);
    return {
      ...item,
      blocknum: blockStageInfo ? blockStageInfo.blocknum : null,
      stage: blockStageInfo ? blockStageInfo.stage : null
    };
  });

  const villaIDSelect = document.getElementById("villaIDSelect");
  const blocknumSelect = document.getElementById("blocknumSelect");
  const stageSelect = document.getElementById("stageSelect");
  const selectedVillaIDs = villaIDSelect ? Array.from(villaIDSelect.selectedOptions).map(opt => String(opt.value)).filter(val => val !== "") : [];
  const selectedBlocknums = blocknumSelect ? Array.from(blocknumSelect.selectedOptions).map(opt => String(opt.value)).filter(val => val !== "") : [];
  const selectedStages = stageSelect ? Array.from(stageSelect.selectedOptions).map(opt => String(opt.value)).filter(val => val !== "") : [];
  const hasFilter = selectedVillaIDs.length > 0 || selectedBlocknums.length > 0 || selectedStages.length > 0 || Object.keys(selectedColors).length > 0;

  const filteredData = enrichedData.filter(item => {
    const matchesVillaID = selectedVillaIDs.length === 0 || selectedVillaIDs.includes(String(item.villaID));
    const matchesBlocknum = selectedBlocknums.length === 0 || selectedBlocknums.includes(String(item.blocknum));
    const matchesStage = selectedStages.length === 0 || selectedStages.includes(String(item.stage));
    const columnName = Object.keys(item).find(key => !['villaID', 'blocknum', 'stage'].includes(key));
    const status = item[columnName] != null ? String(item[columnName]) : "Undefined/Null";
    const matchesStatus = Object.keys(selectedColors).length === 0 || selectedColors[status];
    return matchesVillaID && matchesBlocknum && matchesStage && matchesStatus;
  });
// Update the villa count display based on the filter results
  const filterCountDisplay = document.getElementById('filterCountDisplay');
  if (filterCountDisplay) {
      const totalCount = allData.length;
      const filteredCount = filteredData.length;
      if (hasFilter) {
          filterCountDisplay.textContent = `Showing ${filteredCount} of ${totalCount} villas`;
      } else {
          filterCountDisplay.textContent = `Total Villas: ${totalCount}`;
      }
  }
  const monitoringType = monitoringselectionvalue === "6" ? "general" : 
                        monitoringselectionvalue === "2" ? "sch" : 
                        monitoringselectionvalue === "3" ? "invoice" : "default";
  createStatusElements({ retrievedData: filteredData }, monitoringType, activeColorMap);

  const filteredVillaIDs = new Set(filteredData.map(item => item.villaID));

  enrichedData.forEach(item => {
    const documentElement = document.getElementById(item.villaID);
    if (documentElement) {
      const columnName = Object.keys(item).find(key => !['villaID', 'blocknum', 'stage'].includes(key));
      const status = item[columnName] != null ? String(item[columnName]) : "Undefined/Null";
      if (filteredVillaIDs.has(item.villaID)) {
        const color = selectedColors[status] || activeColorMap.get(status) || default_color || '#cccccc';
        documentElement.style.fill = color;
        documentElement.style.opacity = 1;
      } else {
        documentElement.style.fill = '#000000';
        documentElement.style.opacity = 0.3;
      }
    }
  });

  if (!hasFilter) {
    coloringvillas(activeColorMap, enrichedData);
  }
}

function coloringvillas(statusColorMap, retrievedData) {
  if (!Array.isArray(retrievedData)) {
    console.error("Invalid data format. Expected an array for retrievedData.");
    return;
  }
// Update the count display with the total number of villas
  const filterCountDisplay = document.getElementById('filterCountDisplay');
  if (filterCountDisplay) {
      filterCountDisplay.textContent = `Total Villas: ${retrievedData.length}`;
  }
  retrievedData.forEach((item) => {
    const specificTooltip = tooltip[item.villaID];
    if (specificTooltip && specificTooltip._container) {
      const tooltipElement = specificTooltip._container;
      if (!statusColorMap[item[SelectedConstuctionItem]]) {
        tooltipElement.classList.add('showTextonnotfoundvilla');
      } else {
        tooltipElement.classList.remove('showTextonnotfoundvilla');
      }
    }

    const documentElement = document.getElementById(item.villaID);
    if (documentElement) {
      documentElement.style.fill = statusColorMap[item[SelectedConstuctionItem]] || notFoundColor;
      documentElement.style.opacity = 1;
    }
  });
}
