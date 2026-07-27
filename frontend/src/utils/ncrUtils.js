/**
 * NCR (Non-Conformance Report) findings — every (villa, item) currently
 * marked with status "NCR". Mirrors outOfSequenceUtils.js in shape and
 * approach: runs entirely client-side against data the app already has
 * loaded (useAllVillaStatuses + the construction items template),
 * powering the standalone NCR report (see NcrReport.jsx) the same way
 * findOutOfSequenceItems powers the Out of Sequence report.
 */
export function findNcrItems(allVillaStatuses, constructionItemsTemplate) {
  if (!allVillaStatuses || !constructionItemsTemplate?.length) return [];

  const findings = [];

  for (const [villaID, statusMap] of Object.entries(allVillaStatuses)) {
    for (const item of constructionItemsTemplate) {
      const itemStatus = statusMap[item.TableItemID] ?? "NotStarted";
      if (itemStatus !== "NCR") continue;

      findings.push({
        villaID,
        item: { TableItemID: item.TableItemID, name: item.name },
      });
    }
  }

  return findings;
}
