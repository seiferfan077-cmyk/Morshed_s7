import { UpdateClass } from '../firebase/hubRepository';

export type EasChannel = 'development' | 'preview' | 'production';
export type UpdateDecision = { updateClass: UpdateClass; channel: EasChannel | null; requiresNativeBuild: boolean; reason: string };

export function classifyUpdate(input: { changesNative: boolean; changesJavaScript: boolean; changesRemoteContent: boolean; channel?: EasChannel }): UpdateDecision {
  if (input.changesNative) return { updateClass: 'native', channel: null, requiresNativeBuild: true, reason: 'تغيير Native أو صلاحيات Android يحتاج APK/AAB جديدًا.' };
  if (input.changesJavaScript) return { updateClass: 'ota', channel: input.channel ?? 'preview', requiresNativeBuild: false, reason: 'تغيير JavaScript/TypeScript متوافق مع runtimeVersion؛ يحتاج EAS Update بعد الاختبار.' };
  return { updateClass: 'dynamic', channel: null, requiresNativeBuild: false, reason: input.changesRemoteContent ? 'تغيير محتوى/إعدادات يتحقق عبر Firebase بعد schema validation.' : 'لا يوجد تغيير قابل للنشر.' };
}

/** Publishing is intentionally not implemented in the client. Backend must enforce admin claims, approval and idempotency. */
export function canPublish(status: string, update: UpdateDecision) { return status === 'approved' && update.updateClass !== 'native' ? { allowed: true } : { allowed: false, reason: update.updateClass === 'native' ? 'Native changes require Dashboard APK/AAB build.' : 'Only approved proposals can be published.' }; }
