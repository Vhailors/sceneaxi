export function paletteStyles(): string {
  return `.palette-list{list-style:none;margin:0;padding:var(--space-1) 0;max-height:352px;overflow-y:auto}
.palette-group h3{margin:0;padding:var(--space-3) var(--space-6) var(--space-1);font-size:13px;font-weight:500;color:var(--faint)}
.palette-group ul{list-style:none;margin:0;padding:0}
.palette-item{display:flex;align-items:center;gap:12px;padding:8px 16px;width:100%;text-align:left}
.palette-item:hover{background:var(--hover)}
.palette-name{flex:1;font-size:13px}
.palette-item kbd{font-size:13px;color:var(--dim);border:1px solid var(--line-control);border-radius:var(--r-control);padding:1px var(--space-1)}`;
}
