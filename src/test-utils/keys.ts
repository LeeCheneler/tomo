/** Named key constants for readable stdin.write calls in tests. */
export const keys = {
  backspace: "\x08",
  delete: "\x7f",
  enter: "\r",
  shiftEnter: "\x1b[13;2u",
  escape: "\x1b",
  tab: "\t",
  left: "\x1b[D",
  right: "\x1b[C",
  up: "\x1b[A",
  down: "\x1b[B",
  optionLeft: "\x1b[1;3D",
  optionRight: "\x1b[1;3C",
  /** Readline alt+b — word-left in some terminals. */
  readlineWordLeft: "\x1bb",
  /** Readline alt+f — word-right in some terminals. */
  readlineWordRight: "\x1bf",
  /** Option+Backspace — delete word backward. */
  optionBackspace: "\x1b\x7f",
  /** Readline alt+d — delete word forward. */
  readlineWordDelete: "\x1bd",
  ctrlA: "\x01",
} as const;
