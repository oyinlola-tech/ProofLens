import * as DocumentPicker from "expo-document-picker";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, messageOf, uploadDocument } from "./api";
import type { Document } from "./types";

export type UploadState =
  | { kind: "idle" }
  | { kind: "uploading"; name: string }
  | { kind: "processing"; name: string }
  | { kind: "failed"; name: string; message: string };

const MAX_BYTES = 50 * 1024 * 1024;
const POLL_MS = 2000;
const POLL_TRIES = 30;

/** Picks a file, uploads it, and waits for the backend to finish extracting its pages. */
export function useDocumentUpload(onReady: (doc: Document) => void) {
  const [upload, setUpload] = useState<UploadState>({ kind: "idle" });
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const set = (s: UploadState) => {
    if (alive.current) setUpload(s);
  };

  const pickFile = useCallback(async () => {
    const res = await DocumentPicker.getDocumentAsync({ type: ["application/pdf", "text/plain", "text/markdown", "text/csv"], copyToCacheDirectory: true, multiple: false });
    if (res.canceled || !res.assets[0]) return;
    const asset = res.assets[0];
    const name = asset.name;
    if (asset.size && asset.size > MAX_BYTES) {
      set({ kind: "failed", name, message: "That file is over 50 MB." });
      return;
    }
    set({ kind: "uploading", name });
    try {
      let doc = await uploadDocument<Document>({ uri: asset.uri, name, mimeType: asset.mimeType });
      // The response carries the real processing status; never assume success.
      for (let i = 0; doc.processing_status !== "processed" && doc.processing_status !== "failed"; i++) {
        if (i >= POLL_TRIES) {
          set({ kind: "failed", name, message: "Processing is taking longer than expected. Check your library later." });
          return;
        }
        set({ kind: "processing", name });
        await new Promise((r) => setTimeout(r, POLL_MS));
        if (!alive.current) return;
        doc = await api<Document>(`/documents/${doc.id}`);
      }
      if (doc.processing_status === "failed") {
        set({ kind: "failed", name, message: "The file was received but its text could not be extracted. Try a different copy." });
        return;
      }
      set({ kind: "idle" });
      if (alive.current) onReadyRef.current(doc);
    } catch (e) {
      set({ kind: "failed", name, message: messageOf(e) });
    }
  }, []);

  const busy = upload.kind === "uploading" || upload.kind === "processing";
  return { upload, busy, pickFile, reset: () => set({ kind: "idle" }) };
}
