import sqlite3
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WORKER_SOURCE = ROOT / "native/android/MurshidGalleryImportWorker.java"


class MediaWorkerSQLitePragmaTests(unittest.TestCase):
    def test_busy_timeout_pragma_returns_the_configured_value(self):
        with sqlite3.connect(":memory:") as database:
            result = database.execute("PRAGMA busy_timeout=5000").fetchone()
        self.assertEqual(result, (5000,))

    def test_android_worker_reads_and_validates_the_pragma_result(self):
        source = WORKER_SOURCE.read_text(encoding="utf-8")
        self.assertRegex(
            source,
            r'database\.rawQuery\("PRAGMA busy_timeout=5000",\s*null\)',
        )
        self.assertRegex(
            source,
            r'!busyTimeout\.moveToFirst\(\)\s*\|\|\s*busyTimeout\.getInt\(0\)\s*!=\s*5000',
        )
        self.assertNotRegex(
            source,
            r'database\.execSQL\("PRAGMA busy_timeout=5000"\)',
        )


if __name__ == "__main__":
    unittest.main(verbosity=2)
