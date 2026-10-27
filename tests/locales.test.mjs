import assert from "node:assert/strict";
import { test } from "node:test";
import { LOCALE_DICTS } from "../dist/ui/translations.js";
import { LOCALES } from "../dist/ui/locales/registry.js";
import manifest from "../dist/manifest.js";
import { readFileSync } from "node:fs";

test("every registered non-English locale has nonempty keys and translations", () => {
  for (const { code } of LOCALES) {
    if (code === "en") continue;
    const dict = LOCALE_DICTS[code];
    assert.ok(dict, `missing dictionary: ${code}`);
    for (const [key, value] of Object.entries(dict)) {
      assert.ok(key.trim(), `empty key in ${code}`);
      assert.ok(value.trim(), `empty translation for ${code}:${key}`);
      assert.equal((key.match(/\{count\}/g) ?? []).length, (value.match(/\{count\}/g) ?? []).length,
        `numeric placeholder mismatch: ${code}:${key}`);
    }
  }
});

test("the manifest and npm package identify the same release", () => {
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  assert.equal(manifest.version, pkg.version);
});
