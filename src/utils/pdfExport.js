const escapeHtml = (value = '') => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

export const exportDtrToPdf = (rows, startDate, endDate) => {
  const printWindow = window.open('', '_blank', 'width=1200,height=900');

  if (!printWindow) {
    alert('Unable to open the PDF preview window. Please allow pop-ups and try again.');
    return;
  }

  const sortedRows = [...rows].sort((a, b) => {
    const dateCompare = (a.date || '').localeCompare(b.date || '');
    if (dateCompare !== 0) return dateCompare;
    return (a.name || '').localeCompare(b.name || '');
  });

  const tableRows = sortedRows.map((row) => `
    <tr>
      <td>${escapeHtml(row.date || 'N/A')}</td>
      <td>${escapeHtml(row.name || 'Unknown')}</td>
      <td>${escapeHtml(row.timeIn || '-')}</td>
      <td>${escapeHtml(row.breakOut || '-')}</td>
      <td>${escapeHtml(row.breakIn || '-')}</td>
      <td>${escapeHtml(row.timeOut || '-')}</td>
      <td>${escapeHtml(row.hours || '-')}</td>
      <td>${escapeHtml(row.morningAccomplishment || '-')}</td>
      <td>${escapeHtml(row.afternoonAccomplishment || '-')}</td>
    </tr>
  `).join('');

  const html = `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <title>DTR Report ${escapeHtml(startDate)} to ${escapeHtml(endDate)}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 24px;
            color: #222;
          }

          h1 {
            margin: 0 0 8px;
            font-size: 22px;
          }

          .period {
            margin: 0 0 18px;
            font-size: 14px;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
          }

          col.date-col {
            width: 10%;
          }

          col.name-col {
            width: 14%;
          }

          col.time-col {
            width: 9%;
          }

          col.hours-col {
            width: 10%;
          }

          col.accomplishment-col {
            width: 15%;
          }

          th,
          td {
            border: 1px solid #000000;
            padding: 8px;
            font-size: 12px;
            vertical-align: top;
            word-break: break-word;
            text-align: center;
          }

          thead th {
            background: #325473;
            color: #000000;
            text-align: center;
            word-break: normal;
            overflow-wrap: break-word;
            hyphens: none;
          }

          thead tr:first-child th {
            border-bottom: 1px solid #000000;
          }

          tbody td:nth-child(7) {
            text-align: center;
            white-space: nowrap;
            font-weight: bold;
          }

          @media print {
            body {
              margin: 12px;
            }
          }
        </style>
      </head>
      <body>
        <h1>DTR Report</h1>
        <p class="period">Report Period: ${escapeHtml(startDate)} to ${escapeHtml(endDate)}</p>
        <table>
          <colgroup>
            <col class="date-col" />
            <col class="name-col" />
            <col class="time-col" />
            <col class="time-col" />
            <col class="time-col" />
            <col class="time-col" />
            <col class="hours-col" />
            <col class="accomplishment-col" />
            <col class="accomplishment-col" />
          </colgroup>
          <thead>
            <tr>
              <th rowspan="2">Date</th>
              <th rowspan="2">Name</th>
              <th rowspan="2">Time In</th>
              <th rowspan="2">Break Out</th>
              <th rowspan="2">Break In</th>
              <th rowspan="2">Time Out</th>
              <th rowspan="2">Hours Worked</th>
              <th colspan="2" class="accomplishment-group">Accomplishments</th>
            </tr>
            <tr>
              <th class="accomplishment-start">Morning</th>
              <th>Afternoon</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
      </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();

  printWindow.onload = () => {
    printWindow.print();
  };
};
