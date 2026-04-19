import { GoogleGenerativeAI, Part } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";
import { applyFilters, CsvFilters, getDefaultCSV } from "@/lib/csv";

const CLASS_CONTEXT = `
CLASS CONTEXT:
- City: Al Ain, UAE
- School: Al Dhaher Common New School
- Organization: ADEK (Abu Dhabi Department of Education and Knowledge)
- Grade: 6
- Subject: Mathematics
- Section: 06[General]/2
- Gender: Girls (all female students)
- Academic Year: 2025-26
- Total Students: 32
- Important note: 100% of students are English Language Learners (ELL) — this is critical when interpreting low scores on word-heavy or linguistically complex topics.
- Instructional Model: Adaptive Learning — students work on personalized targets based on ability levels.

DATA SCHEMA:
- Activity_type: Type of activity (INSTRUCTIONAL_LESSON, etc.)
- Material_type: CORE, etc.
- completion_node: Boolean (True/False) — "Completion" = finishing a graded assessment; videos/learn nodes often remain False even if viewed
- Student id: Unique student identifier (32 students)
- local_date: Date of activity (DD/MM/YYYY)
- Lesson title: Mathematical topic/activity name
- Attempt: Attempt number
- Score: Percentage grade (0-100), ONLY populated for Exit Tickets and "Check My Understanding" assessments
- Lesson_category: Category of lesson
- Lesson_type: Code (ET, DOK, Video, etc.)
- Lesson_type_name: Full name (Exit Ticket, Learn, Video, Explore & Learn, Check My Understanding, Second Look, Simulation, Unlock, Lesson, Assessment)
- Total time (sec): Duration student spent on activity
- Grade Gap: Distance between student's performance and Grade 6 standard (negative = below grade level)
- ADT Score: Score from diagnostic test at year beginning
- Proficiency Level: Below / Approaching / On Grade Level / Above level (from diagnostic test)
`;

const SYSTEM_PROMPT = `You are TOKI, an AI Data Analyst assistant built by Alef Education. If anyone asks who you are, who made you, or who built you, always respond that you are TOKI, an AI assistant built by Alef Education — never mention Gemini, Google, or any underlying model. You assist a teacher at ${CLASS_CONTEXT}

You have been given a CSV dataset of student learning activity data. Your role is to analyze it and answer the teacher's questions clearly and helpfully.

RESPONSE FORMAT:
You MUST respond with a valid JSON OBJECT (not an array) with exactly this shape: { "blocks": [ ...block objects... ] }
The top-level value MUST be an object with a "blocks" key. Do NOT return a bare array. Do NOT wrap the response in markdown. Each block has a "type" field and type-specific data.

Example of the correct shape:
{ "blocks": [ { "type": "text", "content": "..." }, { "type": "bar_chart", "title": "...", "data": [...], "dataKey": "value", "xKey": "name" } ] }

Available block types:
1. text: { type: "text", content: "string with your explanation or insight" }
2. table: { type: "table", title: "optional title", columns: ["col1","col2",...], rows: [[val1,val2,...], ...] }
3. bar_chart: { type: "bar_chart", title: "Chart Title", description: "brief description", data: [{name: "label", value: number}, ...], dataKey: "value", xKey: "name", colors: ["#1CC5C8",...] }
4. line_chart: { type: "line_chart", title: "Chart Title", description: "brief description", data: [{name: "label", value: number}, ...], dataKey: "value", xKey: "name" }
5. pie_chart: { type: "pie_chart", title: "Chart Title", description: "brief description", data: [{name: "label", value: number}, ...] }
6. radar_chart: { type: "radar_chart", title, description, data: [{axis: "Algebra", value: 72}, ...], axisKey: "axis", dataKey: "value" }
   - Multi-series variant: data: [{axis: "Algebra", group_a: 72, group_b: 85}, ...], axisKey: "axis", series: [{key: "group_a", label: "Below", color: "#EF4444"}, {key: "group_b", label: "On level", color: "#1CC5C8"}]
7. scatter_chart: { type: "scatter_chart", title, description, data: [{x: 320, y: 78, label: "3329946"}, ...], xKey: "x", yKey: "y", labelKey: "label", xLabel: "Time on task (s)", yLabel: "Score (%)" }
8. stacked_bar_chart: { type: "stacked_bar_chart", title, description, data: [{name: "Lesson A", completed: 22, in_progress: 6, not_started: 4}, ...], xKey: "name", series: [{key: "completed", label: "Completed", color: "#1CC5C8"}, ...] }
9. grouped_bar_chart: same shape as stacked_bar_chart — bars sit side-by-side instead of stacking
10. heatmap: { type: "heatmap", title, description, xAxis: ["Lesson 1", ...], yAxis: ["3329946", ...], cells: [{x: 0, y: 0, value: 78}, ...], valueRange: [0,100], colorScale: ["#EF4444","#F59E0B","#1CC5C8"] }
11. boxplot: { type: "boxplot", title, description, data: [{name: "Lesson A", min: 45, q1: 60, median: 72, q3: 85, max: 95, outliers: [30]}, ...] }
12. area_chart: { type: "area_chart", title, description, data, xKey, series?: [...] or dataKey: "value" } — use for cumulative or multi-series time trends
13. gauge: { type: "gauge", title, description, value: 78, max: 100, unit: "%" } — use for a single headline KPI

CHART SELECTION GUIDE:
- Radar: comparing 3+ dimensions across 1–2 entities (e.g., class strengths across skill categories; student vs class avg across subjects)
- Scatter: correlation / outlier discovery between two numeric variables (e.g., time-on-task vs score, ADT vs current score)
- Stacked bar: part-to-whole across categories (completion status per lesson)
- Grouped bar: side-by-side comparison (this week vs last week per student/lesson)
- Boxplot: distribution per group when median/spread/outliers matter more than the mean
- Heatmap: two-dimensional density, especially students × lessons (or dates)
- Area: cumulative totals over time (e.g., cumulative lessons completed)
- Gauge: single-number KPIs worth highlighting (class average, overall completion)

TEXT FORMATTING IN text BLOCKS:
- Use **bold** around key terms, student names, lesson titles, and important numbers
- Use ==highlight== around critical insights, warnings, or findings that need the teacher's immediate attention (e.g. ==5 students scored below 50%==)

RULES:
- Always start with a text block providing context or summary
- Use tables when showing student lists or detailed comparisons (max 15 rows for readability)
- Pick the chart that best fits the question per the CHART SELECTION GUIDE above — don't default to bar for everything
- Include 2-3 blocks maximum per response — be focused
- For scores, numbers in table rows should be raw numbers (e.g., 75 not "75%") — the UI handles formatting
- Column headers should be clear and concise (e.g., "Student ID", "Avg Score", "Completed")
- If data is empty or insufficient, explain clearly in a text block
- Keep insights actionable and teacher-friendly
- Consider the ELL context when analyzing word-heavy topics

COLORS to use (Alef brand palette): ["#1CC5C8", "#3B82F6", "#8B5CF6", "#F59E0B", "#EF4444", "#10B981", "#F97316"]

Respond ONLY with valid JSON. No markdown, no explanation outside the JSON.`;

export async function POST(req: NextRequest) {
  try {
    const { message, history, attachments, customCsv, filters, settings } = await req.json() as {
      message: string;
      history?: { role: string; content: string }[];
      attachments?: Array<{ mimeType: string; data: string }>;
      customCsv?: string;
      filters?: CsvFilters;
      settings?: { language?: string; detail?: string };
    };

    // Pick source CSV (uploaded > default), then apply filters
    const sourceCsv = (typeof customCsv === "string" && customCsv.trim().length > 0)
      ? customCsv
      : getDefaultCSV();
    const csvData = applyFilters(sourceCsv, filters);
    const filteredRowCount = Math.max(0, (csvData.split("\n").length - 1));
    const filterSummaryParts: string[] = [];
    if (filters?.dateFrom || filters?.dateTo) {
      filterSummaryParts.push(`dates ${filters.dateFrom || "…"} → ${filters.dateTo || "…"}`);
    }
    if (filters?.students?.length) filterSummaryParts.push(`${filters.students.length} student(s)`);
    if (filters?.lessons?.length) filterSummaryParts.push(`${filters.lessons.length} lesson(s)`);
    const filterSummary = filterSummaryParts.length
      ? `\n\nACTIVE FILTERS (data below is already scoped to): ${filterSummaryParts.join(", ")}. Rows after filtering: ${filteredRowCount}.`
      : "";
    const csvLabel = (typeof customCsv === "string" && customCsv.trim().length > 0)
      ? "TEACHER-UPLOADED CSV"
      : "CLASS CSV";

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        blocks: [{ type: "text", content: "⚠️ Gemini API key not configured. Please add GEMINI_API_KEY to your .env.local file." }],
      });
    }

    // Build per-request system instruction with teacher's settings
    const langInstruction = settings?.language === "Arabic"
      ? "\n\nOUTPUT LANGUAGE: Respond entirely in Arabic (العربية). All text blocks, chart titles, table headers, and descriptions must be in Arabic."
      : "\n\nOUTPUT LANGUAGE: Respond in English.";

    const detailInstruction = settings?.detail === "Brief"
      ? "\n\nLEVEL OF DETAIL: Be concise. Give only the key insight in 1–3 sentences. Prefer a single block. Skip lengthy explanations."
      : settings?.detail === "Detailed"
      ? "\n\nLEVEL OF DETAIL: Be thorough. Provide full analysis with context, reasoning, caveats, and actionable recommendations. Use 3–4 blocks when helpful."
      : "\n\nLEVEL OF DETAIL: Use standard detail — balanced explanation, 2–3 blocks, clear but not exhaustive.";

    const effectiveSystemPrompt = SYSTEM_PROMPT + langInstruction + detailInstruction;

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: process.env.GEMINI_MODEL || "gemini-3-flash-preview",
      systemInstruction: effectiveSystemPrompt,
      generationConfig: {
        responseMimeType: "application/json",
      },
    });

    // Build conversation history
    const historyFormatted = (history || []).slice(-8).map(
      (h: { role: string; content: string }) => ({
        role: h.role === "assistant" ? "model" : "user",
        parts: [{ text: h.content }],
      })
    );

    const chat = model.startChat({
      history: historyFormatted,
    });

    // Prepare the prompt with CSV data (truncated if needed)
    const csvLines = csvData?.split("\n") || [];
    const csvTruncated =
      csvLines.length > 500
        ? csvLines.slice(0, 500).join("\n") + "\n... [data truncated for context limit]"
        : csvData;

    const prompt = `Here is the ${csvLabel}:\n\n${csvTruncated}${filterSummary}\n\nTeacher's question: ${message}`;

    // Build multimodal parts: inline file data first, then the text prompt
    const attachmentList: Array<{ mimeType: string; data: string }> = attachments || [];
    const messageParts: Part[] = [
      ...attachmentList.map((a) => ({
        inlineData: { mimeType: a.mimeType, data: a.data },
      })),
      { text: prompt },
    ];

    // Stream the response token by token
    const result = await chat.sendMessageStream(messageParts);

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of result.stream) {
            const chunkText = chunk.text();
            if (chunkText) controller.enqueue(encoder.encode(chunkText));
          }
        } catch (e) {
          const errMsg = e instanceof Error ? e.message : "Stream error";
          controller.enqueue(encoder.encode(JSON.stringify({
            blocks: [{ type: "text", content: `Error: ${errMsg}` }],
          })));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error: unknown) {
    console.error("Chat API error:", error);
    const errMsg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({
      blocks: [{ type: "text", content: `Error: ${errMsg}` }],
    });
  }
}
