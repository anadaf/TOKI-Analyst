# TOKI Analyst

An AI-powered data analysis chat application for teachers, built with Next.js and Google Generative AI. TOKI Analyst helps educators analyze classroom data, generate insights, and create visual reports with minimal effort.

## Features

- 📊 **AI-Powered Analysis**: Ask natural language questions about your class data; get AI-generated insights, tables, and charts
- 📁 **CSV Upload**: Import your own class data or use the bundled demo dataset
- 🎯 **Smart Filtering**: Scope analysis to specific date ranges, students, or lessons
- 🎤 **Voice Input**: Dictate questions using Web Speech API (continuous mode with interim results)
- 📥 **File Attachments**: Upload PDFs and images for Gemini to analyze alongside your data
- 📊 **Multiple Chart Types**: Bar charts, line/area charts, and pie charts with value labels
- 💾 **Download Results**: Export tables as CSV or charts as PNG (retina-quality at 2× pixel ratio)
- 💬 **Chat History**: Persistent conversation history with localStorage

## Prerequisites

- **Node.js**: 18.x or later
- **npm**: 9.x or later
- **Google API Key**: Get one from [Google AI Studio](https://aistudio.google.com/app/apikey)
- **Modern Browser**: Chrome 85+, Safari 14.1+, Edge 85+ (for Web Speech API support)

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/anadaf/TOKI-Analyst.git
cd TOKI-Analyst
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Environment Variables

Create a `.env.local` file in the project root:

```bash
echo "GOOGLE_API_KEY=your_api_key_here" > .env.local
```

Replace `your_api_key_here` with your actual Google API key from [Google AI Studio](https://aistudio.google.com/app/apikey).

**Optional**: To use a different Gemini model, add:

```bash
GEMINI_MODEL=gemini-3-flash-preview
```

Default: `gemini-3-flash-preview` (recommended for analytical tasks)

### 4. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage Guide

### Asking Questions

1. **Welcome Screen**: Choose a suggestion chip or type a custom question
2. **Natural Language**: Ask anything about your class data:
   - "Which students are struggling the most?"
   - "Show me a bar chart of average scores by lesson"
   - "Create a proficiency breakdown pie chart"

### Uploading Data

- **CSV**: Click the paperclip icon, select a `.csv` file with your class data
  - Expected columns: `Student id`, `local_date` (DD/MM/YYYY), `Lesson title`, and any score/proficiency columns
  - The app caches the CSV in memory; reload to use the bundled demo data again
- **PDF/Images**: Click the paperclip icon to attach PDFs or images for Gemini to analyze alongside your data

### Filtering Results

1. Click the **filter icon** (top right)
2. **Date Range**: Select from/to dates (optional)
3. **Students**: Search and select specific student IDs (optional)
4. **Lessons**: Search and select specific lesson titles (optional)
5. Click **Apply**

Filter pills appear below the title bar. Click the × on any pill to remove that filter without reopening the panel.

### Using Voice Input

1. Click the **microphone icon** in the input bar
2. **Grant Permission** if prompted by your browser
3. **Speak Naturally**: The app captures continuous speech with interim results shown in grey
4. **Release** or press Enter to send your question

**Note**: Voice input requires HTTPS or `localhost` (due to browser security policies)

### Downloading Results

- **Tables**: Click the **download icon** in the top-right of any table card → downloads as `.csv`
- **Charts**: Click the **download icon** in the top-right of any chart card → downloads as `.png` (retina-sharp)

Filenames include the block title and today's date, e.g., `Top-5-Students-by-Score-2026-04-17.csv`

## Project Structure

```
├── app/
│   ├── page.tsx              # Main chat interface & state management
│   ├── layout.tsx            # Root layout with sidebar
│   ├── globals.css           # Global styles
│   └── api/
│       ├── chat/route.ts     # AI inference endpoint (Gemini)
│       └── metadata/route.ts # CSV metadata endpoint (filters, date range)
├── components/
│   ├── ChatMessage.tsx       # Chat bubble renderer (tables, charts, text)
│   ├── FilterPanel.tsx       # Scoping filters (date, students, lessons)
│   ├── Sidebar.tsx           # Navigation sidebar
│   └── TopNav.tsx            # Title bar
├── lib/
│   ├── csv.ts                # CSV parsing, filtering, metadata extraction
│   └── export.ts             # Table→CSV and chart→PNG download utilities
├── public/
│   ├── data/classroom.csv    # Demo class data (32 students, 6 months)
│   ├── toki.png              # AI avatar
│   └── alef-logo.png         # Alef branding
└── README.md                 # This file
```

## Technology Stack

- **Frontend**: Next.js 14 (App Router), React 18, TypeScript
- **Styling**: Tailwind CSS + inline styles
- **Charts**: Recharts (bar, line/area, pie charts with recharts labels)
- **AI**: Google Generative AI SDK (Gemini 3-Flash)
- **State Management**: React hooks (useState, useContext)
- **Voice**: Web Speech API
- **Storage**: localStorage (chat history, CSV filename, filters)
- **Data Export**: html-to-image (PNG), native CSV serialization

## API & Generative AI Configuration

### Chat Endpoint (`/api/chat`)

**Request**:
```json
{
  "message": "Which students are struggling?",
  "customCsv": "...",
  "filters": {
    "dateFrom": "2026-03-01",
    "dateTo": "2026-03-31",
    "students": ["3329946", "3330594"],
    "lessons": ["Understanding Percents"]
  }
}
```

**Response**:
```json
{
  "blocks": [
    {
      "type": "text",
      "content": "Based on the data..."
    },
    {
      "type": "bar_chart",
      "title": "Average Scores by Lesson",
      "data": [{ "name": "Lesson A", "value": 85 }, ...],
      "colors": ["#1CC5C8", "#3B82F6", ...]
    }
  ]
}
```

**Supported Block Types**:
- `text`: Plain markdown text
- `table`: `{ columns: string[], rows: (string|number)[][] }`
- `bar_chart`: Bar chart with value labels
- `line_chart`: Line chart (rendered as Area chart with gradient fill + labels)
- `pie_chart`: Donut chart with percentage labels and legend

### Gemini Model

- **Default**: `gemini-3-flash-preview` (fast, analytical reasoning)
- **Recommended**: Use `gemini-3-flash-preview` for best balance of speed and quality
- **Legacy**: `gemini-2.0-flash` is deprecated (EOL: June 1, 2026)

To change models, update `GEMINI_MODEL` in `.env.local`.

## Browser Compatibility

| Feature | Chrome | Safari | Edge | Firefox |
|---------|--------|--------|------|---------|
| Core Chat | ✅ | ✅ | ✅ | ✅ |
| Voice Input | ✅ (desktop) | ⚠️ (iOS 14.5+) | ✅ | ❌ |
| Charts | ✅ | ✅ | ✅ | ✅ |
| File Upload | ✅ | ✅ | ✅ | ✅ |

**Voice Input Notes**:
- Requires HTTPS or localhost
- Mobile Safari (iOS) requires user gesture to start recording
- Firefox does not support Web Speech API

## Common Issues & Solutions

### "Microphone access blocked"
- **Solution**: Check browser settings > Permissions > Microphone. Allow `localhost:3000` and reload.

### "No chart appears, only text"
- **Solution**: Gemini may not have generated structured blocks. Try asking more specifically: "Show me a bar chart of..." instead of "Analyze the scores"

### CSV upload shows "Re-upload" message after reload
- **Solution**: This is expected—CSV data is not persisted (too large for localStorage). Just re-upload your CSV.

### Charts look pixelated
- **Solution**: Ensure download resolution is 2× (`pixelRatio: 2`). Charts download at retina quality.

## Development

### Environment Variables

```bash
# Required
GOOGLE_API_KEY=sk-...

# Optional
GEMINI_MODEL=gemini-3-flash-preview  # or gemini-3-flash, gemini-2.0-flash, etc.
```

### Scripts

```bash
npm run dev      # Start dev server (http://localhost:3000)
npm run build    # Build for production
npm start        # Start production server
npm run lint     # Run ESLint
```

### Code Quality

- **TypeScript**: Strict mode enabled
- **Linting**: ESLint configured for Next.js + React
- **Formatting**: Prettier (configured)

Run `npm run lint` to check for issues.

## Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Visit [vercel.com](https://vercel.com) and import the repository
3. Add `GOOGLE_API_KEY` to environment variables
4. Deploy

### Docker

```bash
docker build -t toki-analyst .
docker run -e GOOGLE_API_KEY=sk-... -p 3000:3000 toki-analyst
```

## License

MIT

## Support

For issues or questions, open an issue on [GitHub](https://github.com/anadaf/TOKI-Analyst/issues).
