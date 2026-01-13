import { NextRequest, NextResponse } from "next/server";

export interface DownloadRequest {
  channels: {
    id: string;
    tvgName: string;
    tvgNameAttribute?: string;
    tvgLogo?: string;
    tvgId?: string;
    tvgCountry?: string;
    tvgLanguage?: string;
    groupTitle?: string;
    url: string;
  }[];
  filename?: string;
}

function sanitizeFilename(filename: string): string {
  const cleaned = filename
    .replace(/[\u0000-\u001F<>:"/\\|?*]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[. ]+$/g, "")
    .slice(0, 160);

  return cleaned || "download";
}

function isBlockedHostname(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (host === "localhost" || host === "127.0.0.1" || host === "::1")
    return true;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
    const parts = host.split(".").map((p) => Number(p));
    if (parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) return true;
    if (parts[0] === 10) return true;
    if (parts[0] === 127) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 169 && parts[1] === 254) return true;
    if (parts[0] === 0) return true;
  }
  return false;
}

function createContentDispositionHeader(filename: string): string {
  const safe = sanitizeFilename(filename);
  const asciiFallback = safe.replace(/[^\x20-\x7E]/g, "") || "download";
  const encoded = encodeURIComponent(safe);
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encoded}`;
}

/**
 * POST /api/m3u/download
 * Generate and download M3U file with resumable download support
 */
export async function POST(request: NextRequest) {
  try {
    const body: DownloadRequest = await request.json();
    const { channels, filename } = body;

    if (!channels || channels.length === 0) {
      return NextResponse.json(
        { error: "İndirilecek kanal bulunamadı" },
        { status: 400 }
      );
    }

    // Generate M3U content
    const m3uContent = generateM3UContent(channels);

    // Generate filename from tvg-name of first channel or provided filename
    const finalFilename =
      filename ||
      generateFilename(
        channels[0].tvgNameAttribute || channels[0].tvgName,
        channels.length
      );

    // Create response with headers for resumable download
    const response = new NextResponse(m3uContent, {
      status: 200,
      headers: {
        "Content-Type": "audio/x-mpegurl; charset=utf-8",
        "Content-Disposition": `attachment; filename="${finalFilename}.m3u"`,
        "Content-Length": Buffer.byteLength(m3uContent).toString(),
        "Accept-Ranges": "bytes", // Enable resumable downloads
        "Cache-Control": "no-cache, no-store, must-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    });

    return response;
  } catch (error) {
    console.error("M3U download error:", error);
    return NextResponse.json(
      {
        error: "Dosya indirilirken hata oluştu",
        details: error instanceof Error ? error.message : "Bilinmeyen hata",
      },
      { status: 500 }
    );
  }
}

/**
 * Generate M3U content from channels
 */
function generateM3UContent(channels: any[]): string {
  let content = "#EXTM3U\n";

  for (const channel of channels) {
    const info: string[] = [];

    if (channel.tvgName)
      info.push(`tvg-name="${escapeAttribute(channel.tvgName)}"`);
    if (channel.tvgLogo)
      info.push(`tvg-logo="${escapeAttribute(channel.tvgLogo)}"`);
    if (channel.tvgId) info.push(`tvg-id="${escapeAttribute(channel.tvgId)}"`);
    if (channel.tvgCountry)
      info.push(`tvg-country="${escapeAttribute(channel.tvgCountry)}"`);
    if (channel.tvgLanguage)
      info.push(`tvg-language="${escapeAttribute(channel.tvgLanguage)}"`);
    if (channel.groupTitle)
      info.push(`group-title="${escapeAttribute(channel.groupTitle)}"`);

    content += `#EXTINF:-1 ${info.join(" ")},${escapeValue(channel.tvgName)}\n`;
    content += `${channel.url}\n`;
  }

  return content;
}

/**
 * Escape attribute values for M3U format
 */
function escapeAttribute(value: string): string {
  if (!value) return "";
  return value
    .replace(/"/g, "'") // Replace double quotes with single quotes
    .replace(/[\r\n]/g, ""); // Remove line breaks
}

/**
 * Escape display name values
 */
function escapeValue(value: string): string {
  if (!value) return "Unknown";
  return value.replace(/[\r\n]/g, "").trim();
}

/**
 * Generate safe filename from channel name
 */
function generateFilename(channelName: string, count: number): string {
  const date = new Date().toISOString().split("T")[0];
  const safeName = channelName
    .replace(/[^a-zA-Z0-9ğüşıöçĞÜŞİÖÇ\s-]/g, "") // Keep only alphanumeric, Turkish chars, spaces and hyphens
    .trim()
    .substring(0, 50); // Limit to 50 characters

  return `${safeName || "channels"}_${count}_${date}`;
}

/**
 * GET /api/m3u/download
 * Get download endpoint information
 */
export async function GET(request: NextRequest) {
  const urlParam = request.nextUrl.searchParams.get("url");
  const filenameParam = request.nextUrl.searchParams.get("filename");

  if (urlParam) {
    let targetUrl: URL;
    try {
      targetUrl = new URL(urlParam);
    } catch {
      return NextResponse.json({ error: "Geçersiz url" }, { status: 400 });
    }

    if (targetUrl.protocol !== "http:" && targetUrl.protocol !== "https:") {
      return NextResponse.json({ error: "Geçersiz url" }, { status: 400 });
    }

    if (isBlockedHostname(targetUrl.hostname)) {
      return NextResponse.json({ error: "Engellenen url" }, { status: 400 });
    }

    const range = request.headers.get("range") ?? "bytes=0-";
    const userAgent =
      request.headers.get("user-agent") ??
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
    const upstream = await fetch(targetUrl.toString(), {
      headers: {
        range,
        "user-agent": userAgent,
        accept: "*/*",
        "accept-language":
          request.headers.get("accept-language") ??
          "tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7",
        referer: `${request.nextUrl.origin}/`,
      },
      redirect: "follow",
    });

    if (!upstream.ok && upstream.status !== 206) {
      return NextResponse.json(
        { error: "İndirilemedi", status: upstream.status },
        { status: 502 }
      );
    }

    const filenameFromPath = decodeURIComponent(
      targetUrl.pathname.split("/").pop() || "download"
    );
    const finalName = sanitizeFilename(
      filenameParam || filenameFromPath || "download"
    );

    const headers = new Headers();
    const contentType = upstream.headers.get("content-type");
    const contentLength = upstream.headers.get("content-length");
    const contentRange = upstream.headers.get("content-range");
    const acceptRanges = upstream.headers.get("accept-ranges");

    if (contentType) headers.set("Content-Type", contentType);
    if (contentLength) headers.set("Content-Length", contentLength);
    if (contentRange) headers.set("Content-Range", contentRange);
    if (acceptRanges) headers.set("Accept-Ranges", acceptRanges);

    headers.set(
      "Content-Disposition",
      createContentDispositionHeader(finalName)
    );
    headers.set("Cache-Control", "no-cache, no-store, must-revalidate");
    headers.set("Pragma", "no-cache");
    headers.set("Expires", "0");

    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers,
    });
  }

  return NextResponse.json({
    name: "M3U Download Endpoint",
    version: "1.0.0",
    features: [
      "Generate M3U files from selected channels",
      "Resumable download support via Accept-Ranges header",
      "Automatic filename generation from tvg-name",
      "Support for UTF-8 encoding",
      "Safe filename generation",
    ],
  });
}
