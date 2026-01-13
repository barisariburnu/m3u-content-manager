import { NextRequest, NextResponse } from 'next/server'

export interface M3UChannel {
  id: string
  tvgName: string
  tvgLogo?: string
  tvgId?: string
  tvgCountry?: string
  tvgLanguage?: string
  groupTitle?: string
  url: string
}

export interface M3UParseResult {
  channels: M3UChannel[]
  totalChannels: number
  groups: { name: string; count: number }[]
}

/**
 * Streaming M3U parser - processes file in chunks for better performance
 */
class StreamingM3UParser {
  private channels: M3UChannel[] = []
  private currentInfo: Partial<M3UChannel> = {}
  private buffer = ''
  private channelId = 0

  parse(chunk: string): M3UChannel[] {
    const newChannels: M3UChannel[] = []

    // Append chunk to buffer
    this.buffer += chunk

    // Process complete lines
    const lines = this.buffer.split(/\r?\n/)
    this.buffer = lines.pop() || '' // Keep incomplete line in buffer

    for (const line of lines) {
      const trimmed = line.trim()

      // Skip empty lines and header
      if (!trimmed || trimmed.startsWith('#EXTM3U')) continue

      if (trimmed.startsWith('#EXTINF:')) {
        // Parse channel info
        this.parseExtInfo(trimmed)
      } else if (trimmed.startsWith('http')) {
        // URL line - complete channel entry
        if (this.currentInfo.tvgName) {
          const channel: M3UChannel = {
            ...this.currentInfo,
            url: trimmed,
            id: `channel-${this.channelId++}`,
          } as M3UChannel

          newChannels.push(channel)
          this.channels.push(channel)
        }
        this.currentInfo = {}
      }
    }

    return newChannels
  }

  finalize(): M3UChannel[] {
    // Process any remaining buffer content
    if (this.buffer.trim()) {
      const trimmed = this.buffer.trim()
      if (trimmed.startsWith('http') && this.currentInfo.tvgName) {
        const channel: M3UChannel = {
          ...this.currentInfo,
          url: trimmed,
          id: `channel-${this.channelId++}`,
        } as M3UChannel
        this.channels.push(channel)
      }
    }
    return this.channels
  }

  private parseExtInfo(line: string): void {
    const infoLine = line.substring(8) // Remove #EXTINF:

    // Extract duration (usually -1 for live streams)
    const durationMatch = infoLine.match(/^(-?\d+)/)
    const duration = durationMatch ? parseInt(durationMatch[1]) : -1

    // Extract the rest after duration
    const rest = infoLine.replace(/^(-?\d+)\s*,?\s*/, '')

    // Extract tvg attributes using regex
    const tvgNameMatch = rest.match(/tvg-name="([^"]*)"/)
    const tvgLogoMatch = rest.match(/tvg-logo="([^"]*)"/)
    const tvgIdMatch = rest.match(/tvg-id="([^"]*)"/)
    const tvgCountryMatch = rest.match(/tvg-country="([^"]*)"/)
    const tvgLanguageMatch = rest.match(/tvg-language="([^"]*)"/)
    const groupTitleMatch = rest.match(/group-title="([^"]*)"/)

    // Extract display name (after comma)
    const displayNameMatch = rest.match(/,\s*(.+)$/)
    const displayName = displayNameMatch ? displayNameMatch[1].trim() : 'Unknown'

    this.currentInfo = {
      tvgName: displayName || tvgNameMatch?.[1] || 'Unknown',
      tvgLogo: tvgLogoMatch?.[1],
      tvgId: tvgIdMatch?.[1],
      tvgCountry: tvgCountryMatch?.[1],
      tvgLanguage: tvgLanguageMatch?.[1],
      groupTitle: groupTitleMatch?.[1] || 'Other',
    }
  }
}

/**
 * POST /api/m3u/parse
 * Parse M3U file with streaming support for large files
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json(
        { error: 'Dosya gerekli' },
        { status: 400 }
      )
    }

    // Validate file type
    const fileName = file.name.toLowerCase()
    if (!fileName.endsWith('.m3u') && !fileName.endsWith('.m3u8')) {
      return NextResponse.json(
        { error: 'Geçersiz dosya formatı. Lütfen .m3u veya .m3u8 dosyası yükleyin' },
        { status: 400 }
      )
    }

    // Check file size (limit to 50MB)
    const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `Dosya boyutu çok büyük. Maksimum ${MAX_FILE_SIZE / (1024 * 1024)}MB` },
        { status: 400 }
      )
    }

    const parser = new StreamingM3UParser()

    // Read file in chunks
    const CHUNK_SIZE = 64 * 1024 // 64KB chunks
    const fileBuffer = await file.arrayBuffer()
    const uint8Array = new Uint8Array(fileBuffer)

    let offset = 0
    while (offset < uint8Array.length) {
      const chunkSize = Math.min(CHUNK_SIZE, uint8Array.length - offset)
      const chunk = uint8Array.slice(offset, offset + chunkSize)
      const chunkText = new TextDecoder('utf-8', { fatal: false }).decode(chunk, { stream: true })

      parser.parse(chunkText)
      offset += chunkSize
    }

    // Finalize parsing
    const channels = parser.finalize()

    // Calculate groups
    const groupMap = new Map<string, number>()
    channels.forEach(channel => {
      const groupName = channel.groupTitle || 'Other'
      groupMap.set(groupName, (groupMap.get(groupName) || 0) + 1)
    })

    const groups = Array.from(groupMap.entries()).map(([name, count]) => ({ name, count }))

    const result: M3UParseResult = {
      channels,
      totalChannels: channels.length,
      groups,
    }

    return NextResponse.json(result)

  } catch (error) {
    console.error('M3U parse error:', error)
    return NextResponse.json(
      {
        error: 'Dosya işlenirken hata oluştu',
        details: error instanceof Error ? error.message : 'Bilinmeyen hata',
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/m3u/parse
 * Get parser information
 */
export async function GET() {
  return NextResponse.json({
    name: 'M3U Streaming Parser',
    version: '1.0.0',
    features: [
      'Streaming parse with chunk processing',
      'Support for large files up to 50MB',
      'Extract tvg-name, tvg-logo, tvg-id, tvg-country, tvg-language, group-title',
      'Automatic channel grouping',
      'UTF-8 encoding support',
    ],
    supportedFormats: ['.m3u', '.m3u8'],
  })
}
