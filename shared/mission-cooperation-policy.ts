/**
 * The reviewed MPN-06a choice is sufficient only for the Cooperating outcome.
 * Respect the saved source mapping; never infer this from labels, a missing
 * answer, a canonical status shared with other choices, or a different Mission.
 */
export function standaloneCooperationItemIds(
  items: ReadonlyArray<{ id: string; stepId: string }>,
  mappedOtherProposalIds: ReadonlyArray<string>,
): string[] {
  const choices = items.filter(item => item.stepId === "MPN-06a");
  return choices.length === 1 && mappedOtherProposalIds.includes(choices[0].id)
    ? [choices[0].id] : [];
}
