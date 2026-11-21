/* A stand-in for the DynamoDB document client, for local development and tests.
   Supports the calls the API makes: Get, Put, Delete, and Query on the table or on GSI1. Optionally saved to a JSON file. */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

export class FakeDb {
  constructor(file) {
    this.file = file;
    this.items = new Map(file && existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : []);
  }
  save() { if (this.file) writeFileSync(this.file, JSON.stringify([...this.items])); }
  async send(cmd) {
    const i = cmd.input, key = (k) => `${k.PK}|${k.SK}`;
    switch (cmd.constructor.name) {
      case 'GetCommand': { const it = this.items.get(key(i.Key)); return { Item: it && structuredClone(it) }; }
      case 'PutCommand': this.items.set(key(i.Item), structuredClone(i.Item)); this.save(); return {};
      case 'DeleteCommand': this.items.delete(key(i.Key)); this.save(); return {};
      case 'QueryCommand': {
        const v = i.ExpressionAttributeValues, all = [...this.items.values()];
        let out = i.IndexName === 'GSI1'
          ? all.filter(x => x.GSI1PK === v[':p']).sort((a, b) => (a.GSI1SK < b.GSI1SK ? -1 : 1))
          : all.filter(x => x.PK === v[':p'] && (!v[':s'] || x.SK.startsWith(v[':s']))).sort((a, b) => (a.SK < b.SK ? -1 : 1));
        if (i.ScanIndexForward === false) out.reverse();
        return { Items: out.map(x => structuredClone(x)) };
      }
    }
    throw new Error('FakeDb: unsupported ' + cmd.constructor.name);
  }
}
