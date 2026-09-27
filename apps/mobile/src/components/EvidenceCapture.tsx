import * as DocumentPicker from "expo-document-picker";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { api, messageOf, uploadDocument } from "../lib/api";
import { formatNumber } from "../lib/format";
import { radius, useTheme } from "../lib/theme";
import type { Document, DocumentPages, Evidence } from "../lib/types";
import { Button, Field, Heading, Input, Loading, Muted, Notice, Panel, ProcessingBadge, Row } from "./ui";

type Mode = "menu" | "paste" | "library" | "pick";
type Upload =
  | { kind: "idle" }
  | { kind: "uploading"; name: string }
  | { kind: "processing"; name: string }
  | { kind: "failed"; name: string; message: string };

interface Props {
  claimId: string;
  initialDocumentId?: string;
  onAttached: () => void;
}

export function EvidenceCapture({ claimId, initialDocumentId, onAttached }: Props) {
  const t = useTheme();
  const [mode, setMode] = useState<Mode>(initialDocumentId ? "pick" : "menu");
  const [picking, setPicking] = useState<Document | null>(null);
  const [upload, setUpload] = useState<Upload>({ kind: "idle" });
  const [library, setLibrary] = useState<Document[] | null>(null);
  const [libraryError, setLibraryError] = useState<string | null>(null);

  useEffect(() => {
    if (!initialDocumentId) return;
    api<Document>(`/documents/${initialDocumentId}`).then(setPicking).catch(() => setMode("menu"));
  }, [initialDocumentId]);

  const pickFile = async () => {
    const res = await DocumentPicker.getDocumentAsync({ type: ["application/pdf", "text/plain", "text/markdown", "text/csv"], copyToCacheDirectory: true, multiple: false });
    if (res.canceled || !res.assets[0]) return;
    const asset = res.assets[0];
    if (asset.size && asset.size > 50 * 1024 * 1024) {
      setUpload({ kind: "failed", name: asset.name, message: "That file is over 50 MB." });
      return;
    }
    setUpload({ kind: "uploading", name: asset.name });
    try {
      const doc = await uploadDocument<Document>({ uri: asset.uri, name: asset.name, mimeType: asset.mimeType });
      // The response carries the real processing status; never assume success.
      if (doc.processing_status === "processed") {
        setUpload({ kind: "idle" });
        setPicking(doc);
        setMode("pick");
      } else if (doc.processing_status === "failed") {
        setUpload({ kind: "failed", name: asset.name, message: "The file was received but its text could not be extracted. Try a different copy." });
      } else {
        setUpload({ kind: "processing", name: asset.name });
        await poll(doc.id, asset.name);
      }
    } catch (e) {
      setUpload({ kind: "failed", name: asset.name, message: messageOf(e) });
    }
  };

  const poll = async (id: string, name: string) => {
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      try {
        const doc = await api<Document>(`/documents/${id}`);
        if (doc.processing_status === "processed") {
          setUpload({ kind: "idle" });
          setPicking(doc);
          setMode("pick");
          return;
        }
        if (doc.processing_status === "failed") {
          setUpload({ kind: "failed", name, message: "Processing failed for this file. Try a different copy." });
          return;
        }
      } catch (e) {
        setUpload({ kind: "failed", name, message: messageOf(e) });
        return;
      }
    }
    setUpload({ kind: "failed", name, message: "Processing is taking longer than expected. Check Documents later." });
  };

  const openLibrary = async () => {
    setMode("library");
    setLibraryError(null);
    try {
      setLibrary(await api<Document[]>("/documents/?limit=100"));
    } catch (e) {
      setLibraryError(messageOf(e));
    }
  };

  if (mode === "pick" && picking) {
    return (
      <PassagePicker
        claimId={claimId}
        document={picking}
        onDone={() => {
          setPicking(null);
          setMode("menu");
          onAttached();
        }}
        onCancel={() => {
          setPicking(null);
          setMode("menu");
        }}
      />
    );
  }

  if (mode === "paste") {
    return <PasteForm claimId={claimId} onDone={() => { setMode("menu"); onAttached(); }} onCancel={() => setMode("menu")} />;
  }

  if (mode === "library") {
    return (
      <Panel style={{ gap: 12 }}>
        <Heading>From your documents</Heading>
        {libraryError ? <Notice>{libraryError}</Notice> : null}
        {library === null && !libraryError ? <Loading /> : null}
        {library && library.length === 0 ? <Muted>You have not uploaded any documents yet.</Muted> : null}
        {library?.map((d, i) => (
          <Row key={d.id} last={i === library.length - 1} onPress={d.processing_status === "processed" ? () => { setPicking(d); setMode("pick"); } : undefined}>
            <Text numberOfLines={1} style={{ color: t.ink, fontSize: 15, fontWeight: "500" }}>{d.filename}</Text>
            <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
              <Muted style={{ textTransform: "uppercase" }}>{d.document_type}</Muted>
              <ProcessingBadge status={d.processing_status} />
            </View>
          </Row>
        ))}
        <Button title="Back" variant="ghost" onPress={() => setMode("menu")} />
      </Panel>
    );
  }

  return (
    <Panel style={{ gap: 12 }}>
      <Heading>Add evidence</Heading>
      {upload.kind === "uploading" || upload.kind === "processing" ? (
        <View accessibilityLiveRegion="polite" style={{ gap: 6 }}>
          <Text numberOfLines={1} style={{ color: t.ink, fontWeight: "500" }}>{upload.name}</Text>
          <Loading label={upload.kind === "uploading" ? "Uploading… large files can take a moment" : "Processing… extracting pages and text"} />
        </View>
      ) : null}
      {upload.kind === "failed" ? (
        <Notice action={<Button title="Choose another file" variant="secondary" onPress={pickFile} />}>
          Upload failed for {upload.name}. {upload.message}
        </Notice>
      ) : null}
      {upload.kind === "idle" || upload.kind === "failed" ? (
        <View style={{ gap: 8 }}>
          <Button title="Pick a PDF or file" onPress={pickFile} />
          <Button title="Paste text" variant="secondary" onPress={() => setMode("paste")} />
          <Button title="From your documents" variant="secondary" onPress={openLibrary} />
        </View>
      ) : null}
      <Muted style={{ fontSize: 12 }}>PDF, TXT, MD or CSV, up to 50 MB. Pages are extracted so the verdict can cite them.</Muted>
    </Panel>
  );
}

function PasteForm({ claimId, onDone, onCancel }: { claimId: string; onDone: () => void; onCancel: () => void }) {
  const [label, setLabel] = useState("");
  const [content, setContent] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const c = content.trim();
    if (c.length < 20) {
      setFieldError("Paste at least a sentence or two of evidence.");
      return;
    }
    if (c.length > 50000) {
      setFieldError("Evidence passages are limited to 50,000 characters.");
      return;
    }
    setFieldError(null);
    setError(null);
    setBusy(true);
    try {
      // Stored as its own text document first so the evidence keeps a source reference.
      const doc = await api<Document>("/documents/", { method: "POST", body: { filename: (label.trim() || "Pasted text").slice(0, 255), content: c, document_type: "text" } });
      await api<Evidence>("/evidence/", { method: "POST", body: { claim_id: claimId, content: c, document_id: doc.id } });
      onDone();
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel style={{ gap: 12 }}>
      <Heading>Paste text</Heading>
      {error ? <Notice>{error}</Notice> : null}
      <Field label="Where is this from?" hint="A short label, such as the paper title or URL. Optional.">
        <Input value={label} onChangeText={setLabel} maxLength={255} placeholder="Recovery trial, 2024, section 3.2…" />
      </Field>
      <Field label="Evidence passage" error={fieldError} hint="Paste the exact text. It is stored as its own source.">
        <Input value={content} onChangeText={setContent} multiline placeholder="Median time to recovery was 4.1 days shorter in the treatment arm…" style={{ minHeight: 140 }} />
      </Field>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Button title={busy ? "Attaching…" : "Attach as evidence"} loading={busy} onPress={submit} style={{ flex: 1 }} />
        <Button title="Cancel" variant="ghost" onPress={onCancel} disabled={busy} />
      </View>
    </Panel>
  );
}

function PassagePicker({ claimId, document, onDone, onCancel }: { claimId: string; document: Document; onDone: () => void; onCancel: () => void }) {
  const t = useTheme();
  const router = useRouter();
  const [pages, setPages] = useState<DocumentPages | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [content, setContent] = useState("");
  const [section, setSection] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api<DocumentPages>(`/documents/${document.id}/pages`)
      .then((p) => {
        if (cancelled) return;
        setPages(p);
        if (p.pages[0]) setContent(p.pages[0].text.slice(0, 50000));
      })
      .catch((e) => !cancelled && setLoadError(messageOf(e)));
    return () => {
      cancelled = true;
    };
  }, [document.id]);

  const choose = (n: number) => {
    const p = pages?.pages.find((x) => x.page_number === n);
    if (!p) return;
    setPage(n);
    setContent(p.text.slice(0, 50000));
  };

  const submit = async () => {
    const c = content.trim();
    if (c.length < 20) {
      setFieldError("Keep at least a sentence or two from the document.");
      return;
    }
    setFieldError(null);
    setError(null);
    setBusy(true);
    try {
      await api<Evidence>("/evidence/", {
        method: "POST",
        body: { claim_id: claimId, content: c, document_id: document.id, page: pages && pages.total_pages > 0 ? page : null, section: section.trim() ? section.trim().slice(0, 255) : null },
      });
      onDone();
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(false);
    }
  };

  if (loadError) return <Notice action={<Button title="Back" variant="secondary" onPress={onCancel} />}>{loadError}</Notice>;
  if (!pages) return <Panel><Loading label="Loading pages…" /></Panel>;

  return (
    <Panel style={{ gap: 12 }}>
      <Heading numberOfLines={1}>{document.filename}</Heading>
      <Pressable accessibilityRole="link" onPress={() => router.push({ pathname: "/(app)/documents/[id]", params: { id: document.id, page: String(page) } })}>
        <Text style={{ color: t.inkSecondary, textDecorationLine: "underline" }}>Open full document</Text>
      </Pressable>
      {error ? <Notice>{error}</Notice> : null}
      {pages.total_pages > 1 ? (
        <View style={{ gap: 6 }}>
          <Text style={{ fontSize: 14, fontWeight: "500", color: t.ink }}>Page</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
            {pages.pages.map((p) => (
              <Pressable
                key={p.id}
                accessibilityRole="button"
                accessibilityState={{ selected: p.page_number === page }}
                onPress={() => choose(p.page_number)}
                style={{ height: 36, paddingHorizontal: 12, borderRadius: radius.pill, justifyContent: "center", backgroundColor: p.page_number === page ? t.ink : t.surfaceMuted }}
              >
                <Text style={{ color: p.page_number === page ? t.onInk : t.ink, fontVariant: ["tabular-nums"] }}>{p.page_number}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <Muted style={{ fontSize: 12 }}>{pages.total_pages} pages. The page text is loaded below; trim it to the relevant passage.</Muted>
        </View>
      ) : null}
      <Field label="Passage to use as evidence" error={fieldError} hint="Keep only the sentences that bear on the claim.">
        <Input value={content} onChangeText={setContent} multiline style={{ minHeight: 180 }} />
      </Field>
      <Field label="Section (optional)">
        <Input value={section} onChangeText={setSection} maxLength={255} placeholder="Results…" />
      </Field>
      <Muted style={{ fontSize: 12 }}>{formatNumber(content.length)} characters selected</Muted>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Button title={busy ? "Attaching…" : "Attach as evidence"} loading={busy} onPress={submit} style={{ flex: 1 }} />
        <Button title="Cancel" variant="ghost" onPress={onCancel} disabled={busy} />
      </View>
    </Panel>
  );
}
