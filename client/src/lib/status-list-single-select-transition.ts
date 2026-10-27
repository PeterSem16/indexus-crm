export type SingleSelectTransitionStep = {
  id: string;
  confirm: boolean;
};

/** Build one replacement transition: clear active siblings, then select target. */
export function createSingleSelectTransition(targetId: string, siblingIds: string[]): SingleSelectTransitionStep[] {
  const uniqueSiblings = Array.from(new Set(siblingIds))
    .filter(id => id && id !== targetId);
  return [
    ...uniqueSiblings.map(id => ({ id, confirm: false })),
    { id: targetId, confirm: true },
  ];
}

/** Keep the transition ordered so only one status can be active at a time. */
export async function executeSingleSelectTransition<T>(
  steps: SingleSelectTransitionStep[],
  apply: (step: SingleSelectTransitionStep) => Promise<T>,
): Promise<T[]> {
  const results: T[] = [];
  for (const step of steps) results.push(await apply(step));
  return results;
}
