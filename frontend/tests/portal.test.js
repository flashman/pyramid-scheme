import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { PortalRegistry } from '../engine/portal.js';
import { RealmManager } from '../engine/realm.js';

const fakeRealm = (id) => ({ id, onEnter() {}, onExit() {} });

beforeEach(() => {
  PortalRegistry._portals = [];
  RealmManager._realms = {};
  RealmManager._transition = null;
  RealmManager.register(fakeRealm('a')).register(fakeRealm('b'));
  RealmManager.currentId = 'a';
});

test('use fires a registered key-less edge immediately', () => {
  let used = 0;
  PortalRegistry.register({ from: 'a', to: 'b', key: null, onUse: () => used++ });
  assert.equal(PortalRegistry.use('a', 'b'), true);
  assert.equal(RealmManager.currentId, 'b');
  assert.equal(used, 1);
});

test('use refuses an edge that is not registered', () => {
  assert.equal(PortalRegistry.use('a', 'b'), false);
  assert.equal(RealmManager.currentId, 'a');
});

test('use respects the edge condition', () => {
  let open = false;
  PortalRegistry.register({ from: 'a', to: 'b', key: null, condition: () => open });
  assert.equal(PortalRegistry.use('a', 'b'), false);
  open = true;
  assert.equal(PortalRegistry.use('a', 'b'), true);
});

test('use schedules an animated transition when the edge has one', () => {
  PortalRegistry.register({ from: 'a', to: 'b', key: null, transition: () => {}, duration: 500 });
  assert.equal(PortalRegistry.use('a', 'b'), true);
  assert.equal(RealmManager.isTransitioning, true);
  assert.equal(RealmManager.currentId, 'a');
});

test('handleKey still fires keyed edges', () => {
  PortalRegistry.register({ from: 'a', to: 'b', key: 'ArrowUp' });
  assert.equal(PortalRegistry.handleKey('ArrowUp', 'a'), true);
  assert.equal(RealmManager.currentId, 'b');
});
