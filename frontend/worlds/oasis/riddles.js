// ── FILE: worlds/oasis/riddles.js ───────────────────────
// HTML-panel riddle system for the Sphinx.
// The player types a single-word answer; the Sphinx responds with lore.
// Uses the shared #dlg / #dlg-speaker / #dlg-text / #dlg-choices / #dlg-hint
// elements — same as every other dialogue in the game.

import { Flags }           from '../../engine/flags.js';
import { InAppKeyboard } from '../../ui/in-app-keyboard.js';
import { Events }           from '../../engine/events.js';
import { DialogueManager }  from '../../engine/dialogue.js';
import { Api }              from '../../game/api.js';

// ── Riddle pool ───────────────────────────────────────────
// Questions only. The answers AND the responses live server-side in
// backend/app/challenges.py — every response opens by naming its solution,
// so shipping responses here would leak all 12 answers even with the answer
// arrays removed. POST /api/challenge validates and returns the response.
//
// The ids are deliberately opaque (r1, r2, …): they used to be the answer
// word itself, which gave the whole pool away to anyone reading this file.
// Keep them in sync with CHALLENGE_CONFIG['sphinx'].items.
const RIDDLES = [
  {
    id: 'r1',
    question: 'I HAVE CITIES, YET NO HOUSES LIVE THERE.\nMOUNTAINS RISE WITHIN ME,\nYET NONE HAVE EVER CLIMBED THEM.\nWHAT AM I?',
  },
  {
    id: 'r2',
    question: 'THE MORE YOU TAKE FROM ME,\nTHE LARGER I BECOME.\nWHAT AM I?',
  },
  {
    id: 'r3',
    question: 'I SPEAK WITHOUT LIPS.\nI LINGER WITHOUT EARS.\nI HAVE NO BODY,\nYET THE DESERT STIRS WITH ME.',
  },
  {
    id: 'r4',
    question: 'THE MAN WHO MAKES ME\nDOES NOT NEED ME.\nHE WHO BUYS ME\nWILL NEVER USE ME HIMSELF.',
  },
  {
    id: 'r5',
    question: 'I GROW WHEN YOU GIVE ME AWAY.\nI VANISH WHEN YOU HOARD ME.\nI AM WORTH NOTHING ON PAPER,\nYET EVERYTHING IN PRACTICE.',
  },
  {
    id: 'r6',
    question: 'YOU SEE MY FACE EVERY DAY.\nYET YOU CANNOT TRULY SEE ME.\nI HAVE HANDS BUT CANNOT TOUCH.\nI COUNT WHAT CANNOT BE RETURNED.',
  },
  {
    id: 'r7',
    question: 'I TRAVEL THE ENTIRE WORLD\nWITHOUT EVER LEAVING MY CORNER.\nWHAT AM I?',
  },
  {
    id: 'r8',
    question: 'ALWAYS AHEAD.\nNEVER BEHIND.\nNEVER SEEN.\nNEVER REACHED.',
  },
  {
    id: 'r9',
    question: 'I AM THE BEGINNING OF ETERNITY,\nTHE END OF TIME AND SPACE,\nTHE START OF EVERY END,\nAND THE END OF EVERY PLACE.',
  },
  {
    id: 'r10',
    question: 'EVERY PHARAOH SEEKS ME AT THE TOP.\nEVERY RECRUIT SEEKS ME AT THE BOTTOM.\nI AM THE SAME IN BOTH PLACES.\nWHAT AM I?',
  },
  {
    id: 'r11',
    question: 'I BUILT THESE PYRAMIDS.\nI WAS PAID NOTHING.\nI WILL OUTLAST THE PHARAOH,\nTHE SCHEME, AND THE DESERT ITSELF.',
  },
  {
    id: 'r12',
    question: 'KINGS FEAR WHAT I REVEAL.\nFOOLS DENY WHAT I DEMAND.\nI AM NEITHER FRIEND NOR ENEMY.\nI AM SIMPLY WHAT IS.',
  },
];

// ── RiddleManager ─────────────────────────────────────────

export const RiddleManager = (() => {
  // State
  let _active     = false;
  let _riddle     = null;
  let _phase      = 'idle';      // 'reading' | 'typing' | 'wrong' | 'correct'
  let _input      = '';
  let _cursorPos  = 0;
  let _typeLen    = 0;
  let _typeStart  = 0;
  let _respText   = '';
  let _attempts   = 0;
  const _used     = new Set();

  // Stable DOM refs for the answer row — created once per typing phase,
  // then updated via textContent only (avoids full innerHTML reflow every frame)
  let _answerBeforeEl = null;
  let _answerCursorEl = null;
  let _answerAfterEl  = null;
  const TYPE_MS   = 36;          // ms per character

  function _buildAnswerRow() {
    const choicesEl = document.getElementById('dlg-choices');
    if (!choicesEl || _answerBeforeEl) return;

    const row = document.createElement('div');
    row.className = 'dlg-choice';
    row.style.paddingTop = '6px';

    const label = document.createElement('span');
    label.style.color = 'var(--gold-dim)';
    label.textContent = 'YOUR ANSWER › ';

    _answerBeforeEl = document.createElement('span');
    _answerBeforeEl.style.color = 'var(--gold)';

    _answerCursorEl = document.createElement('span');
    _answerCursorEl.style.color = 'var(--gold)';
    _answerCursorEl.textContent = '█';
    _answerCursorEl.className = 'kb-cursor';

    _answerAfterEl = document.createElement('span');
    _answerAfterEl.style.color = 'var(--gold)';

    row.appendChild(label);
    row.appendChild(_answerBeforeEl);
    row.appendChild(_answerCursorEl);
    row.appendChild(_answerAfterEl);
    choicesEl.appendChild(row);
  }

  function _destroyAnswerRow() {
    const choicesEl = document.getElementById('dlg-choices');
    if (choicesEl) choicesEl.innerHTML = '';
    _answerBeforeEl = _answerCursorEl = _answerAfterEl = null;
  }

  // Single exit path for the riddle — used by every close site (Escape,
  // mobile escape, correct-answer dismiss). Releases the shared #dlg window
  // (unless astral chat holds the lock) and emits dialogue:end so astral
  // chat, if active, restores its panel.
  function _close() {
    _active = false;
    _phase  = 'idle';
    InAppKeyboard.close();
    const el = document.getElementById('dlg');
    if (el && !DialogueManager.isLocked()) el.classList.remove('active');
    Events.emit('dialogue:end', {});
  }

  function _pick() {
    let pool = RIDDLES.filter(r => !_used.has(r.id));
    if (pool.length === 0) { _used.clear(); pool = RIDDLES; }
    const r = pool[Math.floor(Math.random() * pool.length)];
    _used.add(r.id);
    return r;
  }

  function _currentText() {
    return _phase === 'reading' ? _riddle.question : _respText;
  }

  function _typewriterDone() {
    return _typeLen >= _currentText().length;
  }

  function _openMobileInput() {
    if (navigator.maxTouchPoints > 0) {
      _cursorPos = _input.length;
      InAppKeyboard.open({
        onChar(ch) {
          if (ch === '\b') {
            if (_cursorPos > 0) {
              _input = _input.slice(0, _cursorPos - 1) + _input.slice(_cursorPos);
              _cursorPos--;
            }
          } else if (_input.length < 18) {
            const upper = ch.toUpperCase();
            _input = _input.slice(0, _cursorPos) + upper + _input.slice(_cursorPos);
            _cursorPos++;
          }
        },
        onSubmit() {
          if (_input.trim().length > 0) _submit();
        },
        onEscape() {
          _close();
        },
        onCursor(dir) {
          if (dir === 'left')  _cursorPos = Math.max(0, _cursorPos - 1);
          if (dir === 'right') _cursorPos = Math.min(_input.length, _cursorPos + 1);
        },
      });
    }
  }

  function _skipOrAdvance() {
    if (!_typewriterDone()) {
      _typeLen = _currentText().length;
    } else if (_phase === 'reading') {
      _phase    = 'typing';
      _input    = '';
      _attempts = 0;
      _openMobileInput();
    }
  }

  function _beginPhase(phase, text) {
    _phase     = phase;
    _respText  = text;
    _typeLen   = 0;
    _typeStart = Date.now();
  }

  // The sphinx now asks the server. Answers, responses and the solved
  // counter are all server-owned (backend/app/challenges.py), so a correct
  // answer is the only thing that can open the vault.
  async function _submit() {
    const answer = _input.trim();
    InAppKeyboard.close();
    _beginPhase('waiting', '');

    let res;
    try {
      res = await Api.submitChallenge('sphinx', _riddle.id, answer);
    } catch {
      res = null;
    }
    // A dismissed riddle must not be resurrected by a late response.
    if (!_active || _phase !== 'waiting') return;

    if (!res || res.error || res.detail) {
      _beginPhase('wrong', 'THE SPHINX DOES NOT ANSWER.\nSAND IN THE WIRES.\nTRY AGAIN.');
      return;
    }

    if (res.correct) {
      // Local, for instant portal/draw feedback. The server owns the real
      // count and strips this name from state syncs.
      if (res.solved_count != null) Flags.set('sphinx_riddles_solved', res.solved_count);
      _beginPhase('correct', res.response || '');
      return;
    }

    _attempts = res.attempts ?? _attempts + 1;
    if (res.hint) {
      _beginPhase('correct', `THE ANSWER IS: ${res.hint}.\n${res.response || ''}`);
    } else {
      _beginPhase('wrong', 'INCORRECT.\nTHE SPHINX REGARDS YOU\nIN SILENCE.');
    }
  }

  // ── Public API ───────────────────────────────────────────

  return {
    isActive() { return _active; },

    start() {
      _riddle    = _pick();
      _active    = true;
      _phase     = 'reading';
      _input     = '';
      _cursorPos = 0;
      _typeLen   = 0;
      _typeStart = Date.now();
      _respText  = '';
      _attempts  = 0;
      _destroyAnswerRow();
      // Claim the shared #dlg window — astral chat (if any) yields and buffers.
      Events.emit('dialogue:start', {});
    },

    onKeyDown(key) {
      if (!_active) return false;

      if (key === 'Escape') {
        _close();
        return true;
      }

      // ── Reading phase: Space/Enter skips or advances ──────
      if (_phase === 'reading') {
        if (key === ' ' || key === 'Enter') { _skipOrAdvance(); }
        return true;
      }

      // ── Waiting phase: the sphinx is consulting the server ─
      if (_phase === 'waiting') return true;   // swallow input, no double-submit

      // ── Typing phase: free-text input ─────────────────────
      if (_phase === 'typing') {
        if (key === 'Backspace') {
          _input = _input.slice(0, -1);
          _cursorPos = _input.length;
        } else if (key === 'Enter') {
          if (_input.trim().length > 0) _submit();
        } else if (key.length === 1 && _input.length < 18) {
          // Accept letters, numbers, hyphens
          _input += key.toUpperCase();
          _cursorPos = _input.length;
        }
        return true;
      }

      // ── Wrong phase: Enter to try again ───────────────────
      if (_phase === 'wrong') {
        if (!_typewriterDone()) {
          _typeLen = _currentText().length;
        } else if (key === 'Enter' || key === ' ') {
          _phase     = 'typing';
          _input     = '';
          _cursorPos = 0;
          _openMobileInput();
        }
        return true;
      }

      // ── Correct phase: Enter to close ─────────────────────
      if (_phase === 'correct') {
        if (!_typewriterDone()) {
          _typeLen = _currentText().length;
        } else if (key === 'Enter' || key === ' ') {
          _close();
        }
        return true;
      }

      return true;
    },

    render() {
      if (!_active) {
        // Don't strip the panel if astral chat holds the #dlg lock.
        const el = document.getElementById('dlg');
        if (el && !DialogueManager.isLocked()) el.classList.remove('active');
        return;
      }

      const t = Date.now();

      // Advance typewriter
      if (_phase === 'reading' || _phase === 'wrong' || _phase === 'correct') {
        _typeLen = Math.min(_currentText().length, Math.floor((t - _typeStart) / TYPE_MS));
      }

      // ── Populate the shared #dlg HTML panel ───────────────
      const el        = document.getElementById('dlg');
      const speakerEl = document.getElementById('dlg-speaker');
      const textEl    = document.getElementById('dlg-text');
      const choicesEl = document.getElementById('dlg-choices');
      const hintEl    = document.getElementById('dlg-hint');
      if (!el) return;

      el.classList.add('active');
      speakerEl.textContent = 'THE SPHINX';

      // Text colour matches phase
      if (_phase === 'correct') {
        textEl.style.color = '#e8d090';
      } else if (_phase === 'wrong') {
        textEl.style.color = '#d06020';
      } else {
        textEl.style.color = '';   // use stylesheet default (#e8c878)
      }

      // Main text — typewriter slice.
      // In typing phase we keep showing the full question so the player
      // can refer back to it while composing their answer. Waiting holds
      // the question too, so a fast round trip reads as no pause at all.
      const displayText = (_phase === 'typing' || _phase === 'waiting')
        ? _riddle.question
        : _currentText().substring(0, _typeLen);
      textEl.textContent = displayText;

      // Typing phase: answer input row, built once then updated via textContent
      if (_phase === 'typing') {
        _buildAnswerRow();
        if (_answerBeforeEl) {
          _answerBeforeEl.textContent = _input.slice(0, _cursorPos);
          _answerAfterEl.textContent  = _input.slice(_cursorPos);
        }
        hintEl.textContent = '[ENTER] SUBMIT     [ESC] LEAVE';
      } else if (_phase === 'waiting') {
        if (_answerBeforeEl) _destroyAnswerRow();
        hintEl.textContent = 'THE SPHINX CONSIDERS…';
      } else {
        if (_answerBeforeEl) _destroyAnswerRow();
        const done = _typewriterDone();
        if (!done) {
          hintEl.textContent = '';
        } else if (_phase === 'reading') {
          hintEl.textContent = '▼ SPACE — ANSWER THE RIDDLE';
        } else if (_phase === 'wrong') {
          hintEl.textContent = '[ENTER] TRY AGAIN     [ESC] LEAVE';
        } else if (_phase === 'correct') {
          hintEl.textContent = '▼ SPACE / ENTER';
        }
      }
    },
  };
})();
