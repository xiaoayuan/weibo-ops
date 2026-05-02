const BUSINESS_TIME_ZONE = "Asia/Shanghai";

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function toDateParts(date: Date) {
  const formatter = new Intl.DateTimeFormat("zh-CN", {
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(date);

  return {
    year: Number(parts.find((part) => part.type === "year")?.value || 0),
    month: Number(parts.find((part) => part.type === "month")?.value || 0),
    day: Number(parts.find((part) => part.type === "day")?.value || 0),
  };
}

export function formatBusinessDate(date: Date) {
  const { year, month, day } = toDateParts(date);
  return `${year}-${pad(month)}-${pad(day)}`;
}

export function getBusinessDateText(date = new Date()) {
  return formatBusinessDate(date);
}

export function toBusinessDateTime(dateText: string, timeText: string) {
  const matched = timeText.match(/^(\d{2}):(\d{2})$/);

  if (!matched) {
    throw new Error("业务时间格式不正确");
  }

  return new Date(`${dateText}T${matched[1]}:${matched[2]}:00+08:00`);
}

export function toBusinessDate(input: string) {
  return new Date(`${input}T00:00:00+08:00`);
}
