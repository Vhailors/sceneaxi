export function frameScript(): string {
  return `  const bindingLabel = (binding) => {
    if (binding.device === 'keyboard') {
      const names = { primary: 'Ctrl/Cmd', control: 'Ctrl', meta: 'Cmd', alt: 'Alt', shift: 'Shift' };
      const key = binding.code.startsWith('Key') ? binding.code.slice(3)
        : binding.code.startsWith('Digit') ? binding.code.slice(5) : binding.code;
      return binding.modifiers.map((modifier) => names[modifier]).concat(key).join('+');
    }
    if (binding.device === 'pointer') return 'Pointer ' + binding.button + ' ' + binding.gesture;
    if (binding.device === 'wheel') return 'Wheel ' + binding.axis.toUpperCase();
    if (binding.device === 'gamepad') {
      return 'Gamepad ' + (binding.gamepad + 1) + ' ' + binding.input + ' ' + binding.control;
    }
    return 'Controller ' + (binding.controller + 1) + ' ' + binding.input + ' ' + binding.control;
  };

  const refreshInputBindingLabels = () => {
    q('[data-input-binding-label]').forEach((el) => {
      const row = activeInputActionMap.bindings.find((candidate) =>
        candidate.actionId === el.dataset.inputBindingLabel);
      if (row) el.textContent = bindingLabel(row.binding);
    });
  };

  const keyboardBindingMatches = (binding, event) => {
    if (!binding || binding.device !== 'keyboard') return false;
    const fallback = String(event.key).length === 1
      ? 'Key' + String(event.key).toUpperCase()
      : String(event.key);
    if (binding.code !== (event.code || fallback)) return false;
    const modifiers = binding.modifiers;
    const primary = event.ctrlKey || event.metaKey;
    if (modifiers.includes('primary') !== primary) return false;
    if (!modifiers.includes('primary')) {
      if (modifiers.includes('control') !== Boolean(event.ctrlKey)) return false;
      if (modifiers.includes('meta') !== Boolean(event.metaKey)) return false;
    }
    return modifiers.includes('alt') === Boolean(event.altKey) &&
      modifiers.includes('shift') === Boolean(event.shiftKey);
  };

  const resolveKeyboardAction = (event) => {
    const row = activeInputActionMap.bindings.find((candidate) =>
      keyboardBindingMatches(candidate.binding, event));
    if (!row) return null;
    const definition = T.inputActions.find((candidate) => candidate.id === row.actionId);
    return definition && definition.contexts.includes('editor') ? definition : null;
  };`;
}
