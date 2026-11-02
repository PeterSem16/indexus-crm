/** No arbitrary winner for simultaneous proofs or conflicting legacy identities. */
export function uniqueFunnelActor(values: { actorId?: string | null }[]): string | null {
  if (!values.length || values.some(value => !value.actorId?.trim())) return null;
  const actors = new Set(values.map(value => value.actorId!));
  return actors.size === 1 ? [...actors][0] : null;
}
