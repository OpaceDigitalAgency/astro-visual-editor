export const toolbarStyles = String.raw`
  :host {
    color-scheme: dark;
    --ave-accent: #e94b8a;
    --ave-builder: #6c2eb9;
    --ave-builder-dark: #4f1f91;
    --ave-ink: #f4f7fa;
    --ave-muted: #b9b7c4;
    --ave-surface: #24232a;
    --ave-surface-raised: #302f38;
    --ave-surface-soft: #1c1b21;
    --ave-border: #47454f;
    --ave-focus: #f49bc0;
  }
  * { box-sizing: border-box; }
  [hidden] { display: none !important; }
  button, input, textarea, select { font: inherit; }
  button { min-width: 44px; min-height: 44px; transition: background-color .16s ease, border-color .16s ease, color .16s ease, opacity .16s ease, transform .16s ease; }
  .ave-icon { width: 19px; height: 19px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
  .workbench {
    width: min(420px, calc(100vw - 24px)); max-height: min(720px, calc(100vh - 88px));
    position: fixed; z-index: 2147483000; top: 12px; left: 12px; display: none; overflow: hidden; color: var(--ave-ink); background: var(--ave-surface);
    border: 1px solid #514d59; border-radius: 7px; box-shadow: 0 18px 55px rgba(0,0,0,.5), 0 0 0 1px rgba(255,255,255,.04);
    font: 13px/1.42 Inter, ui-sans-serif, system-ui, sans-serif;
  }
  .workbench[data-open="true"] { display: grid; grid-template-rows: auto auto auto auto minmax(0,1fr) auto; }
  .workbench[data-open="true"][data-has-selection="true"] { height: min(720px, calc(100vh - 88px)); }
  .workbench[data-open="true"][data-minimized="true"] { display: none; }
  .masthead { grid-row: 1; display: flex; align-items: center; justify-content: space-between; gap: 10px; min-height: 72px; padding: 11px 12px 10px 15px; background: linear-gradient(135deg,var(--ave-builder),var(--ave-builder-dark)); border-bottom: 1px solid rgba(255,255,255,.14); }
  .masthead-copy { min-width: 0; }
  .masthead-actions { display: flex; gap: 7px; }
  .eyebrow { margin: 0 0 3px; color: rgba(255,255,255,.72); font: 750 9px/1.2 ui-monospace, monospace; letter-spacing: .14em; text-transform: uppercase; }
  h2, h3 { margin: 0; letter-spacing: -.025em; }
  h2 { font-size: 17px; } h3 { font-size: 14px; }
  .status { display: flex; align-items: center; gap: 7px; margin: 5px 0 0; color: rgba(255,255,255,.8); font-size: 10px; }
  .status-dot { width: 8px; height: 8px; flex: 0 0 auto; border-radius: 50%; background: #6ee7a8; box-shadow: 0 0 0 4px rgba(110,231,168,.1); }
  .status[data-state="warning"] .status-dot { background: #ffd166; }
  .status[data-state="error"] .status-dot { background: #ff8585; }
  .icon-button, .utility-button { display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 0; color: #f5f2f8; background: rgba(255,255,255,.1); border: 1px solid rgba(255,255,255,.24); border-radius: 5px; cursor: pointer; }
  .editable-filter-toggle[aria-pressed="true"] { color: #14301f; background: #6ee7a8; border-color: #9ff2c4; }
  .utility-button { min-height: 44px; padding-inline: 12px; font-size: 11px; font-weight: 750; }
  .icon-button:hover, .icon-button:focus-visible, .utility-button:hover, .utility-button:focus-visible { color: white; background: rgba(255,255,255,.2); outline: 2px solid #fff; outline-offset: 2px; }
  .utility-label { display: inline; }
  .demo-context { grid-row: 2; display: flex; align-items: center; gap: 8px; padding: 6px 10px; color: #9fabB6; background: #182029; border-bottom: 1px solid var(--ave-border); font-size: 9px; font-weight: 750; letter-spacing: .08em; text-transform: uppercase; }
  .demo-context[hidden] { display: none; }
  .mode-tabs { grid-row: 3; display: grid; grid-template-columns: repeat(2,1fr); gap: 0; padding: 0; background: var(--ave-surface-soft); border-bottom: 1px solid var(--ave-border); }
  .mode-tab { position: relative; min-width: 0; min-height: 58px; display: grid; place-items: center; align-content: center; gap: 4px; padding: 6px 4px; color: #aaa7b2; background: transparent; border: 0; border-right: 1px solid #34323a; border-radius: 0; cursor: pointer; font-size: 10px; font-weight: 760; }
  .mode-tab:last-child { border-right: 0; }
  .mode-tab[aria-selected="true"] { color: #fff; background: #302e37; box-shadow: inset 0 -3px 0 var(--ave-accent); }
  .mode-tab[aria-selected="true"] .ave-icon { color: #ff82b5; }
  .mode-tab:focus-visible { outline: 2px solid var(--ave-focus); outline-offset: -3px; }
  .instructions { grid-row: 4; display: flex; align-items: center; gap: 9px; min-height: 43px; padding: 8px 12px; color: #d1cfd7; background: #292730; border-bottom: 1px solid var(--ave-border); font-size: 11px; }
  .instruction-icon { display: inline-flex; flex: 0 0 auto; color: #f071a6; }
  .instruction-icon .ave-icon { width: 16px; height: 16px; }
  .instructions-copy { min-width: 0; }
  .demo-surfaces { display: flex; flex: 1 1 auto; gap: 4px; min-width: 0; overflow-x: auto; }
  .demo-surface { min-width: max-content; min-height: 32px; padding: 5px 9px; color: #bfc5cb; background: #24282c; border: 1px solid #3a4046; border-radius: 999px; cursor: pointer; font-size: 10px; font-weight: 760; }
  .demo-surface[aria-current="page"] { color: #fff; background: #354554; border-color: #708293; }
  .demo-surface:focus-visible { outline: 2px solid var(--ave-focus); outline-offset: 1px; }
  .changes-tray { grid-row: 5; min-height: 0; display: grid; grid-template-rows: auto minmax(0,1fr) auto auto auto; overflow: hidden; background: var(--ave-surface-soft); }
  .navigator { display: none; min-height: 0; overflow: auto; padding: 10px; background: var(--ave-surface-soft); border-bottom: 1px solid var(--ave-border); overscroll-behavior: contain; scrollbar-gutter: stable; }
  .navigator-head { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; margin: 2px 2px 9px; }
  .navigator-hint { color: #8f8996; font-size: 9px; }
  .navigator-tree, .navigator-tree ol { display: grid; gap: 3px; margin: 0; padding: 0; list-style: none; }
  .navigator-tree ol { margin: 3px 0 3px 12px; padding-left: 8px; border-left: 1px solid #3a3742; }
  .navigator-region-label { display: flex; align-items: center; gap: 7px; min-height: 30px; padding: 0 2px; color: #9f9aa8; font-size: 10px; font-weight: 780; }
  .navigator-kind { display: inline-flex; flex: 0 0 auto; padding: 2px 6px; border-radius: 3px; color: #cfe3f5; background: #27435c; font-size: 8px; font-weight: 800; letter-spacing: .07em; text-transform: uppercase; }
  .navigator-kind[data-kind="ROW"] { color: #d2f2df; background: #1e4631; }
  .navigator-kind[data-kind="SECTION"] { color: #c8f3ef; background: #0e4a45; }
  .navigator-kind[data-kind="BLOCK"] { color: #d7dde5; background: #3a4350; }
  .navigator-item-button { display: flex; align-items: center; gap: 7px; width: 100%; min-width: 0; min-height: 38px; padding: 5px 8px; color: #e6e3ea; background: transparent; border: 1px solid transparent; border-radius: 5px; cursor: pointer; font-size: 11px; text-align: left; }
  .navigator-item-button:hover, .navigator-item-button:focus-visible { background: #2d2b34; border-color: #4a4653; outline: none; }
  .navigator-item-button:focus-visible { outline: 2px solid var(--ave-focus); outline-offset: -2px; }
  .navigator-item-button[aria-current="true"] { color: #fff; background: #3a2233; border-color: #7e3f63; }
  .navigator-item-label { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .navigator-state { display: inline-flex; flex: 0 0 auto; color: #f0bd5b; }
  .navigator-state[data-protection="protected"] { color: #e45b67; }
  .navigator-state .ave-icon { width: 13px; height: 13px; }
  .navigator-empty { padding: 10px; color: #858d95; border: 1px dashed #3b4147; border-radius: 8px; font-size: 11px; text-align: center; }
  .navigator-row { display: flex; align-items: center; gap: 2px; }
  .navigator-row .navigator-item-button { flex: 1 1 auto; }
  .navigator-move { display: inline-grid; place-items: center; flex: 0 0 auto; width: 30px; min-width: 30px; height: 30px; min-height: 30px; padding: 0; color: #aaa4b1; background: transparent; border: 1px solid transparent; border-radius: 5px; cursor: pointer; opacity: 0; transition: opacity .1s ease; }
  .navigator-move .ave-icon { width: 14px; height: 14px; }
  .navigator-row:hover .navigator-move, .navigator-row:focus-within .navigator-move { opacity: 1; }
  .navigator-move:hover:not(:disabled), .navigator-move:focus-visible { color: #fff; background: #34313c; border-color: #56515f; }
  .navigator-move:focus-visible { outline: 2px solid var(--ave-focus); outline-offset: -2px; }
  .navigator-move:disabled { cursor: default; opacity: 0; }
  .navigator-return { display: flex; align-items: center; gap: 8px; width: 100%; min-height: 42px; padding: 8px 14px; color: #cfcbd6; background: #1f1e24; border: 0; border-bottom: 1px solid var(--ave-border); cursor: pointer; font-size: 11px; font-weight: 760; text-align: left; }
  .navigator-return .ave-icon { width: 15px; height: 15px; color: #ff82b5; }
  .navigator-return:hover, .navigator-return:focus-visible { color: #fff; background: #2a2830; outline: none; }
  .navigator-return:focus-visible { outline: 2px solid var(--ave-focus); outline-offset: -2px; }
  .selection-inspector { min-height: 0; display: none; overflow: auto; background: #24232a; scrollbar-gutter: stable; }
  .selection-summary { display: grid; gap: 2px; padding: 12px 14px; background: #1f1e24; border-bottom: 1px solid var(--ave-border); }
  .selection-kicker { color: #9f9aa8; font-size: 9px; font-weight: 760; letter-spacing: .08em; text-transform: uppercase; }
  .selection-name { color: #fff; font-size: 15px; }
  .selection-preview { overflow: hidden; color: #bcb8c3; font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
  .selection-state { display: inline-flex; width: fit-content; margin-top: 7px; padding: 4px 7px; color: #dff7e8; background: #173a29; border: 1px solid #2d6b4b; border-radius: 999px; font-size: 9px; font-weight: 760; }
  .selection-inspector[data-protection="locked"] .selection-state { color: #2a1d08; background: #f0bd5b; border-color: #ffd987; }
  .selection-inspector[data-protection="protected"] .selection-state { color: #ffe7e9; background: #67303a; border-color: #a84b5a; }
  .selection-lock-card { display: grid; gap: 5px; margin: 2px 0 10px; padding: 16px; color: #f8e8bd; background: repeating-linear-gradient(135deg,#302817,#302817 10px,#352d1a 10px,#352d1a 20px); border: 1px solid #8a6c2c; border-radius: 6px; }
  .selection-lock-card strong { font-size: 15px; }
  .selection-lock-card span { color: #d8cba9; font-size: 11px; line-height: 1.5; }
  .selection-lock-card .lock-action { margin-top: 4px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,.14); color: #fff; font-weight: 700; }
  .selection-lock-card .lock-action[hidden] { display: none; }
  .selection-inspector[data-protection="protected"] .selection-lock-card { color: #ffe7e9; background: repeating-linear-gradient(135deg,#351f23,#351f23 10px,#3b2328 10px,#3b2328 20px); border-color: #82414b; }
  .inspector-tabs { position: sticky; z-index: 2; top: 0; display: grid; grid-template-columns: repeat(3,1fr); background: #292730; border-bottom: 1px solid var(--ave-border); }
  .inspector-tab { min-width: 0; min-height: 46px; color: #aaa7b2; background: transparent; border: 0; border-right: 1px solid #3b3842; border-radius: 0; cursor: pointer; font-size: 11px; font-weight: 760; }
  .inspector-tab:last-child { border-right: 0; }
  .inspector-tab[aria-selected="true"] { color: #fff; background: #34313b; box-shadow: inset 0 -3px 0 var(--ave-accent); }
  .inspector-tab:focus-visible { outline: 2px solid var(--ave-focus); outline-offset: -3px; }
  .inspector-panel { padding: 10px; }
  .setting-group { margin: 0 0 8px; background: #1c1b20; border: 1px solid #3f3c46; border-radius: 5px; }
  .setting-group > summary { min-height: 44px; display: flex; align-items: center; padding: 0 12px; color: #f1eef4; cursor: pointer; font-size: 12px; font-weight: 780; list-style: none; }
  .setting-group > summary::-webkit-details-marker { display: none; }
  .setting-group > summary::after { margin-left: auto; color: #aaa4b1; content: '+'; font-size: 18px; font-weight: 400; }
  .setting-group[open] > summary::after { content: '−'; }
  .setting-body { padding: 0 12px 13px; border-top: 1px solid #34313a; }
  .setting-body textarea { min-height: 118px; }
  .section-setting-copy { margin: 12px 0; color: #c5c0ca; font-size: 11px; line-height: 1.5; }
  .section-setting-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 7px; }
  .section-setting-actions .danger { grid-column: 1 / -1; }
  .unavailable-setting { display: grid; gap: 3px; padding-top: 12px; color: #c5c0ca; }
  .unavailable-setting small { color: #88838e; }
  .computed-settings, .advanced-settings { display: grid; gap: 0; margin: 0; padding: 4px 12px 10px; border-top: 1px solid #34313a; }
  .computed-settings div, .advanced-settings div { display: grid; grid-template-columns: 92px minmax(0,1fr); gap: 10px; padding: 9px 0; border-bottom: 1px solid #302e35; }
  .computed-settings div:last-child, .advanced-settings div:last-child { border-bottom: 0; }
  .computed-settings dt, .advanced-settings dt { color: #8f8996; font-size: 10px; font-weight: 740; }
  .computed-settings dd, .advanced-settings dd { min-width: 0; margin: 0; overflow-wrap: anywhere; color: #e8e4eb; font-size: 10px; text-align: right; }
  .capability-note { margin: 10px 0 0; padding: 11px 12px; color: #d8c99d; background: #302916; border: 1px solid #5e5129; border-radius: 5px; font-size: 10px; line-height: 1.5; }
  .capability-note strong { display: block; margin-bottom: 2px; color: #ffe4a1; }
  .inspector-actions { position: sticky; bottom: 0; display: grid; grid-template-columns: 44px minmax(0,.82fr) minmax(0,.65fr) minmax(0,1fr); gap: 7px; padding: 9px; background: #19181d; border-top: 1px solid #47434d; box-shadow: 0 -10px 24px rgba(0,0,0,.28); }
  .inspector-actions .icon-button { color: #ffb5b5; background: #582c32; border-color: #82424a; }
  .toggle-selection-lock { display: inline-flex; align-items: center; justify-content: center; gap: 6px; }
  .toggle-selection-lock .ave-icon { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
  .changes-header { display: grid; grid-template-columns: minmax(0,1fr) auto; gap: 7px; padding: 8px; border-top: 1px solid rgba(255,255,255,.03); }
  .changes-toggle { min-height: 44px; display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 7px 11px; color: #fff; background: #34313c; border: 1px solid #56515f; border-radius: 5px; cursor: pointer; font-weight: 780; }
  .changes-toggle:hover, .changes-toggle:focus-visible { background: #403b48; outline: 2px solid var(--ave-focus); outline-offset: 1px; }
  .change-count { display: inline-grid; place-items: center; min-width: 25px; min-height: 25px; padding: 0 7px; color: #fff; background: var(--ave-builder); border-radius: 999px; font-size: 10px; font-variant-numeric: tabular-nums; }
  .changes-header .undo { min-height: 44px; }
  .changes-header .icon-button { color: #ddd9e2; background: #34313c; border-color: #56515f; }
  .ledger { min-height: 92px; overflow: auto; padding: 8px; overscroll-behavior: contain; scrollbar-gutter: stable; }
  .workbench:not([data-mode="review"]):not([data-mode="setup"]) .ledger,
  .workbench:not([data-mode="review"]):not([data-mode="setup"]) .history-actions,
  .workbench:not([data-mode="review"]):not([data-mode="setup"]) .actions { display: none; }
  .workbench:not([data-mode="review"]):not([data-mode="setup"]) .changes-tray { align-self: end; grid-template-rows: auto; }
  .workbench[data-mode="text"][data-has-selection="true"] .changes-tray { align-self: stretch; grid-template-rows: minmax(0,1fr) auto; }
  .workbench[data-mode="text"][data-has-selection="true"] .selection-inspector { display: block; }
  .workbench[data-mode="sections"][data-has-selection="true"] .changes-tray { align-self: stretch; grid-template-rows: minmax(0,1fr) auto; }
  .workbench[data-mode="sections"][data-has-selection="true"] .selection-inspector { display: block; }
  .workbench[data-mode="sections"][data-needs-section="true"] .changes-tray { align-self: stretch; grid-template-rows: minmax(0,1fr); }
  .workbench[data-mode="sections"][data-needs-section="true"] .changes-header { display: none; }
  .workbench[data-mode="sections"][data-needs-section="true"] .ledger { display: grid; align-content: start; }
  .workbench[data-mode="text"]:not([data-has-selection="true"]) .navigator,
  .workbench[data-mode="sections"]:not([data-has-selection="true"]) .navigator { display: block; }
  .workbench[data-mode="text"]:not([data-has-selection="true"]) .changes-tray,
  .workbench[data-mode="sections"]:not([data-has-selection="true"]) .changes-tray { align-self: stretch; grid-template-rows: minmax(0,1fr) auto; }
  .workbench[data-mode="text"]:not([data-has-selection="true"]),
  .workbench[data-mode="sections"]:not([data-has-selection="true"]) { height: min(720px, calc(100vh - 88px)); }
  .workbench[data-mode="review"] .changes-toggle { border-color: #7a8d9e; background: #34414d; }
  .empty { display: grid; place-items: center; min-height: 78px; padding: 13px; text-align: center; color: #858d95; border: 1px dashed #3b4147; border-radius: 10px; }
  .change { display: grid; grid-template-columns: minmax(0,1fr) auto; gap: 8px; padding: 10px; margin-bottom: 7px; background: #1e2124; border: 1px solid #30353a; border-radius: 10px; }
  .change > .icon-button { align-self: start; }
  .change-page { display: flex; align-items: baseline; gap: 7px; min-width: 0; margin-bottom: 7px; }
  .change-page strong { overflow: hidden; color: #f4f7fa; font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
  .change-page span { overflow: hidden; color: #9eabb6; font: 600 9px/1.4 ui-monospace, monospace; text-overflow: ellipsis; white-space: nowrap; }
  .change-type { display: inline-flex; width: fit-content; margin-bottom: 5px; padding: 2px 7px; color: #cad5dd; background: #29343e; border-radius: 999px; font-size: 9px; font-weight: 750; }
  .file { overflow: hidden; color: #b8d0e2; font: 600 11px/1.4 ui-monospace, monospace; text-overflow: ellipsis; white-space: nowrap; }
  .change-summary { color: #f7f5f2; font-size: 13px; font-weight: 780; }
  .change-description { margin: 5px 0 0; color: #c9d0d6; font-size: 11px; line-height: 1.5; overflow-wrap: anywhere; }
  .visible-diff { display: grid; gap: 6px; margin-top: 8px; padding: 8px; background: #181f26; border: 1px solid #35424d; border-radius: 8px; }
  .visible-diff > div { display: grid; grid-template-columns: 42px minmax(0,1fr); gap: 7px; align-items: start; }
  .visible-diff strong { color: #91a0ac; font-size: 9px; text-transform: uppercase; letter-spacing: .06em; }
  .visible-diff span { color: #edf2f5; font-size: 10px; line-height: 1.45; overflow-wrap: anywhere; }
  .visible-diff > div:first-child span { color: #adb7bf; text-decoration: line-through; }
  .diff { display: grid; gap: 3px; margin-top: 6px; font-size: 11px; overflow-wrap: anywhere; }
  .old, .new { display: -webkit-box; overflow: hidden; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
  .old { color: #959da5; text-decoration: line-through; } .new { color: #f7f5f2; }
  .change-technical { margin-top: 9px; }
  .change-technical .file { margin-top: 5px; white-space: normal; }
  .technical-diff { padding-top: 6px; border-top: 1px solid #343a40; }
  .technical-diff .old, .technical-diff .new { display: block; overflow: visible; white-space: pre-wrap; -webkit-line-clamp: unset; }
  .message { display: none; margin: 0 12px 10px; padding: 10px 12px; border-radius: 10px; font-size: 12px; }
  .message[data-show="true"] { display: block; }
  .message[data-kind="error"] { color: #ffd0d0; background: #3b2427; border: 1px solid #6f3940; }
  .message[data-kind="success"] { color: #c9f7de; background: #183128; border: 1px solid #2d624b; }
  .message[data-kind="warning"] { color: #ffe8ae; background: #352d18; border: 1px solid #66562b; }
  .save-recovery { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: -2px 12px 12px; }
  .save-recovery[hidden] { display: none; }
  .history-actions { display: flex; gap: 6px; padding: 0 8px 8px; }
  .history-actions button { flex: 1; min-height: 40px; display: inline-flex; align-items: center; justify-content: center; gap: 7px; }
  .history-actions .ave-icon { width: 16px; height: 16px; }
  .actions { display: grid; grid-template-columns: 1fr 1fr; gap: 7px; padding: 8px; border-top: 1px solid var(--ave-border); }
  .setup-actions { grid-row: 6; display: none; grid-template-columns: auto minmax(0,1fr); gap: 7px; padding: 8px; border-top: 1px solid var(--ave-border); }
  .setup-actions .reload-policy { grid-column: 1 / -1; }
  .workbench[data-mode="setup"] { width: min(460px, calc(100vw - 24px)); max-height: min(720px, calc(100vh - 92px)); }
  .workbench[data-mode="setup"] { grid-template-rows: auto minmax(0,1fr) auto; }
  .workbench[data-mode="setup"] .setup-toggle, .workbench[data-mode="setup"] .demo-context, .workbench[data-mode="setup"] .mode-tabs, .workbench[data-mode="setup"] .instructions, .workbench[data-mode="setup"] .changes-header, .workbench[data-mode="setup"] .history-actions, .workbench[data-mode="setup"] .actions { display: none; }
  .workbench[data-mode="setup"] .changes-tray { grid-row: 2; display: grid; grid-template-rows: minmax(0,1fr); min-height: 0; overflow: hidden; background: var(--ave-surface); }
  .workbench[data-mode="setup"] .setup-actions { display: grid; }
  .workbench:not([data-mode="setup"]) .setup-actions { display: none; }
  .commit { grid-column: 1 / -1; }
  .clear, .revert { width: 100%; }
  .restore-session { grid-column: 1 / -1; width: 100%; }
  .session-restore-files { display: grid; gap: 4px; margin: 14px 0 0; padding: 0 0 0 18px; color: #b8d0e2; font: 600 11px/1.5 ui-monospace, monospace; }
  .session-restore-files:empty { display: none; }
  .primary, .secondary, .danger { min-height: 44px; padding-inline: 14px; border-radius: 5px; font-weight: 780; cursor: pointer; }
  .primary { color: #fff; background: var(--ave-builder); border: 1px solid #8650ca; }
  .primary:hover:not(:disabled), .primary:focus-visible { background: #7b3bc5; outline: 2px solid #d9bdf7; outline-offset: 2px; }
  .secondary { color: #e0dde5; background: var(--ave-surface-raised); border: 1px solid #57535f; }
  .secondary:hover:not(:disabled), .secondary:focus-visible { background: #3c3943; outline: 2px solid #9f99a8; outline-offset: 2px; }
  .danger { color: #ffc9c9; background: #352326; border: 1px solid #60363b; }
  button:disabled { cursor: not-allowed; opacity: .34; filter: grayscale(.45); }
  dialog { width: min(600px, calc(100vw - 24px)); max-height: calc(100vh - 32px); overflow: auto; padding: 0; color: #f4f7fa; background: #24232a; border: 1px solid #5b5763; border-radius: 7px; box-shadow: 0 28px 90px rgba(0,0,0,.68); }
  dialog::backdrop { background: rgba(7,9,10,.72); backdrop-filter: blur(5px); }
  .dialog-body { padding: 20px; }
  .dialog-file { margin: 5px 0 16px; overflow-wrap: anywhere; color: #b8d0e2; font: 600 11px/1.45 ui-monospace, monospace; }
  .source-warning { margin: -7px 0 14px; padding: 8px 10px; color: #ffe4a8; background: #352d18; border: 1px solid #66562b; border-radius: 9px; font-size: 11px; }
  label { display: block; margin: 12px 0 6px; color: #d4d8dc; font-size: 12px; font-weight: 720; }
  input, textarea { width: 100%; min-height: 44px; padding: 11px 12px; color: #fff; background: #17161b; border: 1px solid #5d5963; border-radius: 4px; }
  textarea:disabled { color: #8f8994; background: repeating-linear-gradient(135deg,#1b191d,#1b191d 10px,#211e23 10px,#211e23 20px); border-color: #47424b; cursor: not-allowed; }
  textarea { min-height: 150px; resize: vertical; line-height: 1.55; }
  input:focus, textarea:focus { border-color: #e56aa0; outline: 3px solid rgba(233,75,138,.2); }
  .field-help { margin: 5px 0 0; color: #929aa2; font-size: 11px; }
  .dialog-actions { display: flex; justify-content: flex-end; flex-wrap: wrap; gap: 8px; margin-top: 18px; }
  .file-diff-list, .history-list { display: grid; gap: 10px; margin-top: 16px; }
  .file-diff { overflow: hidden; border: 1px solid #363c42; border-radius: 12px; background: #101214; }
  .file-diff h3 { padding: 10px 12px; color: #c3d8e7; background: #26313b; border-bottom: 1px solid #465562; font: 650 11px/1.4 ui-monospace, monospace; overflow-wrap: anywhere; }
  .diff-code { overflow: auto; padding: 7px 0; font: 12px/1.55 ui-monospace, SFMono-Regular, Consolas, monospace; }
  .diff-line { display: grid; grid-template-columns: 22px 38px minmax(max-content,1fr); min-width: max-content; padding-right: 12px; white-space: pre; }
  .diff-line.remove { color: #ffd3d3; background: #3a2024; }
  .diff-line.add { color: #c9f7de; background: #173126; }
  .diff-marker { text-align: center; font-weight: 800; }
  .diff-number { color: #89929b; text-align: right; padding-right: 9px; user-select: none; }
  .history-restore { align-self: center; min-height: 38px; }
  .template-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 9px; margin-top: 16px; }
  .template-card { min-height: 118px; padding: 13px; text-align: left; color: #e9ecef; background: #202428; border: 1px solid #3a4147; border-radius: 12px; cursor: pointer; }
  .template-card strong, .template-card span { display: block; } .template-card span { margin-top: 7px; color: #aeb4bb; font-size: 11px; line-height: 1.45; }
  .template-card:hover, .template-card:focus-visible { border-color: #9dbbd3; outline: 2px solid rgba(157,187,211,.35); }
  .inventory-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding: 3px 2px 12px; }
  .inventory-header p { margin: 4px 0 0; color: var(--ave-muted); font-size: 10px; }
  .setup-technical { margin: 0; }
  .setup-guide { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 5px; margin: 0 0 10px; padding: 0; list-style: none; }
  .setup-guide li { display: grid; grid-template-columns: 24px minmax(0,1fr); align-items: center; gap: 6px; min-height: 48px; padding: 6px; color: #aeb4bb; background: #181b1e; border: 1px solid #30353a; border-radius: 9px; }
  .setup-guide li[data-state="active"] { color: #fff; background: #34251e; border-color: #a95531; }
  .setup-guide li[data-state="complete"] { color: #c9f7de; background: #183128; border-color: #2d624b; }
  .setup-guide-number { display: inline-grid; place-items: center; width: 24px; height: 24px; border: 1px solid currentColor; border-radius: 50%; font-size: 10px; font-weight: 800; }
  .setup-guide strong, .setup-guide small { display: block; }
  .setup-guide strong { font-size: 10px; }
  .setup-guide small { margin-top: 1px; font-size: 8px; line-height: 1.25; }
  .pending-policy { display: grid; grid-template-columns: minmax(0,1fr) auto; align-items: center; gap: 8px; margin-bottom: 9px; padding: 10px; color: #ffe8ae; background: #352d18; border: 1px solid #66562b; border-radius: 10px; }
  .pending-policy strong, .pending-policy span { display: block; }
  .pending-policy strong { font-size: 11px; }
  .pending-policy span { margin-top: 2px; color: #e4d5a9; font-size: 9px; }
  .pending-policy button { min-height: 40px; padding-inline: 10px; font-size: 10px; }
  .inventory-policy-file { margin: 3px 0 0; color: #b8d0e2; font: 600 10px/1.4 ui-monospace, monospace; overflow-wrap: anywhere; }
  .inventory-total { flex: 0 0 auto; color: #aeb4bb; font-size: 10px; }
  .section-setup { display: grid; gap: 8px; margin: 0 0 10px; padding: 11px; background: #181b1e; border: 1px solid #3a4147; border-radius: 11px; }
  .section-setup-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
  .section-setup h4, .text-settings-heading h4 { margin: 0; font-size: 12px; }
  .section-setup-header p, .text-settings-heading p, .section-setup-empty { margin: 4px 0 0; color: #b5bbc1; font-size: 10px; line-height: 1.45; }
  .section-region-list { display: grid; gap: 6px; }
  .section-region-item { display: grid; grid-template-columns: minmax(0,1fr) auto; align-items: center; gap: 8px; padding: 8px; background: #202428; border: 1px solid #343a40; border-radius: 9px; }
  .section-region-item strong, .section-region-item code { display: block; overflow-wrap: anywhere; }
  .section-region-item strong { font-size: 10px; }
  .section-region-item code { margin-top: 3px; color: #b8d0e2; font-size: 9px; }
  .section-region-item button { min-height: 40px; padding: 6px 9px; font-size: 10px; }
  .add-section-region { width: 100%; min-height: 44px; }
  .setup-picker-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 7px; }
  .setup-picker-actions button { min-height: 44px; padding-inline: 8px; font-size: 10px; }
  .text-settings-heading { margin: 2px 2px 8px; }
  .pick-text-on-page { width: 100%; min-height: 44px; margin-top: 8px; }
  .friendly-region-list { display: grid; gap: 8px; max-height: min(52vh,480px); margin-top: 14px; overflow: auto; }
  .friendly-region { display: grid; grid-template-columns: minmax(0,1fr) auto; gap: 10px; align-items: center; padding: 12px; background: #1c2023; border: 1px solid #3a4147; border-radius: 10px; }
  .friendly-region strong, .friendly-region span { display: block; }
  .friendly-region .region-scope { width: fit-content; margin-bottom: 4px; padding: 2px 6px; color: #b8d0e2; background: #25313b; border-radius: 999px; font-size: 8px; font-weight: 800; letter-spacing: .05em; text-transform: uppercase; }
  .friendly-region span { margin-top: 4px; color: #b5bbc1; font-size: 10px; }
  .friendly-region button { min-height: 42px; padding: 7px 11px; }
  .setup-page-picker { position: fixed; z-index: 2147483647; left: 50%; bottom: 24px; display: none; grid-template-columns: auto minmax(0,1fr) auto; align-items: center; gap: 10px; width: min(620px,calc(100vw - 24px)); padding: 10px; color: #fff; background: rgba(31,40,50,.98); border: 1px solid #8fb3cf; border-radius: 14px; box-shadow: 0 18px 60px rgba(0,0,0,.6); transform: translateX(-50%); pointer-events: none; font: 12px/1.35 Inter,system-ui,sans-serif; }
  .setup-page-picker[data-open="true"] { display: grid; }
  .setup-page-picker strong, .setup-page-picker span { display: block; }
  .setup-page-picker span { color: #c3c8cd; }
  .setup-page-picker button { min-height: 42px; pointer-events: auto; }
  .manage-list { margin-top: 7px; border: 1px solid #455461; border-radius: 10px; background: #1b242d; }
  .manage-list > summary { min-height: 44px; display: flex; align-items: center; padding: 8px 11px; cursor: pointer; color: #eef3f7; font-weight: 750; }
  .manage-list > summary:focus-visible { outline: 2px solid var(--ave-focus); outline-offset: 2px; }
  .manage-list[open] > summary { border-bottom: 1px solid #455461; }
  .manage-list > :not(summary) { margin-inline: 10px; }
  .manage-list > :last-child { margin-bottom: 10px; }
  .search-label { margin: 10px 10px 5px !important; }
  .inventory-search { width: calc(100% - 20px); margin: 0 10px 8px !important; }
  .inventory-filters { display: flex; gap: 5px; overflow-x: auto; padding: 0 0 8px; scrollbar-width: thin; }
  .inventory-filter { min-width: max-content; min-height: 44px; padding: 6px 10px; color: #bbc1c7; background: #1c2023; border: 1px solid #343a40; border-radius: 999px; cursor: pointer; font-size: 10px; font-weight: 720; }
  .inventory-filter[aria-pressed="true"] { color: #fff; background: #34414d; border-color: #718394; }
  .inventory-filter:focus-visible { outline: 2px solid var(--ave-focus); outline-offset: 1px; }
  .inventory-list { display: grid; gap: 8px; }
  .inventory-item { padding: 11px; background: #1c2023; border: 1px solid #343a40; border-left-width: 4px; border-radius: 11px; }
  .inventory-item:focus-visible { outline: 3px solid var(--ave-focus); outline-offset: 2px; }
  .inventory-item.status-editable { border-left-color: #63d69a; }
  .inventory-item.status-excluded { border-left-color: #8b949d; }
  .inventory-item.status-unresolved { border-left-color: #f0bd5b; }
  .inventory-item.status-unsafe { border-left-color: #f17c7c; }
  .inventory-item-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .inventory-item-top code { color: #aeb4bb; font-size: 10px; }
  .inventory-status { display: inline-flex; padding: 2px 7px; border-radius: 999px; color: #f7f5f2; background: #2a2f34; font-size: 10px; font-weight: 780; }
  .status-editable .inventory-status { color: #c9f7de; background: #19352a; }
  .status-unresolved .inventory-status { color: #ffe8ae; background: #3a3019; }
  .status-unsafe .inventory-status { color: #ffd0d0; background: #3c2528; }
  .inventory-copy { display: -webkit-box; margin: 8px 0 0; overflow: hidden; color: #f7f5f2; font-weight: 700; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
  .inventory-reason { margin: 5px 0 0; color: #b5bbc1; font-size: 11px; }
  .inventory-source { margin-top: 7px; color: #b8d0e2; font: 600 10px/1.45 ui-monospace, monospace; overflow-wrap: anywhere; }
  .inventory-controls { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 9px; }
  .inventory-controls button { min-height: 44px; padding: 6px 10px; font-size: 10px; }
  .inventory-source-form { display: grid; grid-template-columns: 1fr; gap: 5px; margin-top: 10px; padding-top: 9px; border-top: 1px solid #343a40; }
  .inventory-source-form label { margin: 3px 0 0; font-size: 10px; }
  .inventory-source-form input { min-height: 40px; padding: 8px 10px; font: 11px/1.3 ui-monospace, monospace; }
  .inventory-source-form button { margin-top: 4px; }
  .discover-source { width: 100%; min-height: 44px; margin-top: 10px; }
  .source-candidate-list { display: grid; gap: 8px; max-height: min(52vh, 480px); margin-top: 14px; overflow: auto; }
  .source-candidate { display: grid; grid-template-columns: auto 1fr; gap: 10px; align-items: start; padding: 12px; background: #1c2023; border: 1px solid #3a4147; border-radius: 10px; cursor: pointer; }
  .source-candidate:has(input:checked) { border-color: #8fb3cf; box-shadow: 0 0 0 1px #8fb3cf; }
  .source-candidate input { width: 20px; height: 20px; margin: 1px 0 0; accent-color: #78a9cb; }
  .source-candidate span { display: grid; gap: 4px; min-width: 0; }
  .source-candidate strong, .source-candidate code { overflow-wrap: anywhere; }
  .source-candidate code { color: #b8d0e2; font-size: 11px; }
  .source-candidate small { color: #b5bbc1; line-height: 1.4; }
  .technical-details { margin-top: 8px; color: #aeb4bb; font-size: 10px; }
  .technical-details summary { min-height: 32px; cursor: pointer; font-weight: 700; }
  .technical-details code, .technical-details .dialog-file { display: block; margin-top: 5px; color: #b8d0e2; overflow-wrap: anywhere; }
  .seo-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0 12px; }
  .seo-grid .wide { grid-column: 1 / -1; }
  .seo-grid input:disabled, .seo-grid textarea:disabled { color: #8e959c; background: #1b1e21; border-style: dashed; cursor: not-allowed; }
  .seo-field-note { color: #f0c98a; }
  .seo-status { margin: 10px 0 0; color: #aeb4bb; font-size: 11px; }
  .seo-status:empty { display: none; }
  .picker { display: none; align-items: center; gap: 8px; min-height: 48px; padding: 6px; color: #fff; background: #151719; border: 1px solid #3a4046; border-radius: 999px; box-shadow: 0 12px 35px rgba(0,0,0,.45); font: 12px/1.2 Inter,system-ui,sans-serif; }
  .picker[data-open="true"] { display: flex; }
  .picker-label { padding-left: 9px; font-weight: 700; white-space: nowrap; }
  .picker button { min-height: 36px; min-width: 36px; border-radius: 999px; }
  @media (max-width: 640px) {
    .workbench { top: 6px; left: 6px; width: calc(100vw - 12px); max-height: min(72vh, 680px); border-radius: 7px; }
    .instructions { align-items: flex-start; }
    .demo-surfaces { max-width: 100%; }
    .template-grid { grid-template-columns: 1fr; } .seo-grid { grid-template-columns: 1fr; }
    .seo-grid .wide { grid-column: auto; } .actions { grid-template-columns: 1fr auto; }
    .revert { grid-column: 1 / -1; }
    .setup-guide { grid-template-columns: 1fr; }
    .setup-guide li { min-height: 44px; }
    .pending-policy { grid-template-columns: 1fr; }
    .setup-actions { grid-template-columns: 1fr; }
    .setup-actions .reload-policy { grid-column: auto; }
    .setup-picker-actions { grid-template-columns: 1fr; }
    .setup-page-picker { grid-template-columns: 1fr auto; bottom: 12px; }
    .setup-page-picker > div { grid-column: 1 / -1; }
  }
  @media (forced-colors: active) { * { forced-color-adjust: auto; } }
  @media (prefers-reduced-motion: reduce) { button { transition: none; } }
  @media (prefers-reduced-motion: no-preference) {
    .workbench { animation: ave-arrive .16s ease-out; }
    @keyframes ave-arrive { from { opacity: 0; transform: translateY(6px) scale(.985); } }
  }
`;

export const pageSectionStyles = String.raw`
  @media (min-width: 900px) {
    html[data-astro-ve-docked="true"] { overflow-x: hidden !important; }
    html[data-astro-ve-docked="true"] body { width: calc(100% - 436px) !important; margin-left: 436px !important; transition: width .18s ease, margin-left .18s ease !important; }
    html[data-astro-ve-setup-docked="true"] { overflow-x: hidden !important; }
    html[data-astro-ve-setup-docked="true"] body { width: calc(100% - 476px) !important; margin-left: 476px !important; }
  }
  /* ——— Progressive-disclosure grammar ———
     Rest: faint persistent boundaries + lock chips only.
     Hover: one stronger outline + one name tag for the pointed-at level.
     Selected: one accent outline + one full toolbar; parent gets a faint context outline. */
  [data-astro-ve-text-state] { position: relative !important; outline: 2px solid #e94b8a !important; outline-offset: 3px !important; }
  [data-astro-ve-text-state]:after { display: none !important; }
  [data-astro-ve-text-state="locked"] { outline-color: #e0a72f !important; outline-style: dashed !important; }
  [data-astro-ve-text-state="protected"] { outline-color: #e45b67 !important; outline-style: dashed !important; }
  [data-astro-ve-selected="true"] { position: relative !important; outline: 2px solid #e94b8a !important; outline-offset: 2px !important; }
  [data-astro-ve-inline-editing="true"] { outline: 2px dashed #f49bc0 !important; outline-offset: 3px !important; cursor: text !important; caret-color: #e94b8a !important; background: rgba(233,75,138,.07) !important; box-shadow: 0 0 0 6px rgba(233,75,138,.1) !important; }
  [data-astro-ve-region-active="true"] { position: relative !important; outline: 1px dashed rgba(63,141,204,.45) !important; outline-offset: 6px !important; }
  [data-astro-ve-region-active="true"][data-astro-ve-hierarchy="row"] { outline: 1px dashed rgba(53,164,106,.45) !important; outline-offset: 3px !important; }
  [data-astro-ve-region-active="true"][data-astro-ve-selected-parent="true"] { outline-style: solid !important; }
  [data-astro-ve-section-active="true"] { position: relative !important; outline: 1px solid rgba(0,184,169,.5) !important; outline-offset: -1px; }
  [data-astro-ve-section-active="true"][data-astro-ve-hierarchy="block"] { outline: 1px dashed rgba(119,131,145,.5) !important; outline-offset: -1px !important; }
  [data-astro-ve-section-active="true"]:hover,
  [data-astro-ve-section-active="true"]:focus-within,
  [data-astro-ve-section-active="true"][data-astro-ve-hover="true"] { outline: 2px solid #00b8a9 !important; outline-offset: -2px !important; }
  [data-astro-ve-section-active="true"][data-astro-ve-hierarchy="block"]:hover,
  [data-astro-ve-section-active="true"][data-astro-ve-hierarchy="block"][data-astro-ve-hover="true"] { outline: 2px solid #778391 !important; }
  [data-astro-ve-section-active="true"][data-astro-ve-protection="locked"] { outline: 1px dashed rgba(224,167,47,.75) !important; }
  [data-astro-ve-section-active="true"][data-astro-ve-protection="protected"] { outline: 1px dashed rgba(228,91,103,.75) !important; }
  [data-astro-ve-section-active="true"][data-astro-ve-selected="true"] { outline: 2px solid #e94b8a !important; outline-offset: -2px !important; }
  /* Selection must beat the hover outline while the pointer is still over
     the element, or the pink only appears after the mouse moves away. */
  [data-astro-ve-section-active="true"][data-astro-ve-hierarchy][data-astro-ve-selected="true"],
  [data-astro-ve-section-active="true"][data-astro-ve-selected="true"]:hover { outline: 2px solid #e94b8a !important; outline-offset: -2px !important; }
  .astro-ve-lock-chip { position: absolute !important; z-index: 2147482940 !important; display: inline-flex !important; align-items: center !important; gap: 4px !important; padding: 3px 7px !important; color: #211909 !important; background: #f0bd5b !important; border-radius: 3px !important; box-shadow: 0 2px 8px rgba(0,0,0,.28) !important; font: 800 9px/1.2 Inter,system-ui,sans-serif !important; letter-spacing: .05em !important; text-transform: uppercase !important; pointer-events: none !important; }
  .astro-ve-lock-chip[data-protection="protected"] { color: #fff !important; background: #8a3542 !important; }
  .astro-ve-lock-chip .ave-icon { width: 11px !important; height: 11px !important; fill: none !important; stroke: currentColor !important; stroke-width: 2.2 !important; stroke-linecap: round !important; stroke-linejoin: round !important; }
  [data-astro-edit-region], [data-astro-edit-sections] { position: relative !important; }
  [data-astro-ve-drag-over="true"] { outline: 4px dashed #e94b8a !important; outline-offset: -5px; }
  /* Must outrank the block/section hover rules above (drops happen while hovered). */
  [data-astro-ve-section-active="true"][data-astro-ve-hierarchy][data-astro-ve-drag-over="true"] { outline: 4px dashed #e94b8a !important; outline-offset: -5px !important; }
  /* The highlight above says which element the drop lands in; these say which
     side of it, driven by the same midpoint test onSectionDrop uses. */
  [data-astro-ve-drop-edge="before"] { box-shadow: inset 0 6px 0 0 #e94b8a !important; }
  [data-astro-ve-drop-edge="after"] { box-shadow: inset 0 -6px 0 0 #e94b8a !important; }
  [data-astro-ve-dragging="true"] { opacity: .55 !important; }
  [data-astro-ve-ui] { box-sizing: border-box; }
  /* "What can I edit?" filter: fade everything the editor cannot change here.
     Editable and user-locked (unlockable) content stays in full colour. */
  html[data-astro-ve-editable-filter="true"] [data-astro-ve-protection="protected"]:not([data-astro-ve-ui]) { opacity: .35 !important; filter: grayscale(.8) !important; transition: opacity .16s ease !important; }
  html[data-astro-ve-editable-filter="true"] [data-astro-ve-section-active="true"][data-astro-ve-protection="protected"] { opacity: .35 !important; filter: grayscale(.8) !important; }
  [data-astro-ve-inventory-status] { outline: none !important; }
  [data-astro-ve-inventory-focus="true"] { outline: 4px solid #8fc7ee !important; outline-offset: 5px !important; }
  [data-astro-ve-setup-pick="true"] { outline: 4px solid #8fc7ee !important; outline-offset: 5px !important; cursor: pointer !important; box-shadow: 0 0 0 8px rgba(75,151,203,.2) !important; }
  .astro-ve-region-controls { position: absolute !important; z-index: 2147482950 !important; top: -24px !important; left: -9px !important; display: block !important; max-width: min(300px,80%) !important; overflow: hidden !important; padding: 4px 8px !important; color: #fff !important; background: #347fb9 !important; border-radius: 4px 4px 0 0 !important; box-shadow: 0 4px 14px rgba(0,0,0,.28) !important; font: 800 9px/1.2 Inter,system-ui,sans-serif !important; letter-spacing: .055em !important; text-overflow: ellipsis !important; white-space: nowrap !important; pointer-events: none !important; opacity: 0 !important; transition: opacity .12s ease !important; }
  .astro-ve-region-controls[data-hierarchy-level="row"] { background: #2d925c !important; }
  [data-astro-ve-region-active="true"]:hover:not(:has([data-astro-ve-hover="true"])) > .astro-ve-region-controls,
  [data-astro-ve-region-active="true"][data-astro-ve-selected-parent="true"] > .astro-ve-region-controls { opacity: 1 !important; }
  .astro-ve-section-controls { position: absolute !important; z-index: 2147483000 !important; top: 10px !important; left: 10px !important; display: flex !important; align-items: center !important; gap: 0 !important; width: fit-content !important; max-width: calc(100% - 20px) !important; min-height: 30px !important; padding: 0 !important; color: #fff !important; background: #008f83 !important; border: 0 !important; border-radius: 4px !important; box-shadow: 0 6px 18px rgba(0,0,0,.32) !important; font: 700 11px/1 Inter,system-ui,sans-serif !important; opacity: 0 !important; pointer-events: none !important; transition: opacity .12s ease, box-shadow .14s ease !important; }
  .astro-ve-section-controls[data-peek="true"], .astro-ve-section-controls[data-visible="true"] { opacity: 1 !important; pointer-events: auto !important; }
  .astro-ve-section-controls[data-visible="true"] { min-height: 36px !important; box-shadow: 0 10px 28px rgba(0,0,0,.52),0 0 0 2px rgba(255,255,255,.75) !important; }
  .astro-ve-section-controls[data-peek="true"]:not([data-visible="true"]) button:not(.astro-ve-drag-handle) { display: none !important; }
  .astro-ve-section-controls[data-hierarchy-level="block"] { z-index: 2147483400 !important; background: #535e6b !important; }
  .astro-ve-element-controls { position: absolute !important; z-index: 2147483200 !important; display: flex !important; align-items: center !important; width: fit-content !important; min-height: 34px !important; color: #fff !important; background: #4f5967 !important; border-radius: 4px !important; box-shadow: 0 8px 22px rgba(0,0,0,.38) !important; font: 700 11px/1 Inter,system-ui,sans-serif !important; pointer-events: none !important; }
  /* Only the protected variant wraps: its explainer takes a full second row.
     Unlocked toolbars must stay single-row so they never overlap the text
     they control (a wrapped row would intercept canvas clicks). */
  .astro-ve-element-controls[data-protection="protected"] { flex-wrap: wrap !important; max-width: min(420px, calc(100vw - 24px)) !important; }
  .astro-ve-explainer { flex: 1 1 100% !important; order: 10 !important; padding: 8px 10px !important; color: #ffe0e4 !important; background: #43303a !important; border-top: 1px solid rgba(255,255,255,.18) !important; border-radius: 0 0 4px 4px !important; font: 600 11px/1.45 Inter,system-ui,sans-serif !important; white-space: normal !important; }
  .astro-ve-element-label { max-width: 230px !important; overflow: hidden !important; padding: 0 9px !important; text-overflow: ellipsis !important; white-space: nowrap !important; }
  .astro-ve-control-state { align-self: stretch !important; display: inline-flex !important; align-items: center !important; padding: 0 8px !important; color: #dff7e8 !important; background: #165c43 !important; border-left: 1px solid rgba(255,255,255,.22) !important; font: 800 9px/1 Inter,system-ui,sans-serif !important; text-transform: uppercase !important; letter-spacing: .04em !important; white-space: nowrap !important; }
  [data-protection="locked"] > .astro-ve-control-state { color: #2a1d08 !important; background: #f0bd5b !important; }
  [data-protection="protected"] > .astro-ve-control-state { color: #fff !important; background: #8a3542 !important; }
  .astro-ve-element-controls button { position: relative !important; display: inline-grid !important; place-items: center !important; width: 34px !important; height: 34px !important; min-width: 34px !important; min-height: 34px !important; padding: 0 !important; color: inherit !important; background: rgba(0,0,0,.1) !important; border: 0 !important; border-left: 1px solid rgba(255,255,255,.22) !important; cursor: pointer !important; pointer-events: auto !important; }
  .astro-ve-element-controls button:last-child { border-radius: 0 4px 4px 0 !important; }
  .astro-ve-element-controls button:hover,
  .astro-ve-element-controls button:focus-visible { background: rgba(0,0,0,.24) !important; outline: 2px solid #fff !important; outline-offset: -2px !important; }
  .astro-ve-element-controls button:disabled { cursor: not-allowed !important; opacity: .85 !important; }
  .astro-ve-element-controls .ave-icon { width: 16px !important; height: 16px !important; fill: none !important; stroke: currentColor !important; stroke-width: 1.8 !important; stroke-linecap: round !important; stroke-linejoin: round !important; }
  .astro-ve-section-label { min-width: 0 !important; max-width: 230px !important; overflow: hidden !important; padding: 0 10px !important; text-overflow: ellipsis !important; white-space: nowrap !important; letter-spacing: .03em !important; }
  .astro-ve-section-controls:not([data-peek="true"]):not([data-visible="true"]) button { display: none !important; }
  .astro-ve-section-controls button { position: relative !important; display: inline-grid !important; place-items: center !important; width: 36px !important; height: 36px !important; min-width: 36px !important; min-height: 36px !important; padding: 0 !important; color: inherit !important; background: rgba(0,0,0,.08) !important; border: 0 !important; border-left: 1px solid rgba(255,255,255,.2) !important; border-radius: 0 !important; cursor: pointer !important; font: inherit !important; }
  .astro-ve-section-controls button:last-child { border-radius: 0 4px 4px 0 !important; }
  .astro-ve-section-controls button:hover, .astro-ve-section-controls button:focus-visible { background: rgba(0,0,0,.22) !important; outline: 3px solid #fff !important; outline-offset: -3px !important; }
  .astro-ve-section-controls button:disabled { cursor: not-allowed !important; opacity: .9 !important; }
  .astro-ve-section-controls .ave-icon { width: 18px !important; height: 18px !important; fill: none !important; stroke: currentColor !important; stroke-width: 1.8 !important; stroke-linecap: round !important; stroke-linejoin: round !important; }
  .astro-ve-section-controls button::after { position: absolute !important; z-index: 2147483647 !important; top: calc(100% + 8px) !important; left: 50% !important; width: max-content !important; max-width: min(240px, 70vw) !important; padding: 7px 9px !important; color: #fff !important; background: #090b0c !important; border: 1px solid #5b6269 !important; border-radius: 7px !important; box-shadow: 0 8px 22px rgba(0,0,0,.48) !important; content: attr(data-tooltip) !important; font: 600 12px/1.35 system-ui,sans-serif !important; opacity: 0 !important; pointer-events: none !important; transform: translateX(-50%) translateY(-2px) !important; transition: opacity .12s ease, transform .12s ease !important; white-space: normal !important; }
  .astro-ve-section-controls button:hover::after, .astro-ve-section-controls button:focus-visible::after { opacity: 1 !important; transform: translateX(-50%) translateY(0) !important; }
  .astro-ve-section-controls button:nth-child(3n + 1)::after { left: 0 !important; transform: translateY(-2px) !important; }
  .astro-ve-section-controls button:nth-child(3n + 1):hover::after, .astro-ve-section-controls button:nth-child(3n + 1):focus-visible::after { transform: translateY(0) !important; }
  .astro-ve-section-controls button:nth-child(3n)::after { right: 0 !important; left: auto !important; transform: translateY(-2px) !important; }
  .astro-ve-section-controls button:nth-child(3n):hover::after, .astro-ve-section-controls button:nth-child(3n):focus-visible::after { transform: translateY(0) !important; }
  .astro-ve-drag-handle { order: -1 !important; cursor: grab !important; background: rgba(0,0,0,.15) !important; }
  @media (prefers-reduced-motion: reduce) { .astro-ve-section-controls button::after { transition: none !important; } }
  @media (max-width: 640px) {
    [data-astro-ve-text-state]:after { top: -31px !important; max-width: 70vw !important; font-size: 10px !important; }
    .astro-ve-section-controls { position: sticky !important; top: 6px !important; margin: 6px !important; max-width: calc(100% - 12px) !important; overflow-x: auto !important; }
    .astro-ve-section-label { max-width: 112px !important; }
    .astro-ve-section-controls button { width: 44px !important; height: 44px !important; min-width: 44px !important; min-height: 44px !important; }
  }
`;
