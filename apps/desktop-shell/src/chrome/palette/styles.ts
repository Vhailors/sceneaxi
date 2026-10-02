export function paletteStyles(): string {
  return `.palette-list{list-style:none;margin:0;padding:6px 0;max-height:352px;overflow-y:auto}
.palette-group h3{margin:0;padding:8px 16px 4px;font-family:var(--mono);font-size:9px;font-weight:400;letter-spacing:.14em;color:var(--faint)}
.palette-group ul{list-style:none;margin:0;padding:0}
.palette-item{display:flex;align-items:center;gap:12px;padding:8px 16px;width:100%;text-align:left}
.palette-item:hover{background:var(--hover)}
.palette-name{flex:1;font-size:13px}
.palette-item kbd{font-size:9px;color:var(--dim);border:1px solid var(--line-control);border-radius:3px;padding:2px 5px}`;
}
