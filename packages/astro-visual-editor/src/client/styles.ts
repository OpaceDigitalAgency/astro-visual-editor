export const toolbarStyles = String.raw`
  :host {
    color-scheme: dark;
    --ave-accent: #ff7a3d;
    --ave-ink: #f4f7fa;
    --ave-muted: #b7c0c9;
    --ave-surface: #202832;
    --ave-surface-raised: #27323d;
    --ave-surface-soft: #19212a;
    --ave-border: #43515e;
    --ave-focus: #a9c7df;
  }
  * { box-sizing: border-box; }
  button, input, textarea, select { font: inherit; }
  button { min-width: 44px; min-height: 44px; transition: background-color .18s ease, border-color .18s ease, color .18s ease, opacity .18s ease; }
  .workbench {
    width: min(400px, calc(100vw - 24px)); max-height: min(610px, calc(100vh - 92px));
    display: none; overflow: hidden; color: var(--ave-ink); background: var(--ave-surface);
    border: 1px solid #536271; border-radius: 15px; box-shadow: 0 22px 64px rgba(0,0,0,.58), 0 0 0 1px rgba(255,255,255,.05);
    font: 13px/1.42 Inter, ui-sans-serif, system-ui, sans-serif;
  }
  .workbench[data-open="true"] { display: grid; grid-template-rows: auto auto auto auto minmax(0,1fr) auto; }
  .workbench[data-open="true"][data-minimized="true"] { display: none; }
  .masthead { grid-row: 1; display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; padding: 12px 13px 10px; border-bottom: 1px solid var(--ave-border); }
  .masthead-actions { display: flex; gap: 7px; }
  .eyebrow { margin: 0 0 3px; color: #a9c7df; font: 750 9px/1.2 ui-monospace, monospace; letter-spacing: .14em; text-transform: uppercase; }
  h2, h3 { margin: 0; letter-spacing: -.025em; }
  h2 { font-size: 17px; } h3 { font-size: 14px; }
  .status { display: flex; align-items: center; gap: 7px; margin: 5px 0 0; color: var(--ave-muted); font-size: 11px; }
  .status-dot { width: 8px; height: 8px; flex: 0 0 auto; border-radius: 50%; background: #6ee7a8; box-shadow: 0 0 0 4px rgba(110,231,168,.1); }
  .status[data-state="warning"] .status-dot { background: #ffd166; }
  .status[data-state="error"] .status-dot { background: #ff8585; }
  .icon-button, .utility-button { display: inline-grid; place-items: center; padding: 0; color: #e3e9ee; background: var(--ave-surface-raised); border: 1px solid #566574; border-radius: 10px; cursor: pointer; }
  .utility-button { min-height: 44px; padding-inline: 12px; font-size: 11px; font-weight: 750; }
  .icon-button:hover, .icon-button:focus-visible, .utility-button:hover, .utility-button:focus-visible { color: white; background: #33414d; outline: 2px solid var(--ave-focus); outline-offset: 2px; }
  .demo-context { grid-row: 2; display: flex; align-items: center; gap: 8px; padding: 6px 10px; color: #9fabB6; background: #182029; border-bottom: 1px solid var(--ave-border); font-size: 9px; font-weight: 750; letter-spacing: .08em; text-transform: uppercase; }
  .demo-context[hidden] { display: none; }
  .mode-tabs { grid-row: 3; display: grid; grid-template-columns: repeat(3,1fr); gap: 3px; padding: 5px; background: var(--ave-surface-soft); border-bottom: 1px solid var(--ave-border); }
  .mode-tab { min-width: 0; min-height: 36px; padding: 4px; color: #aeb4bb; background: transparent; border: 1px solid transparent; border-radius: 8px; cursor: pointer; font-size: 11px; font-weight: 750; }
  .mode-tab[aria-selected="true"] { color: #fff; background: #34414d; border-color: #607080; }
  .mode-tab:focus-visible { outline: 2px solid var(--ave-focus); outline-offset: 1px; }
  .instructions { grid-row: 4; display: flex; align-items: center; gap: 8px; padding: 8px 12px; color: #cbd3da; background: #202832; border-bottom: 1px solid var(--ave-border); font-size: 11px; }
  .instructions-copy { min-width: 0; }
  .demo-surfaces { display: flex; flex: 1 1 auto; gap: 4px; min-width: 0; overflow-x: auto; }
  .demo-surface { min-width: max-content; min-height: 32px; padding: 5px 9px; color: #bfc5cb; background: #24282c; border: 1px solid #3a4046; border-radius: 999px; cursor: pointer; font-size: 10px; font-weight: 760; }
  .demo-surface[aria-current="page"] { color: #fff; background: #354554; border-color: #708293; }
  .demo-surface:focus-visible { outline: 2px solid var(--ave-focus); outline-offset: 1px; }
  .changes-tray { grid-row: 5; min-height: 0; display: grid; grid-template-rows: auto minmax(0,1fr) auto auto auto; overflow: hidden; background: var(--ave-surface-soft); }
  .changes-header { display: grid; grid-template-columns: minmax(0,1fr) auto; gap: 7px; padding: 8px; border-top: 1px solid rgba(255,255,255,.03); }
  .changes-toggle { min-height: 44px; display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 7px 11px; color: #eef3f7; background: var(--ave-surface-raised); border: 1px solid #52616f; border-radius: 10px; cursor: pointer; font-weight: 780; }
  .changes-toggle:hover, .changes-toggle:focus-visible { background: #33414d; outline: 2px solid var(--ave-focus); outline-offset: 1px; }
  .change-count { display: inline-grid; place-items: center; min-width: 25px; min-height: 25px; padding: 0 7px; color: #182029; background: #dce6ed; border-radius: 999px; font-size: 10px; font-variant-numeric: tabular-nums; }
  .changes-header .undo { min-height: 44px; }
  .ledger { min-height: 92px; overflow: auto; padding: 8px; overscroll-behavior: contain; scrollbar-gutter: stable; }
  .workbench:not([data-mode="review"]):not([data-mode="setup"]) .ledger,
  .workbench:not([data-mode="review"]):not([data-mode="setup"]) .history-actions,
  .workbench:not([data-mode="review"]):not([data-mode="setup"]) .actions { display: none; }
  .workbench:not([data-mode="review"]):not([data-mode="setup"]) .changes-tray { align-self: end; grid-template-rows: auto; }
  .workbench[data-mode="sections"][data-needs-section="true"] .changes-tray { align-self: stretch; grid-template-rows: minmax(0,1fr); }
  .workbench[data-mode="sections"][data-needs-section="true"] .changes-header { display: none; }
  .workbench[data-mode="sections"][data-needs-section="true"] .ledger { display: grid; align-content: start; }
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
  .history-actions { display: flex; gap: 6px; padding: 0 8px 8px; }
  .history-actions button { flex: 1; min-height: 38px; }
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
  .primary, .secondary, .danger { min-height: 44px; padding-inline: 14px; border-radius: 10px; font-weight: 780; cursor: pointer; }
  .primary { color: #17191b; background: var(--ave-accent); border: 1px solid #ff9e6b; }
  .primary:hover:not(:disabled), .primary:focus-visible { background: #ff9664; outline: 2px solid #ffd0b5; outline-offset: 2px; }
  .secondary { color: #e0e6eb; background: var(--ave-surface-raised); border: 1px solid #52616f; }
  .secondary:hover:not(:disabled), .secondary:focus-visible { background: #30353a; outline: 2px solid #8f98a1; outline-offset: 2px; }
  .danger { color: #ffc9c9; background: #352326; border: 1px solid #60363b; }
  button:disabled { cursor: not-allowed; opacity: .34; filter: grayscale(.45); }
  dialog { width: min(600px, calc(100vw - 24px)); max-height: calc(100vh - 32px); overflow: auto; padding: 0; color: #f4f7fa; background: #202832; border: 1px solid #566574; border-radius: 17px; box-shadow: 0 28px 90px rgba(0,0,0,.68); }
  dialog::backdrop { background: rgba(7,9,10,.72); backdrop-filter: blur(5px); }
  .dialog-body { padding: 20px; }
  .dialog-file { margin: 5px 0 16px; overflow-wrap: anywhere; color: #b8d0e2; font: 600 11px/1.45 ui-monospace, monospace; }
  .source-warning { margin: -7px 0 14px; padding: 8px 10px; color: #ffe4a8; background: #352d18; border: 1px solid #66562b; border-radius: 9px; font-size: 11px; }
  label { display: block; margin: 12px 0 6px; color: #d4d8dc; font-size: 12px; font-weight: 720; }
  input, textarea { width: 100%; min-height: 44px; padding: 11px 12px; color: #fff; background: #151c23; border: 1px solid #586877; border-radius: 10px; }
  textarea { min-height: 150px; resize: vertical; line-height: 1.55; }
  input:focus, textarea:focus { border-color: #9dbbd3; outline: 3px solid rgba(157,187,211,.22); }
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
  .picker { display: none; align-items: center; gap: 8px; min-height: 48px; padding: 6px; color: #fff; background: #151719; border: 1px solid #3a4046; border-radius: 999px; box-shadow: 0 12px 35px rgba(0,0,0,.45); font: 12px/1.2 Inter,system-ui,sans-serif; }
  .picker[data-open="true"] { display: flex; }
  .picker-label { padding-left: 9px; font-weight: 700; white-space: nowrap; }
  .picker button { min-height: 36px; min-width: 36px; border-radius: 999px; }
  @media (max-width: 640px) {
    .workbench { width: calc(100vw - 12px); max-height: min(72vh, 680px); border-radius: 16px 16px 8px 8px; }
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
    html[data-astro-ve-setup-docked="true"] { overflow-x: hidden !important; }
    html[data-astro-ve-setup-docked="true"] body { width: calc(100% - 476px) !important; margin-left: 476px !important; }
  }
  [data-astro-ve-section-active="true"] { position: relative !important; outline: 3px solid #8fc7ee !important; outline-offset: -3px; }
  [data-astro-ve-drag-over="true"] { outline: 4px dashed #8fc7ee !important; outline-offset: -5px; }
  [data-astro-ve-dragging="true"] { opacity: .55 !important; }
  [data-astro-ve-ui] { box-sizing: border-box; }
  [data-astro-ve-inventory-status] { outline: none !important; }
  [data-astro-ve-inventory-focus="true"] { outline: 4px solid #8fc7ee !important; outline-offset: 5px !important; }
  [data-astro-ve-setup-pick="true"] { outline: 4px solid #8fc7ee !important; outline-offset: 5px !important; cursor: pointer !important; box-shadow: 0 0 0 8px rgba(75,151,203,.2) !important; }
  .astro-ve-section-controls { position: absolute !important; z-index: 2147483000 !important; top: 10px !important; right: 10px !important; display: grid !important; grid-template-columns: repeat(3,44px) !important; gap: 4px !important; width: fit-content !important; padding: 5px !important; color: #fff !important; background: rgba(29,38,47,.98) !important; border: 1px solid #667788 !important; border-radius: 11px !important; box-shadow: 0 8px 24px rgba(0,0,0,.42) !important; font: 700 12px/1 system-ui,sans-serif !important; }
  .astro-ve-section-controls button { position: relative !important; width: 44px !important; height: 44px !important; min-width: 44px !important; min-height: 44px !important; padding: 0 !important; color: inherit !important; background: #2b3844 !important; border: 1px solid #586a7a !important; border-radius: 8px !important; cursor: pointer !important; font: inherit !important; }
  .astro-ve-section-controls button:hover, .astro-ve-section-controls button:focus-visible { background: #3b4b59 !important; outline: 3px solid #a9c7df !important; outline-offset: 1px !important; }
  .astro-ve-section-controls button::after { position: absolute !important; z-index: 2147483647 !important; top: calc(100% + 8px) !important; left: 50% !important; width: max-content !important; max-width: min(240px, 70vw) !important; padding: 7px 9px !important; color: #fff !important; background: #090b0c !important; border: 1px solid #5b6269 !important; border-radius: 7px !important; box-shadow: 0 8px 22px rgba(0,0,0,.48) !important; content: attr(data-tooltip) !important; font: 600 12px/1.35 system-ui,sans-serif !important; opacity: 0 !important; pointer-events: none !important; transform: translateX(-50%) translateY(-2px) !important; transition: opacity .12s ease, transform .12s ease !important; white-space: normal !important; }
  .astro-ve-section-controls button:hover::after, .astro-ve-section-controls button:focus-visible::after { opacity: 1 !important; transform: translateX(-50%) translateY(0) !important; }
  .astro-ve-section-controls button:nth-child(3n + 1)::after { left: 0 !important; transform: translateY(-2px) !important; }
  .astro-ve-section-controls button:nth-child(3n + 1):hover::after, .astro-ve-section-controls button:nth-child(3n + 1):focus-visible::after { transform: translateY(0) !important; }
  .astro-ve-section-controls button:nth-child(3n)::after { right: 0 !important; left: auto !important; transform: translateY(-2px) !important; }
  .astro-ve-section-controls button:nth-child(3n):hover::after, .astro-ve-section-controls button:nth-child(3n):focus-visible::after { transform: translateY(0) !important; }
  .astro-ve-drag-handle { cursor: grab !important; }
  @media (prefers-reduced-motion: reduce) { .astro-ve-section-controls button::after { transition: none !important; } }
  @media (max-width: 640px) { .astro-ve-section-controls { position: sticky !important; top: 6px !important; margin: 6px !important; width: fit-content !important; } }
`;
