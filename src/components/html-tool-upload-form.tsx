"use client";

import Link from "next/link";
import { formatBytes } from "@/lib/format";
import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent } from "react";

const inputClass =
  "w-full rounded-xl border-2 border-sakura-100 bg-white px-4 py-2.5 text-sm shadow-sm transition-colors placeholder:text-ink/25 focus:border-sakura-400 focus:outline-none focus:ring-4 focus:ring-sakura-100";
const labelClass = "mb-1.5 block text-sm font-bold text-ink/70";

export function HtmlToolUploadForm({
  remainingBytes,
  quotaBytes,
  categories,
  replaceToolId,
  maxBytes,
}: {
  remainingBytes: number;
  quotaBytes: number;
  categories: string[];
  /** 传入现有 HTML 工具 id 时进入替换模式：沿用展示信息与访问地址，仅更新内容 */
  replaceToolId?: string;
  /** 替换模式下的包体上限（默认 = remainingBytes）；通常为剩余额度 + 当前文件占用 */
  maxBytes?: number;
}) {
  const router = useRouter();
  const statusId = useId();
  const [file, setFile] = useState<File | null>(null);
  const [pending, setPending] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");

  const replaceMode = Boolean(replaceToolId);
  const uploadLimit = replaceMode ? (maxBytes ?? remainingBytes) : remainingBytes;

  function upload(fileToUpload: File, metadata: Record<string, unknown>): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = new XMLHttpRequest();
      request.open("POST", "/api/html-tools/upload");
      request.responseType = "json";
      request.setRequestHeader("Content-Type", "application/octet-stream");
      request.setRequestHeader("X-HTML-Tool-File-Name", encodeURIComponent(fileToUpload.name));
      if (replaceToolId) {
        request.setRequestHeader("X-HTML-Tool-Id", replaceToolId);
      } else {
        request.setRequestHeader("X-HTML-Tool-Metadata", encodeURIComponent(JSON.stringify(metadata)));
      }
      request.upload.onprogress = (event) => {
        if (event.lengthComputable) setProgress(Math.round((event.loaded / event.total) * 100));
      };
      request.onerror = () => reject(new Error("网络连接中断，请重新上传"));
      request.onload = () => {
        if (request.status >= 200 && request.status < 300) {
          resolve();
          return;
        }
        const message = request.response?.error;
        reject(new Error(typeof message === "string" ? message : "上传失败，请稍后重试"));
      };
      request.send(fileToUpload);
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!file) {
      setError("请选择一个 HTML 或 ZIP 文件");
      return;
    }
    if (file.size > uploadLimit) {
      setError(
        replaceMode
          ? `文件超过替换上限（${formatBytes(uploadLimit)}，即剩余额度 + 当前文件占用）`
          : `文件超过剩余额度（还可使用 ${formatBytes(remainingBytes)}）`,
      );
      return;
    }

    let metadata: Record<string, unknown> = {};
    if (!replaceMode) {
      const formData = new FormData(event.currentTarget);
      metadata = {
        name: String(formData.get("name") || ""),
        description: String(formData.get("description") || ""),
        category: String(formData.get("category") || ""),
        tags: String(formData.get("tags") || ""),
        icon: String(formData.get("icon") || ""),
        order: Number(formData.get("order") || 0),
      };
    }

    setPending(true);
    setProgress(0);
    try {
      await upload(file, metadata);
      setProgress(100);
      router.push("/my");
      router.refresh();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "上传失败，请稍后重试");
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="max-w-xl animate-fade-up space-y-5 rounded-3xl border-2 border-sakura-100 bg-white p-6 shadow-soft sm:p-8"
      aria-describedby={statusId}
    >
      <div className="rounded-2xl border-2 border-skyblue-100 bg-skyblue-50/60 px-4 py-3 text-sm text-ink/60">
        {replaceMode ? (
          <>
            <p className="font-bold text-skyblue-600">替换 HTML 工具内容</p>
            <p className="mt-1 text-xs leading-relaxed">
              替换后访问地址保持不变、立即生效；名称、描述等展示信息沿用当前设置。旧文件占用的额度自动归还，新文件按解压后大小计费。
            </p>
            <p className="mt-2 text-xs font-bold">
              本次替换上限：{formatBytes(uploadLimit)}（剩余额度 + 当前文件占用）
            </p>
          </>
        ) : (
          <>
            <p className="font-bold text-skyblue-600">可上传单个 HTML，或完整工具 ZIP</p>
            <p className="mt-1 text-xs leading-relaxed">
              ZIP 请包含根目录 index.html；也支持仅有一个 HTML 文件或单个子目录入口。CSS、JS、图片等相对路径资源会原样保留。
            </p>
            <p className="mt-2 text-xs font-bold">
              剩余额度：{formatBytes(remainingBytes)} / {formatBytes(quotaBytes)}
            </p>
          </>
        )}
      </div>

      {error && (
        <p id={statusId} role="alert" className="rounded-xl bg-red-50 px-4 py-2.5 text-sm font-bold text-red-600">
          {error}
        </p>
      )}

      <div>
        <label htmlFor="html-package" className={labelClass}>
          工具文件 <span className="text-red-500">*</span>
        </label>
        <input
          id="html-package"
          type="file"
          accept=".html,.htm,.zip,text/html,application/zip"
          required
          disabled={pending || uploadLimit <= 0}
          onChange={(event) => {
            const selected = event.target.files?.[0] || null;
            setFile(selected);
            setError("");
          }}
          className={`${inputClass} file:mr-3 file:rounded-lg file:border-0 file:bg-sakura-100 file:px-3 file:py-1.5 file:text-sm file:font-bold file:text-sakura-600`}
        />
        {file && (
          <p className="mt-1.5 text-xs text-ink/45">
            已选择：{file.name}（{formatBytes(file.size)}）
          </p>
        )}
      </div>

      {!replaceMode && (
        <>
          <div>
            <label htmlFor="name" className={labelClass}>
              名称 <span className="text-red-500">*</span>
            </label>
            <input id="name" name="name" required maxLength={50} className={inputClass} placeholder="例如：图片尺寸转换器" />
          </div>

          <div>
            <label htmlFor="description" className={labelClass}>
              描述 <span className="text-red-500">*</span>
            </label>
            <textarea id="description" name="description" required maxLength={200} rows={2} className={inputClass} placeholder="一句话说明这个工具能做什么" />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="category" className={labelClass}>
                分类 <span className="text-red-500">*</span>
              </label>
              <select id="category" name="category" required defaultValue="" className={inputClass}>
                <option value="" disabled>请选择分类</option>
                {categories.map((category) => <option key={category}>{category}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="icon" className={labelClass}>图标（emoji，可选）</label>
              <input id="icon" name="icon" maxLength={8} className={inputClass} placeholder="🧰" />
            </div>
          </div>

          <div>
            <label htmlFor="tags" className={labelClass}>标签</label>
            <input id="tags" name="tags" maxLength={100} className={inputClass} placeholder="逗号分隔，如：图片,转换,离线" />
          </div>

          <input type="hidden" name="order" value="0" />
        </>
      )}

      {pending && (
        <div id={statusId} role="status" aria-live="polite">
          <div className="flex justify-between text-xs font-bold text-ink/55">
            <span>{progress < 100 ? "正在上传…" : "正在校验并保存…"}</span>
            <span>{progress}%</span>
          </div>
          <progress className="mt-2 h-2.5 w-full accent-sakura-400" max={100} value={progress}>
            {progress}%
          </progress>
        </div>
      )}

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={pending || uploadLimit <= 0}
          className="rounded-xl bg-gradient-to-r from-sakura-400 to-sakura-500 px-5 py-2.5 text-sm font-bold text-white shadow-soft transition-all hover:shadow-pop active:scale-95 disabled:opacity-50"
        >
          {pending ? "替换中…" : replaceMode ? "替换并保存" : "上传并添加"}
        </button>
        <Link href="/my" className="text-sm font-bold text-ink/40 transition-colors hover:text-sakura-500">取消</Link>
      </div>
    </form>
  );
}

