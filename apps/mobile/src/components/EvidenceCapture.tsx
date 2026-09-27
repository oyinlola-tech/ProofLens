import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { api, messageOf } from "../lib/api";
import { formatNumber } from "../lib/format";
import { font, radius, useTheme } from "../lib/theme";
import type { Document, DocumentPages, Evidence } from "../lib/types";
import { useDocumentUpload } from "../lib/useDocumentUpload";
import { DocumentCard } from "./cards";
import { UploadStatus } from "./UploadStatus";
import { Button, Card, Field, Heading, IconTile, Input, Loading, Mono, Muted, Notice, TextLink, notify, tap, type IconName } from "./ui";

type Mode = "menu" | "paste" | "library" | "pick";

interface Props {
  claimId: string;
  initialDocumentId?: string;
  onAttached: () => void;
}

function Option({ icon, title, body, onPress, disabled }: { icon: IconName; title: string; body: string; onPress: () => void; disabled?: boolean }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 14, padding: 14, borderRadius: radius.control + 4, borderWidth: 1, borderColor: t.line, backgroundColor: pressed ? t.surfaceMuted : t.surface, opacity: disabled ? 0.5 : 1 })}
    >
      <IconTile icon={icon} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontFamily: font.semi, fontSize: 15.5, color: t.ink }}>{title}</Text>
        <Muted style={{ fontSize: 13, lineHeight: 18 }}>{body}</Muted>
      </View>
      <Ionicons name="chevron-forward" size={16} color={t.inkTertiary} />
    </Pressable>
  );
}

function SubHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
      <Heading style={{ flex: 1 }} numberOfLines={1}>{title}</Heading>
      <TextLink title="Cancel" onPress={onBack} />
    </View>
  );
}

export function EvidenceCapture({ claimId, initialDocumentId, onAttached }: Props) {
  const [mode, setMode] = useState<Mode>(initialDocumentId ? "pick" : "menu");
  const [picking, setPicking] = useState<Document | null>(null);
  const [library, setLibrary] = useState<Document[] | null>(null);
  const [libraryError, setLibraryError] = useState<string | null>(null);
  const { upload, busy, pickFile } = useDocumentUpload((doc) => {
    setPicking(doc);
    setMode("pick");
  });

  useEffect(() => {
    if (!initialDocumentId) return;
    let cancelled = false;
    api<Document>(`/documents/${initialDocumentId}`)
      .then((d) => !cancelled && setPicking(d))
      .catch(() => !cancelled && setMode("menu"));
    return () => {
      cancelled = true;
    };
  }, [initialDocumentId]);

  const toMenu = () => {
    setPicking(null);
    setMode("menu");
  };
  const attached = () => {
    notify("success");
    toMenu();
    onAttached();
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

  if (mode === "pick") {
    if (!picking) return <Card><Loading label="Opening the document…" /></Card>;
    return <PassagePicker claimId={claimId} document={picking} onDone={attached} onCancel={toMenu} />;
  }

  if (mode === "paste") return <PasteForm claimId={claimId} onDone={attached} onCancel={toMenu} />;

  if (mode === "library") {
    const usable = library?.filter((d) => d.processing_status === "processed") ?? [];
    return (
      <Card style={{ gap: 14 }}>
        <SubHeader title="Choose from your library" onBack={toMenu} />
        {libraryError ? <Notice action={<Button title="Try again" icon="refresh" variant="secondary" onPress={openLibrary} />}>{libraryError}</Notice> : null}
        {library === null && !libraryError ? <Loading /> : null}
        {library && usable.length === 0 ? <Muted>No processed documents yet. Upload a file or paste text instead.</Muted> : null}
        <View style={{ gap: 10 }}>
          {usable.map((d) => (
            <DocumentCard
              key={d.id}
              d={d}
              onPress={() => {
                setPicking(d);
                setMode("pick");
              }}
            />
          ))}
        </View>
      </Card>
    );
  }

  return (
    <View style={{ gap: 10 }}>
      <UploadStatus upload={upload} onRetry={pickFile} />
      <Option icon="cloud-upload-outline" title="Upload a file" body="PDF, TXT, MD or CSV, up to 50 MB" onPress={pickFile} disabled={busy} />
      <Option icon="clipboard-outline" title="Paste a passage" body="Copy the exact text from your source" onPress={() => setMode("paste")} disabled={busy} />
      <Option icon="folder-open-outline" title="Choose from your library" body="Reuse a document you already added" onPress={openLibrary} disabled={busy} />
    </View>
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
    <Card style={{ gap: 16 }}>
      <SubHeader title="Paste a passage" onBack={onCancel} />
      {error ? <Notice>{error}</Notice> : null}
      <Field label="Evidence passage" error={fieldError} hint="Paste the exact text. It is stored as its own source.">
        <Input invalid={Boolean(fieldError)} value={content} onChangeText={setContent} multiline autoFocus placeholder="Median time to recovery was 4.1 days shorter in the treatment arm…" style={{ minHeight: 150 }} />
      </Field>
      <Field label="Where is this from?" hint="A short label, such as the paper title or URL. Optional.">
        <Input icon="pricetag-outline" value={label} onChangeText={setLabel} maxLength={255} placeholder="Recovery trial, 2024, section 3.2…" />
      </Field>
      <Button title={busy ? "Attaching…" : "Attach as evidence"} icon="attach" loading={busy} onPress={submit} />
    </Card>
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
        if (p.pages[0]) {
          setPage(p.pages[0].page_number);
          setContent(p.pages[0].text.slice(0, 50000));
        }
      })
      .catch((e) => !cancelled && setLoadError(messageOf(e)));
    return () => {
      cancelled = true;
    };
  }, [document.id]);

  const choose = (n: number) => {
    const p = pages?.pages.find((x) => x.page_number === n);
    if (!p) return;
    tap();
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
  if (!pages) return <Card><Loading label="Loading pages…" /></Card>;

  return (
    <Card style={{ gap: 16 }}>
      <SubHeader title="Pick the passage" onBack={onCancel} />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: t.surfaceMuted, borderRadius: radius.control + 2, padding: 12 }}>
        <Ionicons name="document-text" size={20} color={t.accent} />
        <Text numberOfLines={1} style={{ flex: 1, fontFamily: font.medium, fontSize: 14.5, color: t.ink }}>{document.filename}</Text>
        <TextLink title="Open" icon="open-outline" onPress={() => router.push({ pathname: "/(app)/documents/[id]", params: { id: document.id, page: String(page) } })} />
      </View>
      {error ? <Notice>{error}</Notice> : null}
      {pages.total_pages > 1 ? (
        <View style={{ gap: 8 }}>
          <Text style={{ fontFamily: font.medium, fontSize: 14, color: t.ink }}>Page <Text style={{ color: t.inkTertiary }}>· {pages.total_pages} in total</Text></Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {pages.pages.map((p) => {
              const on = p.page_number === page;
              return (
                <Pressable key={p.id} accessibilityRole="button" accessibilityLabel={`Page ${p.page_number}`} accessibilityState={{ selected: on }} onPress={() => choose(p.page_number)} style={{ minWidth: 46, height: 44, paddingHorizontal: 14, borderRadius: radius.control, alignItems: "center", justifyContent: "center", backgroundColor: on ? t.ink : t.surfaceMuted }}>
                  <Text style={{ fontFamily: font.monoMedium, fontSize: 14, color: on ? t.onInk : t.ink }}>{p.page_number}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}
      <Field label="Passage to use as evidence" error={fieldError} hint="The page text is loaded for you. Trim it to the sentences that bear on the claim.">
        <Input invalid={Boolean(fieldError)} value={content} onChangeText={setContent} multiline style={{ minHeight: 190, fontSize: 15, lineHeight: 22 }} />
      </Field>
      <Mono>{formatNumber(content.length)} characters selected</Mono>
      <Field label="Section" hint="Optional. For example: Results.">
        <Input icon="bookmark-outline" value={section} onChangeText={setSection} maxLength={255} placeholder="Results…" />
      </Field>
      <Button title={busy ? "Attaching…" : "Attach as evidence"} icon="attach" loading={busy} onPress={submit} />
    </Card>
  );
}
