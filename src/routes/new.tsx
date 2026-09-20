import { useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Camera, ImagePlus, LoaderCircle, PenLine } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { PieceEditor, emptyDraft, type Draft } from "@/components/piece-editor";
import { Button } from "@/components/ui/button";
import { recognizeScore } from "@/lib/ai/server";
import { parseNotation } from "@/lib/music/notation";
import { usePiecesStore } from "@/lib/store/pieces";
import { cn, compressImage } from "@/lib/utils";

export const Route = createFileRoute("/new")({ component: NewPiece });

type Method = "camera" | "upload" | "editor";

function NewPiece() {
  const navigate = useNavigate();
  const addPiece = usePiecesStore((s) => s.addPiece);
  const [method, setMethod] = useState<Method>("editor");
  const [draft, setDraft] = useState<Draft>(() => emptyDraft());
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [camError, setCamError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => stopCam();
  }, []);

  function stopCam() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  async function startCam() {
    setCamError(null);
    try {
      stopCam();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch {
      setCamError("无法打开摄像头，请改用上传或检查浏览器权限。");
    }
  }

  async function ingestImage(blob: Blob, source: "camera" | "upload") {
    setBusy(true);
    try {
      const imageDataUrl = await compressImage(blob, { maxW: 1280, quality: 0.7 });
      const imageThumb = await compressImage(blob, { maxW: 560, quality: 0.58 });
      setPreview(imageThumb);
      const result = await recognizeScore({ data: { imageDataUrl } });
      if (!result.ok) {
        toast.error(result.error);
        setDraft(
          emptyDraft({
            source,
            imageThumb,
            title: source === "camera" ? "拍照曲谱" : "上传曲谱",
          }),
        );
        return;
      }
      const notes = parseNotation(result.notation);
      if (!notes.length) toast.message("已读到图片，请核对手写记谱。");
      setDraft(
        emptyDraft({
          source,
          imageThumb,
          title: result.title,
          composer: result.composer,
          key: result.key,
          timeSignature: result.timeSignature,
          tempo: result.tempo,
          notation: result.notation,
          notes,
        }),
      );
      toast.success("已识别，请核对五线谱后保存。");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "处理图片失败");
    } finally {
      setBusy(false);
    }
  }

  async function capture() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob((b) => res(b), "image/jpeg", 0.85));
    if (!blob) return;
    stopCam();
    await ingestImage(blob, "camera");
  }

  function save() {
    if (!draft.title.trim() || !draft.notes.some((n) => n.type === "note")) {
      toast.error("请填写曲名并录入至少一个音符");
      return;
    }
    const piece = addPiece(draft);
    toast.success("已收入曲库");
    void navigate({ to: "/p/$id", params: { id: piece.id } });
  }

  return (
    <AppShell
      compact
      right={
        <span className="text-sm text-muted">
          {method === "camera" ? "拍照" : method === "upload" ? "上传" : "在线输入"}
        </span>
      }
    >
      <h1 className="font-serif text-3xl font-medium tracking-tight">录入曲谱</h1>
      <p className="mt-1 mb-6 text-sm text-muted">三种方式，识别后都可以改。谱面只存在这台设备上。</p>

      <div className="mb-6 flex flex-wrap gap-2">
        {(
          [
            { id: "camera", label: "拍照", icon: Camera },
            { id: "upload", label: "上传图片", icon: ImagePlus },
            { id: "editor", label: "在线输入", icon: PenLine },
          ] as const
        ).map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => {
              setMethod(m.id);
              if (m.id === "camera") void startCam();
              else stopCam();
            }}
            className={cn(
              "inline-flex h-11 items-center gap-2 rounded-md px-4 text-sm font-medium",
              method === m.id ? "bg-accent text-accent-fg" : "bg-elevated text-muted",
            )}
          >
            <m.icon className="size-4" />
            {m.label}
          </button>
        ))}
      </div>

      {method === "camera" && !preview && (
        <div className="mb-6 space-y-3">
          <div className="overflow-hidden rounded-xl bg-elevated">
            <video ref={videoRef} className="aspect-video w-full bg-bg object-cover" playsInline muted />
          </div>
          {camError && <p className="text-sm text-danger">{camError}</p>}
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void startCam()} variant="secondary">
              打开摄像头
            </Button>
            <Button onClick={() => void capture()} disabled={busy}>
              {busy ? <LoaderCircle className="size-4 animate-spin" /> : <Camera className="size-4" />}
              拍摄并识别
            </Button>
          </div>
        </div>
      )}

      {method === "upload" && !preview && (
        <div className="mb-6">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files[0];
              if (f) void ingestImage(f, "upload");
            }}
            className="flex w-full flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-surface px-6 py-12 text-sm text-muted"
          >
            <ImagePlus className="size-7" />
            拖入五线谱图片，或点击选择
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void ingestImage(f, "upload");
            }}
          />
        </div>
      )}

      {busy && (
        <p className="mb-4 flex items-center gap-2 text-sm text-muted">
          <LoaderCircle className="size-4 animate-spin" />
          正在识谱…
        </p>
      )}

      {(method === "editor" || preview || draft.notes.length > 0) && (
        <PieceEditor draft={draft} onChange={setDraft} onSave={save} saveLabel="收入曲库" />
      )}
    </AppShell>
  );
}
