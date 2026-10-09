import type { ReleaseStatus } from '../firebase/hubRepository';

export type DeviceUpdateEvent = { releaseId: string; status: 'download_started' | 'downloaded' | 'applied' | 'failed' | 'rolled_back'; runtimeVersion: string; errorCode?: string; createdAt: string; };
export type ReleaseHealth = { status: ReleaseStatus; applied: number; failed: number; failureRate: number; compatible: boolean; recommendation: 'continue' | 'pause' | 'rollback'; };

export function evaluateReleaseHealth(events: DeviceUpdateEvent[], expectedRuntimeVersion: string): ReleaseHealth {
  const applied = events.filter((event) => event.status === 'applied').length;
  const failed = events.filter((event) => event.status === 'failed').length;
  const total = applied + failed;
  const failureRate = total ? failed / total : 0;
  const compatible = events.every((event) => event.runtimeVersion === expectedRuntimeVersion);
  const recommendation = !compatible || failureRate >= 0.25 ? 'rollback' : failureRate >= 0.1 ? 'pause' : 'continue';
  return { status: recommendation === 'rollback' ? 'rolled_back' : recommendation === 'pause' ? 'stopped' : 'active', applied, failed, failureRate, compatible, recommendation };
}

export function shouldStopRollout(health: ReleaseHealth) { return health.recommendation !== 'continue'; }
