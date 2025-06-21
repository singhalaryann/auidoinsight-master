import { executeBigQuery } from './bigquery';
import type { SnapshotMetric } from '@shared/schema';

function prepareQuery(metric: SnapshotMetric): string {
  let query = metric.sourceQuery;
  
  // Handle date filter clause
  if (metric.queryParams && typeof metric.queryParams === 'object' && 'date_filter_clause' in metric.queryParams) {
    const dateFilter = metric.queryParams.date_filter_clause as string;
    
    // Replace date placeholders with actual SQL date functions
    let processedDateFilter = dateFilter
      .replace(/TODAY/g, 'CURRENT_DATE()')
      .replace(/YESTERDAY/g, 'DATE_SUB(CURRENT_DATE(), INTERVAL 1 DAY)')
      .replace(/1W_AGO/g, 'DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)')
      .replace(/1M_AGO/g, 'DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)')
      .replace(/3M_AGO/g, 'DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY)')
      .replace(/6M_AGO/g, 'DATE_SUB(CURRENT_DATE(), INTERVAL 180 DAY)')
      .replace(/1Y_AGO/g, 'DATE_SUB(CURRENT_DATE(), INTERVAL 365 DAY)');
    
    // Replace the placeholder in the query
    query = query.replace(/\{\{date_filter_clause\}\}/g, processedDateFilter);
  }
  
  // Handle other placeholder replacements
  if (metric.queryParams && typeof metric.queryParams === 'object') {
    Object.entries(metric.queryParams).forEach(([key, value]) => {
      if (key !== 'date_filter_clause') {
        const placeholder = `{{${key}}}`;
        query = query.replace(new RegExp(placeholder, 'g'), String(value));
      }
    });
  }
  
  return query;
}

function transformResult(metric: SnapshotMetric, data: any[]): any {
  const config = metric.displayConfig as any;
  
  switch (metric.metricType) {
    case 'number':
      if (data.length === 0) {
        return {
          currentValue: 'N/A',
          displayName: config?.title || metric.name,
          deltaDisplay: '0%',
          deltaType: 'neutral',
          sparklineData: []
        };
      }
      
      const row = data[0];
      const value = Object.values(row)[0];
      
      return {
        currentValue: typeof value === 'number' ? value.toLocaleString() : String(value),
        displayName: config?.title || metric.name,
        deltaDisplay: '0%',
        deltaType: 'neutral',
        sparklineData: []
      };
      
    case 'number_comparison':
      if (data.length === 0) {
        return {
          currentValue: 'N/A',
          displayName: config?.title || metric.name,
          deltaDisplay: '0%',
          deltaType: 'neutral',
          sparklineData: []
        };
      }
      
      const comparisonRow = data[0];
      const currentValue = comparisonRow.currentValue || 0;
      const previousValue = comparisonRow.previousValue || 0;
      
      const percentChangeComp = previousValue > 0 ? ((currentValue - previousValue) / previousValue) * 100 : 0;
      const deltaTypeComp = percentChangeComp > 0 ? 'positive' : percentChangeComp < 0 ? 'negative' : 'neutral';
      
      return {
        currentValue: typeof currentValue === 'number' ? currentValue.toLocaleString() : String(currentValue),
        displayName: config?.title || metric.name,
        deltaDisplay: `${percentChangeComp >= 0 ? '+' : ''}${percentChangeComp.toFixed(1)}%`,
        deltaType: deltaTypeComp,
        sparklineData: []
      };
      
    case 'chart':
      if (data.length === 0) {
        return {
          currentValue: 'N/A',
          displayName: config?.title || metric.name,
          deltaDisplay: '0%',
          deltaType: 'neutral',
          sparklineData: [],
          chartData: []
        };
      }
      
      // Transform data for chart display
      const chartData = data.map(row => {
        const transformed: any = {};
        Object.entries(row).forEach(([key, value]) => {
          transformed[key] = value;
        });
        return transformed;
      });
      
      // Calculate current value from latest data point
      const latestValue = data[data.length - 1];
      const chartCurrentValue = Object.values(latestValue).find(v => typeof v === 'number') || 0;

      // Calculate delta from last two data points
      let percentChangeChart = 0;
      let deltaTypeChart = 'neutral';
      if (data.length >= 2) {
        const last = Object.values(data[data.length - 1]).find(v => typeof v === 'number') || 0;
        const prev = Object.values(data[data.length - 2]).find(v => typeof v === 'number') || 0;
        if (prev !== 0) {
          percentChangeChart = ((last - prev) / prev) * 100;
          deltaTypeChart = percentChangeChart > 0 ? 'positive' : percentChangeChart < 0 ? 'negative' : 'neutral';
        }
      }

      return {
        currentValue: typeof chartCurrentValue === 'number' ? chartCurrentValue.toLocaleString() : String(chartCurrentValue),
        displayName: config?.title || metric.name,
        deltaDisplay: `${percentChangeChart >= 0 ? '+' : ''}${percentChangeChart.toFixed(1)}%`,
        deltaType: deltaTypeChart,
        sparklineData: data.map(row => {
          const numericValue = Object.values(row).find(v => typeof v === 'number');
          return typeof numericValue === 'number' ? numericValue : 0;
        }).slice(-10), // Last 10 points for sparkline
        chartData,
        chartConfig: config
      };
      
    default:
      return {
        currentValue: 'N/A',
        displayName: config?.title || metric.name,
        deltaDisplay: '0%',
        deltaType: 'neutral',
        sparklineData: []
      };
  }
}

export async function processMetric(metric: SnapshotMetric): Promise<any> {
  try {
    const query = prepareQuery(metric);
    const data = await executeBigQuery(query);
    const result = transformResult(metric, data);
    
    return result;
  } catch (error) {
    console.error(`Error processing metric ${metric.name}:`, error);
    
    // Return fallback data structure
    const config = metric.displayConfig as any;
    return {
      currentValue: 'Error',
      displayName: config?.title || metric.name,
      deltaDisplay: 'N/A',
      deltaType: 'neutral',
      sparklineData: []
    };
  }
}