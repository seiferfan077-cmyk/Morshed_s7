package com.murshid.s7;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.ContentValues;
import android.content.Context;
import android.content.pm.ServiceInfo;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.net.Uri;
import android.os.Build;
import android.os.SystemClock;

import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import androidx.work.ForegroundInfo;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.Locale;

public final class MurshidGalleryImportWorker extends Worker {
  public static final String KEY_JOB_ID = "jobId";
  public static final String KEY_DATABASE_PATH = "databasePath";
  public static final String KEY_VAULT_DIRECTORY = "vaultDirectory";
  private static final String CHANNEL_ID = "murshid-media-import";
  private static final int NOTIFICATION_ID = 7314;
  private static final int BUFFER_SIZE = 64 * 1024;
  private static final long UPDATE_BYTES = 4L * 1024L * 1024L;
  private static final long UPDATE_MILLIS = 1500L;

  public MurshidGalleryImportWorker(@NonNull Context context, @NonNull WorkerParameters parameters) {
    super(context, parameters);
  }

  @NonNull
  @Override
  public Result doWork() {
    final String jobId = getInputData().getString(KEY_JOB_ID);
    final String databasePath = getInputData().getString(KEY_DATABASE_PATH);
    final String vaultDirectoryUri = getInputData().getString(KEY_VAULT_DIRECTORY);
    if (jobId == null || databasePath == null || vaultDirectoryUri == null) return Result.failure();

    SQLiteDatabase database = null;
    try {
      database = SQLiteDatabase.openDatabase(databasePath, null, SQLiteDatabase.OPEN_READWRITE);
      database.setForeignKeyConstraintsEnabled(true);
      database.execSQL("PRAGMA busy_timeout=5000");
      try {
        database.enableWriteAheadLogging();
      } catch (Exception ignored) {
        // Expo SQLite may already have enabled WAL on this database.
      }
      database.execSQL("UPDATE import_job_items SET status='pending' WHERE job_id=? AND status='in_progress'", new Object[]{jobId});
      database.execSQL("UPDATE import_jobs SET current_bytes=0 WHERE id=?", new Object[]{jobId});
      if (!"running".equals(readJobState(database, jobId))) return Result.success();
      File vaultDirectory = fileFromUri(vaultDirectoryUri);
      if (!vaultDirectory.exists() && !vaultDirectory.mkdirs()) throw new IllegalStateException("تعذر إنشاء مساحة تخزين مُرشد.");
      setForegroundAsync(createForegroundInfo("بدء استيراد الوسائط", 0, readTotalFiles(database, jobId))).get();

      while (!isStopped()) {
        String jobState = readJobState(database, jobId);
        if (!"running".equals(jobState)) {
          clearCurrentFilename(database, jobId);
          return Result.success();
        }
        QueueItem item = nextPendingItem(database, jobId);
        if (item == null) break;
        database.execSQL("UPDATE import_job_items SET status='in_progress', error=NULL WHERE id=? AND job_id=?", new Object[]{item.id, jobId});
        database.execSQL("UPDATE import_jobs SET current_filename=?, updated_at=? WHERE id=?", new Object[]{item.filename, now(), jobId});
        updateNotification(database, jobId, item.filename);

        String existingMediaId = findImportedMediaId(database, item.sourceKey);
        if (existingMediaId != null) {
          item = item.withMediaId(existingMediaId);
          database.execSQL("UPDATE import_job_items SET media_id=? WHERE id=? AND job_id=?", new Object[]{existingMediaId, item.id, jobId});
          markCompleted(database, jobId, item, 0L, null);
          continue;
        }

        try {
          if (!copyOneItem(database, jobId, item, vaultDirectory)) return Result.success();
        } catch (Exception itemError) {
          markFailed(database, jobId, item, itemError);
        }
      }

      if (isStopped()) return Result.success();
      String finalState = readJobState(database, jobId);
      if ("running".equals(finalState)) {
        if (countPending(database, jobId) == 0) {
          database.execSQL("UPDATE import_jobs SET state='completed', current_filename=NULL, updated_at=? WHERE id=?", new Object[]{now(), jobId});
          updateNotification(database, jobId, "اكتمل الاستيراد");
          return Result.success();
        }
      }
      return Result.success();
    } catch (InterruptedException interrupted) {
      Thread.currentThread().interrupt();
      if (database != null) clearCurrentFilename(database, jobId);
      return Result.success();
    } catch (Exception error) {
      if (database != null) {
        database.execSQL("UPDATE import_jobs SET error=?, updated_at=? WHERE id=? AND state='running'",
            new Object[]{safeMessage(error), now(), jobId});
      }
      return Result.retry();
    } finally {
      if (database != null && database.isOpen()) database.close();
    }
  }

  private InputStream openInput(String value) throws Exception {
    Uri uri = Uri.parse(value);
    if ("file".equalsIgnoreCase(uri.getScheme())) {
      File file = new File(uri.getPath());
      if (!file.isFile()) throw new IllegalArgumentException("الملف المصدر غير موجود أو لم يعد متاحًا.");
      return new FileInputStream(file);
    }
    InputStream stream;
    try {
      stream = getApplicationContext().getContentResolver().openInputStream(uri);
    } catch (Exception error) {
      throw new IllegalArgumentException("تعذر الوصول إلى الملف من المصدر. إذا كان محفوظًا على السحابة فقط، نزّله أو شاركه من التطبيق المصدر ثم أعد استيراده.", error);
    }
    if (stream == null) throw new IllegalArgumentException("تعذر فتح الملف من موفر المستندات.");
    return stream;
  }

  private static File fileFromUri(String value) {
    Uri uri = Uri.parse(value);
    if ("file".equalsIgnoreCase(uri.getScheme())) return new File(uri.getPath());
    return new File(value);
  }

  private boolean copyOneItem(SQLiteDatabase database, String jobId, QueueItem item, File vaultDirectory) throws Exception {
    File target = fileFromUri(item.targetUri);
    String targetPath = target.getCanonicalPath();
    String vaultPath = vaultDirectory.getCanonicalPath() + File.separator;
    if (!targetPath.startsWith(vaultPath)) throw new IllegalArgumentException("مسار الوجهة خارج مساحة مُرشد.");
    File parent = target.getParentFile();
    if (parent != null && !parent.exists() && !parent.mkdirs()) throw new IllegalStateException("تعذر تجهيز مساحة التخزين.");
    File partial = new File(target.getAbsolutePath() + ".partial");
    if (partial.exists() && !partial.delete()) throw new IllegalStateException("تعذر تنظيف ملف استيراد سابق.");
    if (target.exists() && !target.delete()) throw new IllegalStateException("تعذر استبدال ملف سابق.");

    long copied = 0L;
    long lastUpdateBytes = 0L;
    long lastUpdateTime = SystemClock.elapsedRealtime();
    boolean interrupted = false;
    try (InputStream input = new BufferedInputStream(openInput(item.sourceUri), BUFFER_SIZE);
         OutputStream output = new BufferedOutputStream(new FileOutputStream(partial), BUFFER_SIZE)) {
      byte[] buffer = new byte[BUFFER_SIZE];
      int count;
      while ((count = input.read(buffer)) != -1) {
        if (isStopped() || !"running".equals(readJobState(database, jobId))) {
          interrupted = true;
          break;
        }
        output.write(buffer, 0, count);
        copied += count;
        long elapsed = SystemClock.elapsedRealtime();
        if (copied - lastUpdateBytes >= UPDATE_BYTES || elapsed - lastUpdateTime >= UPDATE_MILLIS) {
          updateCurrentBytes(database, jobId, copied);
          updateNotification(database, jobId, item.filename);
          lastUpdateBytes = copied;
          lastUpdateTime = elapsed;
        }
      }
      output.flush();
    } catch (Exception error) {
      if (partial.exists()) partial.delete();
      throw error;
    }
    if (interrupted) {
      if (partial.exists()) partial.delete();
      database.execSQL("UPDATE import_job_items SET status='pending' WHERE id=? AND job_id=?", new Object[]{item.id, jobId});
      database.execSQL("UPDATE import_jobs SET current_bytes=0 WHERE id=?", new Object[]{jobId});
      clearCurrentFilename(database, jobId);
      return false;
    }
    if (!partial.exists()) throw new IllegalStateException("لم يُنشأ ملف الاستيراد.");
    if (target.exists() && !target.delete()) throw new IllegalStateException("تعذر استبدال ملف مؤقت.");
    if (!partial.renameTo(target)) throw new IllegalStateException("تعذر تثبيت الملف بعد اكتمال نسخه.");
    markCompleted(database, jobId, item, copied, target.getAbsolutePath());
    return true;
  }

  private static String readJobState(SQLiteDatabase db, String jobId) {
    try (Cursor cursor = db.rawQuery("SELECT state FROM import_jobs WHERE id=?", new String[]{jobId})) {
      return cursor.moveToFirst() ? cursor.getString(0) : "missing";
    }
  }

  private static int readTotalFiles(SQLiteDatabase db, String jobId) {
    try (Cursor cursor = db.rawQuery("SELECT total_files FROM import_jobs WHERE id=?", new String[]{jobId})) {
      return cursor.moveToFirst() ? cursor.getInt(0) : 0;
    }
  }

  private static long readCopiedBytes(SQLiteDatabase db, String jobId) {
    try (Cursor cursor = db.rawQuery("SELECT copied_bytes FROM import_jobs WHERE id=?", new String[]{jobId})) {
      return cursor.moveToFirst() ? cursor.getLong(0) : 0L;
    }
  }

  private static int countPending(SQLiteDatabase db, String jobId) {
    try (Cursor cursor = db.rawQuery("SELECT COUNT(*) FROM import_job_items WHERE job_id=? AND status='pending'", new String[]{jobId})) {
      return cursor.moveToFirst() ? cursor.getInt(0) : 0;
    }
  }

  private static QueueItem nextPendingItem(SQLiteDatabase db, String jobId) {
    try (Cursor cursor = db.rawQuery(
        "SELECT id, media_id, source_uri, target_uri, filename, type, mime_type, size, source_key, source_modified_at, width, height, duration " +
            "FROM import_job_items WHERE job_id=? AND status='pending' ORDER BY position LIMIT 1",
        new String[]{jobId})) {
      if (!cursor.moveToFirst()) return null;
      return new QueueItem(
          cursor.getString(0), cursor.getString(1), cursor.getString(2), cursor.getString(3), cursor.getString(4), cursor.getString(5),
          cursor.isNull(6) ? null : cursor.getString(6), cursor.getLong(7), cursor.isNull(8) ? null : cursor.getString(8),
          cursor.isNull(9) ? null : cursor.getLong(9), cursor.isNull(10) ? null : cursor.getInt(10),
          cursor.isNull(11) ? null : cursor.getInt(11), cursor.isNull(12) ? null : cursor.getDouble(12));
    }
  }

  private static String findImportedMediaId(SQLiteDatabase db, String sourceKey) {
    if (sourceKey == null) return null;
    try (Cursor cursor = db.rawQuery("SELECT id FROM media_items WHERE source_key=? AND import_status='complete' LIMIT 1", new String[]{sourceKey})) {
      return cursor.moveToFirst() ? cursor.getString(0) : null;
    }
  }

  private static String readTargetAlbumId(SQLiteDatabase db, String jobId) {
    try (Cursor cursor = db.rawQuery("SELECT target_album_id FROM import_jobs WHERE id=?", new String[]{jobId})) {
      return cursor.moveToFirst() && !cursor.isNull(0) ? cursor.getString(0) : null;
    }
  }

  private void markCompleted(SQLiteDatabase db, String jobId, QueueItem item, long bytes, String targetPath) {
    db.beginTransaction();
    try {
      if (targetPath != null) {
        ContentValues media = new ContentValues();
        media.put("id", item.mediaId);
        media.put("uri", Uri.fromFile(new File(targetPath)).toString());
        media.put("filename", item.filename);
        media.put("type", item.type);
        if (item.mimeType != null) media.put("mime_type", item.mimeType);
        media.put("size", bytes);
        media.put("created_at", now());
        media.put("hidden", 0);
        media.put("source", "imported");
        if (item.sourceKey != null) media.put("source_key", item.sourceKey);
        if (item.sourceModifiedAt != null) media.put("source_modified_at", item.sourceModifiedAt);
        if (item.width != null) media.put("width", item.width);
        if (item.height != null) media.put("height", item.height);
        if (item.duration != null) media.put("duration", item.duration);
        media.put("import_status", "complete");
        db.insertWithOnConflict("media_items", null, media, SQLiteDatabase.CONFLICT_IGNORE);
      }
      ContentValues queue = new ContentValues();
      queue.put("status", "completed");
      queue.putNull("error");
      db.update("import_job_items", queue, "id=? AND job_id=?", new String[]{item.id, jobId});
      String targetAlbumId = readTargetAlbumId(db, jobId);
      if (targetAlbumId != null) {
        db.execSQL("INSERT OR IGNORE INTO album_media (album_id, media_id, added_at) SELECT ?, ?, ? WHERE EXISTS (SELECT 1 FROM albums WHERE id=?)",
            new Object[]{targetAlbumId, item.mediaId, now(), targetAlbumId});
      }
      db.execSQL("UPDATE import_jobs SET completed_files=completed_files+1, copied_bytes=copied_bytes+?, current_bytes=0, current_filename=NULL, updated_at=? WHERE id=?",
          new Object[]{bytes, now(), jobId});
      db.setTransactionSuccessful();
    } finally {
      db.endTransaction();
    }
  }

  private static void updateCurrentBytes(SQLiteDatabase db, String jobId, long currentBytes) {
    db.execSQL("UPDATE import_jobs SET current_bytes=?, updated_at=? WHERE id=? AND state='running'", new Object[]{currentBytes, now(), jobId});
  }

  private static void clearCurrentFilename(SQLiteDatabase db, String jobId) {
    db.execSQL("UPDATE import_jobs SET current_filename=NULL, current_bytes=0, updated_at=? WHERE id=?", new Object[]{now(), jobId});
  }

  private static void markFailed(SQLiteDatabase db, String jobId, QueueItem item, Exception error) {
    ContentValues queue = new ContentValues();
    queue.put("status", "failed");
    queue.put("error", safeMessage(error));
    db.update("import_job_items", queue, "id=? AND job_id=?", new String[]{item.id, jobId});
    db.execSQL("UPDATE import_jobs SET failed_files=failed_files+1, current_bytes=0, error=?, current_filename=NULL, updated_at=? WHERE id=?",
        new Object[]{safeMessage(error), now(), jobId});
  }

  private void updateNotification(SQLiteDatabase db, String jobId, String filename) {
    int total = readTotalFiles(db, jobId);
    int done;
    try (Cursor cursor = db.rawQuery("SELECT completed_files FROM import_jobs WHERE id=?", new String[]{jobId})) {
      done = cursor.moveToFirst() ? cursor.getInt(0) : 0;
    }
    String label = filename == null ? "جارٍ نسخ الوسائط" : "جارٍ نسخ " + filename;
    getApplicationContext().getSystemService(NotificationManager.class).notify(NOTIFICATION_ID,
        buildNotification(label, done, total));
  }

  private ForegroundInfo createForegroundInfo(String text, int progress, int total) {
    createNotificationChannel();
    Notification notification = buildNotification(text, progress, total);
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      return new ForegroundInfo(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC);
    }
    return new ForegroundInfo(NOTIFICATION_ID, notification);
  }

  private Notification buildNotification(String text, int progress, int total) {
    return new NotificationCompat.Builder(getApplicationContext(), CHANNEL_ID)
        .setSmallIcon(android.R.drawable.stat_sys_download)
        .setContentTitle("استيراد إلى مُرشد")
        .setContentText(text)
        .setOngoing(true)
        .setOnlyAlertOnce(true)
        .setProgress(Math.max(0, total), Math.max(0, Math.min(progress, total)), total <= 0)
        .build();
  }

  private void createNotificationChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
    NotificationManager manager = getApplicationContext().getSystemService(NotificationManager.class);
    if (manager == null || manager.getNotificationChannel(CHANNEL_ID) != null) return;
    manager.createNotificationChannel(new NotificationChannel(CHANNEL_ID, "استيراد الوسائط", NotificationManager.IMPORTANCE_LOW));
  }

  private static String now() {
    return new java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US)
        .format(new java.util.Date());
  }

  private static String safeMessage(Exception error) {
    String message = error.getMessage();
    return message == null || message.trim().isEmpty() ? "تعذر نسخ هذا الملف." : message;
  }

  private static final class QueueItem {
    final String id;
    String mediaId;
    final String sourceUri;
    final String targetUri;
    final String filename;
    final String type;
    final String mimeType;
    final long size;
    final String sourceKey;
    final Long sourceModifiedAt;
    final Integer width;
    final Integer height;
    final Double duration;

    QueueItem(String id, String mediaId, String sourceUri, String targetUri, String filename, String type, String mimeType,
              long size, String sourceKey, Long sourceModifiedAt, Integer width, Integer height, Double duration) {
      this.id = id;
      this.mediaId = mediaId;
      this.sourceUri = sourceUri;
      this.targetUri = targetUri;
      this.filename = filename;
      this.type = type;
      this.mimeType = mimeType;
      this.size = size;
      this.sourceKey = sourceKey;
      this.sourceModifiedAt = sourceModifiedAt;
      this.width = width;
      this.height = height;
      this.duration = duration;
    }

    QueueItem withMediaId(String existingMediaId) {
      this.mediaId = existingMediaId;
      return this;
    }
  }
}
