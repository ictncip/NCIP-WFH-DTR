import { useState, useEffect, useCallback } from 'react';
import { db } from '../../firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import {
  calculateHoursWithLunch,
  getRecordDateKey,
  recordMatchesDate,
  toDateValue
} from './recordsUtils';
import './Records.css';

const Records = ({ selectedUser }) => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split('T')[0]);
  const [searchTerm, setSearchTerm] = useState('');
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryRecords, setSummaryRecords] = useState([]);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const dateKey = dateFilter;
      const baseRef = collection(db, 'dtr');
      let allRecords = [];

      if (selectedUser?.isAdmin) {
        const byDateSnap = await getDocs(query(baseRef, where('dateKey', '==', dateKey)));
        allRecords = byDateSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        if (allRecords.length === 0) {
          const fallbackSnap = await getDocs(baseRef);
          allRecords = fallbackSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
            .filter(record => recordMatchesDate(record, dateKey));
        }
      } else {
        const byUserDateSnap = await getDocs(query(
          baseRef,
          where('userId', '==', selectedUser?.id || '')
        ));
        allRecords = byUserDateSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
          .filter(record => recordMatchesDate(record, dateKey));
      }

      allRecords = allRecords.sort((a, b) => (a.userName || '').localeCompare(b.userName || ''));

      // Filter logs based on user type
      let userRecords = allRecords;
      
      // If not admin, filter to only show selected user's records
      if (!selectedUser?.isAdmin) {
        userRecords = allRecords.filter(record => (record.userId || '') === selectedUser?.id);
      }

      setLogs(userRecords);
    } catch (error) {
      console.error('Error fetching records:', error);
    } finally {
      setLoading(false);
    }
  }, [dateFilter, selectedUser]);

  const fetchSummary = useCallback(async () => {
    setSummaryLoading(true);
    try {
      const baseRef = collection(db, 'dtr');
      let records = [];

      if (selectedUser?.isAdmin) {
        const snap = await getDocs(baseRef);
        records = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      } else {
        const snap = await getDocs(query(baseRef, where('userId', '==', selectedUser?.id || '')));
        records = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      }

      const sortedRecords = records.sort((a, b) =>
        (getRecordDateKey(b) || '').localeCompare(getRecordDateKey(a) || '')
      );

      setSummaryRecords(sortedRecords);
    } catch (error) {
      console.error('Error fetching summary:', error);
    } finally {
      setSummaryLoading(false);
    }
  }, [selectedUser]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  const formatTime = (value) => (value ? value.toLocaleTimeString() : '-');
  const formatWorkedTime = (hours) => {
    const totalMinutes = Math.round(hours * 60);
    const wholeHours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (wholeHours <= 0 && minutes <= 0) return '-';
    if (minutes === 0) return `${wholeHours} h`;
    return `${wholeHours} h ${minutes} min`;
  };

  const renderPhotoTimeCell = (photo, time, label) => (
    <td className="photo-time-cell">
      {photo ? (
        <img
          src={photo}
          alt={label}
          className="time-photo"
        />
      ) : (
        <span className="photo-placeholder">-</span>
      )}
      <div className="time-value">{formatTime(time)}</div>
    </td>
  );

  const renderColGroup = ({ showEmployee = false, showPhotos = false } = {}) => (
    <colgroup>
      <col className="records-col-date" />
      {showEmployee && <col className="records-col-employee" />}
      <col className={showPhotos ? 'records-col-photo-time' : 'records-col-time'} />
      <col className={showPhotos ? 'records-col-photo-time' : 'records-col-time'} />
      <col className={showPhotos ? 'records-col-photo-time' : 'records-col-time'} />
      <col className={showPhotos ? 'records-col-photo-time' : 'records-col-time'} />
      <col className="records-col-hours" />
      <col className="records-col-accomplishment" />
      <col className="records-col-accomplishment" />
    </colgroup>
  );

  const renderRows = (records, { showPhotos = false, showEmployee = false } = {}) => {
    if (records.length === 0) {
      return (
        <tr>
          <td colSpan={showEmployee ? 9 : 8} className="no-records">
            No time records found
          </td>
        </tr>
      );
    }

    return records.map((record) => {
      const timeIn = toDateValue(record.timeIn);
      const timeOut = toDateValue(record.timeOut);
      const breakOut = toDateValue(record.breakOut);
      const breakIn = toDateValue(record.breakIn);
      const totalHours = timeIn && timeOut
        ? calculateHoursWithLunch(timeIn, timeOut, breakOut, breakIn)
        : 0;

      return (
        <tr key={record.id || `${record.userId}-${record.dateKey || ''}`} className="record-row">
          <td className="date-cell">{getRecordDateKey(record) || '-'}</td>
          {showEmployee && <td className="employee-cell">{record.userName || '-'}</td>}
          {showPhotos
            ? renderPhotoTimeCell(record.timeInPhoto, timeIn, `${record.userName || 'Employee'} time in`)
            : <td className="time-cell">{formatTime(timeIn)}</td>}
          {showPhotos
            ? renderPhotoTimeCell(record.breakOutPhoto, breakOut, `${record.userName || 'Employee'} break out`)
            : <td className="time-cell">{formatTime(breakOut)}</td>}
          {showPhotos
            ? renderPhotoTimeCell(record.breakInPhoto, breakIn, `${record.userName || 'Employee'} break in`)
            : <td className="time-cell">{formatTime(breakIn)}</td>}
          {showPhotos
            ? renderPhotoTimeCell(record.timeOutPhoto, timeOut, `${record.userName || 'Employee'} time out`)
            : <td className="time-cell">{formatTime(timeOut)}</td>}
          <td className="action-value-cell">
            {formatWorkedTime(totalHours)}
          </td>
          <td className="accomplishment-cell accomplishment-start">{record.breakOutAccomplishment || '-'}</td>
          <td className="accomplishment-cell">{record.timeOutAccomplishment || '-'}</td>
        </tr>
      );
    });
  };

  return (
    <div className="records-container">
      <div className="records-header">
        <h2>Time Records</h2>
        <div className="records-filters">
          <div className="date-filter">
            <label htmlFor="date-picker">Filter by Date:</label>
            <input
              id="date-picker"
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="date-input"
            />
          </div>
          {selectedUser?.isAdmin && (
            <div className="search-filter">
              <label htmlFor="search-input">Search Employee:</label>
              <input
                id="search-input"
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search name or email"
                className="search-input"
              />
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <p className="loading">Loading records...</p>
      ) : (
        <div className="table-wrapper">
          <table className="records-table">
            {renderColGroup({
              showPhotos: true,
              showEmployee: selectedUser?.isAdmin
            })}
            <thead>
              <tr>
                <th rowSpan="2" className="date-head">Date</th>
                {selectedUser?.isAdmin && <th rowSpan="2" className="employee-head">Name</th>}
                <th rowSpan="2" className="time-head">Time In</th>
                <th rowSpan="2" className="time-head">Break Out</th>
                <th rowSpan="2" className="time-head">Break In</th>
                <th rowSpan="2" className="time-head">Time Out</th>
                <th rowSpan="2" className="hours-head">Total Hours</th>
                <th colSpan="2" className="accomplishment-head accomplishment-start-head">Accomplishments</th>
              </tr>
              <tr>
                <th className="accomplishment-head accomplishment-start-head">Morning</th>
                <th className="accomplishment-head">Afternoon</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const normalized = searchTerm.trim().toLowerCase();
                const filteredLogs = selectedUser?.isAdmin && normalized
                  ? logs.filter(record =>
                      (record.userName || '').toLowerCase().includes(normalized) ||
                      (record.userEmail || '').toLowerCase().includes(normalized)
                    )
                  : logs;

                if (filteredLogs.length === 0) {
                  return (
                    <tr>
                      <td colSpan={selectedUser?.isAdmin ? 9 : 8} className="no-records">
                        No time records found for this date
                      </td>
                    </tr>
                  );
                }

                return renderRows(filteredLogs, {
                  showPhotos: true,
                  showEmployee: selectedUser?.isAdmin
                });
              })()}
            </tbody>
          </table>
        </div>
      )}

      {!selectedUser?.isAdmin && (
        <div className="records-summary">
          <h3>Summary (All Dates)</h3>
          {summaryLoading ? (
            <p className="loading">Loading summary...</p>
          ) : (
            <div className="table-wrapper summary-table-wrapper">
              <table className="records-table">
                {renderColGroup()}
                <thead>
                  <tr>
                    <th rowSpan="2" className="date-head">Date</th>
                    <th rowSpan="2" className="time-head">Time In</th>
                    <th rowSpan="2" className="time-head">Break Out</th>
                    <th rowSpan="2" className="time-head">Break In</th>
                    <th rowSpan="2" className="time-head">Time Out</th>
                    <th rowSpan="2" className="hours-head">Total Hours</th>
                    <th colSpan="2" className="accomplishment-head accomplishment-start-head">Accomplishments</th>
                  </tr>
                  <tr>
                    <th className="accomplishment-head accomplishment-start-head">Morning</th>
                    <th className="accomplishment-head">Afternoon</th>
                  </tr>
                </thead>
                <tbody>{renderRows(summaryRecords)}</tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Records;
