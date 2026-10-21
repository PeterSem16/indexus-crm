/** Complete contact-type tree shared by the real clinic card and automation editor. */
export const CLINIC_CONTACT_TYPES = ["new_contact", "former_collaborator", "current_collaborator"] as const;
export const CLINIC_CONTACT_QUESTIONS = [
  {
    key: "initial", prefix: "initial", fieldKey: "initialStatus", labelKey: "initialStatus", icon: "CircleDot",
    options: [
      { value: "not_contacted", labelKey: "notContacted", icon: "Circle", stage: 1, sentiment: "neutral", color: "text-gray-500" },
      { value: "former", labelKey: "formerCollaborator", icon: "Users", stage: 1, sentiment: "neutral", color: "text-amber-600" },
      { value: "active_contract", labelKey: "activeContract", icon: "ShieldCheck", stage: 5, sentiment: "positive", color: "text-green-600" },
    ],
  },
  {
    key: "cooperation", prefix: "coop", fieldKey: "interestCooperation", labelKey: "cooperationInterest", icon: "Handshake",
    options: [
      { value: "unknown", labelKey: "unknown", icon: "HelpCircle", stage: 2, sentiment: "neutral", color: "text-gray-500" },
      { value: "interested", labelKey: "interested", icon: "CheckCircle2", stage: 3, sentiment: "positive", color: "text-green-600" },
      { value: "not_interested", labelKey: "notInterested", icon: "Ban", stage: 3, sentiment: "negative", color: "text-red-500" },
    ],
  },
  {
    key: "contract_interest", prefix: "contract_int", fieldKey: "interestContract", labelKey: "contractInterest", icon: "FileSignature",
    options: [
      { value: "unknown", labelKey: "unknown", icon: "HelpCircle", stage: 3, sentiment: "neutral", color: "text-gray-500" },
      { value: "interested", labelKey: "interested", icon: "CheckCircle2", stage: 4, sentiment: "positive", color: "text-green-600" },
      { value: "not_interested", labelKey: "notInterested", icon: "Ban", stage: 4, sentiment: "negative", color: "text-red-500" },
    ],
  },
  {
    key: "contract_status", prefix: "contract", fieldKey: "contractStatus", labelKey: "contractStatus", icon: "ScrollText",
    options: [
      { value: "none", labelKey: "noContract", icon: "ScrollText", stage: 4, sentiment: "neutral", color: "text-gray-500" },
      { value: "active", labelKey: "activeContract", icon: "ShieldCheck", stage: 5, sentiment: "positive", color: "text-green-600" },
    ],
  },
] as const;
