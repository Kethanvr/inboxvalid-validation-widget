const STYLE_ID = "inboxvalid-widget-styles";

const WIDGET_STYLES = `
.iv-feedback {
  --iv-ink: #17213f;
  --iv-muted: #667085;
  display: block;
  min-height: 1.35rem;
  margin-top: 0.5rem;
  color: var(--iv-muted);
  font: 500 0.78rem/1.45 Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
.iv-feedback__summary { display: flex; align-items: flex-start; gap: 0.45rem; }
.iv-feedback__icon {
  display: inline-grid;
  flex: 0 0 1.05rem;
  width: 1.05rem;
  height: 1.05rem;
  margin-top: 0.03rem;
  place-items: center;
  border-radius: 999px;
  border: 1px solid currentColor;
  font-size: 0.65rem;
  font-weight: 800;
}
.iv-feedback[data-state="idle"] { color: #7c8499; }
.iv-feedback[data-state="checking"] { color: #5f50d6; }
.iv-feedback[data-state="checking"] .iv-feedback__icon { animation: iv-spin 0.8s linear infinite; border-right-color: transparent; }
.iv-feedback[data-state="valid"] { color: #087a55; }
.iv-feedback[data-state="invalid"],
.iv-feedback[data-state="disposable"] { color: #c93756; }
.iv-feedback[data-state="unknown"] { color: #9a6700; }
.iv-feedback__suggestion {
  margin: 0 0 0 0.2rem;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  font-weight: 750;
  text-decoration: underline;
  text-underline-offset: 0.16em;
  cursor: pointer;
}
.iv-feedback__checks {
  display: grid;
  gap: 0.35rem;
  margin: 0.65rem 0 0;
  padding: 0.65rem 0 0;
  border-top: 1px solid #e6e8ef;
  color: var(--iv-ink);
  list-style: none;
}
.iv-feedback__checks li { display: flex; align-items: center; gap: 0.45rem; }
.iv-feedback__checks li > span {
  display: inline-grid;
  flex: 0 0 1rem;
  width: 1rem;
  height: 1rem;
  place-items: center;
  border-radius: 999px;
  background: #edf0f5;
  font-size: 0.64rem;
  font-weight: 850;
}
.iv-feedback__checks li[data-state="pass"] > span { background: #e7f8f1; color: #087a55; }
.iv-feedback__checks li[data-state="fail"] > span { background: #fff0f3; color: #c93756; }
.iv-feedback__checks li[data-state="unknown"] > span { background: #fff8df; color: #9a6700; }
@keyframes iv-spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) {
  .iv-feedback[data-state="checking"] .iv-feedback__icon { animation: none; }
}
`;

export function injectStyles(): void {
  if (typeof document === "undefined" || document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = WIDGET_STYLES;
  document.head.append(style);
}
