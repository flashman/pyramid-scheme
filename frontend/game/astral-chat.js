// ── FILE: game/astral-chat.js ─────────────────────────────
// AstralChat — chat overlay shown during an astral projection session.
// Completely decoupled from DialogueManager.
//
// Usage:
//   AstralChat.show()             — activate panel
//   AstralChat.hide()             — deactivate + clear input
//   AstralChat.append(who, text)  — add a line to the log
//   AstralChat.clear()            — wipe log
//   AstralChat.onKeyDown(key)     — returns true if it consumed the key
//   AstralChat.isInputOpen()      — true while text input is focused

import { gameSocket } from './ws.js';

class _AstralChat {
  constructor() {
    this._el    = null;
    this._log   = null;
    this._input = null;
  }

  _init() {
    if (this._el) return;
    this._el    = document.getElementById('astral-chat');
    this._log   = document.getElementById('astral-chat-log');
    this._input = document.getElementById('astral-chat-input');

    this._input.addEventListener('keydown', e => {
      e.stopPropagation();
      if (e.key === 'Enter')  { this._submit();     }
      if (e.key === 'Escape') { this._closeInput(); }
    });
  }

  show() {
    this._init();
    this._el.classList.add('active');
  }

  hide() {
    this._init();
    this._closeInput();
    this._el.classList.remove('active');
  }

  clear() {
    this._init();
    this._log.innerHTML = '';
  }

  append(fromUsername, text) {
    this._init();
    const line = document.createElement('div');
    line.textContent = `${fromUsername}: ${text}`;
    this._log.appendChild(line);
    this._log.scrollTop = this._log.scrollHeight;
  }

  onKeyDown(key) {
    if (!this._el?.classList.contains('active')) return false;
    if (key === 'Enter' && !this.isInputOpen()) {
      this._init();
      this._input.classList.add('active');
      this._input.focus();
      return true;
    }
    return false;
  }

  isInputOpen() {
    return this._input?.classList.contains('active') ?? false;
  }

  _submit() {
    const text = this._input.value.trim().slice(0, 200);
    if (text) {
      gameSocket.send({ type: 'chat', text });
      this.append('you', text);
    }
    this._closeInput();
  }

  _closeInput() {
    if (!this._input) return;
    this._input.value = '';
    this._input.classList.remove('active');
    this._input.blur();
  }
}

export const AstralChat = new _AstralChat();
