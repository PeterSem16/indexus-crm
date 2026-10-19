import assert from "node:assert/strict";
import { isStatusListYesNo } from "./status-list-answer-kind";
for (const value of ["yesno", "yes_no"]) assert.equal(isStatusListYesNo(value), true);
for (const value of [null, undefined, "", "checkbox", "radio", "text"]) assert.equal(isStatusListYesNo(value), false);
console.log("Status List saved yes/no aliases are recognized without migration");
