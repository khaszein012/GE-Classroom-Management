/* Parser sanity test — bundled with esbuild (see run command in conversation). */
import { parseCsv, parseQuizCsv, toCsv, csvEscape, QUIZ_CSV_TEMPLATE } from "../src/lib/csv";

let failures = 0;
const expect = (name, cond, detail = "") => {
  if (!cond) {
    failures += 1;
    console.error(`✗ ${name} ${detail}`);
  } else {
    console.log(`✓ ${name}`);
  }
};

// parseCsv basics
const parsed = parseCsv('a,b,"c, with comma"\r\n"x""y",,z\n');
expect("quoted comma cell", JSON.stringify(parsed[0]) === JSON.stringify(["a", "b", "c, with comma"]), JSON.stringify(parsed[0]));
expect("escaped quotes + LF ending", parsed[1][0] === 'x"y' && parsed[1][2] === "z", JSON.stringify(parsed[1]));
expect("BOM stripped", parseCsv("\uFEFFquestion,type")[0][0] === "question");
expect("empty lines dropped", parseCsv("a,b\n\n  \nc,d").length === 2);

// parseQuizCsv — the template itself
const t = parseQuizCsv(QUIZ_CSV_TEMPLATE);
expect("template imports 3 questions", t.questions.length === 3 && t.errors.length === 0, JSON.stringify(t.errors));

// 30-question bulk file with edge cases
const bulk = [
  "question,type,option_a,option_b,option_c,option_d,option_e,correct",
  ...Array.from({ length: 30 }, (_, i) =>
    i % 3 === 2
      ? `"Question ${i} with, comma?",tf,,,,,,${i % 2 ? "false" : "true"}`
      : `"Question ${i}",mc,Opt A${i},Opt B${i},,,,${i % 2 ? "Opt B" + i : "a"}`,
  ),
  // three bad rows
  '"Empty options",mc,,,,,a',        // 1 option → error
  '"No correct match",mc,X,Y,,,zzz', // correct resolves to nothing
  '"Bad type",essay,X,Y,,,a',        // unknown type
].join("\n");
const b = parseQuizCsv(bulk);
expect("bulk imports 30 valid", b.questions.length === 30, `got ${b.questions.length}`);
expect("3 bad rows reported", b.errors.length === 3, JSON.stringify(b.errors));
expect("errors cite row numbers", b.errors.every((e) => /^Row \d+:/.test(e)), JSON.stringify(b.errors));

// tf defaults + correct mapping
const tf = b.questions.find((q) => q.body.startsWith("Question 2,") === false && q.type === "true_false");
expect("tf True/False assumed", b.questions.some((q) => q.type === "true_false" && q.options[0].body === "True" && q.options[1].body === "False"));
const tfTrue = b.questions.filter((q) => q.type === "true_false");
expect("tf correct flags set", tfTrue.every((q) => q.options.filter((o) => o.isCorrect).length === 1));

// mc correct-by-text and by-letter (i=1 is odd MC → text; i=0 even MC → letter)
const byText = b.questions.find((q) => q.options.some((o) => o.isCorrect && o.body === "Opt B1"));
expect("correct by option text", !!byText);
const byLetter = b.questions.find((q) => q.options.some((o) => o.isCorrect && o.body === "Opt A0"));
expect("correct by letter", !!byLetter);

// missing header
const noHeader = parseQuizCsv("What is 2+2?,mc,3,4,,,b\n");
expect("missing header rejected with guidance", noHeader.questions.length === 0 && noHeader.errors[0].includes("columns"), noHeader.errors[0]);

// round-trip escaping
expect("escape quotes/commas", csvEscape('He said "hi", ok') === '"He said ""hi"", ok"');
expect("toCsv CRLF", toCsv([["a", "b"], ["c", "d"]]) === "a,b\r\nc,d\r\n");

console.log(failures === 0 ? "\nALL CSV PARSER TESTS PASSED" : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
