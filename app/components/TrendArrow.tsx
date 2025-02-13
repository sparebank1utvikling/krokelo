export const TrendArrow = ({ trend }: { trend: number }) => {
  if (trend >= 100) {
    return (
      <span
        title={`+${trend}`}
        className="text-sm text-[#00754E] dark:text-[#45B08C]"
      >
        ↑&nbsp;+{trend}
      </span>
    );
  }
  if (trend > 0) {
    return (
      <span
        title={`+${trend}`}
        className="text-sm text-[#1D9E74] dark:text-[#90E0C5]"
      >
        ↗&nbsp;+{trend}
      </span>
    );
  }
  if (trend == 0) {
    return (
      <span
        title={trend.toString()}
        className="text-sm text-black dark:text-white"
      >
        -
      </span>
    );
  }
  if (trend >= -100) {
    return (
      <span title={trend.toString()} className="text-sm text-[#EC7B7C]">
        ↘&nbsp;{trend}
      </span>
    );
  }
  return (
    <span title={trend.toString()} className="text-sm text-[#E44244]">
      ↓&nbsp;{trend}
    </span>
  );
};
