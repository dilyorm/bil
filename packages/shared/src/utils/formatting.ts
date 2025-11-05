export const formatTimestamp = (date: Date): string => {
  return date.toISOString();
};

export const parseTimestamp = (timestamp: string): Date => {
  return new Date(timestamp);
};