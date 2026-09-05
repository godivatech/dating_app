/**
 * IST (Indian Standard Time, UTC+5:30) Time Formatting Utility
 * Strictly presents client times in 12-hour format with AM/PM without persisting formatted strings.
 */

export function formatToIST(isoDateString?: string | null): string {
  if (!isoDateString) return '';

  const date = new Date(isoDateString);
  if (isNaN(date.getTime())) return '';

  // Use Intl.DateTimeFormat for IST formatting
  try {
    const timeFormatter = new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

    const now = new Date();
    const isToday =
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear();

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday =
      date.getDate() === yesterday.getDate() &&
      date.getMonth() === yesterday.getMonth() &&
      date.getFullYear() === yesterday.getFullYear();

    const timeStr = timeFormatter.format(date);

    if (isToday) {
      return timeStr;
    } else if (isYesterday) {
      return `Yesterday, ${timeStr}`;
    } else {
      const dateFormatter = new Intl.DateTimeFormat('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: 'numeric',
        month: 'short',
      });
      return `${dateFormatter.format(date)}, ${timeStr}`;
    }
  } catch {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
  }
}
