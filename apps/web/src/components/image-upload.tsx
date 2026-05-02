"use client";

import { useState, useRef, useCallback } from "react";
import { Upload, X, Image as ImageIcon, Loader2 } from "lucide-react";
import imageCompression from "browser-image-compression";

interface ImageUploadOptions {
  maxSizeMB?: number;
  maxWidthOrHeight?: number;
  useWebWorker?: boolean;
  quality?: number;
}

interface ImageUploadProps {
  value?: string;
  onChange?: (url: string) => void;
  onUpload?: (file: File) => Promise<string>;
  maxSize?: number;
  accept?: string;
  className?: string;
  disabled?: boolean;
  placeholder?: string;
  compressionOptions?: ImageUploadOptions;
}

export function ImageUpload({
  value,
  onChange,
  onUpload,
  maxSize = 5,
  accept = "image/*",
  className = "",
  disabled = false,
  placeholder = "点击或拖拽上传图片",
  compressionOptions = {
    maxSizeMB: 1,
    maxWidthOrHeight: 1920,
    useWebWorker: true,
    quality: 0.8,
  },
}: ImageUploadProps) {
  const [preview, setPreview] = useState<string | undefined>(value);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 压缩图片
  const compressImage = async (file: File): Promise<File> => {
    try {
      const compressed = await imageCompression(file, compressionOptions);
      return compressed;
    } catch (error) {
      console.error("图片压缩失败:", error);
      return file;
    }
  };

  // 处理文件选择
  const handleFileChange = useCallback(
    async (file: File) => {
      if (disabled) return;
      setError(null);

      if (!file.type.startsWith("image/")) {
        setError("请选择图片文件");
        return;
      }

      if (file.size > maxSize * 1024 * 1024) {
        setError(`图片大小不能超过 ${maxSize}MB`);
        return;
      }

      try {
        setUploading(true);
        setProgress(10);

        const compressedFile = await compressImage(file);
        setProgress(30);

        const previewUrl = URL.createObjectURL(compressedFile);
        setPreview(previewUrl);
        setProgress(50);

        if (onUpload) {
          const url = await onUpload(compressedFile);
          setProgress(100);
          onChange?.(url);
        } else {
          setProgress(100);
          onChange?.(previewUrl);
        }
      } catch (error) {
        console.error("上传失败:", error);
        setError(error instanceof Error ? error.message : "上传失败");
        setPreview(undefined);
      } finally {
        setUploading(false);
        setProgress(0);
      }
    },
    [disabled, maxSize, onUpload, onChange, compressionOptions],
  );

  return (
    <div className={`relative ${className}`}>
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFileChange(file);
        }}
        className="hidden"
        disabled={disabled}
      />

      <div
        onClick={() => !disabled && fileInputRef.current?.click()}
        onDragEnter={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          const file = e.dataTransfer.files[0];
          if (file) void handleFileChange(file);
        }}
        className={`
          relative overflow-hidden rounded-[16px] border-2 border-dashed
          transition-all duration-200 cursor-pointer aspect-video
          ${isDragging ? "border-app-accent bg-app-accent-soft" : "border-app-line hover:border-app-accent/50"}
          ${disabled ? "opacity-50 cursor-not-allowed" : ""}
        `}
      >
        {preview ? (
          <>
            <img src={preview} alt="Preview" className="w-full h-full object-cover" />
            {!disabled && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setPreview(undefined);
                  onChange?.("");
                }}
                className="absolute top-2 right-2 p-2 bg-app-panel-strong rounded-full shadow-lg hover:bg-app-danger hover:text-white transition"
              >
                <X className="h-4 w-4" />
              </button>
            )}
            {uploading && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <div className="text-center">
                  <Loader2 className="h-8 w-8 text-white animate-spin mx-auto mb-2" />
                  <div className="text-white text-sm">{progress}%</div>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-app-text-soft">
            {uploading ? (
              <>
                <Loader2 className="h-12 w-12 animate-spin mb-3" />
                <p className="text-sm">{progress}%</p>
              </>
            ) : (
              <>
                <Upload className="h-12 w-12 mb-3" />
                <p className="text-sm">{placeholder}</p>
                <p className="text-xs text-app-text-muted mt-1">最大 {maxSize}MB</p>
              </>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="mt-2 text-sm text-app-danger">{error}</div>
      )}
    </div>
  );
}
