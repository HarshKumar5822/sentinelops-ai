'use strict';
const fs = require('fs');
const path = require('path');
const cfg = require('../config');

/** JSON-file store with atomic writes. Holds one snapshot: { v, mem, inc, seq, set }. */
class Store {
  constructor(file = cfg.dataFile) {
    this.file = file;
    this.state = { v: 2, mem: [], inc: [], seq: 9001, set: {} };
    this.timer = null;
    this.load();
  }
  load() {
    try {
      const raw = fs.readFileSync(this.file, 'utf8');
      const s = JSON.parse(raw);
      if (s && s.v === 2 && Array.isArray(s.mem) && Array.isArray(s.inc)) this.state = s;
    } catch (_) { /* first run: start empty */ }
  }
  get() { return this.state; }
  set(next) { this.state = next; this.saveSoon(); }
  touch() { this.saveSoon(); }
  saveSoon() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), 400);
    this.timer.unref?.();
  }
  flush() {
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      const tmp = `${this.file}.${process.pid}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(this.state));
      fs.renameSync(tmp, this.file);
    } catch (e) { console.error('[store] could not save:', e.message); }
  }
}
module.exports = { Store };
