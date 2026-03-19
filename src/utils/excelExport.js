export const exportToExcel = async (rows, startDate, endDate) => {
  const XLSX = await import('xlsx');
  const workbook = XLSX.utils.book_new();
  const sortedRows = [...rows].sort((a, b) => {
    const dateCompare = (a.date || '').localeCompare(b.date || '');
    if (dateCompare !== 0) return dateCompare;
    return (a.name || '').localeCompare(b.name || '');
  });

  const sheetData = [
    ['DTR Report'],
    ['Report Period:', `${startDate} to ${endDate}`],
    [],
    [
      'Date',
      'Name',
      'Time In',
      'Break Out',
      'Break In',
      'Time Out',
      'Morning Accomplishment',
      'Afternoon Accomplishment',
      'Hours Worked'
    ]
  ];

  sortedRows.forEach(row => {
    sheetData.push([
      row.date || 'N/A',
      row.name || 'Unknown',
      row.timeIn || '-',
      row.breakOut || '-',
      row.breakIn || '-',
      row.timeOut || '-',
      row.morningAccomplishment || '-',
      row.afternoonAccomplishment || '-',
      row.hours
    ]);
  });

  const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
  worksheet['!cols'] = [
    { wch: 12 },
    { wch: 24 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 28 },
    { wch: 28 },
    { wch: 12 }
  ];

  XLSX.utils.book_append_sheet(workbook, worksheet, 'DTR Report');

  // Generate filename with current date
  const fileName = `DTR_Report_${startDate}_to_${endDate}.xlsx`;
  XLSX.writeFile(workbook, fileName);
};
