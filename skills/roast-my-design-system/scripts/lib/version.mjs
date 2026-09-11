// Single version constant for the engine — imported by diagnose (report
// footer) and rules (generated-by line). This is the bump spot that used to
// live as a const inside diagnose/index.mjs.
export const VERSION = '7.1.0';
// The shape of harvest.json and summary.json. Bumped only when a field is
// renamed, removed or changes meaning; a new field is not a new schema. A
// tool comparing two scans compares like with like by this number, not by VERSION.
export const SCHEMA_VERSION = 1;
