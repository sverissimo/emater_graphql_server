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

export function getTodayDateWithTimeZone() {
  const today = new Date();
  today.setHours(today.getHours() - 3);

  return today;
}
