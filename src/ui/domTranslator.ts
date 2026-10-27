/** Translate known UI strings without changing React's DOM structure. */
const TRANSLATABLE_ATTRIBUTES = [
  "title", "placeholder", "aria-label", "aria-description", "aria-valuetext", "alt",
] as const;

// Paperclip renders task descriptions, comments and documents in .paperclip-markdown.
// Neither those contents nor editable text, code, or explicit opt-outs are UI labels.
const PROTECTED_CONTENT = [
  "script", "style", "noscript", "template", "pre", "code", "kbd", "samp",
  "svg", "math", '[translate="no"]', ".notranslate",
  '[contenteditable]:not([contenteditable="false"])', ".paperclip-markdown",
].join(",");

function normalize(value: string): string {
  return value.trim().replace(/\s+/g, " ").replace(/…/g, "...");
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Numeric templates are opt-in dictionary entries such as "{count} tasks".
 * Match the entire label; never substitute arbitrary words in user content.
 */
function createTranslator(dict: Record<string, string>): (value: string) => string {
  const normalized = new Map<string, string>();
  const ambiguous = new Set<string>();
  const templates: Array<{ pattern: RegExp; translation: string }> = [];

  for (const [key, translation] of Object.entries(dict)) {
    const parts = normalize(key).split("{count}");
    if (parts.length === 2 && translation.includes("{count}")) {
      templates.push({
        pattern: new RegExp(`^${escapeRegex(parts[0])}(\\d{1,3}(?:,\\d{3})+|\\d+)${escapeRegex(parts[1])}$`),
        translation,
      });
    } else {
      const label = normalize(key);
      if (normalized.has(label) && normalized.get(label) !== translation) ambiguous.add(label);
      normalized.set(label, translation);
    }
  }

  return (value) => {
    const trimmed = value.trim();
    if (!trimmed) return value;
    const label = normalize(trimmed);
    let translated = Object.hasOwn(dict, trimmed) ? dict[trimmed] : undefined;
    if (translated === undefined && !ambiguous.has(label)) translated = normalized.get(label);
    if (translated === undefined) {
      for (const { pattern, translation } of templates) {
        const match = pattern.exec(label);
        if (match) {
          translated = translation.replaceAll("{count}", match[1]);
          break;
        }
      }
    }
    if (translated === undefined || translated === trimmed) return value;
    const start = value.indexOf(trimmed);
    return value.slice(0, start) + translated + value.slice(start + trimmed.length);
  };
}

/**
 * Translate the current page and subsequent text/attribute updates. Remember our
 * writes so observing characterData cannot translate our own output repeatedly.
 * No nodes are replaced: React retains ownership of its text nodes and controls.
 */
export function startTranslation(dict: Record<string, string>): () => void {
  const translate = createTranslator(dict);
  const writtenText = new WeakMap<Text, string>();
  const writtenAttributes = new WeakMap<Element, Map<string, string>>();

  function translateText(node: Text): void {
    if (node.parentElement?.closest(`${PROTECTED_CONTENT},textarea`)) return;
    if (writtenText.get(node) === node.data) return;
    const translated = translate(node.data);
    if (translated === node.data) return;
    writtenText.set(node, translated);
    node.data = translated;
  }

  function translateAttribute(element: Element, name: string): void {
    if (element.closest(PROTECTED_CONTENT)) return;
    const original = element.getAttribute(name);
    if (original === null) {
      writtenAttributes.get(element)?.delete(name);
      return;
    }
    if (writtenAttributes.get(element)?.get(name) === original) return;
    const translated = translate(original);
    if (translated === original) return;
    let values = writtenAttributes.get(element);
    if (!values) {
      values = new Map();
      writtenAttributes.set(element, values);
    }
    values.set(name, translated);
    element.setAttribute(name, translated);
  }

  function translateNode(node: Node): void {
    if (node.nodeType === Node.TEXT_NODE) {
      translateText(node as Text);
      return;
    }
    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as Element;
      if (element.closest(PROTECTED_CONTENT)) return;
      for (const name of TRANSLATABLE_ATTRIBUTES) translateAttribute(element, name);
      // Translate a textarea's placeholder, never its child text/default value.
      if (element.matches("textarea")) return;
    }
    for (const child of Array.from(node.childNodes)) translateNode(child);
  }

  translateNode(document.body);

  const observer = new MutationObserver((mutations) => {
    const added = new Set<Node>();
    for (const mutation of mutations) {
      if (!document.body.contains(mutation.target)) continue;
      if (mutation.type === "childList") {
        for (const node of Array.from(mutation.addedNodes)) added.add(node);
      } else if (mutation.type === "characterData") {
        translateText(mutation.target as Text);
      } else if (mutation.type === "attributes" && mutation.attributeName) {
        translateAttribute(mutation.target as Element, mutation.attributeName);
      }
    }
    for (const node of added) {
      if (document.body.contains(node)) translateNode(node);
    }
  });

  observer.observe(document.body, {
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: [...TRANSLATABLE_ATTRIBUTES],
    subtree: true,
  });

  return () => observer.disconnect();
}
