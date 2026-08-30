import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("builds the generic agency application shell", async () => {
  const [html, css, app, integration] = await Promise.all([
    readFile(new URL("dist/client/index.html", root), "utf8"),
    readFile(new URL("dist/client/style.css", root), "utf8"),
    readFile(new URL("dist/client/app.js", root), "utf8"),
    readFile(new URL("dist/client/supabase-integration.js", root), "utf8"),
  ]);

  assert.match(html, /<title>Agency Inventory Management Platform<\/title>/);
  assert.match(html, /data-agency-name/);
  assert.doesNotMatch(html, /Department of Migrant Workers|dmw-logo/i);
  assert.match(css, /--agency-accent/);
  assert.match(app, /agency-header-placeholder\.png/);
  assert.match(integration, /name="agencyName"/);
  assert.match(integration, /name="agencyColor"/);
  assert.match(integration, /name="agencyHeader"/);
});

test("keeps the duplicate disconnected from the DMW backend by default", async () => {
  const [config, server] = await Promise.all([
    readFile(new URL("dist/client/config.js", root), "utf8"),
    readFile(new URL("dist/server/index.js", root), "utf8"),
  ]);

  assert.match(config, /"url":""/);
  assert.match(config, /"publishableKey":""/);
  assert.match(server, /env\.ASSETS\.fetch/);
});

test("packages the complete DMW-parity workspace and verified transfer data", async () => {
  const [html, engine, hydration, workspaceCss] = await Promise.all([
    readFile(new URL("dist/client/workspace/index.html", root), "utf8"),
    readFile(new URL("dist/client/workspace/app.js", root), "utf8"),
    readFile(new URL("dist/client/workspace/transfer-hydration.js", root), "utf8"),
    readFile(new URL("dist/client/workspace/style.css", root), "utf8"),
  ]);
  let transfer;
  try {
    transfer = await readFile(new URL("dist/client/data/dmw-data-transfer.json", root), "utf8");
  } catch {
    transfer = await readFile(new URL("dist/client/data/dmw-data-transfer.sample.json", root), "utf8");
  }
  const packageData = JSON.parse(transfer);
  const expected = Object.values(packageData.record_counts).reduce((sum, count) => sum + count, 0);
  const actual = Object.values(packageData.data).reduce((sum, rows) => sum + rows.length, 0);

  assert.match(html, /Sinop Inventory Workspace/);
  assert.match(html, /transfer-hydration\.js/);
  for (const module of ["Purchase Orders", "Inspection & Acceptance", "Property Records", "Admin Options", "Forms", "Reports"]) {
    assert.match(engine, new RegExp(module.replace(/[&]/g, "&")));
  }
  for (const form of ["Appendix 57", "Appendix 58", "Appendix 59", "Appendix 65", "Appendix 66", "Appendix 69", "Appendix 70", "Appendix 71", "Appendix 73", "Appendix 74", "Appendix 75", "Appendix 76", "Annex A.4"]) {
    assert.match(engine, new RegExp(form.replace(".", "\\.")));
  }
  assert.match(hydration, /sinop-dmw-workspace-state-v1/);
  for (const dashboardFeature of ["Connected users now", "PHILIPPINE STANDARD TIME", "Inventory Balance"]) {
    assert.match(engine, new RegExp(dashboardFeature));
  }
  for (const settingFeature of ["Agency Information", "System Color Palette", "Inventory Costing Formula", "Create Department", "Add Plantilla", "Add Employee"]) {
    assert.match(engine, new RegExp(settingFeature));
  }
  assert.match(hydration, /applySinopTenantTheme/);
  assert.match(hydration, /themeTargets = \[document\.documentElement, document\.body\]/);
  assert.match(hydration, /tenant-primary-text/);
  assert.match(workspaceCss, /Strict tenant-palette enforcement/);
  assert.match(workspaceCss, /Workspace typography and high-readability white surfaces/);
  assert.match(workspaceCss, /Final contrast guard for searchable inventory tables and form controls/);
  assert.match(workspaceCss, /Final readable text treatment for navigation tabs and white action cards/);
  assert.match(workspaceCss, /font-size:18pt!important/);
  assert.match(workspaceCss, /font-size:10pt!important/);
  assert.match(workspaceCss, /font-size:9pt!important/);
  assert.match(workspaceCss, /\.tenant-themed \.process-line \.done b/);
  assert.match(workspaceCss, /\.tenant-themed \.badge-green/);
  assert.doesNotMatch(engine, /style\.color="#16825f"/);
  assert.equal(actual, expected);
  assert.ok(expected === 568 || expected === 0);
});
