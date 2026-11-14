// KritZaar icon helper. One sprite (/icons/ui.svg), one line style, colour follows the text (currentColor).
// Usage: el.append(icon('gamepad')) or icon('play', 18). Built with DOM calls, no innerHTML.
const NS = 'http://www.w3.org/2000/svg';
const STYLE_ID = 'kz-icons-style';
const CSS = '.kz-i{width:1.25em;height:1.25em;flex:none;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;vertical-align:-.22em;pointer-events:none}.kz-i--sm{width:1em;height:1em}';

function ensureStyle() {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
  const s = document.createElement('style'); s.id = STYLE_ID; s.textContent = CSS; document.head.append(s);
}

export function icon(name, size) {
  ensureStyle();
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'kz-i');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  if (size) { svg.setAttribute('width', String(size)); svg.setAttribute('height', String(size)); svg.style.width = size + 'px'; svg.style.height = size + 'px'; }
  const use = document.createElementNS(NS, 'use');
  use.setAttribute('href', '/icons/ui.svg#' + name);
  svg.append(use);
  return svg;
}

/** Swap the icon inside an existing .kz-i svg. */
export function setIcon(svg, name) {
  const use = svg && svg.querySelector('use');
  if (use) use.setAttribute('href', '/icons/ui.svg#' + name);
}

/** Replace a node's children with [icon, text]. */
export function iconLabel(node, name, text) {
  node.replaceChildren(icon(name), document.createTextNode(' ' + text));
  return node;
}

ensureStyle();
