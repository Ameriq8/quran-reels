# 🕋 Quran Shorts & Reels Generator — Project Features & Capabilities

> **Purpose of this document:**  
> This file outlines all the existing features, architecture, technology stack, configuration options, and current capabilities of the **Quran Shorts & Reels Generator** project. You can share this document with an AI assistant or team to brainstorm new feature suggestions, design enhancements, and technical improvements.

---

## 📌 1. Project Overview

**Quran Shorts & Reels Generator** is an automated, high-performance vertical (9:16) video generation engine designed specifically for creating Islamic short-form content for **YouTube Shorts**, **Instagram Reels**, and **TikTok**.

The tool programmatically fetches Quranic verses, high-quality audio recitations, and translation subtitles, blends them with ambient backgrounds and dark gradient backdrops, and renders crisp, ready-to-publish MP4 videos in seconds.

---

## 🛠️ 2. Technology Stack & Architecture

| Component | Technology / Library | Role & Details |
| :--- | :--- | :--- |
| **Runtime** | **Bun** (`v1.3+`) | Fast JavaScript/TypeScript execution, ultra-fast dependency resolution, and script runner (`bun start`). |
| **Language** | **TypeScript** (`v7.0+` / `v5.8+`) | Strict type safety, clean interfaces, and modern ESNext modules. |
| **Video Engine** | **FFmpeg** (`v9.0+`) & **ffprobe** | Hardware/native video rendering using `libass`, `libfreetype`, and `libx264` for high-quality MP4 (1080x1920) encoding. |
| **Data Source** | **Quran.com API v4** | Official, secure REST API providing chapter metadata, Uthmanic Arabic text with Harakat, multi-reciter audio, and multilingual translations. |
| **Typography & RTL** | **`arabic-persian-reshaper`** + **ASS Subtitles** | Converts raw Unicode Arabic into connected cursive script with proper Right-To-Left (RTL) shaping and burns in styled subtitles. |
| **HTTP Client** | **Axios** | Efficient HTTP stream downloading and API calls with retry and caching. |

---

## ⚡ 3. Current Working Features

### 🎬 Video Generation & Aesthetics
- **Vertical 9:16 Format (1080×1920)**: Fully optimized for mobile screens and short-form video platforms (Shorts, Reels, TikTok).
- **High-Quality Encoding**: Outputs standard H.264 video (`yuv420p`) and 192kbps AAC stereo audio in an `.mp4` container.
- **Top Surah Banner**:
  - Arabic Surah name (e.g. `سورة الفاتحة`)
  - English Surah name (e.g. `Al-Fatihah`)
  - Ayah range indicator (e.g. `Ayat 1 - 7` or `Ayah 5`)
- **Reciter Credit Tag**: Automatically includes the reciter's name in Arabic (e.g. `القارئ: مشاري راشد العفاسي`).
- **Connected Arabic Typography**:
  - Complete Arabic text with full Harakat/Tashkeel.
  - Formatted Eastern Arabic Ayah end numbers `( ١ )`.
  - Crisp white typography with dark outline and drop-shadow for maximum readability.
- **Synchronized Subtitle Translations**: English (or configured language) subtitles displayed beneath the Arabic verse.
- **Soft Contrast Backdrop**: Applies a dark vignette/overlay (`black@0.45`) on background images so text remains readable regardless of image brightness.
- **Curated Background Library**: 50+ built-in ambient Islamic, nature, and Quran-themed photos in `assets/` with random selection or custom image pinning.

---

### 📖 Quran Data & Recitations
- **Complete Quran Coverage**: Any Surah (1 to 114) and any Ayah range can be generated.
- **Multi-Reciter Library**: Full access to reciters on Quran.com, including:
  - *Mishary Rashid Alafasy* (`ID: 7`)
  - *Abdul Basit - Murattal* (`ID: 2`)
  - *Abdul Basit - Mujawwad* (`ID: 1`)
  - *Abu Bakr Al-Shatri* (`ID: 4`)
  - *Mahmoud Khalil Al-Husary* (`ID: 6`)
  - *Saad Al-Ghamdi* (`ID: 3`)
- **Multilingual Translations**:
  - English translation (`ID: 85`, default)
  - *Saheeh International* (`ID: 20`)
  - Any valid Quran.com translation ID (Urdu, French, Spanish, Indonesian, Turkish, etc.).

---

### ⚙️ Performance & File Management
- **Automatic Audio Caching**: Downloads verse audio files once into `cache/audio/` and reuses them on subsequent runs to save bandwidth.
- **Precise Duration Calculation**: Uses `ffprobe` to compute exact durations down to the millisecond for each verse.
- **Automatic Audio Concatenation**: Combines verse audio files seamlessly using FFmpeg concat.
- **Descriptive Output Naming**: Automatically names files cleanly in `output/` (e.g. `output/Surah_001_Al-Fatihah_Ayah_1-7.mp4`).
- **Temporary File Auto-Cleanup**: Automatically cleans up scratch `.ass` subtitle files and temporary concatenated audio after rendering.
- **Zero Native C++ Binding Hassles**: Pure TypeScript + system FFmpeg eliminates dependency breakage across Node/Bun versions.

---

## 🎛️ 4. Configuration Schema (`config.json`)

The entire video generation process is controlled via a simple JSON file:

```json
{
  "surah": 1,
  "verse_start": 1,
  "verse_count": 7,
  "reciter_id": 7,
  "translation_id": 85,
  "show_translation": true,
  "output_dir": "output",
  "font_size": 62,
  "translation_font_size": 34,
  "arabic_font": "Arial",
  "translation_font": "Segoe UI",
  "background": ""
}
```

### Explanation of Settings:
- `surah` *(number)*: Surah number from 1 (Al-Fatiha) to 114 (An-Nas).
- `verse_start` *(number)*: The starting verse number (1-indexed).
- `verse_count` *(number)*: Number of consecutive verses to include.
- `reciter_id` *(number)*: The ID of the reciter on Quran.com.
- `translation_id` *(number)*: The translation ID on Quran.com.
- `show_translation` *(boolean)*: Toggle translation subtitles on or off.
- `output_dir` *(string)*: Destination directory for rendered `.mp4` videos.
- `font_size` *(number)*: Font size of the main Arabic verse text.
- `translation_font_size` *(number)*: Font size of the translation text.
- `arabic_font` *(string)*: System font for Arabic text (e.g. `"Arial"`, `"Traditional Arabic"`, `"Tahoma"`).
- `translation_font` *(string)*: System font for translation (e.g. `"Segoe UI"`, `"Roboto"`, `"Arial"`).
- `background` *(string)*: *(Optional)* Specific image filename from `assets/` or empty for random.

---

## 🔄 5. How the Generation Pipeline Works

```
1. Read config.json
       │
       ▼
2. Query Quran.com API v4 (Metadata, Uthmanic Text, Translations, Audio URLs)
       │
       ▼
3. Download / Cache Verse MP3s & Probe Exact Timings with ffprobe
       │
       ▼
4. Generate Styled ASS Subtitle File (Arabic Reshaped RTL + Header Banner + Translations)
       │
       ▼
5. Combine Audio Tracks with FFmpeg
       │
       ▼
6. Render 1080x1920 MP4 Video (Image + Dark Overlay + Subtitles + Audio)
       │
       ▼
7. Save to output/ directory & Clean Up Temp Files
```

---

## 💡 6. Questions for the AI / Brainstorming Partner

When presenting this document to an AI to generate new features, you can prompt with:

> *"Here is the current specification of my Quran Shorts video generator project. Based on this, please suggest:*
> 1. *Visual & animation enhancements (e.g., audio visualizers, word-by-word highlights, animated backgrounds, Ken Burns zoom effect, particle effects).*
> 2. *User interface & developer experience (e.g., Web dashboard/UI with real-time video preview, interactive CLI wizard, Discord/Telegram bot integration).*
> 3. *Social media & automation features (e.g., auto-generating SEO hashtags/titles/descriptions, batch generating entire Surahs into multiple 60s shorts, scheduled publishing).*
> 4. *Additional Quranic content features (e.g., Tafseer popups, Tajweed colored rules, word-by-word Arabic/English sync, repeat ayah loops for memorization).*
> 5. *Architectural & performance optimizations."*
