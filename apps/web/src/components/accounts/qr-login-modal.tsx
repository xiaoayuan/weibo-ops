"use client";

import Image from "next/image";
import { X } from "lucide-react";
import { SectionHeader } from "@/components/section-header";
import { SurfaceCard } from "@/components/surface-card";
import type { QrSession } from "./types";

type QrLoginModalProps = {
  accountNickname: string;
  session: QrSession | null;
  loading: boolean;
  onClose: () => void;
};

export function QrLoginModal({
  accountNickname,
  session,
  loading,
  onClose,
}: QrLoginModalProps) {
  const getStateText = (state: QrSession["state"]) => {
    switch (state) {
      case "WAITING":
        return "等待扫码";
      case "SCANNED":
        return "已扫码，等待确认";
      case "CONFIRMED":
        return "登录成功";
      case "EXPIRED":
        return "二维码已过期";
      case "FAILED":
        return "登录失败";
      default:
        return "未知状态";
    }
  };

  const getStateColor = (state: QrSession["state"]) => {
    switch (state) {
      case "WAITING":
        return "text-app-info";
      case "SCANNED":
        return "text-app-warning";
      case "CONFIRMED":
        return "text-app-success";
      case "EXPIRED":
      case "FAILED":
        return "text-app-danger";
      default:
        return "text-app-text-soft";
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md">
        <SurfaceCard>
          <div className="flex items-center justify-between">
            <SectionHeader
              title={`${accountNickname} - 扫码登录`}
              description="使用微博 App 扫描二维码登录"
            />
            <button
              type="button"
              onClick={onClose}
              className="app-button-text"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-5 space-y-4">
            {loading ? (
              <div className="flex h-64 items-center justify-center">
                <div className="text-center">
                  <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-app-accent border-t-transparent" />
                  <p className="mt-4 text-sm text-app-text-soft">生成二维码中...</p>
                </div>
              </div>
            ) : session ? (
              <>
                <div className="flex justify-center">
                  <div className="rounded-xl border-4 border-app-line bg-white p-4">
                    <Image
                      src={session.qrImageDataUrl}
                      alt="登录二维码"
                      width={200}
                      height={200}
                    />
                  </div>
                </div>

                <div className="text-center">
                  <p className={`text-lg font-medium ${getStateColor(session.state)}`}>
                    {getStateText(session.state)}
                  </p>
                  {session.message && (
                    <p className="mt-2 text-sm text-app-text-soft">{session.message}</p>
                  )}
                </div>

                {session.state === "WAITING" && (
                  <div className="rounded-lg bg-app-panel-muted p-4">
                    <p className="text-sm text-app-text-soft">
                      1. 打开微博 App
                      <br />
                      2. 点击右上角扫一扫
                      <br />
                      3. 扫描上方二维码
                      <br />
                      4. 在手机上确认登录
                    </p>
                  </div>
                )}

                {session.state === "CONFIRMED" && (
                  <button
                    type="button"
                    onClick={onClose}
                    className="app-button app-button-primary w-full"
                  >
                    完成
                  </button>
                )}

                {(session.state === "EXPIRED" || session.state === "FAILED") && (
                  <button
                    type="button"
                    onClick={onClose}
                    className="app-button app-button-secondary w-full"
                  >
                    关闭
                  </button>
                )}
              </>
            ) : (
              <div className="flex h-64 items-center justify-center">
                <p className="text-sm text-app-text-soft">无法生成二维码</p>
              </div>
            )}
          </div>
        </SurfaceCard>
      </div>
    </div>
  );
}
