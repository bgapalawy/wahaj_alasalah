const fs = require('fs');

const inputFilename = 'project-boundary.geojson';
const outputFilename = 'cleaned_output.geojson';

try {
    // 1. Read the file
    const rawData = fs.readFileSync(inputFilename, 'utf-8');
    const data = JSON.parse(rawData);

    // 2. Loop through features and update properties
    if (data.features) {
        data.features.forEach(feature => {
            const oldProperties = feature.properties || {};
            
            feature.properties = {
                // "TxtMemo": oldProperties.TxtMemo || "",
                // "zonenum": oldProperties.zonenum || "",
                // "blocknum": oldProperties.blocknum || "",
                // "villatype": oldProperties.villatype || "",
                // "villanum": oldProperties.villanum || "",
                // "villaID": oldProperties.villaID || "",
                // "RefName":oldProperties.RefName || "",
                "OBJECTID": oldProperties.OBJECTID || ""
            };
        });
    }

    // 3. Save to new file
    fs.writeFileSync(outputFilename, JSON.stringify(data, null, 2), 'utf-8');
    console.log(`Success! Cleaned data saved to ${outputFilename}`);

} catch (error) {
    console.error("Error processing file:", error.message);
}