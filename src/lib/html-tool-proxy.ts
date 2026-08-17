/**
 * 注入到用户 HTML 工具页面里的跨域代理补丁。
 * 原理：跨域请求改走本站同源接口 /api/html-tools/proxy，由服务端转发，
 * 从而绕开目标服务器未配置 CORS 响应头导致的浏览器拦截。
 * 注意：片段内不能使用模板字符串/反引号，避免与本文件的字符串字面量冲突。
 */

import { readFile } from "node:fs/promises";

/** 注入标记：工具页面已包含该标记时跳过注入，防止重复包装。 */
export const HTML_TOOL_PROXY_MARKER = "__kitLabProxy";

const SNIPPET_BODY = String.raw`
(function () {
  if (window.__kitLabProxy) return;
  window.__kitLabProxy = true;

  var PROXY_URL = "/api/html-tools/proxy";
  var encoder = new TextEncoder();
  var originalFetch = window.fetch ? window.fetch.bind(window) : null;

  function toBase64(bytes) {
    var binary = "";
    for (var i = 0; i < bytes.length; i += 0x8000) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    return btoa(binary);
  }

  function fromBase64(b64) {
    var binary = atob(b64 || "");
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  function isCrossOrigin(url) {
    try {
      return new URL(url, location.href).origin !== location.origin;
    } catch (e) {
      return false;
    }
  }

  function headersToObject(headers) {
    var out = {};
    try {
      new Headers(headers || {}).forEach(function (value, name) {
        out[name] = value;
      });
    } catch (e) {}
    return out;
  }

  function bodyToBase64(body) {
    if (body === null || body === undefined) return Promise.resolve(null);
    if (typeof body === "string") return Promise.resolve(toBase64(encoder.encode(body)));
    if (body instanceof Blob) {
      return body.arrayBuffer().then(function (ab) {
        return toBase64(new Uint8Array(ab));
      });
    }
    if (body instanceof ArrayBuffer) return Promise.resolve(toBase64(new Uint8Array(body)));
    if (ArrayBuffer.isView(body)) {
      return Promise.resolve(toBase64(new Uint8Array(body.buffer, body.byteOffset, body.byteLength)));
    }
    if (typeof URLSearchParams !== "undefined" && body instanceof URLSearchParams) {
      return Promise.resolve(toBase64(encoder.encode(String(body))));
    }
    return Promise.reject(new Error("Kit Lab proxy: unsupported request body type"));
  }

  function buildResponse(data) {
    var bytes = fromBase64(data.bodyBase64);
    var init = { status: data.status, statusText: data.statusText || "", headers: data.headers || {} };
    try {
      return new Response(bytes.length ? bytes : null, init);
    } catch (e) {
      // statusText 含非法字符等情况，退化为最小构造参数
      return new Response(bytes.length ? bytes : null, { status: data.status });
    }
  }

  function proxyRequest(url, method, headers, body) {
    return bodyToBase64(body)
      .then(function (bodyBase64) {
        return originalFetch(PROXY_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: url, method: method, headers: headersToObject(headers), body: bodyBase64 })
        });
      })
      .then(function (resp) {
        if (!resp.ok) throw new Error("Kit Lab proxy HTTP " + resp.status);
        return resp.json();
      })
      .then(function (data) {
        if (data && data.error) throw new Error(data.error);
        return buildResponse(data);
      });
  }

  if (originalFetch) {
    window.fetch = function (input, init) {
      try {
        var rawUrl = typeof input === "string" ? input : (input && input.url) || "";
        if (!isCrossOrigin(rawUrl)) return originalFetch(input, init);
        var method = (init && init.method) || (typeof input !== "string" && input && input.method) || "GET";
        var headers = (init && init.headers) || (typeof input !== "string" && input && input.headers) || {};
        var bodySource;
        if (init && init.body !== undefined && init.body !== null) {
          bodySource = Promise.resolve(init.body);
        } else if (
          typeof input !== "string" &&
          input &&
          typeof input.arrayBuffer === "function" &&
          method !== "GET" &&
          method !== "HEAD"
        ) {
          bodySource = input.arrayBuffer();
        } else {
          bodySource = Promise.resolve(null);
        }
        var absolute = new URL(rawUrl, location.href).href;
        return bodySource
          .then(function (body) {
            return proxyRequest(absolute, method, headers, body);
          })
          .catch(function () {
            // 代理失败时回退原始请求，行为不劣于注入前
            return originalFetch(input, init);
          });
      } catch (e) {
        return originalFetch(input, init);
      }
    };
  }

  var OriginalXHR = window.XMLHttpRequest;
  if (OriginalXHR && originalFetch) {
    var XHR_EVENTS = [
      "readystatechange",
      "loadstart",
      "progress",
      "load",
      "loadend",
      "error",
      "abort",
      "timeout"
    ];

    function ShimXHR() {
      this._listeners = {};
      this._headers = {};
      this._method = "GET";
      this._url = "";
      this._real = null;
      this._state = 0;
      this._status = 0;
      this._statusText = "";
      this._responseHeaders = {};
      this._responseBytes = null;
      this._responseTextValue = "";
      this.responseType = "";
      this.timeout = 0;
      this.withCredentials = false;
      this.upload = {
        addEventListener: function () {},
        removeEventListener: function () {},
        dispatchEvent: function () {
          return false;
        }
      };
      for (var i = 0; i < XHR_EVENTS.length; i++) {
        this["on" + XHR_EVENTS[i]] = null;
      }
    }

    ShimXHR.UNSENT = 0;
    ShimXHR.OPENED = 1;
    ShimXHR.HEADERS_RECEIVED = 2;
    ShimXHR.LOADING = 3;
    ShimXHR.DONE = 4;
    ShimXHR.prototype.UNSENT = 0;
    ShimXHR.prototype.OPENED = 1;
    ShimXHR.prototype.HEADERS_RECEIVED = 2;
    ShimXHR.prototype.LOADING = 3;
    ShimXHR.prototype.DONE = 4;

    ShimXHR.prototype._dispatch = function (type, original) {
      var event = original || { type: type };
      var handler = this["on" + type];
      if (typeof handler === "function") {
        try {
          handler.call(this, event);
        } catch (e) {
          setTimeout(function () {
            throw e;
          });
        }
      }
      var list = this._listeners[type] || [];
      for (var i = 0; i < list.length; i++) {
        try {
          list[i].call(this, event);
        } catch (e) {}
      }
    };

    ShimXHR.prototype._setState = function (state) {
      this._state = state;
      this._dispatch("readystatechange");
    };

    ShimXHR.prototype.open = function (method, url, async) {
      this._method = method || "GET";
      this._url = url;
      var useReal = !originalFetch || !isCrossOrigin(url) || async === false;
      if (useReal) {
        var real = new OriginalXHR();
        this._real = real;
        var self = this;
        XHR_EVENTS.forEach(function (type) {
          real.addEventListener(type, function (event) {
            self._dispatch(type, event);
          });
        });
        real.open(method, url, async !== false);
        return;
      }
      this._setState(1);
    };

    ShimXHR.prototype.setRequestHeader = function (name, value) {
      if (this._real) {
        this._real.setRequestHeader(name, value);
      } else {
        this._headers[name] = value;
      }
    };

    ShimXHR.prototype.send = function (body) {
      var real = this._real;
      if (real) {
        try {
          real.responseType = this.responseType;
          real.timeout = this.timeout;
          real.withCredentials = this.withCredentials;
        } catch (e) {}
        real.send(body === undefined ? null : body);
        return;
      }
      if (
        body !== null &&
        body !== undefined &&
        typeof FormData !== "undefined" &&
        body instanceof FormData
      ) {
        // FormData 需要分段编码，超出代理能力，回退原生行为（与未注入一致）
        this._dispatch("error");
        this._setState(4);
        this._dispatch("loadend");
        return;
      }
      var self = this;
      var absolute = new URL(this._url, location.href).href;
      this._dispatch("loadstart");
      proxyRequest(absolute, this._method, this._headers, body === undefined ? null : body)
        .then(function (resp) {
          self._status = resp.status;
          self._statusText = resp.statusText;
          resp.headers.forEach(function (value, name) {
            self._responseHeaders[name.toLowerCase()] = value;
          });
          self._setState(2);
          return resp.arrayBuffer();
        })
        .then(function (ab) {
          self._responseBytes = new Uint8Array(ab);
          self._responseTextValue = new TextDecoder().decode(self._responseBytes);
          self._setState(3);
          self._setState(4);
          self._dispatch("load");
          self._dispatch("loadend");
        })
        .catch(function () {
          self._setState(4);
          self._dispatch("error");
          self._dispatch("loadend");
        });
    };

    ShimXHR.prototype.abort = function () {
      if (this._real) {
        this._real.abort();
        return;
      }
      this._dispatch("abort");
      this._setState(4);
      this._dispatch("loadend");
    };

    ShimXHR.prototype.getResponseHeader = function (name) {
      if (this._real) return this._real.getResponseHeader(name);
      var value = this._responseHeaders[String(name).toLowerCase()];
      return value === undefined ? null : value;
    };

    ShimXHR.prototype.getAllResponseHeaders = function () {
      if (this._real) return this._real.getAllResponseHeaders();
      var lines = [];
      for (var name in this._responseHeaders) {
        if (Object.prototype.hasOwnProperty.call(this._responseHeaders, name)) {
          lines.push(name + ": " + this._responseHeaders[name]);
        }
      }
      return lines.length ? lines.join("\r\n") + "\r\n" : "";
    };

    ShimXHR.prototype.addEventListener = function (type, listener) {
      if (typeof listener !== "function") return;
      (this._listeners[type] = this._listeners[type] || []).push(listener);
    };

    ShimXHR.prototype.removeEventListener = function (type, listener) {
      var list = this._listeners[type];
      if (!list) return;
      var index = list.indexOf(listener);
      if (index >= 0) list.splice(index, 1);
    };

    ShimXHR.prototype.dispatchEvent = function () {
      return false;
    };

    ShimXHR.prototype.overrideMimeType = function () {};

    Object.defineProperty(ShimXHR.prototype, "readyState", {
      get: function () {
        return this._real ? this._real.readyState : this._state;
      }
    });
    Object.defineProperty(ShimXHR.prototype, "status", {
      get: function () {
        return this._real ? this._real.status : this._status;
      }
    });
    Object.defineProperty(ShimXHR.prototype, "statusText", {
      get: function () {
        return this._real ? this._real.statusText : this._statusText;
      }
    });
    Object.defineProperty(ShimXHR.prototype, "responseText", {
      get: function () {
        return this._real ? this._real.responseText : this._responseTextValue;
      }
    });
    Object.defineProperty(ShimXHR.prototype, "responseURL", {
      get: function () {
        if (this._real) return this._real.responseURL;
        try {
          return new URL(this._url, location.href).href;
        } catch (e) {
          return "";
        }
      }
    });
    Object.defineProperty(ShimXHR.prototype, "responseXML", {
      get: function () {
        return this._real ? this._real.responseXML : null;
      }
    });
    Object.defineProperty(ShimXHR.prototype, "response", {
      get: function () {
        if (this._real) return this._real.response;
        if (this._responseBytes === null) return this.responseType === "json" ? null : "";
        switch (this.responseType) {
          case "arraybuffer":
            return this._responseBytes.buffer;
          case "blob":
            return new Blob([this._responseBytes]);
          case "json":
            try {
              return JSON.parse(this._responseTextValue);
            } catch (e) {
              return null;
            }
          case "document":
            return null;
          default:
            return this._responseTextValue;
        }
      }
    });

    for (var key in OriginalXHR) {
      if (Object.prototype.hasOwnProperty.call(OriginalXHR, key)) {
        try {
          ShimXHR[key] = OriginalXHR[key];
        } catch (e) {}
      }
    }
    window.XMLHttpRequest = ShimXHR;
  }
})();
`;

export const HTML_TOOL_PROXY_SNIPPET = `<script data-kit-lab-proxy="">${SNIPPET_BODY}</script>`;

/** 把代理补丁插到 <head> 之后（兜底依次为 <html>、doctype、文件开头）。 */
export function injectProxySnippet(html: string): string {
  if (html.includes(HTML_TOOL_PROXY_MARKER)) return html;
  const anchors = [/<head[^>]*>/i, /<html[^>]*>/i, /<!doctype[^>]*>/i];
  for (const anchor of anchors) {
    const match = anchor.exec(html);
    if (match) {
      const at = match.index + match[0].length;
      return html.slice(0, at) + HTML_TOOL_PROXY_SNIPPET + html.slice(at);
    }
  }
  return HTML_TOOL_PROXY_SNIPPET + html;
}

/* ================= 注入结果缓存 ================= */

interface InjectedCacheEntry {
  size: number;
  mtimeMs: number;
  html: string;
  bytes: number;
}

/**
 * 注入结果内存缓存：键为文件路径，命中条件是「大小 + mtime」完全一致。
 * 工具内容通过原子 rename 替换，路径不变时 mtime 必然变化，不会读到旧内容。
 * 单进程部署适用（与 rate-limit 同假设）；多实例各自缓存，行为一致只是多算几次。
 */
const injectedCache = new Map<string, InjectedCacheEntry>();
let injectedCacheBytes = 0;
const INJECTED_CACHE_MAX_ENTRIES = 32;
const INJECTED_CACHE_MAX_BYTES = 64 * 1024 * 1024;

/**
 * 读取 HTML 文件并注入代理补丁，带缓存。
 * @param size 调用方 stat 得到的文件大小（与 mtimeMs 一起作为缓存有效性校验）
 */
export async function getInjectedHtml(
  filePath: string,
  size: number,
  mtimeMs: number,
): Promise<string> {
  const cached = injectedCache.get(filePath);
  if (cached && cached.size === size && cached.mtimeMs === mtimeMs) {
    return cached.html;
  }

  const html = injectProxySnippet((await readFile(filePath)).toString("utf8"));
  const bytes = Buffer.byteLength(html);

  // 单文件超过缓存额度一半就不缓存，避免一个大文件挤掉全部条目
  if (bytes <= INJECTED_CACHE_MAX_BYTES / 2) {
    if (cached) injectedCacheBytes -= cached.bytes;
    injectedCache.set(filePath, { size, mtimeMs, html, bytes });
    injectedCacheBytes += bytes;
    // 按插入顺序逐出最旧条目，直到回到条目数与总字节双重上限内
    while (
      injectedCache.size > INJECTED_CACHE_MAX_ENTRIES ||
      injectedCacheBytes > INJECTED_CACHE_MAX_BYTES
    ) {
      const oldest = injectedCache.keys().next().value;
      if (oldest === undefined || oldest === filePath) break;
      const evicted = injectedCache.get(oldest);
      if (evicted) injectedCacheBytes -= evicted.bytes;
      injectedCache.delete(oldest);
    }
  }
  return html;
}
