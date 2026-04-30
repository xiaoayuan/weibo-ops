export function toBusinessDate(input: string) {
  return new Date(`${input}T00:00:00+08:00`);
}
