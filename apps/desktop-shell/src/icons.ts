/** Hand-drawn desktop symbols on a 16-pixel grid with two-pixel optical padding. */
const PATHS = Object.freeze({
  select: "M3 2 13 8 8 9 6 14Z",
  move: "M8 2V14M2 8H14M6 4 8 2 10 4M6 12 8 14 10 12M4 6 2 8 4 10M12 6 14 8 12 10",
  rotate: "M13 6A5 5 0 1 0 13 10M10 6H14V2",
  scale: "M3 7V13H9M3 13 13 3M8 3H13V8",
  local: "M4 2V12H14M2 4 4 2 6 4M12 10 14 12 12 14M4 12 9 7M6 7H9V10",
  world: "M14 8A6 6 0 1 1 2 8 6 6 0 0 1 14 8ZM2 8H14M8 2C4 5 4 11 8 14 12 11 12 5 8 2Z",
  pivot: "M8 2V5M8 11V14M2 8H5M11 8H14M10 8A2 2 0 1 1 6 8 2 2 0 0 1 10 8Z",
  center: "M2 6V2H6M10 2H14V6M2 10V14H6M10 14H14V10M10 8A2 2 0 1 1 6 8 2 2 0 0 1 10 8Z",
  snap: "M3 3V9A5 5 0 0 0 13 9V3H10V9A2 2 0 0 1 6 9V3ZM3 6H6M10 6H13",
  play: "M4 2 13 8 4 14Z",
  pause: "M4 3H6V13H4ZM10 3H12V13H10Z",
  step: "M3 3 10 8 3 13ZM13 3V13",
  stop: "M3 3H13V13H3Z",
  save: "M3 2H11L14 5V14H2V2ZM5 2V6H10V2M5 14V9H11V14",
  undo: "M6 3 2 7 6 11M2 7H10C14 7 14 13 10 13H8",
  redo: "M10 3 14 7 10 11M14 7H6C2 7 2 13 6 13H8",
  duplicate: "M6 6H14V14H6ZM10 6V2H2V10H6",
  delete: "M2 4H14M6 4V2H10V4M4 4 5 14H11L12 4M7 7V11M9 7V11",
  rename: "M2 13 3 9 10 2 14 6 7 13ZM8 4 12 8M2 14H14",
  "chevron-right": "M6 3 11 8 6 13",
  "chevron-down": "M3 6 8 11 13 6",
  eye: "M2 8Q8 0 14 8 8 16 2 8ZM10 8A2 2 0 1 1 6 8 2 2 0 0 1 10 8Z",
  "eye-off": "M2 2 14 14M6 4Q11 3 14 8L12 10M10 12Q5 13 2 8L4 6M7 7 9 9",
  lock: "M3 7H13V14H3ZM5 7V5A3 3 0 0 1 11 5V7M8 10V11",
  unlock: "M3 7H13V14H3ZM5 7V5A3 3 0 0 1 11 5M8 10V11",
  plus: "M8 3V13M3 8H13",
  more: "M3 8H3.1M8 8H8.1M13 8H13.1",
  search: "M11 6.5A4.5 4.5 0 1 1 2 6.5 4.5 4.5 0 0 1 11 6.5ZM10 10 14 14",
  filter: "M2 3H14L9 8V12L7 14V8Z",
  close: "M3 3 13 13M13 3 3 13",
  "drag-handle": "M6 3H6.1M10 3H10.1M6 8H6.1M10 8H10.1M6 13H6.1M10 13H10.1",
  object: "M8 2 14 5V11L8 14 2 11V5ZM2 5 8 8 14 5M8 8V14",
  group: "M6 2H10V6H6ZM2 10H6V14H2ZM10 10H14V14H10ZM8 6V8M4 10V8H12V10",
  "light-directional": "M8 5A3 3 0 1 1 2 5 3 3 0 0 1 8 5ZM9 9 14 14M10 14H14V10M10 5 14 9M5 10 9 14",
  "light-point": "M11 8A3 3 0 1 1 5 8 3 3 0 0 1 11 8ZM8 2V3M8 13V14M2 8H3M13 8H14M3 3 4 4M12 12 13 13M3 13 4 12M12 4 13 3",
  "light-spot": "M5 2H11L10 5H6ZM6 5 2 13Q8 15 14 13L10 5M8 8V11",
  camera: "M2 5H10V13H2ZM10 7 14 5V13L10 11M4 5 5 3H7L8 5",
  audio: "M2 6H5L9 3V13L5 10H2ZM12 5Q16 8 12 11",
  effect: "M8 2 9.5 6.5 14 8 9.5 9.5 8 14 6.5 9.5 2 8 6.5 6.5ZM12 2V4M11 3H13",
  behaviour: "M2 2H6V6H2ZM10 10H14V14H10ZM6 4H12V8M10 6 12 8 14 6M4 6V12H8M6 10 8 12 6 14",
  prefab: "M8 2 14 5.5V10.5L8 14 2 10.5V5.5ZM8 5 11 6.5V9.5L8 11 5 9.5V6.5ZM5 6.5 8 8 11 6.5M8 8V11",
  model: "M3 2H9L13 6V14H3ZM9 2V6H13M8 7 11 9 8 12 5 9Z",
  texture: "M2 2H14V14H2ZM2 6H14M2 10H14M6 2V14M10 2V14",
  "audio-file": "M3 2H9L13 6V14H3ZM9 2V6H13M9 7V10.5A1.5 1.5 0 1 1 7.5 9H9",
  font: "M2 13 6 3 10 13M4 9H8M10 7H14M12 7V13",
  animation: "M2 3H14V13H2ZM5 3V13M11 3V13M2 6H5M2 10H5M11 6H14M11 10H14M7 6 9 8 7 10Z",
  info: "M14 8A6 6 0 1 1 2 8 6 6 0 0 1 14 8ZM8 7V11M8 5H8.1",
  warning: "M8 2 14 13H2ZM8 6V9M8 11H8.1",
  error: "M14 8A6 6 0 1 1 2 8 6 6 0 0 1 14 8ZM6 6 10 10M10 6 6 10",
  ok: "M3 8 6 11 13 4",
  spinner: "M8 2A6 6 0 1 1 2 8",
  mark: "M8 2 14 8 8 14 2 8ZM5 8H11M8 5V11",
  send: "M2 2 14 8 2 14 5 8ZM5 8H14",
  attach: "M6 9 10 5C12 3 15 6 13 8L8 13C5 16 0 11 3 8L9 2",
  history: "M2 3V7H6M2.5 6A5.5 5.5 0 1 1 3 11M8 5V8L11 10",
  "new-chat": "M9 3H2V12H5V14L8 12H14V8M12 2V6M10 4H14",
  grid: "M2 2H14V14H2ZM2 6H14M2 10H14M6 2V14M10 2V14",
  stats: "M3 3V13H14M6 10V8M9 10V5M12 10V2",
  shading: "M14 8A6 6 0 1 1 2 8 6 6 0 0 1 14 8ZM8 2V14M8 5H13M8 8H14M8 11H13",
  perspective: "M2 4 14 2V14L2 12ZM6 3.5V12.5M10 3V13M2 8H14",
  orthographic: "M3 3H13V13H3ZM3 8H13M8 3V13",
  layout: "M2 2H14V14H2ZM2 5H14M5 5V14M11 5V14M5 11H11",
  settings: "M2 4H5M9 4H14M2 12H9M13 12H14M9 4A2 2 0 1 1 5 4 2 2 0 0 1 9 4ZM13 12A2 2 0 1 1 9 12 2 2 0 0 1 13 12Z",
  help: "M14 8A6 6 0 1 1 2 8 6 6 0 0 1 14 8ZM6 6A2 2 0 1 1 9 7.7L8 8.5V9M8 11H8.1",
  export: "M3 8V14H13V8M8 10V2M5 5 8 2 11 5",
});

export type IconId = keyof typeof PATHS;

/** Emit once per document; icon instances inherit their category or state colour. */
export function iconSprite(): string {
  return `<svg hidden style="display:none" aria-hidden="true" focusable="false"><defs>${Object.entries(PATHS).map(([id, path]) =>
    `<symbol id="i-${id}" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="${path}"/></symbol>`,
  ).join("")}</defs></svg>`;
}

/** Decorative mark only. Its owning control supplies the label and binding tooltip. */
export function icon(id: IconId): string {
  return `<svg class="icon" aria-hidden="true" focusable="false" width="16" height="16" viewBox="0 0 16 16"><use href="#i-${id}"/></svg>`;
}
