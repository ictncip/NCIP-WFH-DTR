export const getDisplayName = ({ userName, userEmail, userId }) => {
  if (userName) return userName;
  if (userEmail) return userEmail.split('@')[0];
  return userId || 'Unknown';
};

export const calculateHours = (timeIn, breakOut, breakIn, timeOut) => {
  if (!timeIn || !timeOut) return 0;

  let totalMinutes = (timeOut - timeIn) / 60000;
  const lunchMinutes = getLunchOverlapMinutes(timeIn, timeOut);

  if (breakOut && breakIn) {
    const breakMinutes = (breakIn - breakOut) / 60000;
    const breakLunchOverlap = getLunchOverlapMinutes(breakOut, breakIn);
    totalMinutes -= Math.max(0, breakMinutes - breakLunchOverlap);
  }

  if (lunchMinutes > 0) {
    totalMinutes -= lunchMinutes;
  }

  return totalMinutes / 60;
};

const getLunchOverlapMinutes = (timeIn, timeOut) => {
  if (!timeIn || !timeOut) return 0;
  const date = new Date(timeIn);
  const lunchStart = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0);
  const lunchEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 13, 0, 0);
  const start = timeIn > lunchStart ? timeIn : lunchStart;
  const end = timeOut < lunchEnd ? timeOut : lunchEnd;
  const diff = end - start;
  return diff > 0 ? diff / 60000 : 0;
};
