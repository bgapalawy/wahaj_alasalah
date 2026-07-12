function addDataToDynamoDB(table, data) {
  return new Promise((resolve, reject) => {
    // Validate input parameters
    if (!table || !data) {
      return reject("Invalid input: table and data are required");
    }

    // Validate villaID
    if (!data.villaID) {
      return reject("Invalid input: villaID is required");
    }

    const dynamoDB = new AWS.DynamoDB();
    console.log("Checking data to be added to DynamoDB:", data);

    // Initialize params object for getting the existing item
    const getParams = {
      TableName: table,
      Key: {
        villaID: { S: data.villaID },
      },
    };

    // Get the existing item from the DynamoDB table
    dynamoDB.getItem(getParams, (err, getData) => {
      if (err) {
        return reject(
          "Unable to retrieve item. Error JSON: " + JSON.stringify(err, null, 2)
        );
      }

      // If no existing item, create a new item
      const updatedItem = getData.Item ? { ...getData.Item } : {};

      // Add new columns to the item
      for (const [key, value] of Object.entries(data)) {
        // Determine the correct DynamoDB attribute type
        if (table === ActualDatesTable && key !== "villaID" && value !== "") {
          // For ActualDatesTable (except villaID), store non-empty values as numbers
          updatedItem[key] = { N: String(value) }; // Convert to string for DynamoDB number type
        } else {
          // For other tables or villaID, store as string; also store empty values as empty strings
          updatedItem[key] = { S: String(value) };
        }
      }

      // Initialize params object for updating the item
      const putParams = {
        TableName: table,
        Item: updatedItem,
      };

      // Update the item in the DynamoDB table
      dynamoDB.putItem(putParams, (err, putData) => {
        if (err) {
          return reject(
            "Unable to add item. Error JSON: " + JSON.stringify(err, null, 2)
          );
        }

        console.log("Added/updated item:", JSON.stringify(putData, null, 2));
        resolve(putData);
      });
    });
  });
}
  
  // Function to retrieve all data from a specific row in DynamoDB
 function retrieveSpecificRowDataFromDynamoDB(table, villaID) {
    return new Promise((resolve, reject) => {
      // Validate input parameters
      if (!table || !villaID) {
        console.error("Invalid input: table and villaID are required");
        reject(new Error("Invalid input: table and villaID are required"));
        return;
      }
  
      const dynamoDB = new AWS.DynamoDB();
  
      // Initialize params object for getting the specific item
      const getParams = {
        TableName: table,
        Key: {
          villaID: { S: villaID }, // villaID is the primary key
        },
      };
  
      // Retrieve the item from the DynamoDB table
      dynamoDB.getItem(getParams, (err, data) => {
        if (err) {
          console.error(
            "Unable to retrieve item. Error JSON:",
            JSON.stringify(err, null, 2)
          );
          reject(err);
          return;
        }
  
        // Check if the item exists
        if (!data.Item) {
          console.log(`No data found for villaID: ${villaID}`);
          resolve(null); // Resolve with null if no data found
          return;
        }
  
        // Convert DynamoDB item to a more readable format
        const result = {};
        for (const [key, value] of Object.entries(data.Item)) {
          result[key] = value.S || value.N || value.BOOL || value.L || value.M; // Extract the value based on its type
        }
  
        // Log the retrieved data
        //console.log("Retrieved data:", JSON.stringify(result, null, 2));
  
        resolve(result); // Resolve the Promise with the retrieved data
      });
    });
  }
  
  // Function to update activities status based on retrieved data
  function updateActivityStatus(activities, retrievedData) {
    //console.log(retrievedData);
    activities.forEach((activity) => {
      // Update the status in the activities array
      
      activity.status = retrievedData[activity.TableItemID]; // Assuming retrievedData has a status property
      //console.log(activity.status);
    });
    
  }
  
  // //////////////////////////////////////////////
  
  // Function to generate an array of villaIDs from V_1 to V_590
  function generateVillaIDRange() {
    const villaIDs = [];
    for (let i = 1; i <= villaIDcounts; i++) {
      villaIDs.push(`V_${i}`);
    }
    return villaIDs;
  }
  
  // Modify the existing function to use the generated villaID range
  async function retrieveAndCountDataFromDynamoDB(tableName, columnName) {
    const dynamoDB = new AWS.DynamoDB.DocumentClient();
  
    // Generate the range of villaIDs to filter
    const validVillaIDs = generateVillaIDRange();
  
    try {
      // Step 1: Initialize a Map to count occurrences of each value
      const countsMap = new Map();
  
      // Step 2: Initialize an array to store the retrieved data before deletion
      const retrievedData = [];
  
      // Step 3: Paginate through the table to retrieve all data
      let lastEvaluatedKey = null;
      do {
        const scanParams = {
          TableName: tableName,
          ProjectionExpression: "#columnName, villaID", // Assuming villaID is your primary key
          ExpressionAttributeNames: {
            "#columnName": columnName,
          },
          FilterExpression: "contains(:villaIDList, villaID)", // Filter for specific villaIDs
          ExpressionAttributeValues: {
            ":villaIDList": validVillaIDs,
          },
          ExclusiveStartKey: lastEvaluatedKey, // Pagination token
        };
  
        const data = await dynamoDB.scan(scanParams).promise();
  
        // Step 4: Process retrieved data and count occurrences
        data.Items.forEach((item) => {
          const value = item[columnName];
          // Increment the count for this value in the map
          countsMap.set(value, (countsMap.get(value) || 0) + 1);
  
          // Add the item to the retrievedData array
          retrievedData.push(item);
        });
  
        // Update the pagination token
        lastEvaluatedKey = data.LastEvaluatedKey;
      } while (lastEvaluatedKey); // Continue until all data is retrieved
  
      // Step 5: Return the retrieved data and counts map
      return {
        retrievedData, // The raw data retrieved from DynamoDB
      };
    } catch (err) {
      console.error("Error:", JSON.stringify(err, null, 2));
      throw err; // Re-throw the error for further handling
    }
  }
  

  //for all project dashboard
async  function fetchTableData(tableName) {
  try {
    let items = [];
    let lastEvaluatedKey = null;
    do {
      const params = {
        TableName: tableName,
        ExclusiveStartKey: lastEvaluatedKey,
      };
      const data = await dynamoDBClient.scan(params).promise();
      items = items.concat(data.Items || []);
      lastEvaluatedKey = data.LastEvaluatedKey;
    } while (lastEvaluatedKey);
    //console.log(`Fetched ${items.length} items from ${tableName}:`, JSON.stringify(items, null, 2));
    return items;
  } catch (error) {
    console.error(`Error fetching data from table ${tableName}:`, error);
    throw error;
  }
}
  


// for general query state
 async  function getdynamoDBClientData(tableName, maxItems = 1000) {
    if (typeof dynamoDBClient === 'undefined') {
      console.error("dynamoDBClient is not defined.");
      return [];
    }

    let items = [];
    let lastEvaluatedKey;
    let scannedItems = 0;

    try {
      do {
        const params = {
          TableName: tableName,
          Limit: 100,
          ExclusiveStartKey: lastEvaluatedKey
        };

        const data = await dynamoDBClient.scan(params).promise();
        if (data.Items && data.Items.length > 0) {
          items = items.concat(data.Items);
          scannedItems += data.Items.length;
        }
        lastEvaluatedKey = data.LastEvaluatedKey;
      } while (lastEvaluatedKey && scannedItems < maxItems);

      return items;
    } catch (error) {
      console.error(`Error scanning table ${tableName}:`, error);
      return [];
    }
  }

  async  function getdynamoDBClientColumns(tableName, maxItems = 1000) {
    if (typeof dynamoDBClient === 'undefined') {
      console.error("dynamoDBClient is not defined.");
      return [];
    }

    let columns = new Set();
    let lastEvaluatedKey;
    let scannedItems = 0;

    try {
      do {
        const params = {
          TableName: tableName,
          Limit: 100,
          ExclusiveStartKey: lastEvaluatedKey
        };

        const data = await dynamoDBClient.scan(params).promise();
        if (data.Items && data.Items.length > 0) {
          data.Items.forEach(item => {
            Object.keys(item).forEach(key => columns.add(key));
            scannedItems++;
          });
        }
        lastEvaluatedKey = data.LastEvaluatedKey;
      } while (lastEvaluatedKey && scannedItems < maxItems);

      return Array.from(columns);
    } catch (error) {
      console.error(`Error scanning table ${tableName}:`, error);
      return [];
    }
  }
  
  

  //invoice function
  async function retrieveSpecificDataonevalueFromDynamoDB(tableName, villaID, constructionItem) {
    const dynamoDB = new AWS.DynamoDB.DocumentClient();
  
    try {
      // Initialize an array to store the retrieved data
      const retrievedData = [];
  
      // Step 1: Query DynamoDB (instead of scanning)
      const queryParams = {
        TableName: tableName,
        KeyConditionExpression: "villaID = :villaID", // Assuming villaID is the partition key
        FilterExpression: "constructionItem = :constructionItem", // Filter by constructionItem
        ExpressionAttributeValues: {
          ":villaID": villaID,
          ":constructionItem": constructionItem,
        },
        Limit: 1, // Only fetch the first matching item
      };
  
      const data = await dynamoDB.query(queryParams).promise();
  
      // Step 2: If an item is found, add it to retrievedData
      if (data.Items && data.Items.length > 0) {
        retrievedData.push(data.Items[0]);
      }
  
      // Step 3: Return the retrieved data (empty if no match)
      return {
        retrievedData, // Contains at most one item
      };
    } catch (err) {
      console.error("Error:", JSON.stringify(err, null, 2));
      throw err; // Re-throw the error for further handling
    }
  }
  
  
  
  
  
  
  
