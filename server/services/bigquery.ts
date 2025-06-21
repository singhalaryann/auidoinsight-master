import { BigQuery } from '@google-cloud/bigquery';

let bigQueryClient: BigQuery | null = null;

function initializeBigQuery() {
  if (bigQueryClient) {
    return bigQueryClient;
  }

  const projectId = process.env.BQ_PROJECT_ID;
  const privateKey = process.env.BQ_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const clientEmail = process.env.BQ_CLIENT_EMAIL;

  if (!projectId || !privateKey || !clientEmail) {
    throw new Error('BigQuery credentials not found in environment variables');
  }

  bigQueryClient = new BigQuery({
    projectId,
    credentials: {
      private_key: privateKey,
      client_email: clientEmail,
    },
  });

  return bigQueryClient;
}

export async function executeBigQuery(query: string): Promise<any[]> {
  try {
    const bigquery = initializeBigQuery();
    console.log('Executing BigQuery query:', query.substring(0, 100) + '...');
    
    const [job] = await bigquery.createQueryJob({
      query,
      location: 'US',
    });

    const [rows] = await job.getQueryResults();
    console.log(`BigQuery returned ${rows.length} rows`);
    
    return rows;
  } catch (error) {
    console.error('BigQuery execution error:', error);
    throw error;
  }
}