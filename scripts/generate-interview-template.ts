/**
 * Generates a blank INTERVIEW_TEMPLATE.docx in /docs.
 * Run with: npx tsx scripts/generate-interview-template.ts
 */
import fs from "fs";
import path from "path";
import { generateInterviewDocx, type InterviewResponses } from "../src/lib/interview-docx";

const BLANK: InterviewResponses = {
  interviewee_name: "",
  department: "[Department]",
  interviewee_role: "",
  interviewer: "",
  interview_date: "",
  quote_to_cash: { flow: "", manual_steps: "", collection_tracking: "", delays_errors: "" },
  people: { team_size: "", key_roles: "", skill_gaps: "", coverage_when_out: "" },
  data: { what_is_tracked: "", where_it_lives: "", how_decisions_made: "", wish_had: "" },
  processes: { core_workflows: "", manual_that_should_be_automated: "", falls_through_cracks: "", how_new_people_learn: "" },
  communication: { meeting_cadence: "", reporting_to_leadership: "", tools_used: "", cross_dept_handoffs: "" },
  issues: { biggest_frustration: "", slows_team_down: "", breaks_regularly: "", leadership_misunderstands: "" },
  dreams: { magic_wand: "", ideal_day: "", done_right: "" },
  must_haves: { must_have_1: "", must_have_2: "" },
  tools: { daily_tools: "", love_about_current: "", hate_about_current: "", wish_had: "" },
};

async function main() {
  const buffer = await generateInterviewDocx(BLANK, "[Organization]");
  const outPath = path.resolve(__dirname, "../docs/INTERVIEW_TEMPLATE.docx");
  fs.writeFileSync(outPath, buffer);
  console.log(`✓ Written: ${outPath}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
