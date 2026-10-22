import type { CSSProperties } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { StatusListQuickOptionIconPicker } from "./status-list-quick-option-icons";
const colors = ["#4f8178", "#708260", "#b66d50", "#c28b38", "#9a5e77", "#687783"];
const validHex = (value: string) => /^#[\da-f]{6}$/i.test(value);

export function StatusListQuestionAppearance({ locale, icon, color, onIconChange, onColorChange, disabled = false }: {
  locale: string;
  icon: string;
  color: string;
  onIconChange: (value: string | null) => void;
  onColorChange: (value: string) => void;
  disabled?: boolean;
}) {
  const { t } = useI18n();
  const copy = t.statusListQuestionAppearance;
  const currentIsPalette = colors.includes(color.toLowerCase());
  return <section className="slqs-appearance slqs-wide" aria-label={copy.color}>
    <div className="slqs-appearance-head">
      <div><strong>{copy.color}</strong><p>{copy.keep}</p></div>
      {color && <span className="slqs-current-color"><i style={{ backgroundColor: color }} />{copy.current}</span>}
    </div>
    <div className="slqs-color-grid" role="group" aria-label={copy.color}>
      {colors.map((value, index) => <button key={value} type="button" aria-pressed={color.toLowerCase() === value} aria-label={copy.palette[index]} title={copy.palette[index]}
        className="slqs-color-swatch" style={{ "--swatch": value } as CSSProperties} disabled={disabled} onClick={() => onColorChange(value)}>
        <i /> <span>{copy.palette[index]}</span>
      </button>)}
      <label className="slqs-color-custom">
        <span>{copy.custom}</span>
        <input type="color" aria-label={copy.custom} value={validHex(color) ? color : "#4f8178"} disabled={disabled} onChange={event => onColorChange(event.target.value)} />
      </label>
    </div>
    {color && !validHex(color) && !currentIsPalette && <small className="slqs-appearance-legacy">{copy.keep} <code>{color}</code></small>}
    <div className="slqs-appearance-icon">
       <h4>{copy.icon}</h4>
      <StatusListQuickOptionIconPicker value={icon || null} onChange={onIconChange} locale={locale} disabled={disabled} title={copy.icon} />
    </div>
  </section>;
}
