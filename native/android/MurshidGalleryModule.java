package com.murshid.s7;

import androidx.annotation.Nullable;
import androidx.work.Data;
import androidx.work.ExistingWorkPolicy;
import androidx.work.OneTimeWorkRequest;
import androidx.work.WorkManager;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;

import java.util.List;
import java.util.concurrent.TimeUnit;

public final class MurshidGalleryModule extends ReactContextBaseJavaModule {
  private static final String PREFIX = "murshid-gallery-import-";

  public MurshidGalleryModule(ReactApplicationContext context) {
    super(context);
  }

  @Override
  public String getName() {
    return "MurshidGallery";
  }

  @ReactMethod
  public void queryMediaStoreAssets(Promise promise) {
    try {
      List<MurshidMediaStore.AssetMetadata> assets = MurshidMediaStore.queryDeviceMedia(getReactApplicationContext());
      WritableArray result = Arguments.createArray();
      for (MurshidMediaStore.AssetMetadata asset : assets) {
        WritableMap map = Arguments.createMap();
        map.putString("id", asset.id);
        map.putString("sourceKey", asset.sourceKey);
        map.putString("uri", asset.uri);
        map.putString("filename", asset.filename);
        map.putString("type", asset.type);
        if (asset.mimeType != null) map.putString("mimeType", asset.mimeType);
        map.putDouble("size", asset.size);
        map.putDouble("modifiedAt", asset.modifiedAt);
        if (asset.width != null) map.putInt("width", asset.width);
        if (asset.height != null) map.putInt("height", asset.height);
        if (asset.duration != null) map.putDouble("duration", asset.duration);
        if (asset.relativePath != null) map.putString("relativePath", asset.relativePath);
        map.putBoolean("screenshot", asset.screenshot);
        result.pushMap(map);
      }
      promise.resolve(result);
    } catch (Exception error) {
      promise.reject("gallery_media_query_failed", error.getMessage(), error);
    }
  }

  @ReactMethod
  public void importToMediaStore(String sourceUri, String filename, String type, @Nullable String mimeType,
                                 double expectedSize, @Nullable String sourceRelativePath, Promise promise) {
    try {
      MurshidMediaStore.ImportedMedia imported = MurshidMediaStore.copyToPublic(
          getReactApplicationContext(), sourceUri, filename, type, mimeType, Math.max(0L, (long) expectedSize), sourceRelativePath, null);
      WritableMap result = Arguments.createMap();
      result.putString("uri", imported.uri);
      result.putDouble("size", imported.size);
      promise.resolve(result);
    } catch (Exception error) {
      promise.reject("gallery_media_public_import_failed", error.getMessage(), error);
    }
  }

  @ReactMethod
  public void deleteMedia(String uri, Promise promise) {
    try {
      promise.resolve(MurshidMediaStore.delete(getReactApplicationContext(), uri));
    } catch (Exception error) {
      promise.reject("gallery_media_delete_failed", error.getMessage(), error);
    }
  }

  @ReactMethod
  public void renameMedia(String uri, String filename, Promise promise) {
    try {
      promise.resolve(MurshidMediaStore.rename(getReactApplicationContext(), uri, filename));
    } catch (Exception error) {
      promise.reject("gallery_media_rename_failed", error.getMessage(), error);
    }
  }

  @ReactMethod
  public void startImport(String jobId, String databasePath, String vaultDirectory, Promise promise) {
    try {
      Data input = new Data.Builder()
          .putString(MurshidGalleryImportWorker.KEY_JOB_ID, jobId)
          .putString(MurshidGalleryImportWorker.KEY_DATABASE_PATH, databasePath)
          .putString(MurshidGalleryImportWorker.KEY_VAULT_DIRECTORY, vaultDirectory)
          .build();
      OneTimeWorkRequest request = new OneTimeWorkRequest.Builder(MurshidGalleryImportWorker.class)
          .setInputData(input)
          .addTag(jobId)
          .setBackoffCriteria(androidx.work.BackoffPolicy.EXPONENTIAL, 10, TimeUnit.SECONDS)
          .build();
      WorkManager.getInstance(getReactApplicationContext()).enqueueUniqueWork(
          PREFIX + jobId,
          ExistingWorkPolicy.REPLACE,
          request
      );
      promise.resolve(request.getId().toString());
    } catch (Exception error) {
      promise.reject("gallery_import_start_failed", error.getMessage(), error);
    }
  }

  @ReactMethod
  public void pauseImport(String jobId, Promise promise) {
    WorkManager.getInstance(getReactApplicationContext()).cancelUniqueWork(PREFIX + jobId);
    promise.resolve(true);
  }

  @ReactMethod
  public void cancelImport(String jobId, Promise promise) {
    WorkManager.getInstance(getReactApplicationContext()).cancelUniqueWork(PREFIX + jobId);
    promise.resolve(true);
  }
}
