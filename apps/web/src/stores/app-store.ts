import { create } from "zustand";
import type { WeiboAccount, CopywritingTemplate, Plan } from "@/lib/app-data";

type AppState = {
  // 账号数据
  accounts: WeiboAccount[];
  accountsLoading: boolean;
  fetchAccounts: () => Promise<void>;
  updateAccount: (id: string, data: Partial<WeiboAccount>) => void;

  // 文案数据
  copywriting: CopywritingTemplate[];
  copywritingLoading: boolean;
  fetchCopywriting: () => Promise<void>;
  addCopywriting: (item: CopywritingTemplate) => void;
  updateCopywriting: (id: string, data: Partial<CopywritingTemplate>) => void;
  deleteCopywriting: (id: string) => void;

  // 计划数据
  plans: Plan[];
  plansLoading: boolean;
  plansDate: string;
  fetchPlans: (date?: string) => Promise<void>;
  updatePlan: (id: string, data: Partial<Plan>) => void;
  deletePlan: (id: string) => void;

  // 全局通知
  notice: string | null;
  error: string | null;
  setNotice: (message: string | null) => void;
  setError: (message: string | null) => void;
};

export const useAppStore = create<AppState>((set, get) => ({
  // 账号数据
  accounts: [],
  accountsLoading: false,
  fetchAccounts: async () => {
    set({ accountsLoading: true });
    try {
      const response = await fetch("/api/accounts");
      const result = await response.json();
      if (result.success && result.data) {
        set({ accounts: result.data });
      }
    } catch (error) {
      console.error("Failed to fetch accounts:", error);
    } finally {
      set({ accountsLoading: false });
    }
  },
  updateAccount: (id, data) => {
    set((state) => ({
      accounts: state.accounts.map((account) =>
        account.id === id ? { ...account, ...data } : account
      ),
    }));
  },

  // 文案数据
  copywriting: [],
  copywritingLoading: false,
  fetchCopywriting: async () => {
    set({ copywritingLoading: true });
    try {
      const response = await fetch("/api/copywriting");
      const result = await response.json();
      if (result.success && result.data) {
        set({ copywriting: result.data });
      }
    } catch (error) {
      console.error("Failed to fetch copywriting:", error);
    } finally {
      set({ copywritingLoading: false });
    }
  },
  addCopywriting: (item) => {
    set((state) => ({ copywriting: [item, ...state.copywriting] }));
  },
  updateCopywriting: (id, data) => {
    set((state) => ({
      copywriting: state.copywriting.map((item) =>
        item.id === id ? { ...item, ...data } : item
      ),
    }));
  },
  deleteCopywriting: (id) => {
    set((state) => ({
      copywriting: state.copywriting.filter((item) => item.id !== id),
    }));
  },

  // 计划数据
  plans: [],
  plansLoading: false,
  plansDate: new Date().toISOString().split("T")[0],
  fetchPlans: async (date) => {
    const targetDate = date || get().plansDate;
    set({ plansLoading: true, plansDate: targetDate });
    try {
      const response = await fetch(`/api/plans?date=${targetDate}`);
      const result = await response.json();
      if (result.success && result.data) {
        set({ plans: result.data });
      }
    } catch (error) {
      console.error("Failed to fetch plans:", error);
    } finally {
      set({ plansLoading: false });
    }
  },
  updatePlan: (id, data) => {
    set((state) => ({
      plans: state.plans.map((plan) =>
        plan.id === id ? { ...plan, ...data } : plan
      ),
    }));
  },
  deletePlan: (id) => {
    set((state) => ({
      plans: state.plans.filter((plan) => plan.id !== id),
    }));
  },

  // 全局通知
  notice: null,
  error: null,
  setNotice: (message) => set({ notice: message, error: null }),
  setError: (message) => set({ error: message, notice: null }),
}));
