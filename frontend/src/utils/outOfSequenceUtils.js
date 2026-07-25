/**
 * "Out of sequence" — an item marked Completed while at least one of its
 * OWN predecessors is not Completed. This is a distinct concept from the
 * existing Schedule mode's "blocked" status (scheduleUtils.js): that one
 * only ever applies to NotStarted items waiting their turn and returns
 * early for Completed items without checking predecessors at all — it
 * answers "should this have started yet," not "was this actually
 * finished before what it depends on."
 *
 * Runs entirely client-side against data the app already has loaded
 * (useAllVillaStatuses + the construction items template) rather than
 * adding a new backend endpoint for something this cheap to compute
 * once both pieces are in memory.
 */
export function findOutOfSequenceItems(allVillaStatuses, constructionItemsTemplate) {
  if (!allVillaStatuses || !constructionItemsTemplate?.length) return [];

  const itemById = new Map(constructionItemsTemplate.map((item) => [item.id, item]));
  const findings = [];

  for (const [villaID, statusMap] of Object.entries(allVillaStatuses)) {
    for (const item of constructionItemsTemplate) {
      const itemStatus = statusMap[item.TableItemID]?.status ?? statusMap[item.TableItemID] ?? "NotStarted";
      if (itemStatus !== "Completed") continue;
      if (!item.predecessors || item.predecessors.length === 0) continue;

      const incompletePredecessors = item.predecessors
        .map((predId) => itemById.get(predId))
        .filter(Boolean)
        .map((predItem) => {
          const predStatus = statusMap[predItem.TableItemID]?.status ?? statusMap[predItem.TableItemID] ?? "NotStarted";
          return { TableItemID: predItem.TableItemID, name: predItem.name, status: predStatus };
        })
        .filter((pred) => pred.status !== "Completed");

      if (incompletePredecessors.length > 0) {
        findings.push({
          villaID,
          item: { TableItemID: item.TableItemID, name: item.name },
          incompletePredecessors,
        });
      }
    }
  }

  return findings;
}
