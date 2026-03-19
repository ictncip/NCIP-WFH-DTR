export const recordMatchesDate = (record, dateKey) => {
  if (record.dateKey) return record.dateKey === dateKey;
  const timeIn = record.timeIn?.toDate ? record.timeIn.toDate() : record.timeIn;
  if (timeIn instanceof Date) {
    const year = timeIn.getFullYear();
    const month = String(timeIn.getMonth() + 1).padStart(2, '0');
    const day = String(timeIn.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}` === dateKey;
  }
  return false;
};

export const getRecordDateKey = (record) => {
  if (record.dateKey) return record.dateKey;
  const timeIn = record.timeIn?.toDate ? record.timeIn.toDate() : record.timeIn;
  if (timeIn instanceof Date) {
    const year = timeIn.getFullYear();
    const month = String(timeIn.getMonth() + 1).padStart(2, '0');
    const day = String(timeIn.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  return '';
};

export const toDateValue = (value) => {
  return value?.toDate ? value.toDate() : value;
};

export const getLunchOverlapMinutes = (timeIn, timeOut) => {
  if (!timeIn || !timeOut) return 0;
  const date = new Date(timeIn);
  const lunchStart = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0);
  const lunchEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 13, 0, 0);
  const start = timeIn > lunchStart ? timeIn : lunchStart;
  const end = timeOut < lunchEnd ? timeOut : lunchEnd;
  const diff = end - start;
  return diff > 0 ? diff / (1000 * 60) : 0;
};

export const calculateHoursWithLunch = (timeIn, timeOut, breakOut, breakIn) => {
  let hours = (timeOut - timeIn) / (1000 * 60 * 60);
  const lunchMinutes = getLunchOverlapMinutes(timeIn, timeOut);

  if (breakOut && breakIn) {
    const breakMinutes = (breakIn - breakOut) / (1000 * 60);
    const breakLunchOverlap = getLunchOverlapMinutes(breakOut, breakIn);
    const extraBreakMinutes = Math.max(0, breakMinutes - breakLunchOverlap);
    hours -= extraBreakMinutes / 60;
  }

  if (lunchMinutes > 0) hours -= lunchMinutes / 60;
  return hours;
};
