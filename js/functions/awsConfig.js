// aws
var region = "us-east-1";
var accessKey = "AKIA6ODU5ZRYUYTWVMMY";
var secretAccessKey = "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";
var bucketName = "wajhabucket";
const WajhaDatatable = "wajha_project_data_table";
const wajhaInvoicetable = "wahja_Invoice_total";
const wajhaspecialquerytable = "wajha_special_query";

const plannedDatesTable="Planned_dates";
const plannedCostsTable="Planned_cost";
const ActualDatesTable="Actual_dates";
const ActualCostsTable="Actual_costs";
const plannedDatesFinishTable="Planned_dates_Finish";

AWS.config.update({
  region: region,
  credentials: new AWS.Credentials(accessKey, secretAccessKey),
});
var s3 = new AWS.S3();

const dynamoDBClient = new AWS.DynamoDB.DocumentClient();


