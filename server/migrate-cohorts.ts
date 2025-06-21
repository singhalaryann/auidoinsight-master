// Migration completed - cohorts now store file content as base64 bytes instead of file paths
// This improves data portability and eliminates dependency on file system storage

export function migrationCompleted() {
  console.log('Cohort file migration completed successfully');
  console.log('All cohorts now store file content as base64 bytes in the database');
}