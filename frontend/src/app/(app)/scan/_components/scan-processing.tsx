"use client";

import { Progress } from "@/components/ui/progress";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

type ScanProcessingProps = {
  onCancel: () => void;
};

export function ScanProcessing({ onCancel }: ScanProcessingProps) {
  const [progress, setProgress] = useState(10);

  useEffect(() => {
    const timer = setInterval(() => {
      setProgress((prev) => Math.min(prev + Math.random() * 15, 90));
    }, 800);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/95">
      <div className="flex flex-col items-center px-8 text-center">
        <Loader2 className="mb-4 h-12 w-12 animate-spin text-green-600" />
        <h2 className="mb-2 text-lg font-semibold text-gray-900">Analyzing receipt...</h2>
        <p className="mb-6 text-sm text-gray-500">Extracting ingredients from your receipt</p>
        <div className="mb-6 w-64">
          <Progress value={progress} className="h-2" />
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="text-sm font-medium text-gray-500 underline"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
