"use client";

import { useOnlineStatus } from "@/hooks/use-online-status";
import { Camera, Image as ImageIcon } from "lucide-react";
import { useRef, useState } from "react";

type UploadAreaProps = {
  onFileSelected: (file: File) => void;
  isUploading: boolean;
};

export function UploadArea({ onFileSelected, isUploading }: UploadAreaProps) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const isOnline = useOnlineStatus();

  function handleFile(file: File | undefined) {
    if (!file) return;
    onFileSelected(file);
  }

  return (
    <div>
      <div
        className={`mb-4 flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 transition-colors ${
          dragOver ? "border-green-500 bg-green-50" : "border-gray-300 bg-white"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFile(e.dataTransfer.files[0]);
        }}
        onClick={() => galleryRef.current?.click()}
      >
        <div className="mb-2 text-4xl">📸</div>
        <div className="text-[15px] font-medium text-gray-700">Take a photo or upload</div>
        <div className="mt-1 text-[13px] text-gray-400">Supports JPG, PNG up to 10MB</div>
      </div>

      <div className="mb-6 flex gap-3">
        <button
          type="button"
          disabled={isUploading || !isOnline}
          onClick={() => cameraRef.current?.click()}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-green-700 px-4 py-3 text-[15px] font-semibold text-white disabled:opacity-50"
        >
          <Camera className="h-4 w-4" />
          Camera
        </button>
        <button
          type="button"
          disabled={isUploading || !isOnline}
          onClick={() => galleryRef.current?.click()}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl border-[1.5px] border-gray-300 bg-white px-4 py-3 text-[15px] font-semibold text-gray-700 disabled:opacity-50"
        >
          <ImageIcon className="h-4 w-4" />
          Gallery
        </button>
      </div>

      {/* Hidden file inputs */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
    </div>
  );
}
