// ── FILE: worlds/oasis/riddles.js ───────────────────────
// HTML-panel riddle system for the Sphinx.
// The player types a single-word answer; the Sphinx responds with lore.
// Uses the shared #dlg / #dlg-speaker / #dlg-text / #dlg-choices / #dlg-hint
// elements — same as every other dialogue in the game.

import { Flags } from '../../engine/flags.js';

// ── Riddle pool ───────────────────────────────────────────
const RIDDLES = [
  {
    id: 'map',
    question: 'I HAVE CITIES, YET NO HOUSES LIVE THERE.\nMOUNTAINS RISE WITHIN ME,\nYET NONE HAVE EVER CLIMBED THEM.\nWHAT AM I?',
    answers:  ['map'],
    response: 'A MAP.\nTHE LAND IS NOT THE TERRITORY.\nYET EVERY PHARAOH MISTAKES\nTHE MAP FOR THE WORLD ITSELF.',
  },
  {
    id: 'hole',
    question: 'THE MORE YOU TAKE FROM ME,\nTHE LARGER I BECOME.\nWHAT AM I?',
    answers:  ['hole'],
    response: 'A HOLE.\nLIKE DEBT.\nLIKE THE SPACE BETWEEN\nWHAT THE SCHEME PROMISES AND WHAT IT DELIVERS.',
  },
  {
    id: 'echo',
    question: 'I SPEAK WITHOUT LIPS.\nI LINGER WITHOUT EARS.\nI HAVE NO BODY,\nYET THE DESERT STIRS WITH ME.',
    answers:  ['echo'],
    response: 'ECHO.\nYOUR RECRUITERS ECHO YOUR PITCH\nDOWN TWELVE LEVELS OF THE CHAIN.\nBY THEN, NOTHING OF THE ORIGINAL REMAINS.',
  },
  {
    id: 'coffin',
    question: 'THE MAN WHO MAKES ME\nDOES NOT NEED ME.\nHE WHO BUYS ME\nWILL NEVER USE ME HIMSELF.',
    answers:  ['coffin'],
    response: 'A COFFIN.\nI HAVE WATCHED FOUR THOUSAND YEARS\nOF PHARAOHS WHO BELIEVED\nTHEY WERE THE EXCEPTION.',
  },
  {
    id: 'trust',
    question: 'I GROW WHEN YOU GIVE ME AWAY.\nI VANISH WHEN YOU HOARD ME.\nI AM WORTH NOTHING ON PAPER,\nYET EVERYTHING IN PRACTICE.',
    answers:  ['trust'],
    response: 'TRUST.\nTHE ONLY CURRENCY THAT CANNOT BE PRINTED.\nEVERY PYRAMID SPENDS IT FIRST\nAND NOTICES LAST.',
  },
  {
    id: 'clock',
    question: 'YOU SEE MY FACE EVERY DAY.\nYET YOU CANNOT TRULY SEE ME.\nI HAVE HANDS BUT CANNOT TOUCH.\nI COUNT WHAT CANNOT BE RETURNED.',
    answers:  ['clock', 'time'],
    response: 'THE CLOCK. TIME.\nYOUR PYRAMID TOOK WEEKS TO BUILD.\nFOUR THOUSAND YEARS FROM NOW\nNO ONE WILL REMEMBER THE PHARAOH.',
  },
  {
    id: 'stamp',
    question: 'I TRAVEL THE ENTIRE WORLD\nWITHOUT EVER LEAVING MY CORNER.\nWHAT AM I?',
    answers:  ['stamp'],
    response: 'A STAMP.\nYOUR INVITATION SCROLLS\nALSO TRAVEL FAR\nWITHOUT EVER LEAVING YOUR HAND.',
  },
  {
    id: 'future',
    question: 'ALWAYS AHEAD.\nNEVER BEHIND.\nNEVER SEEN.\nNEVER REACHED.',
    answers:  ['future', 'horizon'],
    response: 'THE FUTURE. OR THE HORIZON.\nBOTH ARE CORRECT.\nBOTH DESCRIBE THE SAME THING:\nWHAT EVERY SCHEME SELLS.',
  },
  {
    id: 'letter_e',
    question: 'I AM THE BEGINNING OF ETERNITY,\nTHE END OF TIME AND SPACE,\nTHE START OF EVERY END,\nAND THE END OF EVERY PLACE.',
    answers:  ['e'],
    response: 'THE LETTER E.\nYOU DID NOT EXPECT THAT.\nNEITHER DID THE LAST\nFOUR THOUSAND PHARAOHS WHO STOOD HERE.',
  },
  {
    id: 'profit',
    question: 'EVERY PHARAOH SEEKS ME AT THE TOP.\nEVERY RECRUIT SEEKS ME AT THE BOTTOM.\nI AM THE SAME IN BOTH PLACES.\nWHAT AM I?',
    answers:  ['gold', 'profit', 'wealth', 'money'],
    response: 'GOLD. PROFIT. WEALTH.\nALL CORRECT.\nAND AT THE TOP OF YOUR UPLINE?\nSOMETHING ELSE PROFITS FROM YOURS.',
  },
  {
    id: 'stone',
    question: 'I BUILT THESE PYRAMIDS.\nI WAS PAID NOTHING.\nI WILL OUTLAST THE PHARAOH,\nTHE SCHEME, AND THE DESERT ITSELF.',
    answers:  ['stone', 'sand', 'time', 'worker', 'labor'],
    response: 'STONE. SAND. TIME. WORKER.\nALL ACCEPTED.\nTHE BUILDERS HAVE ALWAYS\nOUTLASTED THE SCHEME.',
  },
  {
    id: 'truth',
    question: 'KINGS FEAR WHAT I REVEAL.\nFOOLS DENY WHAT I DEMAND.\nI AM NEITHER FRIEND NOR ENEMY.\nI AM SIMPLY WHAT IS.',
    answers:  ['truth', 'reality', 'facts'],
    response: 'TRUTH.\nOR REALITY.\nYOU HAVE ANSWERED WELL, PHARAOH.\nNOW WATCH CAREFULLY WHAT YOU HAVE BUILT.',
  },
];

// ── RiddleManager ─────────────────────────────────────────

export const RiddleManager = (() => {
  // State
  let _active     = false;
  let _riddle     = null;
  let _phase      = 'idle';      // 'reading' | 'typing' | 'wrong' | 'correct'
  let _input      = '';
  let _typeLen    = 0;
  let _typeStart  = 0;
  let _respText   = '';
  let _attempts   = 0;
  const _used     = new Set();
  const TYPE_MS   = 36;          // ms per character

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

  function _skipOrAdvance() {
    if (!_typewriterDone()) {
      _typeLen = _currentText().length;
    } else if (_phase === 'reading') {
      _phase    = 'typing';
      _input    = '';
      _attempts = 0;
    }
  }

  function _submit() {
    const answer = _input.trim().toLowerCase();
    if (_riddle.answers.includes(answer)) {
      _phase     = 'correct';
      _respText  = _riddle.response;
      _typeLen   = 0;
      _typeStart = Date.now();
      Flags.inc('sphinx_riddles_solved');
    } else {
      _attempts++;
      if (_attempts >= 3) {
        const hint = _riddle.answers[0].toUpperCase();
        _phase    = 'correct';
        _respText = `THE ANSWER IS: ${hint}.\n${_riddle.response}`;
      } else {
        _phase    = 'wrong';
        _respText = 'INCORRECT.\nTHE SPHINX REGARDS YOU\nIN SILENCE.';
      }
      _typeLen   = 0;
      _typeStart = Date.now();
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
      _typeLen   = 0;
      _typeStart = Date.now();
      _respText  = '';
      _attempts  = 0;
    },

    onKeyDown(key) {
      if (!_active) return false;

      if (key === 'Escape') {
        _active = false;
        _phase  = 'idle';
        const el = document.getElementById('dlg');
        if (el) el.classList.remove('active');
        return true;
      }

      // ── Reading phase: Space/Enter skips or advances ──────
      if (_phase === 'reading') {
        if (key === ' ' || key === 'Enter') { _skipOrAdvance(); }
        return true;
      }

      // ── Typing phase: free-text input ─────────────────────
      if (_phase === 'typing') {
        if (key === 'Backspace') {
          _input = _input.slice(0, -1);
        } else if (key === 'Enter') {
          if (_input.trim().length > 0) _submit();
        } else if (key.length === 1 && _input.length < 18) {
          // Accept letters, numbers, hyphens
          _input += key.toUpperCase();
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
        }
        return true;
      }

      // ── Correct phase: Enter to close ─────────────────────
      if (_phase === 'correct') {
        if (!_typewriterDone()) {
          _typeLen = _currentText().length;
        } else if (key === 'Enter' || key === ' ') {
          _active = false;
          _phase  = 'idle';
          const el = document.getElementById('dlg');
          if (el) el.classList.remove('active');
        }
        return true;
      }

      return true;
    },

    render() {
      if (!_active) {
        const el = document.getElementById('dlg');
        if (el) el.classList.remove('active');
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
      // can refer back to it while composing their answer.
      const displayText = _phase === 'typing'
        ? _riddle.question
        : _currentText().substring(0, _typeLen);
      textEl.textContent = displayText;

      // Typing phase: render an answer input row in the choices slot
      if (_phase === 'typing') {
        const cursor = Math.floor(t / 500) % 2 === 0 ? '█' : ' ';
        // Escape input before injecting into innerHTML
        const safeInput = _input.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
        choicesEl.innerHTML =
          `<div class="dlg-choice" style="margin-top:6px">` +
          `<span style="color:var(--gold-dim)">YOUR ANSWER &rsaquo; </span>` +
          `<span style="color:var(--gold)">${safeInput}${cursor}</span></div>`;
        hintEl.textContent = '[ENTER] SUBMIT     [ESC] LEAVE';
      } else {
        choicesEl.innerHTML = '';
        const done = _typewriterDone();
        if (!done) {
          hintEl.textContent = '';
        } else if (_phase === 'reading') {
          hintEl.textContent = Math.floor(t / 500) % 2 === 0 ? '▼ SPACE — ANSWER THE RIDDLE' : '';
        } else if (_phase === 'wrong') {
          hintEl.textContent = Math.floor(t / 500) % 2 === 0 ? '[ENTER] TRY AGAIN     [ESC] LEAVE' : '';
        } else if (_phase === 'correct') {
          hintEl.textContent = Math.floor(t / 500) % 2 === 0 ? '▼ SPACE / ENTER' : '';
        }
      }
    },
  };
})();
