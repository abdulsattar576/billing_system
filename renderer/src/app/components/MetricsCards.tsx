import React from 'react';

interface Metric {
  title: string;
  value?: string;
  change?: string;
  trend?: 'up' | 'down';
  description?: string;
}

interface MetricCardProps extends Metric {}

const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value = 'Rs.0.00',
  change = '',
  trend = 'up',
  description = ''
}) => {
  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow duration-200">
      <div className="flex justify-between items-start mb-3">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
        </div>
        <span className={`text-xs font-semibold px-2 py-1 rounded Rs.{
          trend === 'up' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
        }`}>
          {change}
        </span>
      </div>
      <p className="text-xs text-gray-500 leading-relaxed">{description}</p>
    </div>
  );
};

const MetricsCards: React.FC<{ metrics?: Metric[] }> = ({ metrics }) => {
  const defaultMetrics: Metric[] = [
    {
      title: 'Monthly Revenue',
      value: '0.00',
      change: '',
      trend: 'up',
      description: 'Revenue collected this month'
    },
    {
      title: 'All-Time Revenue',
      value: 'Rs 0.00',
      change: '',
      trend: 'up',
      description: 'Total revenue to date'
    },
    {
      title: 'Active Areas',
      value: '0',
      change: '',
      trend: 'up',
      description: 'Number of active areas'
    },
    {
      title: 'Active Connections',
      value: '0',
      change: '',
      trend: 'up',
      description: 'Number of active connections'
    }
  ];

  const finalMetrics = defaultMetrics.map((def, i) => ({
    ...def,
    ...(metrics && metrics[i] ? metrics[i] : {})
  }));

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {finalMetrics.map((metric, index) => (
        <MetricCard key={index} {...metric} />
      ))}
    </div>
  );
};

export default MetricsCards;