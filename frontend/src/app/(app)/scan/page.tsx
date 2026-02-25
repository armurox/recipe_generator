"use client";

import { useAuth } from "@/lib/auth-context";
import { uploadReceiptImage } from "@/lib/upload";
import { useScanReceipt } from "@/hooks/use-receipts";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { RecentScans } from "./_components/recent-scans";
import { ScanProcessing } from "./_components/scan-processing";
import { UploadArea } from "./_components/upload-area";

export default function ScanPage() {
  const router = useRouter();
  const { user } = useAuth();
  const scanReceipt = useScanReceipt();
  const [isProcessing, setIsProcessing] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  async function handleFileSelected(file: File) {
    if (!user) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error("File too large. Please select an image under 10MB.");
      return;
    }

    const abortController = new AbortController();
    abortRef.current = abortController;
    setIsProcessing(true);

    try {
      const imageUrl = await uploadReceiptImage(file, user.id);

      if (abortController.signal.aborted) return;

      const scan = await scanReceipt.mutateAsync({ image_url: imageUrl });

      if (abortController.signal.aborted) {
        // Scan completed on backend but user cancelled — still navigate to review
        toast.success(`Scan completed! Found ${scan.items.length} items`);
        router.push(`/scan/${scan.id}`);
        return;
      }

      toast.success(`Found ${scan.items.length} items`);
      router.push(`/scan/${scan.id}`);
    } catch (error) {
      if (abortController.signal.aborted) return;
      const message = error instanceof Error ? error.message : "Failed to scan receipt";
      toast.error(message);
    } finally {
      setIsProcessing(false);
      abortRef.current = null;
    }
  }

  function handleCancel() {
    if (abortRef.current) {
      abortRef.current.abort();
    }
    setIsProcessing(false);
    toast.info("Scan cancelled. Check Recent Scans if it completed in the background.");
  }

  if (isProcessing) {
    return <ScanProcessing onCancel={handleCancel} />;
  }

  return (
    <div>
      <div className="px-5 pb-4 pt-3">
        <h1 className="text-[28px] font-bold text-gray-900">Scan Receipt</h1>
        <p className="mt-0.5 text-sm text-gray-500">Add items to your pantry</p>
      </div>

      <div className="px-5 pb-24">
        <UploadArea onFileSelected={handleFileSelected} isUploading={isProcessing} />

        <RecentScans />

        {/* Tips card */}
        <div className="rounded-xl border border-green-200 bg-green-50 p-4">
          <div className="flex gap-3">
            <span className="text-2xl">💡</span>
            <div>
              <div className="mb-1 text-[14px] font-semibold text-gray-900">
                Tips for best results
              </div>
              <ul className="list-disc space-y-0.5 pl-4 text-[13px] leading-relaxed text-gray-700">
                <li>Flatten the receipt on a flat surface</li>
                <li>Make sure the text is in focus</li>
                <li>Include the entire receipt in frame</li>
                <li>Avoid shadows and glare</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
