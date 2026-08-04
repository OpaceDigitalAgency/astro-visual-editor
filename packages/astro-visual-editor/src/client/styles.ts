export const toolbarStyles = String.raw`
  :host { color-scheme: dark; --ave-accent: #ff7a3d; --ave-ink: #f7f5f2; --ave-muted: #aeb4bb; }
  * { box-sizing: border-box; }
  button, input, textarea { font: inherit; }
  button { min-width: 44px; min-height: 44px; }
  .workbench {
    width: min(480px, calc(100vw - 24px)); max-height: min(760px, calc(100vh - 92px));
    display: none; overflow: hidden; color: var(--ave-ink); background: #121416;
    border: 1px solid #34383d; border-radius: 18px; box-shadow: 0 28px 90px rgba(0,0,0,.58);
    font: 14px/1.45 Inter, ui-sans-serif, system-ui, sans-serif;
  }
  .workbench[data-open="true"] { display: grid; grid-template-rows: auto auto auto minmax(0,1fr) auto auto; }
  .workbench[data-open="true"][data-minimized="true"] { display: none; }
  .masthead { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding: 17px 18px 13px; border-bottom: 1px solid #2a2e32; }
  .eyebrow { margin: 0 0 5px; color: #ff9a65; font: 750 10px/1.2 ui-monospace, monospace; letter-spacing: .14em; text-transform: uppercase; }
  h2, h3 { margin: 0; letter-spacing: -.025em; }
  h2 { font-size: 19px; } h3 { font-size: 15px; }
  .status { display: flex; align-items: center; gap: 8px; margin: 9px 0 0; color: var(--ave-muted); font-size: 12px; }
  .status-dot { width: 8px; height: 8px; flex: 0 0 auto; border-radius: 50%; background: #6ee7a8; box-shadow: 0 0 0 4px rgba(110,231,168,.1); }
  .status[data-state="warning"] .status-dot { background: #ffd166; }
  .status[data-state="error"] .status-dot { background: #ff8585; }
  .icon-button { display: inline-grid; place-items: center; padding: 0; color: #cfd4d9; background: #202428; border: 1px solid #393f45; border-radius: 10px; cursor: pointer; }
  .icon-button:hover, .icon-button:focus-visible { color: white; background: #2c3136; outline: 2px solid #ffad82; outline-offset: 2px; }
  .mode-tabs { display: grid; grid-template-columns: repeat(4,1fr); gap: 4px; padding: 8px; background: #191c1f; border-bottom: 1px solid #2a2e32; }
  .mode-tab { min-width: 0; min-height: 40px; padding: 6px; color: #aeb4bb; background: transparent; border: 1px solid transparent; border-radius: 9px; cursor: pointer; font-size: 12px; font-weight: 750; }
  .mode-tab[aria-selected="true"] { color: #fff; background: #2b2f33; border-color: #474d53; }
  .mode-tab:focus-visible { outline: 2px solid #ffad82; outline-offset: 1px; }
  .instructions { padding: 11px 18px; color: #c5cad0; background: #1b1e21; border-bottom: 1px solid #2a2e32; font-size: 12px; }
  .ledger { min-height: 145px; overflow: auto; padding: 12px; overscroll-behavior: contain; }
  .empty { display: grid; place-items: center; min-height: 118px; padding: 18px; text-align: center; color: #858d95; border: 1px dashed #3b4147; border-radius: 12px; }
  .change { display: grid; grid-template-columns: minmax(0,1fr) auto; gap: 10px; padding: 12px; margin-bottom: 8px; background: #1e2124; border: 1px solid #30353a; border-radius: 12px; }
  .change-type { display: inline-flex; width: fit-content; margin-bottom: 6px; padding: 2px 7px; color: #ffd3bc; background: #472b1f; border-radius: 999px; font: 700 10px/1.5 ui-monospace, monospace; text-transform: uppercase; }
  .file { overflow: hidden; color: #ffab7a; font: 600 11px/1.4 ui-monospace, monospace; text-overflow: ellipsis; white-space: nowrap; }
  .change-summary { margin-top: 8px; color: #f7f5f2; font-size: 12px; font-weight: 760; }
  .diff { display: grid; gap: 3px; margin-top: 7px; font-size: 12px; overflow-wrap: anywhere; }
  .old { color: #959da5; text-decoration: line-through; } .new { color: #f7f5f2; }
  .message { display: none; margin: 0 12px 10px; padding: 10px 12px; border-radius: 10px; font-size: 12px; }
  .message[data-show="true"] { display: block; }
  .message[data-kind="error"] { color: #ffd0d0; background: #3b2427; border: 1px solid #6f3940; }
  .message[data-kind="success"] { color: #c9f7de; background: #183128; border: 1px solid #2d624b; }
  .message[data-kind="warning"] { color: #ffe8ae; background: #352d18; border: 1px solid #66562b; }
  .history-actions { display: flex; gap: 6px; padding: 0 12px 10px; }
  .history-actions button { flex: 1; min-height: 38px; }
  .actions { display: grid; grid-template-columns: minmax(0,1fr) auto auto; gap: 8px; padding: 12px; border-top: 1px solid #2a2e32; }
  .primary, .secondary, .danger { min-height: 44px; padding-inline: 14px; border-radius: 10px; font-weight: 780; cursor: pointer; }
  .primary { color: #17191b; background: var(--ave-accent); border: 1px solid #ff9e6b; }
  .primary:hover:not(:disabled), .primary:focus-visible { background: #ff9664; outline: 2px solid #ffd0b5; outline-offset: 2px; }
  .secondary { color: #d8dce0; background: #24282c; border: 1px solid #3a4046; }
  .secondary:hover:not(:disabled), .secondary:focus-visible { background: #30353a; outline: 2px solid #8f98a1; outline-offset: 2px; }
  .danger { color: #ffc9c9; background: #352326; border: 1px solid #60363b; }
  button:disabled { cursor: not-allowed; opacity: .42; }
  dialog { width: min(600px, calc(100vw - 24px)); max-height: calc(100vh - 32px); overflow: auto; padding: 0; color: #f7f5f2; background: #17191b; border: 1px solid #3a3f45; border-radius: 17px; box-shadow: 0 28px 90px rgba(0,0,0,.68); }
  dialog::backdrop { background: rgba(7,9,10,.72); backdrop-filter: blur(5px); }
  .dialog-body { padding: 20px; }
  .dialog-file { margin: 5px 0 16px; overflow-wrap: anywhere; color: #ffab7a; font: 600 11px/1.45 ui-monospace, monospace; }
  label { display: block; margin: 12px 0 6px; color: #d4d8dc; font-size: 12px; font-weight: 720; }
  input, textarea { width: 100%; min-height: 44px; padding: 11px 12px; color: #fff; background: #0f1113; border: 1px solid #454c53; border-radius: 10px; }
  textarea { min-height: 150px; resize: vertical; line-height: 1.55; }
  input:focus, textarea:focus { border-color: #ff8a4c; outline: 3px solid rgba(255,138,76,.2); }
  .field-help { margin: 5px 0 0; color: #929aa2; font-size: 11px; }
  .dialog-actions { display: flex; justify-content: flex-end; flex-wrap: wrap; gap: 8px; margin-top: 18px; }
  .template-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 9px; margin-top: 16px; }
  .template-card { min-height: 118px; padding: 13px; text-align: left; color: #e9ecef; background: #202428; border: 1px solid #3a4147; border-radius: 12px; cursor: pointer; }
  .template-card strong, .template-card span { display: block; } .template-card span { margin-top: 7px; color: #aeb4bb; font-size: 11px; line-height: 1.45; }
  .template-card:hover, .template-card:focus-visible { border-color: #ff8a4c; outline: 2px solid rgba(255,138,76,.35); }
  .seo-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0 12px; }
  .seo-grid .wide { grid-column: 1 / -1; }
  .picker { display: none; align-items: center; gap: 8px; min-height: 48px; padding: 6px; color: #fff; background: #151719; border: 1px solid #3a4046; border-radius: 999px; box-shadow: 0 12px 35px rgba(0,0,0,.45); font: 12px/1.2 Inter,system-ui,sans-serif; }
  .picker[data-open="true"] { display: flex; }
  .picker-label { padding-left: 9px; font-weight: 700; white-space: nowrap; }
  .picker button { min-height: 36px; min-width: 36px; border-radius: 999px; }
  @media (max-width: 640px) {
    .workbench { width: calc(100vw - 12px); max-height: min(72vh, 680px); border-radius: 16px 16px 8px 8px; }
    .template-grid { grid-template-columns: 1fr; } .seo-grid { grid-template-columns: 1fr; }
    .seo-grid .wide { grid-column: auto; } .actions { grid-template-columns: 1fr auto; }
    .revert { grid-column: 1 / -1; }
  }
  @media (forced-colors: active) { * { forced-color-adjust: auto; } }
  @media (prefers-reduced-motion: no-preference) {
    .workbench { animation: ave-arrive .16s ease-out; }
    @keyframes ave-arrive { from { opacity: 0; transform: translateY(6px) scale(.985); } }
  }
`;

export const pageSectionStyles = String.raw`
  [data-astro-ve-section-active="true"] { position: relative !important; outline: 3px solid #ff7a3d !important; outline-offset: -3px; }
  [data-astro-ve-drag-over="true"] { outline: 4px dashed #ff7a3d !important; outline-offset: -5px; }
  [data-astro-ve-dragging="true"] { opacity: .55 !important; }
  [data-astro-ve-ui] { box-sizing: border-box; }
  .astro-ve-section-controls { position: absolute !important; z-index: 2147483000 !important; top: 10px !important; right: 10px !important; display: flex !important; gap: 4px !important; padding: 5px !important; color: #fff !important; background: rgba(18,20,22,.96) !important; border: 1px solid #515860 !important; border-radius: 11px !important; box-shadow: 0 8px 24px rgba(0,0,0,.38) !important; font: 700 12px/1 system-ui,sans-serif !important; }
  .astro-ve-section-controls button { position: relative !important; width: 38px !important; height: 38px !important; min-width: 38px !important; min-height: 38px !important; padding: 0 !important; color: inherit !important; background: #292e33 !important; border: 1px solid #454c53 !important; border-radius: 8px !important; cursor: pointer !important; font: inherit !important; }
  .astro-ve-section-controls button:hover, .astro-ve-section-controls button:focus-visible { background: #3a4147 !important; outline: 3px solid #ffb08a !important; outline-offset: 1px !important; }
  .astro-ve-section-controls button::after { position: absolute !important; z-index: 2147483647 !important; top: calc(100% + 8px) !important; left: 50% !important; width: max-content !important; max-width: min(240px, 70vw) !important; padding: 7px 9px !important; color: #fff !important; background: #090b0c !important; border: 1px solid #5b6269 !important; border-radius: 7px !important; box-shadow: 0 8px 22px rgba(0,0,0,.48) !important; content: attr(data-tooltip) !important; font: 600 12px/1.35 system-ui,sans-serif !important; opacity: 0 !important; pointer-events: none !important; transform: translateX(-50%) translateY(-2px) !important; transition: opacity .12s ease, transform .12s ease !important; white-space: normal !important; }
  .astro-ve-section-controls button:hover::after, .astro-ve-section-controls button:focus-visible::after { opacity: 1 !important; transform: translateX(-50%) translateY(0) !important; }
  .astro-ve-section-controls button:first-child::after { left: 0 !important; transform: translateY(-2px) !important; }
  .astro-ve-section-controls button:first-child:hover::after, .astro-ve-section-controls button:first-child:focus-visible::after { transform: translateY(0) !important; }
  .astro-ve-section-controls button:last-child::after { right: 0 !important; left: auto !important; transform: translateY(-2px) !important; }
  .astro-ve-section-controls button:last-child:hover::after, .astro-ve-section-controls button:last-child:focus-visible::after { transform: translateY(0) !important; }
  .astro-ve-drag-handle { cursor: grab !important; }
  @media (prefers-reduced-motion: reduce) { .astro-ve-section-controls button::after { transition: none !important; } }
  @media (max-width: 640px) { .astro-ve-section-controls { position: sticky !important; top: 6px !important; margin: 6px !important; width: fit-content !important; } }
`;
