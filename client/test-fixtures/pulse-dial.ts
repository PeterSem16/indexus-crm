import React from "react";
import { createRoot } from "react-dom/client";
import {
  PulseClinicDialButton,
  PulseMainDialButton,
  PulseMobileDialButton,
  PulseQuickDialButton,
} from "../src/components/pulse-dial-button";
import { createPulseDialEntryPoints } from "../src/lib/pulse-dial-request";

declare global {
  interface Window {
    pulseDialRequests: string[];
    failNextPulseDial: boolean;
  }
}

window.pulseDialRequests = [];
window.failNextPulseDial = false;

const requestCentralDial = (phoneNumber: string) => {
  if (window.failNextPulseDial) {
    window.failNextPulseDial = false;
    return Promise.reject(new Error("SIP registration failed"));
  }
  window.pulseDialRequests.push(phoneNumber);
  return Promise.resolve();
};

function Fixture() {
  const dial = createPulseDialEntryPoints(requestCentralDial, false);
  const buttons = [
    React.createElement(PulseMainDialButton, { key: "main", phoneNumber: "+421 900 111 222", onDial: dial.main, errorMessage: "Dial request failed" }, "main"),
    React.createElement(PulseQuickDialButton, { key: "quick", phoneNumber: "+421 900 111 222", onDial: dial.quick, errorMessage: "Dial request failed" }, "quick"),
    React.createElement(PulseClinicDialButton, { key: "clinic", phoneNumber: "+421 900 111 222", onDial: dial.clinic, errorMessage: "Dial request failed" }, "clinic"),
    React.createElement(PulseMobileDialButton, { key: "mobile", label: "Phone", phoneNumber: "+421 900 111 222", onDial: dial.mobile, errorMessage: "Dial request failed" }, "mobile"),
  ];
  return React.createElement(
    React.Fragment,
    null,
    buttons,
  );
}

createRoot(document.getElementById("pulse-dial-root")!).render(React.createElement(Fixture));