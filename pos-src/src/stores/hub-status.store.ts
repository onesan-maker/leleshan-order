import { create } from 'zustand';
import { hubClient } from '@/lib/hub-client';

interface HubStatusState {
  isHealthy: boolean;
  lastCheckAt: Date | null;
  lastError: string | null;
  checkHealth(): Promise<void>;
  startMonitoring(): void;
  stopMonitoring(): void;
}

let _intervalId: ReturnType<typeof setInterval> | null = null;

export const useHubStatusStore = create<HubStatusState>((set) => ({
  isHealthy: false,
  lastCheckAt: null,
  lastError: null,

  async checkHealth() {
    try {
      const healthy = await hubClient.isHealthy();
      set({
        isHealthy: healthy,
        lastCheckAt: new Date(),
        lastError: healthy ? null : 'Hub unreachable',
      });
    } catch (e) {
      set({
        isHealthy: false,
        lastCheckAt: new Date(),
        lastError: e instanceof Error ? e.message : String(e),
      });
    }
  },

  startMonitoring() {
    if (_intervalId !== null) return;
    void useHubStatusStore.getState().checkHealth();
    _intervalId = setInterval(() => {
      void useHubStatusStore.getState().checkHealth();
    }, 30_000);
  },

  stopMonitoring() {
    if (_intervalId !== null) {
      clearInterval(_intervalId);
      _intervalId = null;
    }
  },
}));
