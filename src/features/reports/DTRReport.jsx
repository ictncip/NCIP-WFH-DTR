import { useState } from 'react';
import { db } from '../../firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { exportToExcel } from '../../utils/excelExport';
import { getOfficeDisplayName } from '../../utils/officeDirectory';
import { calculateHours, getDisplayName } from './reportsUtils';
import './DTRReport.css';

const DTRReport = () => {
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [officeFilter, setOfficeFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const formatWorkedTime = (hours) => {
    const totalMinutes = Math.round(hours * 60);
    const wholeHours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (wholeHours <= 0 && minutes <= 0) return '0 h';
    if (minutes === 0) return `${wholeHours} h`;
    return `${wholeHours} h ${minutes} min`;
  };

  const fetchReport = async () => {
    setLoading(true);
    try {
      const q = query(
        collection(db, 'dtr'),
        where('dateKey', '>=', startDate),
        where('dateKey', '<=', endDate)
      );

      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        // day records contain dateKey and time fields
      }));

      // Group by user (id + name/email)
      const grouped = {};
      data.forEach(log => {
        const userId = log.userId || 'unknown';
        const userName = log.userName || '';
        const userEmail = log.userEmail || '';
        const displayName = getDisplayName({ userName, userEmail, userId });
        const officeName = getOfficeDisplayName(userEmail);
        const key = `${userId}::${displayName}`;
        if (!grouped[key]) {
          grouped[key] = {
            userId,
            name: displayName,
            email: userEmail,
            office: officeName,
            key,
            logs: []
          };
        }
        grouped[key].logs.push(log);
      });

      const reportList = Object.values(grouped).map(report => ({
        ...report,
        logs: report.logs.sort((a, b) => (a.dateKey || '').localeCompare(b.dateKey || ''))
      }));
      setReports(reportList);
    } catch (error) {
      console.error('Error fetching report:', error);
      alert('Error fetching report: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    if (rows.length === 0) {
      alert('No data to export');
      return;
    }
    const exportRows = rows.map(({ report, day }) => {
      const timeIn = day.timeIn?.toDate ? day.timeIn.toDate() : day.timeIn;
      const breakOut = day.breakOut?.toDate ? day.breakOut.toDate() : day.breakOut;
      const breakIn = day.breakIn?.toDate ? day.breakIn.toDate() : day.breakIn;
      const timeOut = day.timeOut?.toDate ? day.timeOut.toDate() : day.timeOut;
      const hours = calculateHours(timeIn, breakOut, breakIn, timeOut);

      return {
        name: report.name || 'Unknown',
        date: day.dateKey || (timeIn ? timeIn.toLocaleDateString() : ''),
        timeInPhoto: day.timeInPhoto || '',
        timeIn: timeIn ? timeIn.toLocaleTimeString() : '',
        breakOutPhoto: day.breakOutPhoto || '',
        breakOut: breakOut ? breakOut.toLocaleTimeString() : '',
        breakInPhoto: day.breakInPhoto || '',
        breakIn: breakIn ? breakIn.toLocaleTimeString() : '',
        timeOutPhoto: day.timeOutPhoto || '',
        timeOut: timeOut ? timeOut.toLocaleTimeString() : '',
        morningAccomplishment: day.breakOutAccomplishment || '',
        afternoonAccomplishment: day.timeOutAccomplishment || '',
        hours: formatWorkedTime(hours)
      };
    });

    await exportToExcel(exportRows, startDate, endDate);
  };

  const officeOptions = reports
    .map(r => r.office || '')
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
  const uniqueOfficeOptions = Array.from(new Set(officeOptions));

  const term = searchTerm.trim().toLowerCase();
  const filteredReports = reports
    .filter(r => officeFilter === 'all' || (r.office || '') === officeFilter)
    .filter(r => !term || (r.name || '').toLowerCase().includes(term));

  const rows = filteredReports.flatMap(report =>
    report.logs.map(day => ({
      report,
      day
    }))
  );

  return (
    <div className="dtr-report">
      <div className="report-controls">
        <h2>DTR Report</h2>
        <div className="controls-row">
          <div className="date-input">
            <label>From:</label>
            <input 
              type="date" 
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="date-input">
            <label>To:</label>
            <input 
              type="date" 
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          <div className="date-input select-input">
            <label>Office:</label>
            <select
              value={officeFilter}
              onChange={(e) => setOfficeFilter(e.target.value)}
            >
              <option value="all">All Offices</option>
              {uniqueOfficeOptions.map(office => (
                <option key={office} value={office}>
                  {office}
                </option>
              ))}
            </select>
          </div>
          <div className="date-input">
            <label>Search:</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name"
            />
          </div>
          <button onClick={fetchReport} disabled={loading} className="fetch-btn">
            {loading ? 'Loading...' : 'Generate Report'}
          </button>
          <button 
            onClick={handleExport} 
            disabled={reports.length === 0}
            className="export-btn"
          >
            Export
          </button>
        </div>
      </div>

      {loading ? (
        <p className="loading">Loading report...</p>
      ) : (
        <div className="report-content">
          {rows.length === 0 ? (
            <p className="no-data">Generate Report to Display Data</p>
          ) : (
            <table className="report-table">
              <thead>
                <tr>
                  <th rowSpan="2">Date</th>
                  <th rowSpan="2">Name</th>
                  <th rowSpan="2">Time In</th>
                  <th rowSpan="2">Break Out</th>
                  <th rowSpan="2">Break In</th>
                  <th rowSpan="2">Time Out</th>
                  <th rowSpan="2">Hours Worked</th>
                  <th rowSpan="2" className="table-gap-head" aria-hidden="true"></th>
                  <th colSpan="2">Accomplishments</th>
                </tr>
                <tr>
                  <th>Morning</th>
                  <th>Afternoon</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ report, day }, idx) => {
                  const timeIn = day.timeIn?.toDate ? day.timeIn.toDate() : day.timeIn;
                  const breakOut = day.breakOut?.toDate ? day.breakOut.toDate() : day.breakOut;
                  const breakIn = day.breakIn?.toDate ? day.breakIn.toDate() : day.breakIn;
                  const timeOut = day.timeOut?.toDate ? day.timeOut.toDate() : day.timeOut;
                  const hours = calculateHours(timeIn, breakOut, breakIn, timeOut);

                  return (
                    <tr key={`${report.key}-${day.dateKey || ''}-${idx}`}>
                      <td>{day.dateKey || (timeIn ? timeIn.toLocaleDateString() : '')}</td>
                      <td>{report.name || 'Unknown'}</td>
                      <td>{timeIn ? timeIn.toLocaleTimeString() : '-'}</td>
                      <td>{breakOut ? breakOut.toLocaleTimeString() : '-'}</td>
                      <td>{breakIn ? breakIn.toLocaleTimeString() : '-'}</td>
                      <td>{timeOut ? timeOut.toLocaleTimeString() : '-'}</td>
                      <td className="hours">{formatWorkedTime(hours)}</td>
                      <td className="table-gap-cell" aria-hidden="true"></td>
                      <td className="accomplishment-cell">{day.breakOutAccomplishment || '-'}</td>
                      <td className="accomplishment-cell">{day.timeOutAccomplishment || '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
};

export default DTRReport;
