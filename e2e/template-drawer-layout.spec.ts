import {test,expect} from "@playwright/test";

test("real template drawer keeps settings readable and every type accessible across screen sizes",async({page})=>{
  test.setTimeout(90000);
  const errors:string[]=[];
  page.on("pageerror",error=>errors.push(error.message));
  await page.route("**/api/**",async route=>{
    const pathname=new URL(route.request().url()).pathname;
    const data=/\/api\/auth\/(user|me)$/.test(pathname)
      ? {id:"layout-fixture",username:"fixture",role:"admin",assignedCountries:["SK"],language:"en"}
      : pathname==="/api/automation/catalog" ? {fields:{},moduleLabels:{}}
      : [];
    await route.fulfill({contentType:"application/json",body:JSON.stringify(data)});
  });
  await page.setViewportSize({width:1440,height:1000});
  await page.goto("/test-fixtures/template-drawer-layout.html");
  await page.getByTestId("button-add-template").click();
  const drawer=page.getByTestId("template-drawer");
  await expect(drawer).toBeVisible();
  await page.getByTestId("input-template-name").fill("Zmluva o spolupráci – zaslanie návrhu spolupráce");
  for(const width of [1440,1024,390]){
    await page.setViewportSize({width,height:1000});
    const panel=page.getByTestId("template-settings-panel");
    await expect(panel).toBeVisible();
    const panelBounds=await panel.boundingBox();
    expect(panelBounds!.width).toBeGreaterThanOrEqual(350);
    const boxes=[];
    for(const type of ["email","sms","task","notification"]){
      const button=page.getByTestId(`toggle-type-${type}`);
      await expect(button).toBeVisible();
      expect(await button.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBeTruthy();
      boxes.push((await button.boundingBox())!);
    }
    expect(boxes[2].y).toBeGreaterThan(boxes[0].y);
    expect(boxes[1].x).toBeGreaterThan(boxes[0].x);
    expect(await drawer.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBeTruthy();
    await expect(page.getByTestId("button-save-template")).toBeInViewport();
    for(const type of ["sms","task","notification","email"]){
      const button=page.getByTestId(`toggle-type-${type}`);
      await button.scrollIntoViewIfNeeded();
      await button.click();
    }
    await page.getByTestId("template-editor-panel").scrollIntoViewIfNeeded();
    await expect(page.getByTestId("template-editor-panel")).toBeInViewport();
    await page.getByTestId("template-variables-panel").scrollIntoViewIfNeeded();
    await expect(page.getByTestId("template-variables-panel")).toBeInViewport();
  }
  expect(errors).toEqual([]);
});
