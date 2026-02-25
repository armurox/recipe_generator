import imageCompression from "browser-image-compression";
import { createClient } from "@/lib/supabase";

const COMPRESSION_OPTIONS = {
  maxSizeMB: 1,
  maxWidthOrHeight: 1920,
  useWebWorker: true,
};

export async function uploadReceiptImage(file: File, userId: string): Promise<string> {
  const compressed = await imageCompression(file, COMPRESSION_OPTIONS);

  const supabase = createClient();
  const path = `${userId}/${Date.now()}.jpg`;

  const { error } = await supabase.storage.from("receipts").upload(path, compressed, {
    contentType: "image/jpeg",
    upsert: false,
  });

  if (error) {
    throw new Error(`Upload failed: ${error.message}`);
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("receipts").getPublicUrl(path);

  return publicUrl;
}
