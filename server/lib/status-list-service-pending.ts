/** Desired-state background work predating the switch is not a completed
 * callback. Unknown queue kinds cannot be assumed unrelated to this Mission.
 * $1 is the Mission id. This query never reads callback contents or replays work.
 */
export const CALLBACK_DEFERRED_PREDICATE = `
 d.kind NOT IN ('mission','contact','clinic','hospital')
 OR (d.kind='mission' AND d.entity_id=$1)
 OR EXISTS(SELECT 1 FROM campaign_contacts cc WHERE cc.campaign_id=$1 AND (
   (d.kind='contact' AND d.entity_id=cc.id)
   OR (d.kind='clinic' AND d.entity_id=cc.clinic_id)
   OR (d.kind='hospital' AND d.entity_id=cc.hospital_id)
 ))`;
