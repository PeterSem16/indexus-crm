import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueueMetadataBadges } from "./queue-metadata-badges";

const copy = { referralBadge: "Referral", cityCountrySeparator: " · " };

test("renders the actual referral and city badge fixture", () => {
  const html = renderToStaticMarkup(
    <QueueMetadataBadges
      contact={{ id: "fixture", contactType: "customer", hasReferral: true, priorityCity: "Brno", priorityCountryCode: "CZ" } as any}
      copy={copy}
      testIdSuffix="fixture"
    />,
  );

  assert.match(html, /Referral/);
  assert.match(html, /Brno · CZ/);
  assert.match(html, /badge-scheduled-referral-fixture/);
  assert.match(html, /badge-scheduled-city-fixture/);
});

test("does not render a city badge for missing location", () => {
  const html = renderToStaticMarkup(
    <QueueMetadataBadges
      contact={{ id: "missing", contactType: "customer", hasReferral: true } as any}
      copy={copy}
    />,
  );

  assert.match(html, /Referral/);
  assert.doesNotMatch(html, /MapPin|badge-scheduled-city/);
});