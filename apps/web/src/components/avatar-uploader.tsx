"use client";

import { useRef, useState } from "react";

import { UserAvatar } from "@/components/user-avatar";

type AvatarUploaderProps = {
  username: string;
  currentBase64: string | null;
  onChange: (base64: string | null) => void;
};

const MAX_SIZE_BYTES = 200 * 1024;

export function AvatarUploader({ username, currentBase64, onChange }: AvatarUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  function handleFileSelect(file: File) {
    setError(null);

    if (!file.type.startsWith("image/")) {
      setError("请选择图片文件");
      return;
    }

    if (file.size > MAX_SIZE_BYTES) {
      setError("图片大小不能超过 200KB");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      onChange(reader.result as string);
    };
    reader.onerror = () => {
      setError("图片读取失败");
    };
    reader.readAsDataURL(file);
  }

  function handleDrop(event: React.DragEvent) {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }

  function handleRemove() {
    onChange(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4">
        <div
          className="relative cursor-pointer group"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
        >
          <UserAvatar base64={currentBase64} username={username} size={72} />
          <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
        </div>
        <div className="space-y-2">
          <button type="button" onClick={() => inputRef.current?.click()} className="app-button app-button-secondary h-10 px-4 text-xs">
            上传头像
          </button>
          {currentBase64 && (
            <button type="button" onClick={handleRemove} className="app-button app-button-secondary h-10 px-4 text-xs ml-2">
              移除头像
            </button>
          )}
          <p className="text-xs text-app-text-soft">支持 JPG/PNG/GIF，不超过 200KB，可拖拽上传</p>
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) handleFileSelect(file);
        }}
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
