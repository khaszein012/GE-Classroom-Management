/**
 * CSV utilities — RFC-4180 parsing, escaping, browser download, and the
 * quiz-import mapping. No dependencies.
 */

/** Parse CSV text into rows of cells. Handles quoted fields with embedded
 *  commas, quotes and newlines, CRLF line endings, and a UTF-8 BOM. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  let i = 0;

  while (i < src.length) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      cell += ch;
      i += 1;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === ",") {
      row.push(cell);
      cell = "";
      i += 1;
      continue;
    }
    if (ch === "\r" && src[i + 1] === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      i += 2;
      continue;
    }
    if (ch === "\n" || ch === "\r") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      i += 1;
      continue;
    }
    cell += ch;
    i += 1;
  }
  row.push(cell);
  rows.push(row);
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

/** Escape one CSV field (quotes, commas, newlines). */
export function csvEscape(value: string | number | null | undefined | boolean): string {
  const s = value === null || value === undefined ? "" : String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Build a full CSV document (CRLF line endings for spreadsheet apps). */
export function toCsv(rows: (string | number | null | undefined | boolean)[][]): string {
  return rows.map((r) => r.map(csvEscape).join(",")).join("\r\n") + "\r\n";
}

/** Trigger a browser download of `rows` as a UTF-8 CSV (BOM for Excel). */
export function downloadCsv(filename: string, rows: (string | number | null | undefined | boolean)[][]): void {
  downloadText(filename, toCsv(rows));
}

/** Trigger a browser download of raw text (already CSV-formatted). */
export function downloadText(filename: string, text: string, mime = "text/csv;charset=utf-8"): void {
  const blob = new Blob(["\uFEFF" + text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ---------- Quiz import ----------

export interface QuizCsvQuestion {
  body: string;
  type: "multiple_choice" | "true_false";
  options: { body: string; isCorrect: boolean }[];
}

export const QUIZ_CSV_TEMPLATE =
  "question,type,option_a,option_b,option_c,option_d,option_e,correct\n" +
  '"What is 7 x 8?",mc,54,56,,,,b\n' +
  '"The Sun is a star.",tf,,,,,,true\n' +
  '"Which planet is red?",multiple_choice,Mars,Venus,,,,Mars\n';

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, "_");
}

/** Parse quiz CSV text into validated questions plus per-row error notes
 *  ("Row N: reason"). Valid rows are returned even when others fail. */
export function parseQuizCsv(text: string): { questions: QuizCsvQuestion[]; errors: string[] } {
  const rows = parseCsv(text);
  const questions: QuizCsvQuestion[] = [];
  const errors: string[] = [];
  if (rows.length === 0) {
    return { questions, errors: ["The file is empty."] };
  }

  const header = rows[0].map(normalizeHeader);
  const col = (...names: string[]) => {
    for (const n of names) {
      const idx = header.indexOf(n);
      if (idx >= 0) return idx;
    }
    return -1;
  };
  const qCol = col("question", "question_text", "questiontext", "body");
  const typeCol = col("type", "question_type");
  const correctCol = col("correct", "answer", "correct_answer", "correct_option");
  const optCols = ["a", "b", "c", "d", "e"].map((letter) =>
    col(`option_${letter}`, `options_${letter}`, `option${letter}`, letter),
  );

  if (qCol < 0 || correctCol < 0) {
    return {
      questions,
      errors: [
        "Missing required columns. The first row must include at least 'question' and 'correct' — download the template for the exact format.",
      ],
    };
  }

  for (let r = 1; r < rows.length; r++) {
    const rowNo = r + 1;
    const cells = rows[r];
    const get = (idx: number) => (idx >= 0 ? (cells[idx] ?? "").trim() : "");
    const body = get(qCol);
    const rawType = get(typeCol).toLowerCase();
    const correctRaw = get(correctCol);

    if (!body) {
      errors.push(`Row ${rowNo}: empty question text.`);
      continue;
    }

    const isTf = rawType === "tf" || rawType === "true_false" || rawType === "truefalse" || rawType === "t" || rawType === "true/false";
    const isMc = rawType === "" || rawType === "mc" || rawType === "multiple_choice" || rawType === "multiple" || rawType === "m";
    if (!isTf && !isMc) {
      errors.push(`Row ${rowNo}: unknown type "${rawType}" — use mc or tf.`);
      continue;
    }

    if (isTf) {
      // Options default to True/False unless the row supplies its own pair.
      let options = optCols.map(get).filter((o) => o !== "");
      if (options.length === 0) options = ["True", "False"];
      if (options.length !== 2) {
        errors.push(`Row ${rowNo}: true/false questions need exactly two options (or none — True/False is assumed).`);
        continue;
      }
      const key = correctRaw.toLowerCase();
      const idx =
        key === "a" ? 0 : key === "b" ? 1 :
        key === "true" || key === "t" ? options.findIndex((o) => o.toLowerCase() === "true") :
        key === "false" || key === "f" ? options.findIndex((o) => o.toLowerCase() === "false") :
        options.findIndex((o) => o.toLowerCase() === key);
      if (idx < 0) {
        errors.push(`Row ${rowNo}: correct answer must be true or false.`);
        continue;
      }
      questions.push({
        body,
        type: "true_false",
        options: options.map((o, i) => ({ body: o, isCorrect: i === idx })),
      });
      continue;
    }

    // Multiple choice
    const options = optCols.map(get).filter((o) => o !== "");
    if (options.length < 2 || options.length > 5) {
      errors.push(`Row ${rowNo}: multiple choice needs 2–5 non-empty options (found ${options.length}).`);
      continue;
    }
    const key = correctRaw.toLowerCase();
    let idx = ["a", "b", "c", "d", "e"].indexOf(key);
    if (idx >= options.length) idx = -1;
    if (idx < 0) {
      const matches = options.map((o, i) => (o.toLowerCase() === key ? i : -1)).filter((i) => i >= 0);
      if (matches.length === 1) idx = matches[0];
    }
    if (idx < 0) {
      errors.push(`Row ${rowNo}: correct answer "${correctRaw}" doesn't match any option (use a–e or the option text).`);
      continue;
    }
    questions.push({
      body,
      type: "multiple_choice",
      options: options.map((o, i) => ({ body: o, isCorrect: i === idx })),
    });
  }

  return { questions, errors };
}
