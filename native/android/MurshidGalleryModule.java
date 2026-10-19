package com.murshid.s7;

import androidx.work.Data;
import androidx.work.ExistingWorkPolicy;
import androidx.work.OneTimeWorkRequest;
import androidx.work.WorkManager;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

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
