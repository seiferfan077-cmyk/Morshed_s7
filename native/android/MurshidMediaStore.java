package com.murshid.s7;

import android.content.ContentResolver;
import android.content.ContentUris;
import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;

import androidx.annotation.Nullable;

import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

import android.media.MediaScannerConnection;

public final class MurshidMediaStore {
  public static final String PHOTOS_RELATIVE_PATH = "Pictures/مُرشد/الصور/";
  public static final String VIDEOS_RELATIVE_PATH = "Movies/مُرشد/الفيديوهات/";
  public static final String SCREENSHOTS_RELATIVE_PATH = "Pictures/مُرشد/لقطات الشاشة/";
  private static final int BUFFER_SIZE = 64 * 1024;

  private MurshidMediaStore() {}

  public interface Cancellation {
    boolean isCancelled();
  }

  public static final class CopyCancelledException extends IOException {
    public CopyCancelledException() {
      super("تم إيقاف استيراد الوسائط.");
    }
  }

  public static final class ImportedMedia {
    public final String uri;
    public final long size;

    ImportedMedia(String uri, long size) {
      this.uri = uri;
      this.size = size;
    }
  }

  public static final class AssetMetadata {
    public final String id;
    public final String sourceKey;
    public final String uri;
    public final String filename;
    public final String type;
    public final String mimeType;
    public final long size;
    public final long modifiedAt;
    public final Integer width;
    public final Integer height;
    public final Double duration;
    public final String relativePath;
    public final boolean screenshot;

    AssetMetadata(String id, String sourceKey, String uri, String filename, String type, String mimeType,
                  long size, long modifiedAt, Integer width, Integer height, Double duration,
                  String relativePath, boolean screenshot) {
      this.id = id;
      this.sourceKey = sourceKey;
      this.uri = uri;
      this.filename = filename;
      this.type = type;
      this.mimeType = mimeType;
      this.size = size;
      this.modifiedAt = modifiedAt;
      this.width = width;
      this.height = height;
      this.duration = duration;
      this.relativePath = relativePath;
      this.screenshot = screenshot;
    }
  }

  public static List<AssetMetadata> queryDeviceMedia(Context context) {
    ContentResolver resolver = context.getContentResolver();
    List<AssetMetadata> result = new ArrayList<>();
    Uri collection = MediaStore.Files.getContentUri("external");
    String mediaTypeColumn = MediaStore.Files.FileColumns.MEDIA_TYPE;
    String[] projection;
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      projection = new String[]{
          MediaStore.Files.FileColumns._ID,
          mediaTypeColumn,
          MediaStore.MediaColumns.DISPLAY_NAME,
          MediaStore.MediaColumns.MIME_TYPE,
          MediaStore.MediaColumns.SIZE,
          MediaStore.MediaColumns.DATE_MODIFIED,
          MediaStore.MediaColumns.RELATIVE_PATH,
          MediaStore.MediaColumns.WIDTH,
          MediaStore.MediaColumns.HEIGHT,
          MediaStore.Video.VideoColumns.DURATION,
          MediaStore.MediaColumns.IS_PENDING,
      };
    } else {
      projection = new String[]{
          MediaStore.Files.FileColumns._ID,
          mediaTypeColumn,
          MediaStore.MediaColumns.DISPLAY_NAME,
          MediaStore.MediaColumns.MIME_TYPE,
          MediaStore.MediaColumns.SIZE,
          MediaStore.MediaColumns.DATE_MODIFIED,
          MediaStore.MediaColumns.DATA,
          MediaStore.MediaColumns.WIDTH,
          MediaStore.MediaColumns.HEIGHT,
          MediaStore.Video.VideoColumns.DURATION,
      };
    }
    String selection = mediaTypeColumn + " IN (?, ?)";
    String[] selectionArgs = {
        String.valueOf(MediaStore.Files.FileColumns.MEDIA_TYPE_IMAGE),
        String.valueOf(MediaStore.Files.FileColumns.MEDIA_TYPE_VIDEO),
    };
    try (Cursor cursor = resolver.query(collection, projection, selection, selectionArgs, MediaStore.MediaColumns.DATE_ADDED + " ASC")) {
      if (cursor == null) return result;
      int idIndex = cursor.getColumnIndex(MediaStore.Files.FileColumns._ID);
      int mediaTypeIndex = cursor.getColumnIndex(mediaTypeColumn);
      int nameIndex = cursor.getColumnIndex(MediaStore.MediaColumns.DISPLAY_NAME);
      int mimeIndex = cursor.getColumnIndex(MediaStore.MediaColumns.MIME_TYPE);
      int sizeIndex = cursor.getColumnIndex(MediaStore.MediaColumns.SIZE);
      int modifiedIndex = cursor.getColumnIndex(MediaStore.MediaColumns.DATE_MODIFIED);
      int relativePathIndex = cursor.getColumnIndex(Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
          ? MediaStore.MediaColumns.RELATIVE_PATH : MediaStore.MediaColumns.DATA);
      int widthIndex = cursor.getColumnIndex(MediaStore.MediaColumns.WIDTH);
      int heightIndex = cursor.getColumnIndex(MediaStore.MediaColumns.HEIGHT);
      int durationIndex = cursor.getColumnIndex(MediaStore.Video.VideoColumns.DURATION);
      int pendingIndex = cursor.getColumnIndex(MediaStore.MediaColumns.IS_PENDING);
      while (cursor.moveToNext()) {
        if (pendingIndex >= 0 && cursor.getInt(pendingIndex) != 0) continue;
        long id = idIndex >= 0 ? cursor.getLong(idIndex) : -1L;
        int mediaType = mediaTypeIndex >= 0 ? cursor.getInt(mediaTypeIndex) : -1;
        String type = mediaType == MediaStore.Files.FileColumns.MEDIA_TYPE_VIDEO ? "video" : "image";
        String relativePath = relativePathIndex >= 0 && !cursor.isNull(relativePathIndex) ? cursor.getString(relativePathIndex) : null;
        if (isMurshidPublicPath(relativePath)) continue;
        boolean screenshot = isScreenshotPath(relativePath);
        Uri itemUri = ContentUris.withAppendedId(collection, id);
        String filename = valueOrDefault(cursor, nameIndex, "media-" + id);
        String mimeType = nullableString(cursor, mimeIndex);
        long size = longValue(cursor, sizeIndex);
        long modifiedAt = longValue(cursor, modifiedIndex) * 1000L;
        Integer width = nullableInt(cursor, widthIndex);
        Integer height = nullableInt(cursor, heightIndex);
        Double duration = nullableDouble(cursor, durationIndex);
        result.add(new AssetMetadata(
            String.valueOf(id), "device:" + id, itemUri.toString(), filename, type, mimeType,
            size, modifiedAt, width, height, duration, relativePath, screenshot));
      }
    }
    return result;
  }

  public static ImportedMedia copyToPublic(Context context, String sourceUri, String filename, String type,
                                           @Nullable String mimeType, long expectedSize,
                                           @Nullable String sourceRelativePath,
                                           @Nullable Cancellation cancellation) throws Exception {
    String safeName = safeFilename(filename);
    String resolvedMime = mimeType == null || mimeType.trim().isEmpty() ? mimeForType(type, safeName) : mimeType;
    boolean screenshot = "image".equals(type) && isScreenshotPath(sourceRelativePath);
    String relativePath = "video".equals(type) ? VIDEOS_RELATIVE_PATH : screenshot ? SCREENSHOTS_RELATIVE_PATH : PHOTOS_RELATIVE_PATH;
    if (!"image".equals(type) && !"video".equals(type)) {
      throw new IllegalArgumentException("هذا النوع لا ينتمي إلى مجلدات الوسائط العامة.");
    }

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      ContentResolver resolver = context.getContentResolver();
      Uri collection = "video".equals(type)
          ? MediaStore.Video.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY)
          : MediaStore.Images.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY);
      ContentValues values = new ContentValues();
      values.put(MediaStore.MediaColumns.DISPLAY_NAME, safeName);
      values.put(MediaStore.MediaColumns.MIME_TYPE, resolvedMime);
      values.put(MediaStore.MediaColumns.RELATIVE_PATH, relativePath);
      values.put(MediaStore.MediaColumns.IS_PENDING, 1);
      Uri target = resolver.insert(collection, values);
      if (target == null) throw new IOException("تعذر إنشاء سجل MediaStore للوسيط.");
      try {
        long copied = copyStream(context, sourceUri, resolver.openOutputStream(target, "w"), expectedSize, cancellation);
        long storedSize = querySize(resolver, target);
        if (storedSize >= 0 && storedSize != copied) throw new IOException("لم يتطابق حجم النسخة العامة مع البيانات المنسوخة.");
        ContentValues published = new ContentValues();
        published.put(MediaStore.MediaColumns.IS_PENDING, 0);
        if (resolver.update(target, published, null, null) != 1) throw new IOException("تعذر نشر الوسيط في MediaStore.");
        return new ImportedMedia(target.toString(), copied);
      } catch (Exception error) {
        resolver.delete(target, null, null);
        throw error;
      }
    }

    File root = Environment.getExternalStoragePublicDirectory(
        "video".equals(type) ? Environment.DIRECTORY_MOVIES : Environment.DIRECTORY_PICTURES);
    File directory = "video".equals(type)
        ? new File(root, "مُرشد/الفيديوهات")
        : new File(root, screenshot ? "مُرشد/لقطات الشاشة" : "مُرشد/الصور");
    if (!directory.exists() && !directory.mkdirs()) throw new IOException("تعذر إنشاء مجلد الوسائط العامة.");
    File target = uniqueFile(directory, safeName);
    long copied = 0L;
    try (OutputStream output = new BufferedOutputStream(new FileOutputStream(target), BUFFER_SIZE)) {
      copied = copyStream(context, sourceUri, output, expectedSize, cancellation);
    } catch (Exception error) {
      if (target.exists()) target.delete();
      throw error;
    }
    MediaScannerConnection.scanFile(context, new String[]{target.getAbsolutePath()}, new String[]{resolvedMime}, null);
    return new ImportedMedia(Uri.fromFile(target).toString(), copied);
  }

  public static boolean delete(Context context, String value) {
    Uri uri = Uri.parse(value);
    if ("content".equalsIgnoreCase(uri.getScheme())) {
      return context.getContentResolver().delete(uri, null, null) > 0;
    }
    if ("file".equalsIgnoreCase(uri.getScheme())) {
      File file = new File(uri.getPath());
      return !file.exists() || file.delete();
    }
    return false;
  }

  public static String rename(Context context, String value, String filename) throws IOException {
    String safeName = safeFilename(filename);
    Uri uri = Uri.parse(value);
    if ("content".equalsIgnoreCase(uri.getScheme())) {
      ContentValues values = new ContentValues();
      values.put(MediaStore.MediaColumns.DISPLAY_NAME, safeName);
      if (context.getContentResolver().update(uri, values, null, null) <= 0) {
        throw new IOException("تعذر إعادة تسمية النسخة العامة.");
      }
      return value;
    }
    if ("file".equalsIgnoreCase(uri.getScheme())) {
      File current = new File(uri.getPath());
      File parent = current.getParentFile();
      if (parent == null) throw new IOException("مسار النسخة العامة غير صالح.");
      File target = uniqueFile(parent, safeName);
      if (!current.equals(target) && !current.renameTo(target)) throw new IOException("تعذر إعادة تسمية النسخة العامة.");
      return Uri.fromFile(target).toString();
    }
    throw new IOException("نوع URI غير مدعوم لإعادة التسمية.");
  }

  public static boolean isMurshidPublicPath(@Nullable String value) {
    if (value == null) return false;
    String normalized = value.replace('\\', '/').toLowerCase(Locale.ROOT);
    return normalized.contains("/مُرشد/الصور/")
        || normalized.contains("/مُرشد/الفيديوهات/")
        || normalized.contains("/مُرشد/لقطات الشاشة/")
        || normalized.contains("/murshid/الصور/")
        || normalized.contains("/murshid/الفيديوهات/")
        || normalized.contains("/murshid/لقطات الشاشة/");
  }

  public static boolean isScreenshotPath(@Nullable String value) {
    if (value == null || value.trim().isEmpty()) return false;
    String normalized = value.replace('\\', '/').toLowerCase(Locale.ROOT);
    String[] segments = normalized.split("/");
    for (String segment : segments) {
      if (segment.equals("screenshots") || segment.equals("screenshot")
          || segment.equals("لقطات الشاشة") || segment.equals("لقطات-الشاشة")) return true;
    }
    return false;
  }

  private static long copyStream(Context context, String sourceUri, @Nullable OutputStream output,
                                 long expectedSize, @Nullable Cancellation cancellation) throws Exception {
    if (output == null) throw new IOException("تعذر فتح مساحة الكتابة للوسيط.");
    long copied = 0L;
    try (InputStream input = new BufferedInputStream(openInput(context, sourceUri), BUFFER_SIZE);
         OutputStream stream = new BufferedOutputStream(output, BUFFER_SIZE)) {
      byte[] buffer = new byte[BUFFER_SIZE];
      int count;
      while ((count = input.read(buffer)) != -1) {
        if (cancellation != null && cancellation.isCancelled()) throw new CopyCancelledException();
        stream.write(buffer, 0, count);
        copied += count;
      }
      stream.flush();
    }
    if (expectedSize > 0 && copied != expectedSize) {
      throw new IOException("تغير حجم الملف أثناء النسخ.");
    }
    return copied;
  }

  private static InputStream openInput(Context context, String value) throws Exception {
    Uri uri = Uri.parse(value);
    if ("file".equalsIgnoreCase(uri.getScheme())) {
      File source = new File(uri.getPath());
      if (!source.isFile()) throw new IOException("الملف المصدر غير موجود أو لم يعد متاحًا.");
      return new FileInputStream(source);
    }
    InputStream input = context.getContentResolver().openInputStream(uri);
    if (input == null) throw new IOException("تعذر فتح الملف المصدر.");
    return input;
  }

  private static long querySize(ContentResolver resolver, Uri uri) {
    try (Cursor cursor = resolver.query(uri, new String[]{MediaStore.MediaColumns.SIZE}, null, null, null)) {
      if (cursor != null && cursor.moveToFirst()) return cursor.getLong(0);
    } catch (Exception ignored) {
      // The stream length below remains the source of truth when a provider omits SIZE.
    }
    return -1L;
  }

  private static File uniqueFile(File directory, String filename) {
    File candidate = new File(directory, filename);
    if (!candidate.exists()) return candidate;
    String stem = filename;
    String extension = "";
    int dot = filename.lastIndexOf('.');
    if (dot > 0) {
      stem = filename.substring(0, dot);
      extension = filename.substring(dot);
    }
    int index = 2;
    while (candidate.exists()) candidate = new File(directory, stem + "-" + index++ + extension);
    return candidate;
  }

  private static String safeFilename(String filename) {
    String clean = filename == null ? "media" : filename.replaceAll("[\\\\/:*?\"<>|\\u0000-\\u001f]+", "-")
        .replaceAll("\\s+", "-").replaceAll("^-+|-+$", "");
    return clean.length() > 180 ? clean.substring(0, 180) : clean.isEmpty() ? "media" : clean;
  }

  private static String mimeForType(String type, String filename) {
    if ("video".equals(type)) return "video/mp4";
    String lower = filename.toLowerCase(Locale.ROOT);
    if (lower.endsWith(".png")) return "image/png";
    if (lower.endsWith(".webp")) return "image/webp";
    if (lower.endsWith(".heic")) return "image/heic";
    return "image/jpeg";
  }

  private static String valueOrDefault(Cursor cursor, int index, String fallback) {
    String value = nullableString(cursor, index);
    return value == null || value.trim().isEmpty() ? fallback : value;
  }

  @Nullable
  private static String nullableString(Cursor cursor, int index) {
    return index >= 0 && !cursor.isNull(index) ? cursor.getString(index) : null;
  }

  private static long longValue(Cursor cursor, int index) {
    return index >= 0 && !cursor.isNull(index) ? cursor.getLong(index) : 0L;
  }

  @Nullable
  private static Integer nullableInt(Cursor cursor, int index) {
    return index >= 0 && !cursor.isNull(index) ? cursor.getInt(index) : null;
  }

  @Nullable
  private static Double nullableDouble(Cursor cursor, int index) {
    return index >= 0 && !cursor.isNull(index) ? cursor.getDouble(index) : null;
  }
}
