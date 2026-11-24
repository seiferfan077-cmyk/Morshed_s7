import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MEDIA_STORE = (ROOT / 'native/android/MurshidMediaStore.java').read_text()
WORKER = (ROOT / 'native/android/MurshidGalleryImportWorker.java').read_text()
PLUGIN = (ROOT / 'plugins/withMurshidDialer.js').read_text()

class MediaStorePathsTest(unittest.TestCase):
    def test_required_public_paths_and_pending_flow(self):
        self.assertIn('Pictures/مُرشد/الصور/', MEDIA_STORE)
        self.assertIn('Movies/مُرشد/الفيديوهات/', MEDIA_STORE)
        self.assertIn('Pictures/مُرشد/لقطات الشاشة/', MEDIA_STORE)
        self.assertIn('MediaStore.MediaColumns.IS_PENDING, 1', MEDIA_STORE)
        self.assertIn('published.put(MediaStore.MediaColumns.IS_PENDING, 0)', MEDIA_STORE)
        self.assertIn('resolver.delete(target, null, null)', MEDIA_STORE)

    def test_screenshot_uses_real_path_not_filename(self):
        self.assertRegex(MEDIA_STORE, r'isScreenshotPath\(relativePath\)')
        self.assertIn('sourceRelativePath', WORKER)
        self.assertIn('item.sourceRelativePath', WORKER)

    def test_plugin_copies_media_store_and_old_permission(self):
        self.assertIn("'MurshidMediaStore.java'", PLUGIN)
        self.assertIn("'android.permission.WRITE_EXTERNAL_STORAGE'", PLUGIN)

    def test_worker_uses_public_store_for_images_and_videos(self):
        self.assertIn('MurshidMediaStore.copyToPublic', WORKER)
        self.assertIn('item.type', WORKER)
        self.assertIn('import_status', WORKER)

if __name__ == '__main__':
    unittest.main()
