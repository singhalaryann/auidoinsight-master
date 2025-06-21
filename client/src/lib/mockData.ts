// Mock analytics data for demonstration
export const mockAnalyticsData = {
  engagement: {
    chartData: [
      { name: 'Mon', value: 125.4 },
      { name: 'Tue', value: 132.1 },
      { name: 'Wed', value: 128.9 },
      { name: 'Thu', value: 145.2 },
      { name: 'Fri', value: 141.8 },
      { name: 'Sat', value: 118.3 },
      { name: 'Sun', value: 122.7 }
    ],
    insight: "DAU increased 12.5% this week. Feature adoption remains strong at 73%.",
    metrics: [
      { label: "Daily Active Users", value: "125.4K", change: 12.5 },
      { label: "Session Duration", value: "8m 42s", change: 5.2 },
      { label: "Feature Adoption", value: "73%", change: -2.1 }
    ],
    primary: { label: "Daily Active Users", value: "125.4K", change: 12.5 }
  },
  
  retention: {
    chartData: [
      { name: 'Week 1', value: 85.2 },
      { name: 'Week 2', value: 72.8 },
      { name: 'Week 3', value: 65.4 },
      { name: 'Week 4', value: 58.9 },
      { name: 'Week 5', value: 53.1 },
      { name: 'Week 6', value: 48.7 },
      { name: 'Week 7', value: 45.2 }
    ],
    insight: "Week 1 retention down 8% vs last month. Day 3 onboarding critical.",
    metrics: [
      { label: "1-Week Retention", value: "85.2%", change: -8.0 },
      { label: "1-Month Retention", value: "45.2%", change: -3.2 },
      { label: "Churn Rate", value: "14.8%", change: 8.0 }
    ],
    primary: { label: "1-Week Retention", value: "85.2%", change: -8.0 }
  },
  
  monetization: {
    chartData: [
      { name: 'Jan', value: 847 },
      { name: 'Feb', value: 892 },
      { name: 'Mar', value: 921 },
      { name: 'Apr', value: 879 },
      { name: 'May', value: 934 },
      { name: 'Jun', value: 1002 },
      { name: 'Jul', value: 1087 }
    ],
    insight: "Monthly revenue grew 18.3% with strong ARPU improvement to $24.50.",
    metrics: [
      { label: "Monthly Revenue", value: "$847K", change: 18.3 },
      { label: "ARPU", value: "$24.50", change: 3.1 },
      { label: "Conversion Rate", value: "4.2%", change: -0.3 }
    ],
    primary: { label: "Monthly Revenue", value: "$847K", change: 18.3 }
  },
  
  store: {
    chartData: [
      { name: 'Mon', value: 124 },
      { name: 'Tue', value: 118 },
      { name: 'Wed', value: 142 },
      { name: 'Thu', value: 156 },
      { name: 'Fri', value: 189 },
      { name: 'Sat', value: 203 },
      { name: 'Sun', value: 167 }
    ],
    insight: "Weekly sales up 22% driven by weekend promotions and new product launches.",
    metrics: [
      { label: "Weekly Sales", value: "$124K", change: 22.0 },
      { label: "Avg Order Value", value: "$87.50", change: 8.3 },
      { label: "Cart Conversion", value: "12.4%", change: 2.1 }
    ],
    primary: { label: "Weekly Sales", value: "$124K", change: 22.0 }
  },
  
  ua: {
    chartData: [
      { name: 'Mon', value: 2.8 },
      { name: 'Tue', value: 3.1 },
      { name: 'Wed', value: 2.9 },
      { name: 'Thu', value: 3.4 },
      { name: 'Fri', value: 3.8 },
      { name: 'Sat', value: 2.6 },
      { name: 'Sun', value: 2.3 }
    ],
    insight: "User acquisition increased 15% today with strong performance from social channels.",
    metrics: [
      { label: "New Users Today", value: "2.8K", change: 15.0 },
      { label: "CAC", value: "$12.50", change: -8.2 },
      { label: "Organic %", value: "42%", change: 5.1 }
    ],
    primary: { label: "New Users Today", value: "2.8K", change: 15.0 }
  },
  
  techHealth: {
    chartData: [
      { name: '00:00', value: 99.9 },
      { name: '04:00', value: 99.8 },
      { name: '08:00', value: 99.9 },
      { name: '12:00', value: 99.7 },
      { name: '16:00', value: 99.9 },
      { name: '20:00', value: 99.8 },
      { name: '24:00', value: 99.9 }
    ],
    insight: "System health excellent with 99.9% uptime. All services operating normally.",
    metrics: [
      { label: "Uptime", value: "99.9%", change: 0.1 },
      { label: "Response Time", value: "245ms", change: -12.3 },
      { label: "Error Rate", value: "0.02%", change: -15.8 }
    ],
    primary: { label: "Uptime", value: "99.9%", change: 0.1 }
  },
  
  social: {
    chartData: [
      { name: 'Mon', value: 892 },
      { name: 'Tue', value: 734 },
      { name: 'Wed', value: 1023 },
      { name: 'Thu', value: 987 },
      { name: 'Fri', value: 1156 },
      { name: 'Sat', value: 1289 },
      { name: 'Sun', value: 1043 }
    ],
    insight: "Social sharing increased 8% this week with viral content driving engagement.",
    metrics: [
      { label: "Shares Today", value: "892", change: 8.0 },
      { label: "Viral Coefficient", value: "1.2", change: 12.5 },
      { label: "Social Traffic", value: "18%", change: 3.4 }
    ],
    primary: { label: "Shares Today", value: "892", change: 8.0 }
  }
};
