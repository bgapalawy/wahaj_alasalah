


// Modified dashboard function for popup

function handleFileOperations() {
    function getFileType(extension) {
        const ext = extension.toLowerCase();
        if (validExtensions.image.includes(ext)) return 1; // Image
        if (validExtensions.pdf.includes(ext)) return 2; // PDF
        if (validExtensions.video.includes(ext)) return 3; // Video
        return 4; // Other
    }

    for (let i = 0; i < 11; i++) {
        let inputFile = document.querySelector(`#file${i + 1}`);
        let button = document.querySelector(`#select${i + 1}`);
        let imageArea = document.querySelector(`#img${i + 1}`);
        imageArea.innerHTML = `<div class="image-area" id="img1"><img class="icon" /><h5>Upload File</h5></div>`;
        imageArea.dataset.img = "";

        let objectKey = states[Math.floor(i / 2)] === "Approval"
            ? `${SelectedConstuctionItem}-VillaID:${button.getAttribute("BVITEM")}-${states[Math.floor(i / 2)]}`
            : `${SelectedConstuctionItem}-VillaID:${button.getAttribute("BVITEM")}-${states[Math.floor(i / 2)]}${((i + 2) % 2) + 1}`;

        button.addEventListener("click", () => inputFile.click());

        s3.listObjects({ Bucket: bucketName }, (err, data) => {
            if (err) {
                console.error("Error listing objects:", err);
            } else {
                const matchingObjects = data.Contents.filter(object => object.Key.split(".")[0] === objectKey);
                if (matchingObjects.length === 1) {
                    const object = matchingObjects[0];
                    const NewobjectKey = object.Key;
                    const extension = object.Key.split(".")[1];
                    s3.getObject({ Bucket: bucketName, Key: NewobjectKey }, (err, data) => {
                        if (err) {
                            console.error("Error fetching S3 object:");
                        } else {
                            s3.getSignedUrl("getObject", { Bucket: bucketName, Key: NewobjectKey }, (err, url) => {
                                if (err) {
                                    console.error("Error getting signed URL:", err);
                                } else if (imageArea) {
                                    imageArea.innerHTML = "";
                                    if (getFileType(extension) === 1) {
                                        const img = document.createElement("img");
                                        img.src = url;
                                        img.classList.add("image");
                                        imageArea.classList.add("active");
                                        imageArea.appendChild(img);
                                    } else if (getFileType(extension) === 3) {
                                        const video = document.createElement("video");
                                        video.src = url;
                                        video.controls = true;
                                        video.style.width = "100%";
                                        imageArea.appendChild(video);
                                    } else {
                                        const img = document.createElement("img");
                                        img.id = "GeneralFileimage";
                                        img.classList.add("image");
                                        imageArea.classList.add("active");
                                        imageArea.appendChild(img);
                                    }
                                    imageArea.dataset.img = NewobjectKey;
                                }
                            });
                        }
                    });
                }
            }
        });

        inputFile.addEventListener("change", async function () {
            const file = this.files[0];
            const currentImageArea = document.querySelector(`#img${i + 1}`);
            if (!file) return;

            const fileExtension = file.name.split(".").pop()?.toLowerCase();
            if (!fileExtension || file.size > imageSize * 1024 * 1024) {
                alert("Invalid file. Please check the file extension and size.");
                this.value = '';
                return;
            }

            const newS3Key = `${objectKey}.${fileExtension}`;
            try {
                const listData = await s3.listObjects({ Bucket: bucketName, Prefix: objectKey }).promise();
                if (listData.Contents && listData.Contents.length > 0) {
                    const objectsToDelete = listData.Contents.map(item => ({ Key: item.Key }));
                    if (objectsToDelete.length > 0) {
                        await s3.deleteObjects({ Bucket: bucketName, Delete: { Objects: objectsToDelete, Quiet: false } }).promise();
                    }
                }
            } catch (err) {
                console.error("Error listing or deleting existing files:", err);
                alert("An error occurred while checking for previous file versions. Upload cancelled.");
                this.value = '';
                return;
            }

            const reader = new FileReader();
            reader.onload = () => {
                const fileURL = reader.result;
                currentImageArea.innerHTML = "";
                currentImageArea.classList.add("active");
                currentImageArea.dataset.img = newS3Key;
                if (file.type.startsWith("image/")) {
                    const img = document.createElement("img");
                    img.src = fileURL;
                    img.classList.add("image");
                    currentImageArea.appendChild(img);
                } else if (file.type.startsWith("video/")) {
                    const video = document.createElement("video");
                    video.src = fileURL;
                    video.controls = true;
                    video.style.width = "100%";
                    currentImageArea.appendChild(video);
                } else {
                    const iconContainer = document.createElement('div');
                    iconContainer.style.textAlign = 'center';
                    const icon = document.createElement('span');
                    icon.textContent = `📄`;
                    icon.style.fontSize = '40px';
                    const name = document.createElement('div');
                    name.textContent = file.name;
                    name.style.fontSize = '12px';
                    name.style.wordBreak = 'break-all';
                    iconContainer.appendChild(icon);
                    iconContainer.appendChild(name);
                    currentImageArea.appendChild(iconContainer);
                }
            };
            reader.onerror = error => {
                console.error("Error reading file:", error);
                alert("Could not read the selected file to create a preview.");
            };
            reader.readAsDataURL(file);

            try {
                await s3.putObject({ Bucket: bucketName, Key: newS3Key, Body: file, ContentType: file.type || undefined }).promise();
                alert("File uploaded successfully!");
            } catch (uploadErr) {
                console.error("Upload error:", uploadErr);
                alert(`Failed to upload file: ${uploadErr.message || 'Unknown error'}`);
                currentImageArea.innerHTML = "Upload Failed";
                currentImageArea.classList.remove('active');
                currentImageArea.dataset.img = "";
            }
        });

        let downloadButton = document.querySelector(`#download${i + 1}`);
        downloadButton.addEventListener("click", function () {
            const imagedataextension = imageArea.dataset.img.split(".").pop().toLowerCase();
            const dataWithExtension = objectKey + "." + imagedataextension;
            const customFileName = `${objectKey}${SelectedConstuctionItemForpopup}.${imagedataextension}`;
            const encodedFileName = encodeURIComponent(customFileName);
            const disposition = `attachment; filename*=UTF-8''${encodedFileName}`;

            if (imageArea.dataset.img === dataWithExtension) {
                s3.getObject({ Bucket: bucketName, Key: dataWithExtension }, (err, data) => {
                    if (err) {
                        console.error("Error getting object:", err);
                    } else {
                        s3.getSignedUrl("getObject", { Bucket: bucketName, Key: dataWithExtension, ResponseContentDisposition: disposition }, (err, url) => {
                            if (err) {
                                console.error("Error generating pre-signed URL:", err);
                            } else {
                                const a = document.createElement("a");
                                a.href = url;
                                a.setAttribute("download", customFileName);
                                document.body.appendChild(a);
                                a.click();
                                document.body.removeChild(a);
                            }
                        });
                    }
                });
            }
        });

        let deleteButton = document.querySelector(`#delete${i + 1}`);
        deleteButton.addEventListener("click", function () {
            const imagedataextension = imageArea.dataset.img.split(".").pop().toLowerCase();
            const dataWithExtension = objectKey + "." + imagedataextension;
            if (imageArea.dataset.img === dataWithExtension) {
                s3.deleteObject({ Bucket: bucketName, Key: dataWithExtension }, (err, data) => {
                    if (err) {
                        console.error("Error deleting object:", err);
                    } else {
                        imageArea.innerHTML = `<div class="image-area" id="img1"><img class="icon" /><h5>Upload File</h5></div>`;
                        imageArea.dataset.img = "";
                    }
                });
            }
        });
    }
}


function togglePopupView(container, layer) {
    const mainContent = container.querySelector(".main-content");
    const dashboardContent = container.querySelector(".dashboard-content");
    const button = container.querySelector(".toggle-view-btn");
    
    if (mainContent.style.display === "none") {
        // Show main content
        mainContent.style.display = "block";
        dashboardContent.style.display = "none";
        button.textContent = "Show Dashboard";
    } else {
        // Show dashboard
        mainContent.style.display = "none";
        dashboardContent.style.display = "block";
        button.textContent = "Show Details";
        
        // Initialize dashboard if not already loaded
        if (dashboardContent.innerHTML === "") {
            loadAndRunPopupDashboard(dashboardContent);
        }
    }
}



function createImageUploadSection(index, villaID) {
  return `
    <div class="container">
      <input type="file" id="file${index}" hidden />
      <div class="image-area"  id="img${index}">
        <img class="icon" />
        <h5>Upload File</h5>
      </div>
      <button id="select${index}" class="select-imag-button" BVITEM="${villaID}">
        Select File
      </button>
      <div class="button-group">
        <button id="download${index}" class="download-imag-button">Download File</button>
        <button id="delete${index}" class="delete-imag-button">Delete</button>
      </div>
    </div>
  `;
}


function createLeftClickPopupContent(SelectedConstuctionItemForpopup, layer) {
  return `
    <body>
      <div class="leftClickPage">
        <span class="statueHeader">
          Villa Status</br>${SelectedConstuctionItemForpopup}</br>
          VillaID: ${layer.feature.properties.villaID}</br>
          Block: ${layer.feature.properties.blocknum}</br>
          Villa: ${layer.feature.properties.villanum}</br>
          </br>
          </br>
          <label for="plannedStartDate" style="margin-left: 10px;">Planned Start Date:</label>
          <input type="date" id="plannedStartDate" name="plannedStartDate" readonly style="margin-left: 10px;" />
          <br />
          <label for="plannedFinishDate" style="margin-left: 10px;">Planned Finish Date:</label>
          <input type="date" id="plannedFinishDate" name="plannedFinishDate" readonly style="margin-left: 10px;" />
        </span>
         </br>
          </br>
        <hr>
        <span class="leftclickheaders">
          Progress status
        </span>
        <form id="villaForm">
          <input type="radio" name="villaStat" id="NotStarted" value="NotStarted" />
          <label for="NotStarted" class="NotStarted">NotStarted</label>
          <br />
          <input type="radio" name="villaStat" id="Notes" value="Notes" />
          <label for="Notes" class="Notes">Notes</label>
          <br />
          <input type="radio" name="villaStat" id="NCR" value="NCR" />
          <label for="NCR" class="NCR">NCR</label>
          <br />
          <input type="radio" name="villaStat" id="Rejected" value="Rejected" />
          <label for="Rejected" class="Rejected">Rejected</label>
          <br />
          <input type="radio" name="villaStat" id="Completed" value="Completed" />
          <label for="Completed" class="Completed">Completed</label>
          <input type="date" id="completionDate" name="completionDate" style="margin-left: 10px;" />
          <br />
          <br />
          <hr />
          <button type="button" id="sendButton" onclick="sendbuttondataonevillitem(${
            layer.feature.properties.villaID
          })">Send Data</button>
        </form>
        <div id="output"></div>
      </div>
      <hr>
      <hr>
      <span class="leftclickheaders">
        Files status
      </span>
      <div class="statue-container">
        <button class="header-statue" onclick='showFunction("NotStarted")'>Not Started</button>
        <div class="all-Images-container" id="NotStarted_container">
          ${createImageUploadSection(1, layer.feature.properties.villaID)}
          ${createImageUploadSection(2, layer.feature.properties.villaID)}
        </div>
      </div>

      <div class="statue-container">
        <button class="header-statue" onclick="showFunction('NCR')">NCR</button>
        <div class="all-Images-container" id="NCR_container">
          ${createImageUploadSection(3, layer.feature.properties.villaID)}
          ${createImageUploadSection(4, layer.feature.properties.villaID)}
        </div>
      </div>

      <div class="statue-container">
        <button class="header-statue" onclick="showFunction('Notes')">Notes</button>
        <div class="all-Images-container" id="Notes_container">
          ${createImageUploadSection(5, layer.feature.properties.villaID)}
          ${createImageUploadSection(6, layer.feature.properties.villaID)}
        </div>
      </div>

      <div class="statue-container">
        <button class="header-statue" onclick="showFunction('Rejected')">Rejected</button>
        <div class="all-Images-container" id="Rejected_container">
          ${createImageUploadSection(7, layer.feature.properties.villaID)}
          ${createImageUploadSection(8, layer.feature.properties.villaID)}
        </div>
      </div>

      <div class="statue-container">
        <button class="header-statue" onclick="showFunction('Completed')">Completed</button>
        <div class="all-Images-container" id="Completed_container">
          ${createImageUploadSection(9, layer.feature.properties.villaID)}
          ${createImageUploadSection(10, layer.feature.properties.villaID)}
        </div>
      </div>
      <div class="statue-container">
        <button class="header-statue" onclick="showFunction('Approval')">Approval</button>
        <div class="all-Images-container" id="Approval_container">
          ${createImageUploadSection(11, layer.feature.properties.villaID)}
        </div>
      </div>
      <hr>
      <hr>
      <span class="leftclickheaders">
        Invoices status
      </span>
      <form id="villaInvoice">
        <input type="radio" name="villaInvoice" id="Paid" value="Paid" />
        <label for="Paid" class="Paid">Paid</label>
        <br />
        <input type="radio" name="villaInvoice" id="InProgress" value="InProgress" />
        <label for="InProgress" class="InProgress">InProgress</label>
        <br />
        <input type="radio" name="villaInvoice" id="ReadyToPay" value="ReadyToPay" />
        <label for="ReadyToPay" class="ReadyToPay">ReadyToPay</label>
        <br />
        <input type="radio" name="villaInvoice" id="NotStarted2" value="NotStarted" />
        <label for="NotStarted2" class="NotStarted2">NotStarted</label>
        <br />
        <hr />
        <button type="button" id="sendButtonInvoice" onclick="sendbuttondataonevillitemInvoice(${
          layer.feature.properties.villaID
        })">Send Invoice Data</button>
      </form>
    </body>
  `;
}

function showFunction(state) {
  if (document.getElementById(`${state}_container`).style.display === "none") {
    document.getElementById(`${state}_container`).style.display = "flex";

    for (let i = 0; i < states.length; i++) {
      if (states[i] === state) continue;
      else {
        document.getElementById(`${states[i]}_container`).style.display =
          "none";
      }
    }
  } else {
    document.getElementById(`${state}_container`).style.display = "none";
  }
}
