const assert = require('node:assert/strict');
const { isSQLiteDatabaseCorruption } = require('../.tmp-sqlite-recovery-test/sqliteRecoveryPolicy.js');

assert.equal(isSQLiteDatabaseCorruption(new Error('database disk image is malformed')), true);
assert.equal(isSQLiteDatabaseCorruption({ code: 'SQLITE_CORRUPT', message: 'statement failed' }), true);
assert.equal(isSQLiteDatabaseCorruption({ code: 'SQLITE_NOTADB', message: 'file is not a database' }), true);
assert.equal(isSQLiteDatabaseCorruption(new Error('database is locked')), false);
assert.equal(isSQLiteDatabaseCorruption(new Error('no such table: media_items')), false);
console.log('SQLite recovery policy tests passed.');
