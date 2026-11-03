import React from "react";
import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import type { FunnelRow } from "../../../../shared/mission-funnel";
import { missionFunnelTranslations } from "@/i18n/mission-funnel-translations";
import MissionFunnelChart from "./MissionFunnelChart";

test("combined outcomes render package sent as its own labeled drill-down step", () => {
  const rows = (["cooperating", "packageSent", "materials"] as const).map((key, index) => ({
    key,
    total: 12 - index,
    direct: 12 - index,
    inferred: 0,
    previousPercent: null,
    qualifiedPercent: 42,
    members: [],
  })) as FunnelRow[];
  const copy = missionFunnelTranslations.en;
  const markup = renderToStaticMarkup(
    <MissionFunnelChart
      rows={rows}
      copy={copy}
      locale="en"
      selectedStep="packageSent"
      onSelectStep={() => undefined}
    />,
  );

  assert.match(markup, /data-testid="mission-funnel-chart-step-packageSent"/);
  assert.match(markup, /aria-pressed="true"/);
  assert.ok(markup.includes(copy.stepLabels.packageSent));
  assert.ok(markup.includes(copy.chartCombinedHelp));
});
