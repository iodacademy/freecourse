/**
 * POST /api/upload
 * Upload file ke Firebase Storage menggunakan Admin SDK
 * Body: multipart/form-data — field "file", "path" (storage path prefix tanpa ekstensi)
 * Returns: { url: string }
 *
 * Admin SDK bypass Security Rules — rules tidak mempengaruhi upload ini.
 * Untuk READ publik (tampil di <img>), kita generate signed URL 10 tahun / pakai download token.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, handleError } from "@/lib/api-helpers";
import { getAdminStorage } from "@/lib/firebase-admin";
import { v4 as uuidv4 } from "uuid";

export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req);

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const storagePath = (formData.get("path") as string) || "uploads/file";

    if (!file) {
      return NextResponse.json({ error: "File tidak ditemukan dalam request" }, { status: 400 });
    }

    // Validasi ukuran (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "Ukuran file maksimal 5MB" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const contentType = file.type || "image/jpeg";
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const fullPath = `${storagePath}.${ext}`;

    // Generate download token agar URL bisa diakses publik
    const downloadToken = uuidv4();

    const storage = getAdminStorage();
    const bucket = storage.bucket(); // pakai default bucket dari storageBucket config

    console.log("[upload] Uploading to bucket:", bucket.name, "path:", fullPath);

    const fileRef = bucket.file(fullPath);

    await fileRef.save(buffer, {
      metadata: {
        contentType,
        metadata: {
          // Firebase download token — memungkinkan akses publik via URL
          firebaseStorageDownloadTokens: downloadToken,
        },
      },
    });

    // Build Firebase Storage download URL dengan token
    const encodedPath = encodeURIComponent(fullPath);
    const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodedPath}?alt=media&token=${downloadToken}`;

    console.log("[upload] Success. URL:", publicUrl);

    return NextResponse.json({ url: publicUrl });
  } catch (e: any) {
    console.error("[upload] Error:", e?.message || e);
    return handleError(e);
  }
}
