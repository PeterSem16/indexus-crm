type Queryable = { query: (text: string, values?: any[]) => Promise<{ rows: any[] }> };
type History = { id: string; action: string; campaignId?: string | null; metadata: any };

/** This is an ordinary manual disposition choice with audit provenance, not
 * an override of an approved automation or callback executor. */
export async function resolveManualStatusListSource(db: Queryable, source: unknown, campaignId: string) {
  if (!source || typeof source !== "object" || Array.isArray(source)) throw new Error("invalid_status_list_source");
  const s = source as Record<string, unknown>;
  if (typeof s.statusListItemId !== "string" || !s.statusListItemId ||
    s.questionId != null && typeof s.questionId !== "string") throw new Error("invalid_status_list_source");
  const result = await db.query(`SELECT i.id,i.label,q.id AS question_id,q.question_text
    FROM campaign_status_list_items i
    LEFT JOIN campaign_status_list_questions q ON q.item_id=i.id AND q.id=$3
    WHERE i.id=$1 AND i.campaign_id=$2 AND ($3::varchar IS NULL OR q.id=$3)`,
  [s.statusListItemId, campaignId, s.questionId || null]);
  if (!result.rows.length) throw new Error("status_list_source_not_in_mission");
  const row = result.rows[0];
  return { campaignId, statusListItemId: row.id, itemLabel: row.label,
    questionId: row.question_id || null, questionLabel: row.question_text || null,
    actionType: "set_contact_status" };
}

/** Batched lookups for old audit rows without label snapshots. Scope every
 * lookup to the row's Mission; snapshots always win over current definitions. */
export async function loadStatusListHistoryDisplay(db: Queryable, history: History[]) {
  const rows = history.filter(h => h.action.startsWith("status_list_"));
  const ids = (values: unknown[]) => Array.from(new Set(values.filter((v): v is string => typeof v === "string" && !!v)));
  if (!rows.length) return new Map<string, Record<string, unknown>>();
  const m = (h: History) => h.metadata && typeof h.metadata === "object" ? h.metadata : {};
  const actionIds = ids(rows.map(h => m(h).automationId));
  const questionIds = ids(rows.map(h => m(h).questionId));
  const [actions, questions] = await Promise.all([
    actionIds.length ? db.query(`SELECT a.id,a.status_list_item_id,a.question_id,a.action_type,a.disposition_id,i.campaign_id
      FROM campaign_status_list_automations a JOIN campaign_status_list_items i ON i.id=a.status_list_item_id
      WHERE a.id=ANY($1::varchar[])`, [actionIds]) : { rows: [] },
    questionIds.length ? db.query(`SELECT q.id,q.question_text,q.item_id,i.campaign_id
      FROM campaign_status_list_questions q JOIN campaign_status_list_items i ON i.id=q.item_id
      WHERE q.id=ANY($1::varchar[])`, [questionIds]) : { rows: [] },
  ]);
  const itemIds = ids([...rows.flatMap(h => [m(h).statusListItemId, m(h).itemId]),
    ...actions.rows.map(a => a.status_list_item_id), ...questions.rows.map(q => q.item_id)]);
  const campaigns = ids(rows.map(h => h.campaignId || m(h).campaignId));
  const missingQuestionIds = ids(actions.rows.map(a => a.question_id))
    .filter(id => !questions.rows.some(q => q.id === id));
  const [items, dispositions, extraQuestions] = await Promise.all([
    itemIds.length ? db.query("SELECT id,label,campaign_id FROM campaign_status_list_items WHERE id=ANY($1::varchar[])", [itemIds]) : { rows: [] },
    campaigns.length ? db.query("SELECT id,code,name,campaign_id FROM campaign_dispositions WHERE campaign_id=ANY($1::varchar[])", [campaigns]) : { rows: [] },
    missingQuestionIds.length ? db.query(`SELECT q.id,q.question_text,q.item_id,i.campaign_id
      FROM campaign_status_list_questions q JOIN campaign_status_list_items i ON i.id=q.item_id
      WHERE q.id=ANY($1::varchar[])`, [missingQuestionIds]) : { rows: [] },
  ]);
  const questionRows: any[] = [...questions.rows, ...extraQuestions.rows];
  const result = new Map<string, Record<string, unknown>>();
  for (const h of rows) {
    const meta = m(h);
    const campaign = h.campaignId || meta.campaignId;
    const a = actions.rows.find(a => a.id === meta.automationId && a.campaign_id === campaign);
    const q = questionRows.find(q => q.id === (meta.questionId || a?.question_id) && q.campaign_id === campaign);
    const itemId = meta.statusListItemId || meta.itemId || q?.item_id || a?.status_list_item_id;
    const item = items.rows.find(i => i.id === itemId && i.campaign_id === campaign);
    const d = dispositions.rows.find(d => d.campaign_id === campaign &&
      (meta.dispositionCode ? d.code === meta.dispositionCode : d.id === a?.disposition_id));
    result.set(h.id, {
      itemLabel: item?.label || null, questionLabel: q?.question_text || null,
      dispositionName: d?.name || null, actionType: meta.actionType || a?.action_type || null,
    });
  }
  return result;
}
