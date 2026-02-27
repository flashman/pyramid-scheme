// ── FILE: engine/dialogue.js ─────────────────────────────
// Canvas-rendered branching dialogue system.

import { Events } from './events.js';

export class Dialogue {
  constructor(nodes) {
    this.nodes = nodes;
  }
}

export const DialogueManager = (() => {
  let _active    = false;
  let _dialogue  = null;
  let _node      = null;
  let _typeLen   = 0;
  let _typeStart = 0;
  let _choiceIdx = 0;
  const TYPE_SPEED = 35;

  function _resolveNode(raw) {
    if (!raw) return null;
    const node = { ...raw };
    if (typeof node.text === 'function') node.text = node.text();
    if (node.choices) {
      node.choices = node.choices.filter(c => !c.condition || c.condition());
    }
    return node;
  }

  function _goto(nodeId) {
    if (!nodeId) { close(); return; }
    const raw = _dialogue.nodes[nodeId];
    if (!raw) { close(); return; }
    if (raw.condition && !raw.condition()) {
      _goto(raw.conditionFail || null);
      return;
    }
    _node      = _resolveNode(raw);
    _typeLen   = 0;
    _typeStart = Date.now();
    _choiceIdx = 0;
    _node.onEnter?.();
    Events.emit('dialogue:node', { nodeId });
  }

  function _typewriterDone() {
    return _node && _typeLen >= _node.text.length;
  }

  function _confirm() {
    if (!_active || !_node) return;
    if (!_typewriterDone()) {
      _typeLen = _node.text.length;
      return;
    }
    if (_node.choices && _node.choices.length > 0) {
      const choice = _node.choices[_choiceIdx];
      if (choice) {
        choice.action?.();
        _node.onComplete?.();
        _goto(choice.next || null);
      }
    } else {
      _node.onComplete?.();
      _goto(_node.next || null);
    }
  }

  function close() {
    _active = false;
    const el = document.getElementById('dlg');
    if (el) el.classList.remove('active');
    Events.emit('dialogue:end', {});
  }

  return {
    start(dialogue, startNode = 'start') {
      _dialogue = dialogue;
      _active   = true;
      _goto(startNode);
      Events.emit('dialogue:start', {});
    },

    isActive() { return _active; },

    update() {
      if (!_active || !_node) return;
      _typeLen = Math.min(_node.text.length, Math.floor((Date.now() - _typeStart) / TYPE_SPEED));
    },

    onKeyDown(key) {
      if (!_active) return false;
      if (key === 'Escape') { close(); return true; }
      if (key === ' ' || key === 'Enter' || key === 'z' || key === 'Z') {
        _confirm(); return true;
      }
      if (key === 'ArrowUp'   && _node?.choices) { _choiceIdx = (_choiceIdx - 1 + _node.choices.length) % _node.choices.length; return true; }
      if (key === 'ArrowDown' && _node?.choices) { _choiceIdx = (_choiceIdx + 1) % _node.choices.length; return true; }
      return true;
    },

    render() {
      if (!_active || !_node) {
        document.getElementById('dlg').classList.remove('active');
        return;
      }
      this.update();

      const el        = document.getElementById('dlg');
      const speakerEl = document.getElementById('dlg-speaker');
      const textEl    = document.getElementById('dlg-text');
      const choicesEl = document.getElementById('dlg-choices');
      const hintEl    = document.getElementById('dlg-hint');

      el.classList.add('active');
      speakerEl.textContent = _node.speaker || '';
      textEl.textContent    = _node.text.substring(0, _typeLen);

      const textDone   = _typewriterDone();
      const hasChoices = _node.choices?.length > 0;

      if (textDone && hasChoices) {
        choicesEl.innerHTML = _node.choices.map((c, i) =>
          `<div class="dlg-choice${i === _choiceIdx ? ' sel' : ''}">${i === _choiceIdx ? '▶ ' : '  '}${c.label}</div>`
        ).join('');
        hintEl.textContent = '↑↓ SELECT   SPACE / ENTER CONFIRM';
      } else if (textDone) {
        choicesEl.innerHTML = '';
        hintEl.textContent  = Math.floor(Date.now() / 500) % 2 === 0 ? '▼ SPACE' : '';
      } else {
        choicesEl.innerHTML = '';
        hintEl.textContent  = '';
      }
    },
  };
})();
