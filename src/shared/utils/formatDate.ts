export const formatDate = (date: string | Date | undefined) => {
  if (date === undefined) {
    return date;
  }
  if (date instanceof Date === true) {
    return date.toLocaleString("pt-BR").slice(0, "yyyy-mm-dd".length);
  }

  if (typeof date === "string") {
    const formattedDate = date
      .slice(0, "yyyy-mm-dd".length)
      .split("-")
      .reverse()
      .join("/");
    return formattedDate;
  }
  return date;
};

export function getTodayBrTimezone() {
  const tz = "America/Sao_Paulo";
  const str = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(
    new Date()
  );

  return new Date(str + "T00:00:00-03:00"); // Force midnight in São Paulo (UTC-3) → valid ISO string
}
