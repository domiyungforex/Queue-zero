const required = ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET_NAME"];
const missing = required.filter((name) => !process.env[name]);
if (!process.argv.includes("--confirm") || missing.length) {
  console.error("Refusing to migrate images.");
  console.error(missing.length ? `Missing ${missing.join(", ")}.` : "Pass --confirm after the R2 bucket and a database backup exist.");
  console.error("This command never deletes existing photographs.");
  process.exit(1);
}
console.error("Migration was not started. Connect an authorized operator database session before copying objects. Source photographs must stay until retrieval is verified.");
process.exit(1);
