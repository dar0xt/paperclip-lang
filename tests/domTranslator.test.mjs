import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { JSDOM } from "jsdom";
import React from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { startTranslation } from "../dist/ui/domTranslator.js";
import { ja } from "../dist/ui/locales/ja.js";

let dom;
let cleanups;
const globals = ["window", "document", "Node", "HTMLElement", "MutationObserver"];
const originals = new Map(globals.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const start = (dict = ja) => {
  const stop = startTranslation(dict);
  cleanups.push(stop);
  return stop;
};

beforeEach(() => {
  dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
  for (const key of globals) Object.defineProperty(globalThis, key, { configurable: true, value: dom.window[key] });
  cleanups = [];
});

afterEach(() => {
  for (const stop of cleanups) stop();
  dom.window.close();
  for (const key of globals) {
    const descriptor = originals.get(key);
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else delete globalThis[key];
  }
});

test("translates nested labels in place and preserves whitespace and unknown text", () => {
  document.body.innerHTML = '<button>\n  Save  </button><p>Save the report</p><span><b>Tasks</b></span>';
  const text = document.querySelector("button").firstChild;
  start();
  assert.equal(document.querySelector("button").firstChild, text);
  assert.equal(text.data, "\n  保存  ");
  assert.equal(document.querySelector("p").textContent, "Save the report");
  assert.equal(document.querySelector("b").textContent, "タスク");
});

test("normalizes wrapping whitespace and ellipses without case-folding all labels", () => {
  document.body.innerHTML = '<p>  Loading… </p><p>First\n  second</p><p>SAVE</p>';
  start({ "Loading...": "読み込み中...", "First second": "文章", Save: "保存" });
  assert.deepEqual([...document.querySelectorAll("p")].map((p) => p.textContent), ["  読み込み中... ", "文章", "SAVE"]);
});

test("prefers exact keys and avoids ambiguous normalized matches", () => {
  document.body.innerHTML = '<p>A B</p><p>A  B</p><p>A\nB</p>';
  start({ "A B": "one", "A  B": "two" });
  assert.deepEqual([...document.querySelectorAll("p")].map((p) => p.textContent), ["one", "two", "A\nB"]);
});

test("matches only explicitly listed whole-label numeric templates", () => {
  document.body.innerHTML = '<p>1 task</p><p>1,234 tasks</p><p>+4 more tasks</p><p>My 4 tasks</p><p>important tasks</p><p>12,34 tasks</p>';
  start();
  assert.deepEqual([...document.querySelectorAll("p")].map((p) => p.textContent), [
    "1件のタスク", "1,234件のタスク", "ほか4件のタスク", "My 4 tasks", "important tasks", "12,34 tasks",
  ]);
});

test("escapes regex punctuation in numeric templates and preserves literal dollar signs", () => {
  document.body.innerHTML = '<p>Jobs ({count})</p><p>Jobs (3)</p><p>Jobs X3X</p><p>Save</p>';
  start({ "Jobs ({count})": "${count}", Save: "$&" });
  assert.deepEqual([...document.querySelectorAll("p")].map((p) => p.textContent), ["${count}", "$3", "Jobs X3X", "$&"]);
});

test("translates added nodes, portals and direct characterData updates", async () => {
  document.body.innerHTML = '<span>Running</span><div id="portal"></div>';
  start();
  const text = document.querySelector("span").firstChild;
  text.data = "Paused";
  document.querySelector("#portal").innerHTML = '<button title="Save">Save</button>';
  await settle();
  assert.equal(text.data, "一時停止中");
  assert.equal(document.querySelector("button").textContent, "保存");
  assert.equal(document.querySelector("button").title, "保存");
  text.data = "Running";
  await settle();
  assert.equal(text.data, "実行中");
});

test("translates accessibility labels and hints, never values or machine attributes", async () => {
  document.body.innerHTML = '<input id="Save" name="Save" value="Save" placeholder="Search tasks..." title="Save" aria-label="Task title" aria-description="Optional" aria-valuetext="Running"><img alt="Home"><a href="/Save" data-key="Save">Home</a>';
  start();
  const input = document.querySelector("input");
  assert.equal(input.placeholder, "タスクを検索...");
  assert.equal(input.title, "保存");
  assert.equal(input.getAttribute("aria-label"), "タスクのタイトル");
  assert.equal(input.getAttribute("aria-description"), "任意");
  assert.equal(input.getAttribute("aria-valuetext"), "実行中");
  assert.equal(document.querySelector("img").alt, "ホーム");
  assert.equal(input.value, "Save");
  assert.equal(input.getAttribute("value"), "Save");
  assert.equal(input.id, "Save");
  assert.equal(input.name, "Save");
  assert.equal(document.querySelector("a").getAttribute("href"), "/Save");
  assert.equal(document.querySelector("a").dataset.key, "Save");
  input.setAttribute("title", "Cancel");
  input.setAttribute("aria-valuetext", "Paused");
  await settle();
  assert.equal(input.title, "キャンセル");
  assert.equal(input.getAttribute("aria-valuetext"), "一時停止中");
  input.removeAttribute("title");
  await settle();
  assert.equal(input.hasAttribute("title"), false);
});

test("protects textarea values but translates their hints, including subsequent changes", async () => {
  document.body.innerHTML = '<textarea placeholder="Task title" aria-label="Task title">Save</textarea>';
  const area = document.querySelector("textarea");
  start();
  assert.equal(area.value, "Save");
  assert.equal(area.defaultValue, "Save");
  assert.equal(area.placeholder, "タスクのタイトル");
  area.firstChild.data = "Running";
  area.placeholder = "Search tasks...";
  await settle();
  assert.equal(area.value, "Running");
  assert.equal(area.defaultValue, "Running");
  assert.equal(area.placeholder, "タスクを検索...");
});

test("skips code, Markdown, editable regions and explicit translation opt-outs", async () => {
  const wrappers = [
    '<pre title="Save"><span>Save</span></pre>', '<code>Save</code>', '<kbd>Save</kbd>',
    '<samp>Save</samp>', '<script type="application/json">Save</script>', '<style>Save</style>',
    '<div contenteditable="">Save</div>', '<div contenteditable="plaintext-only">Save</div>',
    '<div contenteditable="true"><span title="Save">Save</span></div>',
    '<div translate="no"><span title="Save">Save</span><textarea placeholder="Save">Save</textarea></div>',
    '<div class="notranslate">Save</div>', '<div class="paperclip-markdown"><p title="Save">Save</p></div>',
    '<svg><text>Save</text></svg>', '<math><mi>Save</mi></math>', '<template><p>Save</p></template>',
  ];
  document.body.innerHTML = wrappers.join("");
  const original = document.body.innerHTML;
  start();
  assert.equal(document.body.innerHTML, original);
  document.querySelector(".paperclip-markdown p").firstChild.data = "Running";
  document.querySelector(".paperclip-markdown p").title = "Running";
  await settle();
  assert.equal(document.querySelector(".paperclip-markdown p").textContent, "Running");
  assert.equal(document.querySelector(".paperclip-markdown p").title, "Running");
});

test("honors opt-outs on the textarea itself and allows noneditable UI text", () => {
  document.body.innerHTML = '<textarea translate="no" placeholder="Save">Save</textarea><div contenteditable="false">Save</div>';
  start();
  assert.equal(document.querySelector("textarea").placeholder, "Save");
  assert.equal(document.querySelector("textarea").value, "Save");
  assert.equal(document.querySelector("div").textContent, "保存");
});

test("does not use inherited dictionary properties as translations", () => {
  document.body.innerHTML = '<p>constructor</p><p>toString</p><p>__proto__</p>';
  start({ Save: "保存" });
  assert.deepEqual([...document.querySelectorAll("p")].map((p) => p.textContent), ["constructor", "toString", "__proto__"]);
});

test("own text and attribute writes neither cascade nor cause observer loops", async () => {
  document.body.innerHTML = '<span title="A">A</span>';
  const stop = start({ A: "B", B: "A" });
  let count = 0;
  const monitor = new MutationObserver((records) => {
    count += records.length;
    if (count > 10) stop(); // Bound failures even if a regression causes a microtask loop.
  });
  monitor.observe(document.body, { subtree: true, characterData: true, attributes: true });
  document.querySelector("span").firstChild.data = "A";
  document.querySelector("span").title = "A";
  await settle();
  monitor.disconnect();
  assert.ok(count <= 4, `unexpected translation loop: ${count} writes`);
  assert.equal(document.querySelector("span").textContent, "B");
  assert.equal(document.querySelector("span").title, "B");
});

test("ignores removed nodes and stops translating after cleanup", async () => {
  document.body.innerHTML = '<div><span>Save</span></div>';
  const stop = start();
  const removed = document.querySelector("div");
  removed.remove();
  removed.querySelector("span").firstChild.data = "Cancel";
  await settle();
  assert.equal(removed.textContent, "Cancel");
  stop();
  document.body.innerHTML = '<button title="Save">Save</button>';
  await settle();
  assert.equal(document.querySelector("button").textContent, "Save");
  assert.equal(document.querySelector("button").title, "Save");
});

test("React can repeatedly update, handle events and unmount translated mixed content", async () => {
  document.body.innerHTML = '<div id="root"></div>';
  const root = createRoot(document.querySelector("#root"));
  let clicks = 0;
  const render = (status, count, showButton = true) => flushSync(() => root.render(
    React.createElement("div", null,
      React.createElement("span", { id: "status" }, status),
      showButton && React.createElement("button", {
        onClick: () => { clicks++; }, title: "Save",
      }, "Save", React.createElement("strong", null, count)),
      React.createElement("input", { value: "Save", readOnly: true, placeholder: "Task title" }),
    ),
  ));
  render("Running", 1);
  const text = document.querySelector("button").firstChild;
  start();
  for (let i = 0; i < 12; i++) {
    render(i % 2 ? "Running" : "Paused", i);
    await settle();
    assert.equal(document.querySelector("#status").textContent, i % 2 ? "実行中" : "一時停止中");
    assert.equal(document.querySelector("button").firstChild, text);
    assert.equal(document.querySelector("button").firstChild.data, "保存");
    assert.equal(document.querySelector("strong").textContent, String(i));
    document.querySelector("button").click();
    assert.equal(document.querySelector("input").value, "Save");
  }
  assert.equal(clicks, 12);
  render("Running", 0, false);
  await settle();
  assert.equal(document.querySelector("button"), null);
  assert.doesNotThrow(() => flushSync(() => root.unmount()));
  await settle();
});
