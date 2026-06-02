import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(resolve(here, "../2027special.html"), "utf8");

const checks = [
  ["mobile section navigation exists", 'class="mobile-jump"'],
  ["admission mobile card list exists", 'id="admissionCards"'],
  ["medical search input exists", 'id="medicalSearch"'],
  ["medical period filter exists", 'id="medicalPeriodFilter"'],
  ["medical region filter exists", 'id="medicalRegionFilter"'],
  ["medical mobile card list exists", 'id="medicalCards"'],
  ["self-check reset button exists", 'id="resetCheck"'],
  ["admission card renderer exists", "function renderAdmissionCards"],
  ["medical card renderer exists", "function renderMedicalCards"],
  ["selected university table shortcut exists", "function applyUniversityFilter"],
  ["mobile overflow protection exists", "overflow-x:hidden"],
];

const failures = checks.filter(([, needle]) => !html.includes(needle));

if (failures.length) {
  console.error("2027special verification failed:");
  for (const [label, needle] of failures) {
    console.error(`- ${label}: missing ${needle}`);
  }
  process.exit(1);
}

console.log(`2027special verification passed (${checks.length} checks).`);
