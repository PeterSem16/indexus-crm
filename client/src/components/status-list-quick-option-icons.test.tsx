import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { test } from "node:test";
import {
  getStatusListQuestionColorValue,
  StatusListQuickOptionIcon,
  StatusListQuickOptionIconPicker,
} from "./status-list-quick-option-icons";

const legacyQuestionIcons = [
  "SquareCheck", "CircleHelp", "Info", "CircleAlert", "CircleCheck", "Star", "Heart", "Phone", "Mail",
  "Calendar", "User", "FileText", "MessageCircle", "MapPin", "Clock", "DollarSign", "Shield", "Activity",
  "Home", "Building2", "Flag", "Lightbulb", "Lock", "Award", "Smile", "Stethoscope", "Baby", "Dna",
  "ClipboardCheck", "Zap",
];

test("every icon saved by the original Status List editor still renders in Nexus Pulse", () => {
  for (const name of legacyQuestionIcons) {
    const markup = renderToStaticMarkup(<StatusListQuickOptionIcon name={name} />);
    assert.match(markup, /<svg\b/, `${name} should render as an icon`);
  }
});

test("question icon colors preserve custom hex values and map legacy color names", () => {
  assert.equal(getStatusListQuestionColorValue("#4f8178"), "#4f8178");
  assert.equal(getStatusListQuestionColorValue("indigo"), "#6366f1");
  assert.equal(getStatusListQuestionColorValue(null), undefined);

  const markup = renderToStaticMarkup(<StatusListQuickOptionIcon name="Clock" color="indigo" />);
  assert.match(markup, /style="color:#6366f1"/);
});

test("the modern icon picker only exposes its translated choices", () => {
  const markup = renderToStaticMarkup(
    <StatusListQuickOptionIconPicker value={null} onChange={() => {}} locale="sk" />,
  );
  assert.match(markup, /data-testid="quick-option-icon-Activity"/);
  assert.match(markup, /data-testid="quick-option-icon-UserRoundCheck"/);
  assert.doesNotMatch(markup, /quick-option-icon-Clock"/);

  const legacyValueMarkup = renderToStaticMarkup(
    <StatusListQuickOptionIconPicker value="Clock" onChange={() => {}} locale="en" />,
  );
  assert.match(legacyValueMarkup, /This saved icon isn&#x27;t offered here/);
  assert.match(legacyValueMarkup, /<svg\b/);
});
