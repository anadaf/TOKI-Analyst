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

const SYSTEM_PROMPT = `You are an AI Data Analyst assistant for a teacher at ${CLASS_CONTEXT}

You have been given a CSV dataset of student learning activity data. Your role is to analyze it and answer the teacher's questions clearly and helpfully.

RESPONSE FORMAT:
You MUST respond with a valid JSON object containing a "blocks" array. Each block has a "type" field and type-specific data.

Available block types:
1. text: { type: "text", content: "string with your explanation or insight" }
2. table: { type: "table", title: "optional title", columns: ["col1","col2",...], rows: [[val1,val2,...], ...] }
3. bar_chart: { type: "bar_chart", title: "Chart Title", description: "brief description", data: [{name: "label", value: number}, ...], dataKey: "value", xKey: "name", colors: ["#1CC5C8",...] }
4. line_chart: { type: "line_chart", title: "Chart Title", description: "brief description", data: [{name: "label", value: number}, ...], dataKey: "value", xKey: "name" }
5. pie_chart: { type: "pie_chart", title: "Chart Title", description: "brief description", data: [{name: "label", value: number}, ...] }

RULES:
- Always start with a text block providing context or summary
- Use tables when showing student lists or detailed comparisons (max 15 rows for readability)
- Use bar charts for comparisons across categories (e.g., scores by topic, students by proficiency)
- Use line charts for trends over time
- Use pie charts for distributions (e.g., proficiency breakdown, completion rates)
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
    const { message, history, attachments, customCsv, filters } = await req.json() as {
      message: string;
      history?: { role: string; content: string }[];
      attachments?: Array<{ mimeType: string; data: string }>;
      customCsv?: string;
      filters?: CsvFilters;
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

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: process.env.GEMINI_MODEL || "gemini-3-flash-preview",
      systemInstruction: SYSTEM_PROMPT,
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

    const result = await chat.sendMessage(messageParts);
    const text = result.response.text().trim();

    if (!text) {
      return NextResponse.json({
        blocks: [{ type: "text", content: "I wasn't able to generate a response for that question. Please try rephrasing or ask a more specific question about the class data." }],
      });
    }

    // Parse JSON response
    let parsed;
    try {
      // Strip markdown code blocks if present
      const clean = text.replace(/^```json\n?/, "").replace(/\n?```$/, "").trim();
      parsed = JSON.parse(clean);
    } catch {
      // Fallback: return as text block
      parsed = { blocks: [{ type: "text", content: text }] };
    }

    if (!parsed?.blocks || !Array.isArray(parsed.blocks) || parsed.blocks.length === 0) {
      parsed = { blocks: [{ type: "text", content: text || "No response generated." }] };
    }

    return NextResponse.json(parsed);
  } catch (error: unknown) {
    console.error("Chat API error:", error);
    const errMsg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({
      blocks: [{ type: "text", content: `Error: ${errMsg}` }],
    });
  }
}
