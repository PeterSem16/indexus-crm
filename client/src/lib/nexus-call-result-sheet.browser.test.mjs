import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import ts from "typescript";
import { chromium } from "@playwright/test";

// Extract the exact production JSX and module helpers. Only the owning
// component's state/API boundary is replaced; no auth bypass is shipped.
const originalPath = path.resolve("client/src/pages/agent-workspace.tsx");
let source = fs.readFileSync(originalPath, "utf8");
let ast = ts.createSourceFile(originalPath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const relativeImports = ast.statements.filter(ts.isImportDeclaration)
  .filter(n => n.moduleSpecifier.text.startsWith("."))
  .map(n => ({ start: n.moduleSpecifier.getStart(ast) + 1, end: n.moduleSpecifier.end - 1,
    value: `/@fs/${path.resolve(path.dirname(originalPath), n.moduleSpecifier.text)}` }));
for (const edit of relativeImports.reverse()) source = source.slice(0, edit.start) + edit.value + source.slice(edit.end);
ast = ts.createSourceFile(originalPath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const owner = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === "AgentWorkspacePageContent");
let drawer;
function find(node) {
  if (ts.isJsxElement(node) && node.openingElement.tagName.getText(ast) === "Sheet" &&
    node.openingElement.attributes.properties.some(p => p.name?.getText(ast) === "open" &&
      p.initializer?.getText(ast) === "{dispositionModalOpen}")) drawer = node;
  ts.forEachChild(node, find);
}
find(owner);
assert.ok(drawer, "extract the real production call-result Sheet");
const jsx = drawer.getText(ast);
const output = path.resolve("generated-artifacts/nexus-call-result-preview");
fs.mkdirSync(output, { recursive: true });
const harness = `{
  const {t,locale}=useI18n();
  const user={id:"fixture-agent",fullName:"Ukážkový agent"};
  const currentContact={id:"fixture-contact",firstName:"Ukážkový",lastName:"kontakt",phone:"+421900000000",email:"preview@example.invalid"};
  const callContext={callInfo:{phoneNumber:currentContact.phone}};
  const inboundPhone=currentContact.phone;
  const mandatoryDisposition=new URLSearchParams(location.search).get("mandatory")==="1";
  const [dispositionModalOpen,setDispositionModalOpen]=useState(true);
  const [dispositionOpenedAt,setDispositionOpenedAt]=useState(null);
  const [dispositionChannelFilter,setDispositionChannelFilter]=useState("phone");
  const [modalSelectedParent,setModalSelectedParent]=useState(null);
  const [checklistParentId,setChecklistParentId]=useState(null);
  const [checklistSelectedCodes,setChecklistSelectedCodes]=useState([]);
  const [modalCallbackDate,setModalCallbackDate]=useState("");
  const [modalCallbackTime,setModalCallbackTime]=useState("09:00");
  const [modalCallbackNote,setModalCallbackNote]=useState("");
  const [modalCallbackAssign,setModalCallbackAssign]=useState("me");
  const [checklistCallbackDate,setChecklistCallbackDate]=useState("");
  const [checklistCallbackTime,setChecklistCallbackTime]=useState("09:00");
  const [checklistCallbackAssign,setChecklistCallbackAssign]=useState("me");
  const [callNotes,setCallNotes]=useState("");
  const [multiSelectMode,setMultiSelectMode]=useState(false);
  const [multiSelectedCodes,setMultiSelectedCodes]=useState([]);
  const [activeDispCategory,setActiveDispCategory]=useState("__all__");
  const [isNonMissionInboundDisposition,setIsNonMissionInboundDisposition]=useState(false);
  const dispositionCategories=[];
  const rows=[
    ["interested","Záujem","green","none"],["callback","Zavolať neskôr","blue","callback"],
    ["not-interested","Bez záujmu","orange","complete"],["no-answer","Nedvíha","gray","none"],
    ["busy","Obsadené","yellow","none"],["voicemail","Odkazová schránka","purple","none"],
    ["wrong-number","Nesprávne číslo","red","none"],["dnd","Nevolať","red","dnd"],
  ];
  const campaignDispositions=rows.map(([id,name,color,actionType],sortOrder)=>({
    id,code:id,name,color,actionType,sortOrder,isActive:true,parentId:null,
    requiresNote:id==="wrong-number",requiresCallback:id==="callback",callbackOffsetDays:1,
  })).concat([
    {id:"interested-a",code:"interested-a",name:"Záujem potvrdený",color:"green",actionType:"none",parentId:"interested",isActive:true},
    {id:"interested-b",code:"interested-b",name:"Poslať informácie",color:"blue",actionType:"none",parentId:"interested",isActive:true},
  ]);
  const getDispName=disp=>disp.name;
  const dispChannelAllowed=()=>true;
  const handleDisposition=(...args)=>{window.__resultWrites.push(args);setDispositionModalOpen(false)};
  const toast=message=>window.__resultToasts.push(message);
  useEffect(()=>{window.__resultWrites=[];window.__resultToasts=[]},[]);
  return (${jsx});
}`;
fs.writeFileSync(path.join(output, "fixture.tsx"),
  source.slice(0, owner.body.getStart(ast)) + harness + source.slice(owner.body.end) +
  "\nexport {AgentWorkspacePageContent as ResultFixture};\n");
const fixtureUrl = `/@fs/${output}/fixture.tsx`;
fs.writeFileSync(path.join(output, "index.html"), `<!doctype html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/src/index.css">
</head><body><div id="fixture-root"></div><script type="module">
const params=new URLSearchParams(location.search);
document.documentElement.classList.toggle("dark",params.get("theme")==="dark");
const refresh=await import("/@react-refresh");refresh.injectIntoGlobalHook(window);
window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;
const source=await fetch("/src/pages/agent-workspace.tsx").then(r=>r.text());
const entry=await fetch("/src/main.tsx").then(r=>r.text());
const rm=await import(source.match(/from\\s*["']([^"']*\\/react\\.js[^"']*)["']/)[1]);
const React=rm.default||rm;
const dom=await import(entry.match(/from\\s*["']([^"']*react-dom_client[^"']*)["']/)[1]);
const query=await import(source.match(/from\\s*["']([^"']*react-query[^"']*)["']/)[1]);
const {I18nProvider}=await import("/src/i18n/I18nProvider.tsx");
const {TooltipProvider}=await import("/src/components/ui/tooltip.tsx");
const {ResultFixture}=await import(${JSON.stringify(fixtureUrl)});
const client=new query.QueryClient({defaultOptions:{queries:{retry:false}}});
(dom.createRoot||dom.default.createRoot)(document.getElementById("fixture-root")).render(
React.createElement(query.QueryClientProvider,{client},React.createElement(I18nProvider,{userCountries:["SK"]},
React.createElement(TooltipProvider,null,React.createElement(ResultFixture)))));
</script></body></html>`);

const base = process.env.STATUS_LIST_TEST_URL || `https://${process.env.REPLIT_DEV_DOMAIN}`;
const url = `${base}/@fs/${output}/index.html`;
console.log("Preview:", url);
const browser = await chromium.launch({ executablePath: "/repl/tools/bin/chromium", headless: true, args: ["--no-sandbox"] });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.route("**/api/**", route => route.fulfill({ json: [] }));
  async function open(suffix = "") {
    await page.goto(url + suffix);
    await page.getByTestId("call-result-sheet").waitFor({ timeout: 60000 });
    await page.getByTestId("pulse-status-callback").waitFor();
    await page.waitForTimeout(350);
    assert.equal(errors.length, 0, errors.join("\n"));
  }
  const bounds = async () => {
    const rect = await page.getByTestId("call-result-sheet").boundingBox();
    const viewport = page.viewportSize();
    assert.ok(rect.x >= -1 && rect.y >= -1 && rect.x + rect.width <= viewport.width + 1, JSON.stringify(rect));
    assert.ok(rect.y + rect.height <= viewport.height + 1, JSON.stringify(rect));
    assert.ok(await page.getByTestId("input-disp-notes").isVisible());
    return rect;
  };
  await open();
  const copyKeys = [...jsx.matchAll(/t\.(agentWorkspace|nexusPulse)\.([A-Za-z0-9_]+)/g)]
    .map(match => [match[1], match[2]]);
  const missingCopy = await page.evaluate(async keys => {
    const { translations } = await import("/src/i18n/translations.ts");
    return ["en", "sk", "cs", "hu", "ro", "it", "de"].flatMap(locale =>
      keys.filter(([group, key]) => typeof translations[locale][group][key] !== "string")
        .map(([group, key]) => `${locale}.${group}.${key}`));
  }, copyKeys);
  assert.deepEqual(missingCopy, [], "drawer labels exist in every supported language");
  const desktop = await bounds();
  assert.ok(desktop.height < 700, "no full-height empty drawer");
  assert.match(await page.locator('label[for="disp-notes"]').innerText(), /Poznámka/);
  await page.screenshot({ path: path.join(output, "desktop.jpg") });
  await page.keyboard.press("Escape");
  await page.getByTestId("call-result-sheet").waitFor({ state: "hidden" });
  assert.equal(await page.evaluate(() => window.__resultWrites.length), 0);
  await open();
  await page.getByTestId("pulse-status-no-answer").click();
  assert.equal(await page.evaluate(() => window.__resultWrites[0][0]), "no-answer");
  await open();
  await page.getByTestId("pulse-status-interested").click();
  await page.getByTestId("btn-checklist-back").waitFor();
  assert.equal(await page.evaluate(() => window.__resultWrites.length), 0);
  await page.getByTestId("checklist-item-interested-a").click();
  await page.getByTestId("btn-checklist-confirm").click();
  assert.deepEqual(await page.evaluate(() => window.__resultWrites[0].at(-1)), ["interested-a"]);
  await open();
  await page.getByTestId("pulse-status-wrong-number").click();
  assert.ok(await page.getByTestId("btn-modal-disposition-confirm-simple").isDisabled());
  await page.getByTestId("input-disp-notes").fill("Ukážková povinná poznámka");
  await page.getByTestId("btn-modal-disposition-confirm-simple").click();
  assert.equal(await page.evaluate(() => window.__resultWrites[0][0]), "wrong-number");
  await open();
  await page.getByTestId("pulse-status-callback").click();
  await page.getByTestId("input-modal-callback-datetime").waitFor();
  assert.equal(await page.evaluate(() => window.__resultWrites.length), 0);
  await page.getByTestId("btn-cb-preset-2").click();
  await page.getByTestId("input-modal-callback-note").fill("Ukážková poznámka");
  await page.getByTestId("btn-modal-disposition-confirm-callback").click();
  const callback = await page.evaluate(() => window.__resultWrites[0]);
  assert.equal(callback[0], "callback");
  assert.match(callback[2], /^\d{4}-\d{2}-\d{2}T09:00$/);
  assert.equal(callback[4], "Ukážková poznámka");
  await open("?mandatory=1");
  await page.keyboard.press("Escape");
  assert.ok(await page.getByTestId("call-result-sheet").isVisible(), "mandatory result cannot be dismissed");
  await page.setViewportSize({ width: 1280, height: 650 });
  await open("?theme=dark");
  await bounds();
  const cardColor = await page.getByTestId("pulse-status-callback").evaluate(n => getComputedStyle(n).backgroundColor);
  assert.notEqual(cardColor, "rgb(255, 255, 255)", "dark cards must not retain inline white backgrounds");
  const labelColor = await page.getByTestId("pulse-status-callback").locator(".text-sm").first()
    .evaluate(n => getComputedStyle(n).color);
  assert.equal(labelColor, "rgb(229, 237, 243)", "dark labels remain legible despite inline legacy colors");
  await page.screenshot({ path: path.join(output, "dark.jpg") });
  await page.setViewportSize({ width: 390, height: 740 });
  await open();
  await bounds();
  await page.screenshot({ path: path.join(output, "mobile.jpg") });
  assert.equal(errors.length, 0, errors.join("\n"));
  console.log("PASS: extracted production drawer: compact bounds, light/dark/mobile, cancel, direct status, children, callback date/note and mandatory guard");
} finally {
  await browser.close();
}
