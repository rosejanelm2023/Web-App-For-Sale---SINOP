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
