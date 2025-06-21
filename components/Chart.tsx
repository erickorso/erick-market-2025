
import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { ChartDataPoint } from '../types';

interface StockChartProps {
  data: ChartDataPoint[];
  lineColor?: string;
}

const StockChart: React.FC<StockChartProps> = ({ data, lineColor = "#8884d8" }) => {
  if (!data || data.length === 0) {
    return <div className="text-center p-4 text-gray-500">No chart data available.</div>;
  }

  // Ensure price is a number
  const formattedData = data.map(d => ({...d, price: Number(d.price)}));

  return (
    <div style={{ width: '100%', height: 200 }} className="bg-gray-800 p-2 rounded-lg shadow">
      <ResponsiveContainer>
        <LineChart
          data={formattedData}
          margin={{
            top: 5, right: 10, left: -25, bottom: 5, // Adjusted left margin for YAxis visibility
          }}
        >
          <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
          <XAxis dataKey="name" stroke="#9ca3af" fontSize={10} />
          <YAxis stroke="#9ca3af" fontSize={10} domain={['dataMin - 1', 'dataMax + 1']} />
          <Tooltip 
            contentStyle={{ backgroundColor: 'rgba(31, 41, 55, 0.9)', border: '1px solid #4b5563', borderRadius: '0.375rem' }}
            labelStyle={{ color: '#e5e7eb', fontWeight: 'bold' }}
            itemStyle={{ color: lineColor }}
          />
          <Legend wrapperStyle={{ fontSize: '12px' }} />
          <Line type="monotone" dataKey="price" stroke={lineColor} strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 5 }} name="Price" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default StockChart;
    