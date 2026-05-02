import type { WeiboAccount } from "@/lib/app-data";

export type AccountStatus = "ACTIVE" | "DISABLED" | "RISKY" | "EXPIRED";

export type FormState = {
  nickname: string;
  remark: string;
  groupName: string;
  status: AccountStatus;
  scheduleWindowEnabled: boolean;
  executionWindowStart: string;
  executionWindowEnd: string;
  baseJitterSec: number;
};

export type SessionFormState = {
  uid: string;
  username: string;
  cookie: string;
};

export type QrLoginState = "WAITING" | "SCANNED" | "CONFIRMED" | "EXPIRED" | "FAILED";

export type QrSession = {
  sessionId: string;
  state: QrLoginState;
  qrImageDataUrl: string;
  expiresAt: string;
  message?: string;
};

export const initialForm: FormState = {
  nickname: "",
  remark: "",
  groupName: "",
  status: "ACTIVE",
  scheduleWindowEnabled: false,
  executionWindowStart: "",
  executionWindowEnd: "",
  baseJitterSec: 0,
};

export type CheckSessionResult = {
  success: boolean;
  message?: string;
  data?: {
    id: string;
    loginStatus: WeiboAccount["loginStatus"];
    lastCheckAt: string | null;
    loginErrorMessage: string | null;
    consecutiveFailures: number;
  };
};

export type CreateAccountResult = {
  success: boolean;
  message?: string;
  data: WeiboAccount;
};

export type SaveSessionResult = {
  success: boolean;
  message?: string;
  data?: {
    id: string;
    uid: string | null;
    username: string | null;
    loginStatus: WeiboAccount["loginStatus"];
    cookieUpdatedAt: string | null;
  };
};

export type QrStartResult = {
  success: boolean;
  message?: string;
  data?: QrSession;
};

export type QrStatusResult = {
  success: boolean;
  message?: string;
  data?: {
    sessionId: string;
    state: QrLoginState;
    message?: string;
    uid?: string;
    username?: string;
    cookie?: string;
  };
};
