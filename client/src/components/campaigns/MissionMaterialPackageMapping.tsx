import type { FunnelConfig, MissionFunnelReport } from "../../../../shared/mission-funnel";
import type { MissionFunnelCopy } from "@/i18n/mission-funnel-translations";
import { materialPackageCopy } from "./mission-material-package-copy";
export const emptyMaterialPackage = (): NonNullable<FunnelConfig["materials"]> => ({
  packageSent: [], excluded: { materials17: [], materials18: [], materials19: [] },
});
export default function MissionMaterialPackageMapping({ config, report, locale, copy, onChange }: {
  config: FunnelConfig; report: MissionFunnelReport; locale: string; copy: MissionFunnelCopy;
  onChange: (value: NonNullable<FunnelConfig["materials"]>) => void;
}) {
  const text = materialPackageCopy[locale as keyof typeof materialPackageCopy] ?? materialPackageCopy.en;
  const value = config.materials ?? emptyMaterialPackage();
  const picker = (label: string, ids: string[], change: (ids: string[]) => void, testId: string) => <label className="block space-y-1.5">
    <span className="text-xs font-medium">{label}</span>
    <select multiple value={ids} size={4} onChange={event => change(Array.from(event.target.selectedOptions, option => option.value))}
      data-testid={testId} aria-label={label} className="w-full rounded-md border border-input bg-background p-2 text-xs text-foreground">
      {ids.filter(id => !report.items.some(item => item.id === id)).map(id => <option key={id} value={id}>{id}</option>)}
      {report.items.map(item => <option key={item.id} value={item.id}>{item.stepId} · {item.label}</option>)}
    </select>
  </label>;
  return <section className="mb-5 space-y-3 rounded-lg border border-border bg-muted/20 p-3" data-testid="material-package-mapping">
    <h3 className="text-sm font-semibold">{text.title}</h3>
    <p className="text-xs leading-relaxed text-muted-foreground">{text.help}</p>
    {picker(text.sent, value.packageSent, packageSent => onChange({ ...value, packageSent }), "material-package-sent")}
    <details>
      <summary className="cursor-pointer text-xs font-medium">{text.excluded}</summary>
      <div className="mt-3 grid gap-3">
        {(["materials17", "materials18", "materials19"] as const).map(key => <div key={key}>
          {picker(copy.sourceLabels[key], value.excluded[key], ids => onChange({ ...value, excluded: { ...value.excluded, [key]: ids } }), `material-package-excluded-${key}`)}
        </div>)}
      </div>
    </details>
  </section>;
}
