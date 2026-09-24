/**
 * dsh-automation — 注入的样式（唯一 `<style data-dsh-automation-style>`，类名带 `da-` 前缀）。
 *
 * 颜色全部取自 DSH 主题变量（dsh-client-ui-theme 的 --dsw-alias-*，带兜底值），
 * 与「新会话」「日程」等主界面保持一致。侧栏条目卡片化对齐「新会话」按钮。
 */
const CSS = `
.da-root{--da-border:var(--dsw-alias-border-l2,#e5e7eb);--da-border-strong:var(--dsw-alias-border-l3,#d0d3d9);--da-text:var(--dsw-alias-label-primary,#1f2328);--da-text-dim:var(--dsw-alias-label-secondary,#57606a);--da-text-faint:var(--dsw-alias-label-tertiary,#8b949e);--da-accent:var(--dsw-alias-brand-primary,#2f6fed);--da-bg:var(--dsw-alias-bg-base,#f7f8fa);--da-card:var(--dsw-alias-bg-layer-1,#ffffff);--da-card-2:var(--dsw-alias-bg-layer-2,#f2f3f5);--da-hover:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.05));--da-ok:var(--dsw-alias-state-success-primary,#2e7d32);--da-err:var(--dsw-alias-state-error-primary,#c62828);--da-warn:var(--dsw-alias-state-warn-primary,#b26a00);
display:flex;flex-direction:column;height:100%;min-height:0;background:var(--da-bg);color:var(--da-text);font-size:14px;line-height:1.5;overflow:hidden;box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif;}
.da-root *{box-sizing:border-box;}
.da-header{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 16px;border-bottom:1px solid var(--da-border-strong);background:var(--da-card);flex:none;}
.da-header h1{font-size:15px;font-weight:600;margin:0;letter-spacing:.2px;}
.da-header-sub{font-size:12px;color:var(--da-text-dim);margin-top:2px;}
.da-tabs{display:flex;gap:8px;border-bottom:1px solid var(--da-border);padding:0 16px;flex:none;}
.da-tabs button{border:0;background:transparent;color:var(--da-text-dim);padding:8px 14px;border-radius:6px 6px 0 0;cursor:pointer;font-size:13px;border-bottom:2px solid transparent;}
.da-tabs button:hover{background:var(--da-hover);}
.da-tabs button.da-active{color:var(--da-accent);font-weight:600;border-bottom-color:var(--da-accent);}
.da-main{flex:1;min-height:0;overflow:auto;padding:14px 16px;display:flex;flex-direction:column;gap:10px;}
.da-btn{border:1px solid var(--da-border);background:var(--da-card);color:var(--da-text);padding:4px 12px;border-radius:6px;cursor:pointer;font-size:13px;}
.da-btn:hover{background:var(--da-hover);}
.da-btn.da-primary{background:var(--da-accent);border-color:var(--da-accent);color:#fff;}
.da-btn.da-primary:hover{filter:brightness(1.05);}
.da-btn.da-danger{color:var(--da-err);border-color:color-mix(in srgb,var(--da-err) 40%,transparent);}
.da-btn:disabled{opacity:.5;cursor:default;}
.da-btn-sm{padding:2px 8px;font-size:12px;}
.da-card{background:var(--da-card);border:1px solid var(--da-border);border-radius:10px;padding:10px 14px;}
.da-card-head{display:flex;align-items:center;justify-content:space-between;gap:8px;}
.da-card-title{font-weight:600;font-size:14px;display:flex;align-items:center;gap:8px;min-width:0;}
.da-card-sub{font-size:12px;color:var(--da-text-dim);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.da-dim{color:var(--da-text-dim);font-size:12px;}
.da-empty{color:var(--da-text-dim);text-align:center;padding:24px 8px;font-size:13px;}
.da-badge{display:inline-flex;align-items:center;border-radius:10px;padding:1px 8px;font-size:11px;line-height:18px;flex:none;}
.da-badge.da-on{background:color-mix(in srgb,var(--da-ok) 12%,transparent);color:var(--da-ok);}
.da-badge.da-off{background:var(--da-hover);color:var(--da-text-dim);}
.da-tag{font-size:11px;padding:1px 8px;border-radius:10px;background:color-mix(in srgb,var(--da-accent) 10%,transparent);color:var(--da-accent);flex:none;}
.da-filter{display:flex;gap:8px;align-items:center;flex-wrap:wrap;}
.da-input,.da-select{border:1px solid var(--da-border);border-radius:6px;padding:4px 8px;font-size:13px;background:var(--da-card);color:var(--da-text);}
.da-input:focus,.da-select:focus{outline:2px solid color-mix(in srgb,var(--da-accent) 35%,transparent);outline-offset:-1px;}
.da-run{display:flex;align-items:center;justify-content:space-between;gap:8px;border-bottom:1px solid var(--da-border);padding:6px 4px;}
.da-run:last-child{border-bottom:0;}
.da-status{font-size:12px;font-weight:600;}
.da-status.da-s-running{color:var(--da-accent);}
.da-status.da-s-success{color:var(--da-ok);}
.da-status.da-s-failed{color:var(--da-err);}
.da-status.da-s-cancelled,.da-status.da-s-skipped{color:var(--da-text-dim);}
.da-status.da-s-timeout{color:var(--da-warn);}
.da-modal{position:fixed;inset:0;background:var(--dsw-alias-bg-mask-2,rgba(0,0,0,.4));display:flex;justify-content:flex-end;z-index:1000;}
.da-modal-card{background:var(--da-card);height:100%;width:460px;max-width:94vw;overflow:auto;padding:18px 20px;box-sizing:border-box;box-shadow:-8px 0 32px rgba(0,0,0,.12);}
.da-modal-card h2{margin:0 0 14px;font-size:15px;}
.da-form{display:flex;flex-direction:column;gap:12px;}
.da-field{display:flex;flex-direction:column;gap:4px;}
.da-field>label{font-size:12px;color:var(--da-text-dim);}
.da-inline{display:flex;gap:8px;align-items:center;flex-wrap:wrap;}
.da-log{font-size:12px;background:var(--da-card-2);border-radius:8px;padding:10px;overflow:auto;max-height:300px;white-space:pre-wrap;margin:0;color:var(--da-text);}

/* ── DSH 侧边栏面板条目展示覆盖（非 .da- 体系）──────────────────────────
 * 框架把面板条目渲染为透明灰字行（panelRow），而「新会话」是白卡片。
 * 这里把条目卡片化对齐「新会话」；CSS modules 类名为“哈希前缀+原名”，
 * 用 [class*=原名] 稳定匹配，失配时自动降级回框架原生样式（纯视觉，无功能影响）。
 */
body [class*="root"]:not([class*="collapsed"]) nav[class*="panelList"] button[class*="panelRow"]{
  border:.5px solid var(--dsw-alias-border-l3,#d0d3d9);
  background:var(--dsw-alias-button-elevated-fill,#ffffff);
  border-radius:12px;height:38px;min-height:38px;margin:0 2px;
  justify-content:center;gap:6px;padding:8px 16px;
  color:var(--dsw-alias-label-primary,#1f2328);
  font-size:14px;font-weight:500;line-height:22px;
}
body [class*="root"]:not([class*="collapsed"]) nav[class*="panelList"] button[class*="panelRow"]:hover{
  background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.04));
}
body [class*="root"]:not([class*="collapsed"]) nav[class*="panelList"] button[class*="panelRow"][class*="panelActive"]{
  background:var(--dsw-alias-interactive-bg-active,rgba(47,111,237,.1));
  box-shadow:inset 0 0 0 1px var(--dsw-alias-brand-primary,#2f6fed);
  color:var(--dsw-alias-label-primary,#1f2328);
}
/* 折叠态（36px rail）：还原为透明图标，与「新会话」折叠态一致 */
[class*="collapsed"] nav[class*="panelList"] button[class*="panelRow"]{
  background:0 0;border-color:transparent;border-radius:8px;
  width:36px;height:36px;min-height:36px;margin:0;justify-content:center;padding:0;box-shadow:none;
}
`

let injected = false

/** 注入一次样式；幂等。 */
export function injectStyle(): void {
  if (injected) return
  const style = document.createElement('style')
  style.setAttribute('data-dsh-automation-style', '')
  style.textContent = CSS
  document.head.appendChild(style)
  injected = true
}

/** 测试/卸载用（可逆）。 */
export function removeStyle(): void {
  document.head.querySelectorAll('[data-dsh-automation-style]').forEach(node => node.remove())
  injected = false
}
