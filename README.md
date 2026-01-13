# M3U Content Manager

An advanced M3U/M3U8 file processing and content management application.

## Features

### 1. File Upload and Processing

- **Drag & Drop**: Upload M3U/M3U8 files by dragging and dropping
- **File Selection**: Manually select files using file picker
- **Large File Support**: Process files up to 50MB with optimization
- **Streaming Parser**: Performance optimization with chunk processing
- **Auto Remember**: Stores the content of the last uploaded file in the browser

### 2. Channel Listing

- **Grouping**: Automatically group channels by category
- **Search**: Search by channel name, category, country, or language
- **Filtering**: Real-time filtering (debounced search for performance optimization)
- **Responsive Design**: Flawless work on mobile, tablet, and desktop devices
- **Lazy Loading**: Performance optimization with pagination for large lists
- **Expandable Groups**: Ability to open and close groups

### 3. Save and Download Functions

- **Download Selected Channels**: Download selected channels in M3U format
- **Filename Generation**: Use tvg-name information as the filename
- **Group Download**: Select and download an entire category with one click
- **Resumable Download**: Seamless download support for large files (Accept-Ranges header)

### 4. Additional Features

- **Channel Logos**: Display tvg-logo information
- **Meta Information**: Show country, language, group title, etc.
- **Live Preview**: Open channel URLs in a new tab
- **Statistics**: Total channel, category, displayed, and selected channel counts
- **Toast Notifications**: Notify users of operation status
- **Local Storage**: Store data in localStorage

## Usage

### File Upload

1. Click on the file upload area on the main page or
2. Drag and drop an M3U/M3U8 file
3. The file is automatically processed and channels are listed

### Channel Selection

- Click the checkbox next to a channel to select a single channel
- Click the checkbox on the category header to select an entire category
- Click the "Clear" button to clear the selection

### Search and Filtering

- Type the channel name, category, country, or language in the search box
- Results are automatically filtered
- Since the filtering is debounced, you won't experience performance issues with large lists

### Pagination

- Click on page numbers to navigate between pages
- Use "Previous" and "Next" buttons to navigate
- 100 categories are displayed per page

### Download

1. Select the channels you want to download
2. Click the "Download" button
3. The file is automatically downloaded

### Clear All Data

- Click the trash icon in the top right corner
- All channel data and selections are cleared

## Technical Details

### Backend API

#### POST /api/m3u/parse

Parses the M3U file.

**Request:**

- `file`: M3U/M3U8 file (multipart/form-data)

**Response:**

```json
{
  "channels": [
    {
      "id": "channel-0",
      "tvgName": "Channel Name",
      "tvgLogo": "https://example.com/logo.png",
      "tvgId": "channel.id",
      "tvgCountry": "TR",
      "tvgLanguage": "Turkish",
      "groupTitle": "Sports",
      "url": "http://example.com/stream.m3u8"
    }
  ],
  "totalChannels": 100,
  "groups": [
    { "name": "Sports", "count": 20 },
    { "name": "Movies", "count": 30 }
  ]
}
```

#### POST /api/m3u/download

Creates and downloads an M3U file from selected channels.

**Request:**

```json
{
  "channels": [...],
  "filename": "optional-filename"
}
```

**Response:**

- M3U file (Content-Type: audio/x-mpegurl)
- Resumable download support (Accept-Ranges: bytes)

### Frontend Technologies

- **Framework**: Next.js 15 (App Router)
- **UI**: shadcn/ui + Tailwind CSS
- **State Management**: React Hooks (useState, useEffect, useMemo, useCallback)
- **Debounce**: Custom useDebounce hook
- **Icons**: Lucide React
- **Notifications**: Sonner
- **Storage**: LocalStorage

### Performance Optimizations

1. **Streaming Parser**: Large file support with chunk processing in the backend
2. **Debounced Search**: Search performance optimization with 300ms delay
3. **Memoization**: Prevent unnecessary renders with useMemo
4. **Pagination**: Limit DOM size with lazy loading
5. **LocalStorage**: Automatic storage for last file data

## M3U Format Supported Features

- `#EXTM3U` header
- `#EXTINF:-1` duration information
- `tvg-name="..."` channel name
- `tvg-logo="..."` logo URL
- `tvg-id="..."` channel ID
- `tvg-country="..."` country
- `tvg-language="..."` language
- `group-title="..."` category

## Example M3U File

```m3u
#EXTM3U
#EXTINF:-1 tvg-name="TRT 1" tvg-logo="https://example.com/trt1.png" tvg-id="trt1.tr" tvg-country="TR" tvg-language="Turkish" group-title="Ulusal",TRT 1
http://example.com/stream/trt1.m3u8
#EXTINF:-1 tvg-name="Show TV" tvg-logo="https://example.com/show.png" tvg-id="show.tr" tvg-country="TR" tvg-language="Turkish" group-title="Ulusal",Show TV
http://example.com/stream/show.m3u8
```

## Browser Support

- Chrome (last 2 versions)
- Firefox (last 2 versions)
- Safari (last 2 versions)
- Edge (last 2 versions)

## License

MIT License
