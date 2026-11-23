import type { DealStage } from "../features/deals/types/deal.types";

const LOCALE = "en-IN";

const currencyFormatters = new Map<string, Intl.NumberFormat>();

const dateTimeFormatter = new Intl.DateTimeFormat(LOCALE, {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
});

const dateFormatter = new Intl.DateTimeFormat(LOCALE, {
  day: "numeric",
  month: "short",
  year: "numeric",
});

const countFormatter = new Intl.NumberFormat(LOCALE);

export function formatCurrency(value: number, currency: string): string {
  let formatter = currencyFormatters.get(currency);

  if (!formatter) {
    formatter = new Intl.NumberFormat(LOCALE, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    });
    currencyFormatters.set(currency, formatter);
  }

  return formatter.format(value);
}

const CRORE = 10_000_000;
const LAKH = 100_000;
const shortNumber = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 1 });
const shortWholeNumber = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 });

export function formatShortInr(value: number): string {
  if (value >= CRORE) {
    const crores = value / CRORE;
    const formatter = crores >= 100 ? shortWholeNumber : shortNumber;
    return `₹${formatter.format(crores)} Cr`;
  }

  if (value >= LAKH) {
    return `₹${shortNumber.format(value / LAKH)} L`;
  }

  return formatCurrency(value, "INR");
}

export function formatDateTime(iso: string): string {
  return dateTimeFormatter.format(new Date(iso));
}

export function formatDate(iso: string): string {
  return dateFormatter.format(new Date(iso));
}

export function formatRelativeTime(iso: string, now = Date.now()): string {
  const minutes = Math.round((now - Date.parse(iso)) / 60000);

  if (minutes < 1) {
    return "just now";
  }

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.round(minutes / 60);

  if (hours < 24) {
    return `${hours}h ago`;
  }

  return `${Math.round(hours / 24)}d ago`;
}

export function formatCount(value: number): string {
  return countFormatter.format(value);
}

export function stageSlug(stage: DealStage): string {
  return stage.toLowerCase().replaceAll(" ", "-");
}

export function stageClassName(stage: DealStage): string {
  return `stage-badge stage-${stageSlug(stage)}`;
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
