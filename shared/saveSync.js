import { diffSave } from './savePatch.js';

const clone = value => JSON.parse(JSON.stringify(value));

// Only acknowledged snapshots become the base for the next delta.
export class SaveSync {
  constructor(request) {
    this.request = request;
    this.slots = new Map();
    this.profile = {};
    this.pending = Promise.resolve();
  }

  remember(save) {
    this.slots.set(save.slot, clone(save));
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
    const base = this.slots.get(slot);
    let result;
    if (base?.revision) {
      // prepareSave timestamps every snapshot, even when gameplay hasn't changed.
      const changes = diffSave(base.state, snapshot).filter(change => change.path[0] !== 'updatedAt');
      const profileChanges = diffSave(this.profile, profileSnapshot);
      if (!changes.length && !profileChanges.length) {
        return { ...base, profile: clone(this.profile) };
      }
      if (changes.length && snapshot.updatedAt !== undefined) changes.push({ path: ['updatedAt'], value: snapshot.updatedAt });
      const send = revision => this.request(`/saves/${slot}`, {
        method: 'PATCH', body: { baseRevision: revision, changes, profileChanges },
      });
      try {
        result = await send(base.revision);
      } catch (error) {
        if (error.code !== 'save-conflict') throw error;
        // A timed-out request may have committed. Only retry against the new
        // revision when the cloud already has exactly the requested state.
        const { save } = await this.request(`/saves/${slot}`);
        const remaining = diffSave(save.state, snapshot).filter(change => change.path[0] !== 'updatedAt');
        if (remaining.length) throw error;
        changes.length = 0;
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
