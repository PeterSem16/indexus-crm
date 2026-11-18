/** Build-only adapter: retain the existing authenticated app and actual Tasks UI. */
export function isolatedTasksRoute(code: string): string {
  const route = /<Route path="\/tasks">\s*<Redirect to="\/email\?tab=tasks" \/>\s*<\/Route>/g;
  if ([...code.matchAll(route)].length !== 1 || code.includes("IndexusB1TasksPage"))
    throw Error("B1_ORIGINAL_TASK_ROUTE_CHANGED");
  return code.replace(route, '<Route path="/tasks" component={IndexusB1TasksPage} />') +
    '\nconst IndexusB1TasksPage = lazy(() => import("@/pages/tasks"));\n';
}
