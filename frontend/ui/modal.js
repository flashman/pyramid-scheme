// ── FILE: ui/modal.js ────────────────────────────────────
// Full-screen announcement modal — used for quest completion fanfares,
// story beats, and tier-up events.
// Close with the button, Enter, or Escape.

/**
 * Shows the modal with a heading and body text.
 * @param {string} h - Heading text.
 * @param {string} b - Body text (newlines rendered as line breaks via pre-line).
 */
export function showModal(h, b) {
  document.getElementById('mh').textContent=h;
  document.getElementById('mb').textContent=b;
  document.getElementById('mo').classList.add('show');
}

/** Hides the modal. */
export function closeModal() {
  document.getElementById('mo').classList.remove('show');
}

document.addEventListener('keydown', e => {
  const modal = document.getElementById('mo');
  if ((e.key === 'Escape' || e.key === 'Enter') && modal.classList.contains('show')) {
    e.preventDefault();
    closeModal();
    return;
  }
  if (e.key === 'Escape') {
    document.getElementById('cfg-panel').style.display = 'none';
  }
});
