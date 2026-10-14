import { TEMPLATE_VISUAL_PALETTES, templateVisualTone } from "../../shared/automation-template-visual";

export function automationTemplateVisuals(id: string, html: string): string {
  const tone = templateVisualTone(id);
  const palette = TEMPLATE_VISUAL_PALETTES[tone];
  if (/call/.test(id)) html = html.replace(/cid:indexus-automation-(?:task|phone(?:-(?:positive|negative|urgent|info|deadline))?)/g,
    `cid:indexus-automation-phone-${tone}`);
  return html.replace(/#316bd8/gi, palette.accent)
    .replace(/#edf3f8|#edf4ff|#f3f7fa/gi, palette.background)
    .replace(/#d9e4ed|#e1eaf0|#e8eef3/gi, palette.border)
    .replace(/#173852|#3779a6|#426c8d|#57768d/gi, palette.foreground);
}

type Default = { id: string; name: string; subject: string; content: string; contentHtml: string };
/** Exact compare-and-update preserves manager-edited/deleted/disabled defaults. */
export async function refreshPristineTemplateVisuals(pool: { query: (sql: string) => Promise<unknown> }, oldTemplates: Default[], templates: Default[]) {
  const byId = new Map(templates.map(item => [item.id, item]));
  const quote = (value: string) => `'${value.replaceAll("'", "''")}'`;
  const values = oldTemplates.filter(item => byId.has(item.id) && item.contentHtml !== byId.get(item.id)!.contentHtml).map(old =>
    `(${[old.id, old.name, old.subject, old.content, old.contentHtml, byId.get(old.id)!.contentHtml].map(quote).join(",")})`).join(",\n");
  if (!values) return;
  await pool.query(`WITH visuals(id,name,subject,content,old_html,new_html) AS (VALUES ${values})
    UPDATE message_templates AS template SET content_html=visuals.new_html FROM visuals
    WHERE template.id=visuals.id AND template.type='email' AND template.format='html'
      AND template.is_active=true AND template.name=visuals.name
      AND template.subject=visuals.subject AND template.content=visuals.content
      AND template.content_html=visuals.old_html AND cardinality(template.country_codes)=0;`);
}
