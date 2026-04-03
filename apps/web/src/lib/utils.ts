import { clsx, type ClassValue } from "clsx";

export const cn = (...values: ClassValue[]) => clsx(values);

export const formatDateTime = (value: string | null | undefined) => {
  if (!value) {
    return "Not available";
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

export const formatRelativePoints = (value: number) =>
  `${value > 0 ? "+" : ""}${value} pts`;
