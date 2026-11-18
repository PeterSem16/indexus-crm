import assert from "node:assert/strict";
import { test } from "node:test";
import { isolatedTasksRoute } from "./client-route";

test("B1 build replaces only the Tasks redirect and keeps original authentication markup", () => {
  const original = `import { lazy } from "react";
const view = <Authenticated><Route path="/tasks">
  <Redirect to="/email?tab=tasks" />
</Route><Route path="/email" component={EmailPage} /></Authenticated>;`;
  const result = isolatedTasksRoute(original);
  assert(result.includes('<Authenticated><Route path="/tasks" component={IndexusB1TasksPage} />'));
  assert(result.includes('<Route path="/email" component={EmailPage} /></Authenticated>'));
  assert(result.includes('lazy(() => import("@/pages/tasks"))'));
  assert.throws(() => isolatedTasksRoute(original + original), /B1_ORIGINAL_TASK_ROUTE_CHANGED/);
  assert.throws(() => isolatedTasksRoute(result), /B1_ORIGINAL_TASK_ROUTE_CHANGED/);
  assert.throws(() => isolatedTasksRoute("different app"), /B1_ORIGINAL_TASK_ROUTE_CHANGED/);
});
