import type { OmniGroupReplyTemplate } from "@shared/omni-mailbox-groups";

export type OmniReplyTemplateCopy = {
  replySubjectDefault: string;
  replyBodyDefault: string;
};

export function defaultOmniGroupReplyTemplate(
  groupName: string,
  copy: OmniReplyTemplateCopy,
): OmniGroupReplyTemplate {
  return {
    subject: copy.replySubjectDefault.replace("{group}", groupName),
    body: copy.replyBodyDefault,
    includeSignature: false,
  };
}

export function effectiveOmniGroupReplyTemplate(
  group: { name: string; replyTemplate?: OmniGroupReplyTemplate },
  copy: OmniReplyTemplateCopy,
): OmniGroupReplyTemplate {
  return group.replyTemplate ?? defaultOmniGroupReplyTemplate(group.name, copy);
}
