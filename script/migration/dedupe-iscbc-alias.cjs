function resolveCollaboratorAlias(aliasesByLegacyId, legacyId, directRecord, recordsById = {}) {
  const alias = aliasesByLegacyId[String(legacyId)];
  if (!alias) return directRecord;
  const canonical = alias && recordsById[String(alias.canonical_id)];
  if (!canonical || canonical.is_active !== true) {
    throw new Error(`ISCBC alias ${legacyId} points to a missing or inactive canonical collaborator`);
  }
  return canonical;
}

module.exports = { resolveCollaboratorAlias };