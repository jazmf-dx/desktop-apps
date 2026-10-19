/**
 * A PostCSS plugin that closes a stylesheet inside one element, so it can sit
 * on somebody else's page (the npm package, ADR-0005). It runs on what
 * Tailwind and pdf.js's viewer CSS produce:
 *
 * - every selector goes under `.pdf-one`: `button` → `.pdf-one button`;
 *   `:root`, `:host`, `html` and `body` become the element itself; `*` and the
 *   bare pseudo-elements (`::before`) become the element and its descendants;
 *   a selector that already starts with `.pdf-one` stays as it is
 * - `@keyframes` names get a prefix (`fade-in` → `pdf-one-fade-in`), and the
 *   `animation` declarations and `--animate-*` theme variables that name
 *   them follow: keyframes are global, a page could have a `fade-in` of its own
 * - rem becomes `calc(N * var(--pdf-one-rem))`: the page's root font size is
 *   not ours (a `62.5%` would shrink the app, and 文字を大きく would have to
 *   change the page's). The variable is set in src/web.css
 * - the `@layer`s are taken apart (`flattenLayers`): rules in a layer lose to
 *   every rule outside one, and a page has plenty (`button { … }`); under
 *   `.pdf-one` ours win against such element rules, and nothing changes
 *   among ours, since what was in a layer still comes first
 * - `@property`, `@font-face` stay outside
 *
 * It then checks its own work and throws if a rule is left that reaches
 * outside `.pdf-one`. Rules nested in another rule (CSS nesting) follow
 * their parent.
 */
import type { AtRule, ChildNode, Plugin, Rule } from "postcss";

export interface ScopeOptions {
  /** The class everything is put under, with the dot. */
  scope: string;
  /** Put before every @keyframes name. */
  keyframesPrefix: string;
  /** The custom property rem is multiplied by. */
  remVar: string;
  /**
   * Take the rules out of their `@layer`s, in the order the layers had, and
   * put what was not in a layer after them (as the cascade ranks them, for
   * rules of the same specificity).
   */
  flattenLayers?: boolean;
}

/** The first compound selector (`div.a[b="c d"]:not(.e)`) and what follows it. */
function splitFirst(sel: string): [string, string] {
  let depth = 0;
  for (let i = 0; i < sel.length; i++) {
    const c = sel[i];
    if (c === "\\") i++;
    else if (c === "(" || c === "[") depth++;
    else if (c === ")" || c === "]") depth--;
    else if (depth === 0 && /[\s>+~]/.test(c)) return [sel.slice(0, i), sel.slice(i)];
  }
  return [sel, ""];
}

export function scopeSelector(selector: string, scope: string): string[] {
  const sel = selector.trim();
  if (sel.startsWith(scope) || sel.startsWith(`:where(${scope}`)) return [sel];
  const [head, rest] = splitFirst(sel);
  // The page's own roots are the element itself.
  const root = /^(?::root|:host|html|body)(?![\w(-])/.exec(head);
  if (root) return [scope + head.slice(root[0].length) + rest];
  // Everything, and pseudo-elements of everything: the element too, then its descendants.
  if (head.startsWith("*")) return [scope + head.slice(1) + rest, `${scope} ${sel}`];
  if (head.startsWith("::")) return [scope + head + rest, `${scope} ${sel}`];
  return [`${scope} ${sel}`];
}

const insideRule = (node: { parent?: { type: string } | undefined }) => {
  for (let p = node.parent as { type: string; name?: string; parent?: unknown } | undefined; p; p = p.parent as typeof p) {
    if (p.type === "rule") return true;
    if (p.type === "atrule" && /keyframes$/.test(p.name ?? "")) return true;
  }
  return false;
};

const ANIMATION_PROP = /^(?:-webkit-)?animation(?:-name)?$|^--/;

export default function scopeCss(options: ScopeOptions): Plugin {
  const { scope, keyframesPrefix, remVar, flattenLayers } = options;
  // Skips url(…) and strings, which may hold anything.
  const REM = /url\([^)]*\)|"[^"]*"|'[^']*'|(?<![\w.-])(-?(?:\d*\.)?\d+)rem(?![\w-])/g;
  return {
    postcssPlugin: "pdf-one-scope",
    Once(root) {
      // @keyframes names.
      const renamed = new Map<string, string>();
      root.walkAtRules(/keyframes$/, (at: AtRule) => {
        if (at.params.startsWith(keyframesPrefix)) return;
        renamed.set(at.params, keyframesPrefix + at.params);
        at.params = keyframesPrefix + at.params;
      });

      root.walkDecls((decl) => {
        if (renamed.size && ANIMATION_PROP.test(decl.prop)) {
          for (const [from, to] of renamed) {
            decl.value = decl.value.replace(new RegExp(`(?<![\\w-])${from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\w-])`, "g"), to);
          }
        }
        if (decl.value.includes("rem")) {
          decl.value = decl.value.replace(REM, (m, n?: string) => (n === undefined ? m : `calc(${n} * var(${remVar}))`));
        }
      });

      // Selectors.
      root.walkRules((rule: Rule) => {
        if (insideRule(rule)) return;
        const out = new Set(rule.selectors.flatMap((s) => scopeSelector(s, scope)));
        rule.selectors = [...out];
      });

      if (flattenLayers) {
        const layered: ChildNode[] = [];
        const rest: ChildNode[] = [];
        root.each((node) => {
          if (node.type === "atrule" && node.name === "layer") {
            // `@layer a, b;` only names them.
            if (node.nodes) layered.push(...node.nodes);
          } else {
            rest.push(node);
          }
        });
        root.removeAll();
        root.append(...layered, ...rest);
      }

      // Nothing may be left outside.
      root.walkRules((rule: Rule) => {
        if (insideRule(rule)) return;
        for (const s of rule.selectors) {
          if (!s.startsWith(scope) && !s.startsWith(`:where(${scope}`)) throw rule.error(`selector outside ${scope}: ${s}`);
        }
      });
    },
  };
}
scopeCss.postcss = true;
