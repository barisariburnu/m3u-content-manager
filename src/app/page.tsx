"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Upload,
  FileText,
  Search,
  Trash2,
  Loader2,
  Play,
  Heart,
  Download,
  X,
  Tv,
  Film,
  FolderOpen,
  ArrowLeft,
  Grid,
  List,
  Zap,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { useDebounce } from "@/hooks/use-debounce";
import { Progress } from "@/components/ui/progress";

export interface M3UChannel {
  id: string;
  tvgName: string;
  tvgNameAttribute?: string;
  tvgLogo?: string;
  tvgId?: string;
  tvgCountry?: string;
  tvgLanguage?: string;
  groupTitle?: string;
  url: string;
}

export interface M3UGroup {
  name: string;
  count: number;
}

type ViewMode = "grid" | "list";
type ContentFilter = "all" | "live" | "vod" | "series";
type VideoViewMode = "normal" | "top" | "bottom" | "left" | "right";

export default function M3UPlayer() {
  const [channels, setChannels] = useState<M3UChannel[]>([]);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [fileInfo, setFileInfo] = useState<{
    name: string;
    size: number;
  } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [contentFilter, setContentFilter] = useState<ContentFilter>("all");
  const [playingChannel, setPlayingChannel] = useState<M3UChannel | null>(null);
  const [isLoadingVideo, setIsLoadingVideo] = useState(false);
  const [videoViewMode, setVideoViewMode] = useState<VideoViewMode>("normal");
  const [view, setView] = useState<"upload" | "categories" | "detail">(
    "upload"
  );
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [downloadingItems, setDownloadingItems] = useState<Set<string>>(
    new Set()
  );
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<any>(null);

  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  const estimateDataSize = (data: any): number => {
    return new Blob([JSON.stringify(data)]).size;
  };

  const STORAGE_LIMIT = 4 * 1024 * 1024;

  useEffect(() => {
    const savedChannels = localStorage.getItem("m3u_channels");
    const savedFileInfo = localStorage.getItem("m3u_file_info");
    const savedFavorites = localStorage.getItem("m3u_favorites");

    if (savedChannels) {
      try {
        setChannels(JSON.parse(savedChannels));
        setView("categories");
      } catch (e) {
        console.error("Failed to parse saved channels:", e);
      }
    }

    if (savedFileInfo) {
      try {
        setFileInfo(JSON.parse(savedFileInfo));
      } catch (e) {
        console.error("Failed to parse saved file info:", e);
      }
    }

    if (savedFavorites) {
      try {
        setFavorites(new Set(JSON.parse(savedFavorites)));
      } catch (e) {
        console.error("Failed to parse saved favorites:", e);
      }
    }
  }, []);

  useEffect(() => {
    try {
      const dataSize = estimateDataSize(channels);
      if (dataSize > STORAGE_LIMIT) {
        localStorage.removeItem("m3u_channels");
        return;
      }
      if (channels.length > 0) {
        localStorage.setItem("m3u_channels", JSON.stringify(channels));
      } else {
        localStorage.removeItem("m3u_channels");
      }
    } catch (error) {
      console.error("Error saving channels:", error);
    }
  }, [channels]);

  useEffect(() => {
    try {
      localStorage.setItem(
        "m3u_favorites",
        JSON.stringify(Array.from(favorites))
      );
    } catch (error) {
      console.error("Error saving favorites:", error);
    }
  }, [favorites]);

  useEffect(() => {
    try {
      const dataSize = estimateDataSize(fileInfo);
      if (dataSize > STORAGE_LIMIT) {
        localStorage.removeItem("m3u_file_info");
        return;
      }
      if (fileInfo) {
        localStorage.setItem("m3u_file_info", JSON.stringify(fileInfo));
      } else {
        localStorage.removeItem("m3u_file_info");
      }
    } catch (error) {
      console.error("Error saving file info:", error);
    }
  }, [fileInfo]);

  const parseM3U = useCallback((content: string): M3UChannel[] => {
    const lines = content.split(/\r?\n/);
    const parsedChannels: M3UChannel[] = [];
    let currentInfo: Partial<M3UChannel> = {};

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (!line || line.startsWith("#EXTM3U")) continue;

      if (line.startsWith("#EXTINF:")) {
        const infoLine = line.substring(8);
        const tvgNameMatch = infoLine.match(/tvg-name="([^"]*)"/);
        const tvgLogoMatch = infoLine.match(/tvg-logo="([^"]*)"/);
        const tvgIdMatch = infoLine.match(/tvg-id="([^"]*)"/);
        const tvgCountryMatch = infoLine.match(/tvg-country="([^"]*)"/);
        const tvgLanguageMatch = infoLine.match(/tvg-language="([^"]*)"/);
        const groupTitleMatch = infoLine.match(/group-title="([^"]*)"/);
        const displayNameMatch = infoLine.match(/,\s*(.+)$/);
        const displayName = displayNameMatch
          ? displayNameMatch[1].trim()
          : "Unknown";

        currentInfo = {
          tvgName: displayName || tvgNameMatch?.[1] || "Unknown",
          tvgNameAttribute: tvgNameMatch?.[1],
          tvgLogo: tvgLogoMatch?.[1],
          tvgId: tvgIdMatch?.[1],
          tvgCountry: tvgCountryMatch?.[1],
          tvgLanguage: tvgLanguageMatch?.[1],
          groupTitle: groupTitleMatch?.[1] || "Diğer",
        };
      } else if (line.startsWith("http")) {
        if (currentInfo.tvgName) {
          parsedChannels.push({
            ...currentInfo,
            url: line,
            id: `channel-${parsedChannels.length}`,
          } as M3UChannel);
        }
        currentInfo = {};
      }
    }

    return parsedChannels;
  }, []);

  useEffect(() => {
    if (!playingChannel) return;
    const context = `${playingChannel.groupTitle || ""} ${
      playingChannel.tvgName || ""
    }`.toLowerCase();
    if (context.includes("3d")) {
      setVideoViewMode("top");
      return;
    }
    setVideoViewMode("normal");
  }, [playingChannel]);

  const handleFileUpload = useCallback(
    async (file: File) => {
      setIsLoading(true);
      setIsProcessing(true);
      setUploadProgress(0);

      try {
        const fileContent = await readFile(file);
        setUploadProgress(50);

        await new Promise((resolve) => setTimeout(resolve, 100));

        const parsedChannels = parseM3U(fileContent);
        setUploadProgress(100);

        setChannels(parsedChannels);
        setFileInfo({
          name: file.name,
          size: file.size,
        });

        toast.success(`Successfully loaded: ${parsedChannels.length} content`, {
          description: `${formatFileSize(file.size)}`,
        });

        setTimeout(() => {
          setView("categories");
        }, 500);
      } catch (error) {
        console.error("Error parsing M3U file:", error);
        toast.error("Error processing file", {
          description: error instanceof Error ? error.message : "Unknown error",
        });
      } finally {
        setIsLoading(false);
        setIsProcessing(false);
        setTimeout(() => setUploadProgress(0), 1000);
      }
    },
    [parseM3U]
  );

  const readFile = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onprogress = (event) => {
        if (event.lengthComputable) {
          const percentComplete = (event.loaded / event.total) * 50;
          setUploadProgress(percentComplete);
        }
      };

      reader.onload = (event) => resolve(event.target?.result as string);
      reader.onerror = () => reject(new Error("Error reading file"));
      reader.readAsText(file, "UTF-8");
    });
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    const m3uFile = files.find(
      (f) =>
        f.name.toLowerCase().endsWith(".m3u") ||
        f.name.toLowerCase().endsWith(".m3u8")
    );

    if (m3uFile) {
      handleFileUpload(m3uFile);
    } else if (files.length > 0) {
      toast.error("Please upload .m3u or .m3u8 file");
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const toggleFavorite = (channelId: string) => {
    const newFavorites = new Set(favorites);
    if (newFavorites.has(channelId)) {
      newFavorites.delete(channelId);
      toast.info("Removed from favorites");
    } else {
      newFavorites.add(channelId);
      toast.success("Added to favorites");
    }
    setFavorites(newFavorites);
  };

  const downloadContent = async (channel: M3UChannel) => {
    const channelId = channel.id;

    if (downloadingItems.has(channelId)) {
      toast.info("This content is already downloading...");
      return;
    }

    setDownloadingItems((prev) => new Set(prev).add(channelId));

    try {
      const extension = getContentType(channel);

      const safeName = (channel.tvgNameAttribute || channel.tvgName)
        .replace(/[<>:"/\\|?*]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .substring(0, 100);
      const fileName = `${safeName}.${extension}`;
      const downloadUrl = `/api/m3u/download?url=${encodeURIComponent(
        channel.url
      )}&filename=${encodeURIComponent(fileName)}`;

      const a = document.createElement("a");
      a.href = downloadUrl;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      toast.info(`"${channel.tvgName}" downloading...`, {
        description: `${extension.toUpperCase()} format`,
      });
    } catch (error) {
      console.error("Download error:", error);
      toast.error("Download error", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setDownloadingItems((prev) => {
        const newSet = new Set(prev);
        newSet.delete(channelId);
        return newSet;
      });
    }
  };

  const getContentType = (channel: M3UChannel): string => {
    const url = channel.url.toLowerCase();
    const groupTitle = channel.groupTitle?.toLowerCase() || "";

    if (url.includes(".mp4") || url.includes(".m4v")) return "mp4";
    if (url.includes(".mkv")) return "mkv";
    if (url.includes(".avi")) return "avi";
    if (url.includes(".mov")) return "mov";
    if (url.includes(".flv")) return "flv";
    if (url.includes(".wmv")) return "wmv";
    if (url.includes(".webm")) return "webm";
    if (url.includes(".m3u8")) return "m3u8";

    if (
      groupTitle.includes("film") ||
      groupTitle.includes("movie") ||
      groupTitle.includes("vod")
    )
      return "mp4";
    if (
      groupTitle.includes("dizi") ||
      groupTitle.includes("series") ||
      groupTitle.includes("show")
    )
      return "mp4";

    return "mp4";
  };

  const playContent = (channel: M3UChannel) => {
    // URL doğrulaması
    if (!channel.url || !channel.url.startsWith("http")) {
      toast.error("Invalid URL", {
        description: "Content URL is not valid",
      });
      return;
    }

    setIsLoadingVideo(true);

    // Önceki video instance'ını temizle
    if (hlsRef.current) {
      try {
        hlsRef.current.destroy();
      } catch (e) {
        console.warn("HLS destroy error:", e);
      }
      hlsRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.removeAttribute("src");
      videoRef.current.load();
    }

    setPlayingChannel(channel);

    setTimeout(() => {
      if (!videoRef.current) {
        console.error("Video element not available");
        setIsLoadingVideo(false);
        toast.error("Video element could not be prepared");
        return;
      }

      const url = channel.url.toLowerCase();

      // HLS.js kontrolü
      const Hls = typeof window !== "undefined" ? (window as any).Hls : null;

      console.log("Attempting to play:", channel.tvgName, channel.url);

      // Video event handlers ekle
      const handleVideoLoadStart = () => {
        console.log("Video load started");
      };

      const handleVideoCanPlay = () => {
        console.log("Video can play");
        setIsLoadingVideo(false);
      };

      const handleVideoError = (e: Event) => {
        const target = e.target as HTMLVideoElement;
        console.error("Video element error:", {
          error: target.error,
          src: target.src,
          readyState: target.readyState,
          networkState: target.networkState,
        });
        setIsLoadingVideo(false);
      };

      videoRef.current.addEventListener("loadstart", handleVideoLoadStart);
      videoRef.current.addEventListener("canplay", handleVideoCanPlay);
      videoRef.current.addEventListener("error", handleVideoError);

      if (
        url.includes(".m3u8") ||
        url.includes("m3u8") ||
        url.includes("/stream") ||
        url.includes("/playlist")
      ) {
        if (Hls && Hls.isSupported()) {
          console.log("Using HLS.js for playback");

          const hls = new Hls({
            debug: false,
            enableWorker: true,
            lowLatencyMode: true,
          });

          hlsRef.current = hls;

          hls.loadSource(channel.url);
          hls.attachMedia(videoRef.current);

          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            console.log("HLS manifest parsed successfully");
            setIsLoadingVideo(false);
            videoRef.current?.play().catch((e) => {
              console.warn("Auto-play failed:", e);
              toast.info("Click to play video");
            });
          });

          hls.on(Hls.Events.ERROR, (event: any, data: any) => {
            console.error("HLS error:", { event, data });
            setIsLoadingVideo(false);

            if (data.fatal) {
              toast.error("Video could not be loaded", {
                description:
                  "Stream URL is invalid, deprecated, or may have CORS restrictions",
                duration: 5000,
              });

              switch (data.type) {
                case Hls.ErrorTypes.NETWORK_ERROR:
                  console.error("Network error, trying to recover...");
                  try {
                    hls.startLoad();
                  } catch (e) {
                    console.warn("Recovery failed:", e);
                  }
                  break;
                case Hls.ErrorTypes.MEDIA_ERROR:
                  console.error("Media error, trying to recover...");
                  try {
                    hls.recoverMediaError();
                  } catch (e) {
                    console.warn("Recovery failed:", e);
                  }
                  break;
                default:
                  try {
                    hls.destroy();
                  } catch (e) {
                    console.warn("Destroy failed:", e);
                  }
                  hlsRef.current = null;
                  break;
              }
            } else {
              console.warn("Non-fatal HLS error:", data);
            }
          });
        } else {
          console.warn("HLS.js not supported, trying native playback");
          try {
            videoRef.current.src = channel.url;
            videoRef.current.load();
            videoRef.current.play().catch((e) => {
              console.error("Native playback failed:", e);
              setIsLoadingVideo(false);
              toast.error("Video could not be played", {
                description:
                  "This browser does not support HLS. Try Chrome or Firefox.",
                duration: 5000,
              });
            });
          } catch (e) {
            console.error("Native playback setup failed:", e);
            setIsLoadingVideo(false);
            toast.error("Video could not be prepared", {
              description: e instanceof Error ? e.message : "Unknown error",
            });
          }
        }
      } else {
        // MP4, MKV gibi dosyalar için native playback
        console.log("Using native HTML5 video playback");
        try {
          videoRef.current.src = channel.url;
          videoRef.current.load();
          videoRef.current.play().catch((e) => {
            console.error("Native playback failed:", e);
            setIsLoadingVideo(false);
            toast.error("Video could not be played", {
              description:
                "Video format is not supported or file may be corrupted",
              duration: 5000,
            });
          });
        } catch (e) {
          console.error("Native playback setup failed:", e);
          setIsLoadingVideo(false);
          toast.error("Video could not be prepared", {
            description: e instanceof Error ? e.message : "Unknown error",
          });
        }
      }
    }, 300);
  };

  const closePlayer = useCallback(() => {
    // HLS cleanup
    if (hlsRef.current) {
      try {
        hlsRef.current.destroy();
      } catch (e) {
        console.warn("HLS destroy error:", e);
      }
      hlsRef.current = null;
    }

    // Video element cleanup
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.removeAttribute("src");
    }

    setPlayingChannel(null);
    setIsLoadingVideo(false);
  }, []);

  const clearAllData = () => {
    setChannels([]);
    setFileInfo(null);
    setView("upload");
    setSelectedCategory(null);
    localStorage.removeItem("m3u_channels");
    localStorage.removeItem("m3u_file_info");
    toast.success("All data cleared");
  };

  const categories = useMemo(() => {
    const groupMap = new Map<string, number>();

    channels.forEach((channel) => {
      const groupName = channel.groupTitle || "Diğer";
      groupMap.set(groupName, (groupMap.get(groupName) || 0) + 1);
    });

    return Array.from(groupMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [channels]);

  const filteredChannels = useMemo(() => {
    let result = channels.filter((c) => c.groupTitle === selectedCategory);

    if (contentFilter !== "all") {
      const groupTitle = (channel) => channel.groupTitle?.toLowerCase() || "";
      if (contentFilter === "vod") {
        result = result.filter(
          (c) =>
            groupTitle(c).includes("vod") ||
            groupTitle(c).includes("film") ||
            groupTitle(c).includes("movie")
        );
      } else if (contentFilter === "series") {
        result = result.filter(
          (c) =>
            groupTitle(c).includes("dizi") ||
            groupTitle(c).includes("series") ||
            groupTitle(c).includes("show")
        );
      } else {
        result = result.filter(
          (c) =>
            !groupTitle(c).includes("vod") &&
            !groupTitle(c).includes("film") &&
            !groupTitle(c).includes("dizi")
        );
      }
    }

    if (!debouncedSearchQuery) return result;

    const query = debouncedSearchQuery.toLowerCase();
    return result.filter(
      (channel) =>
        channel.tvgName?.toLowerCase().includes(query) ||
        channel.tvgCountry?.toLowerCase().includes(query) ||
        channel.tvgLanguage?.toLowerCase().includes(query)
    );
  }, [channels, selectedCategory, debouncedSearchQuery, contentFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchQuery, contentFilter]);

  const { displayedChannels, totalPages } = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return {
      displayedChannels: filteredChannels.slice(startIndex, endIndex),
      totalPages: Math.ceil(filteredChannels.length / itemsPerPage),
    };
  }, [filteredChannels, currentPage, itemsPerPage]);

  const isLiveContent = (channel: M3UChannel) => {
    const url = channel.url.toLowerCase();
    const groupTitle = channel.groupTitle?.toLowerCase() || "";
    return (
      !groupTitle.includes("vod") &&
      !groupTitle.includes("film") &&
      !groupTitle.includes("dizi") &&
      !url.includes(".mp4") &&
      !url.includes(".mkv") &&
      !url.includes(".avi")
    );
  };

  const CategoryCard = ({ category }: { category: M3UGroup }) => (
    <Card
      className="cursor-pointer hover:shadow-lg hover:border-primary/50 transition-all duration-200 group"
      onClick={() => {
        setSelectedCategory(category.name);
        setView("detail");
      }}
    >
      <CardContent className="pt-6">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-full bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
            <FolderOpen className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-lg group-hover:text-primary transition-colors line-clamp-1">
              {category.name}
            </h3>
            <p className="text-sm text-muted-foreground">
              {category.count} içerik
            </p>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:translate-x-1 transition-transform" />
        </div>
      </CardContent>
    </Card>
  );

  const ContentCard = ({ channel }: { channel: M3UChannel }) => (
    <div className="relative group rounded-xl overflow-hidden border-2 transition-all duration-300">
      <div className="aspect-video bg-muted relative overflow-hidden">
        {channel.tvgLogo ? (
          <img
            src={channel.tvgLogo}
            alt={channel.tvgName}
            className="w-full h-full object-contain p-4"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-primary/5">
            {isLiveContent(channel) ? (
              <Tv className="h-16 w-16 text-primary/40" />
            ) : (
              <Film className="h-16 w-16 text-primary/40" />
            )}
          </div>
        )}
        {isLiveContent(channel) && (
          <Badge className="absolute top-2 left-2 bg-red-600 hover:bg-red-600">
            <Zap className="h-3 w-3 mr-1" />
            CANLI
          </Badge>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="absolute bottom-0 left-0 right-0 p-3 flex gap-2">
            <Button
              size="sm"
              className="flex-1"
              onClick={(e) => {
                e.stopPropagation();
                playContent(channel);
              }}
            >
              <Play className="h-4 w-4 mr-1" />
              Play
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={(e) => {
                e.stopPropagation();
                downloadContent(channel);
              }}
              disabled={downloadingItems.has(channel.id)}
            >
              {downloadingItems.has(channel.id) ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </div>
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm line-clamp-1">
              {channel.tvgName}
            </h3>
          </div>
          <div className="flex gap-1">
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={(e) => {
                e.stopPropagation();
                toggleFavorite(channel.id);
              }}
            >
              <Heart
                className={`h-4 w-4 ${
                  favorites.has(channel.id) ? "fill-red-500 text-red-500" : ""
                }`}
              />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {playingChannel && (
        <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4">
          <div className="w-full max-w-6xl">
            <div className="bg-card rounded-xl overflow-hidden">
              <div className="aspect-video bg-black relative overflow-hidden">
                {isLoadingVideo && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-10">
                    <Loader2 className="h-16 w-16 text-primary animate-spin" />
                  </div>
                )}
                <div className="absolute top-2 left-2 z-10 flex gap-2">
                  <Button
                    size="sm"
                    variant={
                      videoViewMode === "normal" ? "default" : "secondary"
                    }
                    onClick={() => setVideoViewMode("normal")}
                  >
                    Normal
                  </Button>
                  <Button
                    size="sm"
                    variant={videoViewMode === "top" ? "default" : "secondary"}
                    onClick={() => setVideoViewMode("top")}
                  >
                    Üst
                  </Button>
                  <Button
                    size="sm"
                    variant={
                      videoViewMode === "bottom" ? "default" : "secondary"
                    }
                    onClick={() => setVideoViewMode("bottom")}
                  >
                    Alt
                  </Button>
                  <Button
                    size="sm"
                    variant={videoViewMode === "left" ? "default" : "secondary"}
                    onClick={() => setVideoViewMode("left")}
                  >
                    Sol
                  </Button>
                  <Button
                    size="sm"
                    variant={
                      videoViewMode === "right" ? "default" : "secondary"
                    }
                    onClick={() => setVideoViewMode("right")}
                  >
                    Sağ
                  </Button>
                </div>
                <video
                  key={`${playingChannel.id}-${playingChannel.url}`}
                  ref={videoRef}
                  className={`w-full h-full ${
                    videoViewMode === "normal"
                      ? "object-contain"
                      : "object-cover"
                  }`}
                  controls
                  style={
                    videoViewMode === "top"
                      ? { transform: "scaleY(2)", transformOrigin: "top" }
                      : videoViewMode === "bottom"
                      ? { transform: "scaleY(2)", transformOrigin: "bottom" }
                      : videoViewMode === "left"
                      ? { transform: "scaleX(2)", transformOrigin: "left" }
                      : videoViewMode === "right"
                      ? { transform: "scaleX(2)", transformOrigin: "right" }
                      : undefined
                  }
                />
              </div>
              <div className="p-4 border-t flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold">
                    {playingChannel.tvgName}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {playingChannel.groupTitle}
                  </p>
                </div>
                <Button size="icon" variant="ghost" onClick={closePlayer}>
                  <X className="h-6 w-6" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="flex items-center gap-4 mb-8">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent flex-1">
            M3U Content Manager
          </h1>
          {channels.length > 0 && (
            <div className="flex items-center gap-2">
              <Button
                size="icon"
                variant={viewMode === "grid" ? "default" : "outline"}
                onClick={() => setViewMode("grid")}
              >
                <Grid className="h-5 w-5" />
              </Button>
              <Button
                size="icon"
                variant={viewMode === "list" ? "default" : "outline"}
                onClick={() => setViewMode("list")}
              >
                <List className="h-5 w-5" />
              </Button>
              <Button size="icon" variant="outline" onClick={clearAllData}>
                <Trash2 className="h-5 w-5" />
              </Button>
            </div>
          )}
        </div>

        {view === "upload" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                File Upload
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-xl p-12 text-center transition-all ${
                  dragOver
                    ? "border-primary bg-primary/5 scale-[1.02]"
                    : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50"
                }`}
              >
                <input
                  type="file"
                  accept=".m3u,.m3u8"
                  onChange={handleFileInputChange}
                  className="hidden"
                  id="file-input"
                  disabled={isLoading}
                />
                <label htmlFor="file-input" className="cursor-pointer">
                  {isLoading ? (
                    <>
                      <RefreshCw className="h-16 w-16 mx-auto mb-4 text-primary animate-spin" />
                      <p className="text-xl font-semibold mb-2">İşleniyor...</p>
                    </>
                  ) : (
                    <>
                      <Upload className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                      <p className="text-xl font-semibold mb-2">
                        Drag and drop file here or click to select
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Channel list in M3U or M3U8 format
                      </p>
                    </>
                  )}
                </label>
              </div>

              {isProcessing && uploadProgress > 0 && (
                <div className="mt-6 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="font-medium">
                      {Math.round(uploadProgress)}%
                    </span>
                  </div>
                  <Progress value={uploadProgress} className="h-2" />
                </div>
              )}

              {fileInfo && (
                <Alert className="mt-4">
                  <FileText className="h-4 w-4" />
                  <AlertDescription className="ml-2">
                    <span className="font-medium">{fileInfo.name}</span> (
                    {formatFileSize(fileInfo.size)}) - {channels.length} content
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        )}

        {view === "categories" && (
          <>
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FolderOpen className="h-5 w-5" />
                  Categories
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  {categories.length} categories • {channels.length} content
                </p>
              </CardHeader>
            </Card>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {categories.map((category) => (
                <CategoryCard key={category.name} category={category} />
              ))}
            </div>
          </>
        )}

        {view === "detail" && selectedCategory && (
          <>
            <div className="mb-6 flex items-center gap-4">
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedCategory(null);
                  setView("categories");
                }}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Categories
              </Button>

              <h2 className="text-2xl font-bold flex-1">{selectedCategory}</h2>

              <div className="flex items-center gap-2">
                <div className="relative flex-1 sm:w-64">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Search content..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
            </div>

            <div className="mb-6 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {filteredChannels.length} content found
              </p>
            </div>

            {viewMode === "grid" ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {displayedChannels.map((channel) => (
                  <ContentCard key={channel.id} channel={channel} />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {displayedChannels.map((channel) => (
                  <Card key={channel.id} className="border-2">
                    <CardContent className="p-3">
                      <div className="flex items-center gap-3">
                        {channel.tvgLogo && (
                          <img
                            src={channel.tvgLogo}
                            alt={channel.tvgName}
                            className="w-10 h-10 rounded object-cover"
                            onError={(e) => {
                              e.currentTarget.style.display = "none";
                            }}
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium truncate">
                              {channel.tvgName}
                            </span>
                            {isLiveContent(channel) && (
                              <Badge className="bg-red-600 hover:bg-red-600 text-xs">
                                <Zap className="h-3 w-3 mr-1" />
                                CANLI
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {channel.groupTitle}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={() => toggleFavorite(channel.id)}
                          >
                            <Heart
                              className={`h-4 w-4 ${
                                favorites.has(channel.id)
                                  ? "fill-red-500 text-red-500"
                                  : ""
                              }`}
                            />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={() => playContent(channel)}
                          >
                            <Play className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={() => downloadContent(channel)}
                            disabled={downloadingItems.has(channel.id)}
                          >
                            {downloadingItems.has(channel.id) ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Download className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-6 pt-6 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  Önceki
                </Button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }

                  return (
                    <Button
                      key={pageNum}
                      variant={currentPage === pageNum ? "default" : "outline"}
                      size="sm"
                      className="w-8 h-8"
                      onClick={() => setCurrentPage(pageNum)}
                    >
                      {pageNum}
                    </Button>
                  );
                })}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalPages, p + 1))
                  }
                  disabled={currentPage === totalPages}
                >
                  Sonraki
                </Button>
              </div>
            )}
          </>
        )}

        {channels.length === 0 && !isLoading && view === "upload" && (
          <Card className="text-center py-16">
            <CardContent>
              <div className="mx-auto w-32 h-32 rounded-full bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center mb-6">
                <Tv className="h-16 w-16 text-primary/40" />
              </div>
              <h3 className="text-xl font-semibold mb-2">
                No content loaded yet
              </h3>
              <p className="text-muted-foreground mb-4">
                Upload an M3U or M3U8 file to get started
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
