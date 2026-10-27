import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { LangSwitcher } from "../../src/ui/LangSwitcher.js";
import { LangSettingsPage } from "../../src/ui/LangSettingsPage.js";
import { STORAGE_KEY } from "../../src/ui/locales/registry.js";

if (!localStorage.getItem(STORAGE_KEY)) localStorage.setItem(STORAGE_KEY, "ja");

function Preview() {
  const [running, setRunning] = useState(true);
  const [count, setCount] = useState(1);
  const [show, setShow] = useState(true);
  return <main>
    <header><div><h1>Language Pack</h1><small translate="no">LOCAL TEST FIXTURE · No server or production data</small></div><LangSwitcher /></header>
    <nav>{["Home", "Tasks", "Agents", "Routines", "Plugins", "Settings"].map(label => <span key={label}>{label}</span>)}</nav>
    <div className="grid">
      <section>
        <h2>Task details</h2>
        <p><span id="status" className="status" aria-label={running ? "Running" : "Paused"}>{running ? "Running" : "Paused"}</span></p>
        <p id="count">{`${count} ${count === 1 ? "task" : "tasks"}`}</p>
        <button onClick={() => setRunning(value => !value)}>Run now</button>
        <button onClick={() => setCount(value => value + 1)}>New Task</button>
        <button onClick={() => setShow(value => !value)}>Show properties</button>
        {show && <div>
          <label>Task title<input placeholder="Task title" aria-label="Task title" defaultValue="Save" /></label>
          <label>Description<textarea placeholder="Write something..." defaultValue="Running" /></label>
          <p><button title="Save">Save<strong translate="no"> {count}</strong></button><button>Cancel</button></p>
        </div>}
        <h2 translate="no">Protected content (must stay English)</h2>
        <pre><code>Save</code></pre>
        <div className="paperclip-markdown"><p>Running</p></div>
        <div contentEditable suppressContentEditableWarning>Task title</div>
      </section>
      <section>
        <LangSettingsPage {...({} as Parameters<typeof LangSettingsPage>[0])} />
      </section>
    </div>
  </main>;
}

createRoot(document.getElementById("root")!).render(<Preview />);
