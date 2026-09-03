# 🕋 Quran Shorts & Reels MP4 Video Generator

A modern, high-performance vertical video generator for **Quran Shorts, Reels, and TikTok** powered by **Bun**, **TypeScript v7**, **Quran.com API v4**, and native **FFmpeg** rendering.

---

## ✨ Features

- **⚡ Blazing Fast**: Built with **Bun** and **TypeScript v7**.
- **📱 9:16 Vertical 1080x1920 MP4**: Clean, ready-to-upload MP4 files saved directly to `output/`.
- **📖 Quran.com API v4**: High-accuracy Arabic Uthmanic text with Harakat/Tashkeel, verse audio, and translations.
- **🎨 Beautiful Styling**:
  - Surah banner (Arabic & English name + Ayah numbers)
  - Reciter attribution tag
  - Arabic Uthmanic calligraphy text with verse end symbols (`۝`)
  - Synchronized English / multilingual translations
  - Dark vignette overlay for clear contrast on background photos
- **🎙️ Multi-Reciter Support**: Choose any reciter from Quran.com (e.g. Mishary Rashid Alafasy, Abdul Basit, Al-Husary, Al-Shatri, Al-Ghamdi, etc.).
- **🌐 Cross-Platform**: Works out of the box on Windows, macOS, and Linux without needing OS font installations or WebGL C++ compilation.

---

## 🚀 Quick Start

### 1. Requirements
- [Bun](https://bun.sh) (v1.0+)
- [FFmpeg](https://ffmpeg.org/) installed and available in your `PATH`.

### 2. Install Dependencies
```bash
bun install
```

### 3. Configure
Edit [`config.json`](file:///c:/Users/amerm/Desktop/quran-shorts-master/config.json) to select the Surah, verse range, reciter, and options:

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
  "translation_font_size": 34
}
```

### 4. Generate Video
```bash
bun start
```

Your rendered MP4 short will be saved to the `output/` directory (e.g. `output/Surah_001_Al-Fatihah_Ayah_1-7.mp4`).

---

## ⚙️ Configuration Reference

| Parameter | Type | Description |
| :--- | :--- | :--- |
| `surah` | `number` | Surah number (1 - 114) |
| `verse_start` | `number` | Starting verse number (1-indexed) |
| `verse_count` | `number` | Number of verses to include in the video |
| `reciter_id` | `number` | Reciter ID (`7` = Mishary Alafasy, `2` = Abdul Basit Murattal, `1` = Abdul Basit Mujawwad, `4` = Abu Bakr Al-Shatri, `6` = Mahmoud Khalil Al-Husary) |
| `translation_id` | `number` | Quran.com translation resource ID (`85` is the default) |
| `show_translation`| `boolean`| Whether to overlay translation subtitles |
| `background` | `string` | *(Optional)* Specify a filename in `assets/`, or leave empty for a random background |
| `output_dir` | `string` | Folder where generated `.mp4` videos are saved (`"output"`) |

---

## 📜 License
MIT
