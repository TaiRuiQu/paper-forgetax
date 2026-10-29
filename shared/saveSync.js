import { diffSave } from './savePatch.js';

const clone = value => JSON.parse(JSON.stringify(value));
const stateChanges = (before, after) => diffSave(before, after).filter(change => change.path[0] !== 'updatedAt');

// Only acknowledged snapshots become the base for the next delta.
export class SaveSync {
  constructor(request) {
    this.request = request;
    this.slots = new Map();
    this.unacknowledged = new Map();
    this.profile = {};
    this.pending = Promise.resolve();
  }

  remember(save) {
    this.slots.set(save.slot, clone(save));
    this.unacknowledged.delete(save.slot);
  }

  rememberProfile(profile) {
    this.profile = clone(profile);
  }

  save(slot, state, profile) {
    const snapshot = clone(state);
    const profileSnapshot = clone(profile);
    const pending = this.pending.then(() => this.flush(slot, snapshot, profileSnapshot));
    this.pending = pending.catch(() => {});
    return pending;
  }

  async flush(slot, snapshot, profileSnapshot) {
    let base = this.slots.get(slot);
    const unacknowledged = this.unacknowledged.get(slot);
    if (unacknowledged) {
      // Reconcile before sending again: another failed request must not erase
      // the snapshot whose acknowledgement was lost.
      const { save } = await this.request(`/saves/${slot}`);
      if (![base?.state, snapshot, unacknowledged].some(candidate => candidate && !stateChanges(save.state, candidate).length)) {
        throw Object.assign(new Error('云端存档已改变，请重新载入存档后继续。'), { code: 'save-conflict', status: 409 });
      }
      this.remember(save);
      base = this.slots.get(slot);
    }
    let result;
    if (base?.revision) {
      // prepareSave timestamps every snapshot, even when gameplay hasn't changed.
      let changes = stateChanges(base.state, snapshot);
      const profileChanges = diffSave(this.profile, profileSnapshot);
      if (!changes.length && !profileChanges.length) {
        return { ...base, profile: clone(this.profile) };
      }
      if (changes.length && snapshot.updatedAt !== undefined) changes.push({ path: ['updatedAt'], value: snapshot.updatedAt });
      const send = revision => {
        // A failed response does not prove that the server rolled back the write.
        this.unacknowledged.set(slot, clone(snapshot));
        return this.request(`/saves/${slot}`, {
          method: 'PATCH', body: { baseRevision: revision, changes, profileChanges },
        });
      };
      try {
        result = await send(base.revision);
      } catch (error) {
        if (error.code !== 'save-conflict') throw error;
        this.unacknowledged.delete(slot);
        // Recover an equivalent cloud snapshot without overwriting another client.
        const { save } = await this.request(`/saves/${slot}`);
        if (![base.state, snapshot].some(candidate => !stateChanges(save.state, candidate).length)) {
          throw error;
        }
        this.remember(save);
        changes = stateChanges(save.state, snapshot);
        if (changes.length && snapshot.updatedAt !== undefined) changes.push({ path: ['updatedAt'], value: snapshot.updatedAt });
        result = await send(save.revision);
      }
    } else {
      result = await this.request(`/saves/${slot}`, { method: 'PUT', body: { state: snapshot, profile: profileSnapshot } });
    }
    this.remember({ slot, state: snapshot, revision: result.revision, meta: result.meta, updatedAt: result.updatedAt });
    this.profile = clone(result.profile || profileSnapshot);
    return result;
  }
}
