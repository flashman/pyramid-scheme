// frontend/game/__smoke__/recruit-presence.smoke.mjs
import { RecruitPresence } from '../recruit-presence.js';

// Module must import under node (no top-level DOM access).
RecruitPresence.clear();
if (RecruitPresence.isOnline(42) !== false) throw new Error('unknown uid should be offline');

RecruitPresence.seed([{ user_id: 42, online: true }, { user_id: 7, online: false }]);
if (!RecruitPresence.isOnline(42)) throw new Error('seed online failed');
if (RecruitPresence.isOnline(7)) throw new Error('seed offline failed');

// string/number key parity (WS payloads + data-uid attrs cross int/string)
RecruitPresence.set('42', false);
if (RecruitPresence.isOnline(42)) throw new Error('set must coerce key type');
RecruitPresence.set(7, true);
if (!RecruitPresence.isOnline('7')) throw new Error('isOnline must coerce key type');

// null uid is ignored, not stored
RecruitPresence.set(null, true);

console.log('recruit-presence smoke OK');
