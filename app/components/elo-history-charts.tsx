import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  type ELOLog,
  type TeamELOLog,
  type TeamPlayerELOLog,
} from '@prisma/client';
import { BASE_ELO } from '~/utils/constants';
import { useWindowSize } from '~/utils/hooks/use-window-size';
import { useState } from 'react';
import { ToggleSwitch } from '~/components/toggle-switch';

const formatSimpleDate = (date: string) => {
  return new Date(date).toLocaleString('no-NO', {
    month: '2-digit',
    day: '2-digit',
  });
};

const formatDateWithTime = (date: string) => {
  return new Date(date).toLocaleString('no-NO', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatDateOnly = (date: string) => {
  return new Date(date).toLocaleString('no-NO', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
};

const aggregateByDay = (data: any[]) => {
  if (data.length === 0) return [];

  // First, group by day as before
  const groupedByDay = data.reduce((acc, item) => {
    const date = new Date(item.date);
    const dayKey = new Date(date.getFullYear(), date.getMonth(), date.getDate())
      .toISOString()
      .split('T')[0];

    if (!acc[dayKey]) {
      acc[dayKey] = { date: dayKey, elos: [] };
    }
    acc[dayKey].elos.push(item.elo);
    return acc;
  }, {});

  // Find start date and use today as end date
  const dates = Object.keys(groupedByDay).sort();
  const startDate = new Date(dates[0]);
  const endDate = new Date(); // Use today's date
  endDate.setHours(23, 59, 59, 999); // Set to end of today

  // Fill in all days from start until today
  const filledData = [];
  let currentDate = new Date(startDate);
  let lastKnownElo = BASE_ELO;

  while (currentDate <= endDate) {
    const dateKey = currentDate.toISOString().split('T')[0];
    const dayData = groupedByDay[dateKey];

    if (dayData) {
      // Calculate average ELO for days with matches
      const avgElo = Math.round(
        dayData.elos.reduce((sum: number, elo: number) => sum + elo, 0) /
          dayData.elos.length
      );
      lastKnownElo = avgElo;
      filledData.push({
        date: dateKey,
        elo: avgElo,
        hasMatches: true,
      });
    } else {
      // Use last known ELO for days without matches
      filledData.push({
        date: dateKey,
        elo: lastKnownElo,
        hasMatches: false,
      });
    }

    // Move to next day
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return filledData;
};

interface Props {
  data: ELOLog[] | TeamELOLog[] | TeamPlayerELOLog[];
}

const CustomTooltip = ({ active, payload, showDailyView }: any) => {
  if (active && payload && payload.length) {
    const date = payload[0].payload.date;
    const formattedDate = showDailyView
      ? formatDateOnly(date)
      : formatDateWithTime(date);

    return (
      <div className="rounded-lg border border-gray-700 bg-gray-800/95 p-2 text-sm shadow-lg sm:p-3 sm:text-base">
        <p className="text-xs text-gray-200 sm:text-sm">{formattedDate}</p>
        <p className="text-base font-semibold text-white sm:text-lg">
          ELO: {payload[0].value}
        </p>
      </div>
    );
  }
  return null;
};

export const EloHistoryChart = ({ data }: Props) => {
  const [showDailyView, setShowDailyView] = useState(false);
  const { width } = useWindowSize();
  const isMobile = width ? width < 640 : false;

  const processedData = showDailyView ? aggregateByDay(data) : data;

  const massagedData =
    processedData.length > 0
      ? [
          {
            date: new Date(
              new Date(processedData[0].date).getTime() - 5 * 60000
            ).toISOString(),
            elo: BASE_ELO,
          },
          ...processedData,
        ].map((item) => ({
          date: item.date,
          displayDate: formatSimpleDate(item.date.toString()),
          elo: item.elo,
          hasMatches: 'hasMatches' in item ? item.hasMatches : false,
        }))
      : [];

  const minElo = Math.min(...data.map((d) => d.elo));
  const maxElo = Math.max(...data.map((d) => d.elo));

  const yAxisDomain = [minElo - 50, maxElo + 50];

  const axisColor = '#94a3b8';

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <ToggleSwitch
          checked={showDailyView}
          onChange={setShowDailyView}
          label="Vis ELO-endring per dag"
        />
      </div>
      <ResponsiveContainer width="100%" height={isMobile ? 200 : 300}>
        <LineChart data={massagedData}>
          <defs>
            <linearGradient id="eloColor" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="rgba(255, 255, 255, 0.1)"
            vertical={false}
          />
          <XAxis
            dataKey="displayDate"
            tick={{ fill: axisColor, fontSize: isMobile ? 10 : 12 }}
            tickLine={{ stroke: axisColor }}
            stroke={axisColor}
            angle={isMobile ? -45 : 0}
            textAnchor={isMobile ? 'end' : 'middle'}
            height={isMobile ? 60 : 30}
          />
          <YAxis
            domain={yAxisDomain}
            tick={{ fill: axisColor, fontSize: isMobile ? 10 : 12 }}
            tickLine={{ stroke: axisColor }}
            stroke={axisColor}
            width={isMobile ? 30 : 40}
          />
          <Tooltip
            content={(props) => (
              <CustomTooltip {...props} showDailyView={showDailyView} />
            )}
            wrapperStyle={{ zIndex: 1000 }}
          />
          <Legend wrapperStyle={{ color: axisColor }} />
          <Line
            type="monotone"
            dataKey="elo"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 6, fill: '#3b82f6', stroke: '#fff' }}
            fill="url(#eloColor)"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};
