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

export function toBusinessDate(dateText: string) {
  const matched = dateText.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!matched) {
    throw new Error("业务日期格式不正确");
  }

  const year = Number(matched[1]);
  const month = Number(matched[2]);
  const day = Number(matched[3]);

  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
}
