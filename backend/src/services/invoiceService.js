import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, tables } from "../config/aws.js";
import { getVillaWideItem, getManyVillaWideItems } from "./wideTableService.js";

/**
 * Invoice status per villa/construction item — the original app's
 * "monitoring type 3" (Invoice) view. Same plain-string wide-table shape
 * as wajhaData: { villaID, "Civil-1": "ReadyToPay", "Civil-2": "Paid", ... }.
 * Valid values (matching the original statusColorMapInvoice):
 * NotStarted, InProgress, ReadyToPay, Paid.
 */

export async function getInvoiceStatus(villaID, tableItemId) {
  const item = await getVillaWideItem(tables.invoices, villaID);
  return item[tableItemId] ?? "NotStarted";
}

export async function getAllInvoiceStatuses(villaID) {
  return getVillaWideItem(tables.invoices, villaID);
}

export async function getManyInvoiceStatuses(villaIDs) {
  return getManyVillaWideItems(tables.invoices, villaIDs);
}

export async function updateInvoiceStatus(villaID, tableItemId, status) {
  const result = await ddb.send(
    new UpdateCommand({
      TableName: tables.invoices,
      Key: { villaID },
      UpdateExpression: "SET #item = :status",
      ExpressionAttributeNames: { "#item": tableItemId },
      ExpressionAttributeValues: { ":status": status },
      ReturnValues: "ALL_NEW",
    })
  );
  return result.Attributes?.[tableItemId] ?? status;
}

/**
 * Ports the original app's auto-invoice-trigger: when an activity's
 * status transitions INTO "Completed" from something else, its invoice
 * status is automatically set to "ReadyToPay" — someone still has to
 * mark it "Paid" manually, but it's surfaced as billable the moment the
 * work is done instead of requiring a separate manual step.
 *
 * Deliberately does NOT auto-revert the invoice when un-completing an
 * activity — the original app only *warns* the user client-side if the
 * invoice was already "Paid" (see ActivityStatusControl on the frontend)
 * and leaves the actual invoice status change, if any, to a manual
 * decision. Reverting a paid invoice automatically would be a real
 * financial side-effect to make silently.
 */
export async function autoUpdateInvoiceOnCompletion(villaID, tableItemId, previousStatus, newStatus) {
  if (newStatus === "Completed" && previousStatus !== "Completed") {
    await updateInvoiceStatus(villaID, tableItemId, "ReadyToPay");
  }
}
