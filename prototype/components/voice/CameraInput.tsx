"use client";

// PERSON A OWNS THIS FILE.
// capture="environment" opens the rear camera straight away on Android.

import { useRef, useState } from "react";
import { Camera } from "lucide-react";

type Props = {
  onImage: (base64: string, mimeType: string, previewUrl: string) => void;
  label: string;
};

export default function CameraInput({ onImage, label }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const handle = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(",")[1];
      setPreview(dataUrl);
      onImage(base64, file.type || "image/jpeg", dataUrl);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => ref.current?.click()}
        className="flex w-full items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-brand px-5 py-8 text-lg font-semibold text-brand"
      >
        <Camera className="h-7 w-7" />
        {label}
      </button>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && handle(e.target.files[0])}
      />
      {preview && <img src={preview} alt="Document preview" className="w-full rounded-xl border border-[var(--line)]" />}
    </div>
  );
}
