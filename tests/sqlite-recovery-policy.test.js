const assert = require('node:assert/strict');
const { hasSQLiteIntegrityFailure, isSQLiteDatabaseCorruption } = require('../.tmp-sqlite-recovery-test/sqliteRecoveryPolicy.js');

assert.equal(isSQLiteDatabaseCorruption(new Error('database disk image is malformed')), true);
assert.equal(isSQLiteDatabaseCorruption({ code: 'SQLITE_CORRUPT', message: 'statement failed' }), true);
assert.equal(isSQLiteDatabaseCorruption({ code: 'SQLITE_NOTADB', message: 'file is not a database' }), true);
assert.equal(isSQLiteDatabaseCorruption(new Error('database is locked')), false);
assert.equal(isSQLiteDatabaseCorruption(new Error('no such table: media_items')), false);
assert.equal(hasSQLiteIntegrityFailure('ok'), false);
assert.equal(hasSQLiteIntegrityFailure('row 14 missing from index media_items_created_idx'), true);
assert.equal(hasSQLiteIntegrityFailure(undefined), true);
console.log('SQLite recovery policy tests passed.');
