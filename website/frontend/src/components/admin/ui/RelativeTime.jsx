import { formatRelativeTime } from '../../../utils/formatRelativeTime.js';

export default function RelativeTime({ value, className = '' }) {
  const { relative, full } = formatRelativeTime(value);
  return (
    <time dateTime={value ? new Date(value).toISOString() : undefined} title={full} className={className}>
      {relative}
    </time>
  );
}
