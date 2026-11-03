/** Clinic eligibility only: never exposes or counts personnel as funnel actors.
 * Keep both supported institution links, including legacy singular-only links.
 * EXISTS avoids multiplying a clinic when several linked people have referrals.
 */
export const missionClinicReferralSql = `(c.is_referred_by_doctor OR EXISTS (
  SELECT 1 FROM collaborators referral_person
  WHERE referral_person.is_referred_by_doctor = TRUE
    AND (referral_person.clinic_id = c.id OR c.id = ANY(referral_person.clinic_ids))
))`;
