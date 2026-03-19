import { Suspense, lazy, useState } from 'react';
import { useAuth } from '../../context/useAuth';
import UserSelection from '../users/UserSelection';
import Records from '../records/Records';
import './Dashboard.css';

const TimeTracking = lazy(() => import('../tracking/TimeTracking'));
const EmployeeList = lazy(() => import('../employees/EmployeeList'));
const DTRReport = lazy(() => import('../reports/DTRReport'));
const getInitialTab = (selectedUser) => (selectedUser?.isAdmin ? 'records' : 'tracking');

const Dashboard = ({ initialSelectedUser, onLogout }) => {
  const [activeTab, setActiveTab] = useState(getInitialTab(initialSelectedUser));
  const [selectedUser, setSelectedUser] = useState(initialSelectedUser || null);
  const { userData, logout } = useAuth();
  const currentSelectedUser = initialSelectedUser || selectedUser;
  const isAdmin = String(userData?.role || '').trim().toLowerCase() === 'admin'
    || userData?.isAdmin === true
    || currentSelectedUser?.isAdmin;


  const handleLogout = async () => {
    setSelectedUser(null);
    if (onLogout) {
      onLogout();
    } else {
      await logout();
    }
  };


  // Show user selection if no user is selected yet
  if (!currentSelectedUser) {
    return <UserSelection onSelectUser={setSelectedUser} />;
  }


  // Show dashboard with records tab
  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="header-left">
          <h1>Daily Time Record System</h1>
          <p>Selected: {userData?.office || currentSelectedUser?.name || '-'}</p>
        </div>
        <div className="header-right">
          <span className="current-user-badge">{currentSelectedUser.name}</span>
          {!currentSelectedUser?.isAdmin && (
            <button onClick={() => setSelectedUser(null)} className="back-to-selection-btn">
              Change User
            </button>
          )}
          <button onClick={handleLogout} className="logout-btn">Logout</button>
        </div>
      </header>


      <nav className="dashboard-nav">
        {!currentSelectedUser?.isAdmin && (
          <button
            className={`nav-btn ${activeTab === 'tracking' ? 'active' : ''}`}
            onClick={() => setActiveTab('tracking')}
          >
            Time Tracking
          </button>
        )}
        <button
          className={`nav-btn ${activeTab === 'records' ? 'active' : ''}`}
          onClick={() => setActiveTab('records')}
        >
          Records
        </button>
        {isAdmin && (
          <>
            <button
              className={`nav-btn ${activeTab === 'employees' ? 'active' : ''}`}
              onClick={() => setActiveTab('employees')}
            >
              Employee List
            </button>
            <button
              className={`nav-btn ${activeTab === 'report' ? 'active' : ''}`}
              onClick={() => setActiveTab('report')}
            >
              DTR Report
            </button>
          </>
        )}
      </nav>


      <div className="dashboard-content">
        {activeTab === 'records' && <Records selectedUser={currentSelectedUser} />}
        {activeTab === 'tracking' && (
          <Suspense fallback={<p className="loading">Loading time tracking...</p>}>
            <TimeTracking selectedUser={currentSelectedUser} />
          </Suspense>
        )}
        {activeTab === 'employees' && (
          <Suspense fallback={<p className="loading">Loading employees...</p>}>
            <EmployeeList />
          </Suspense>
        )}
        {activeTab === 'report' && (
          <Suspense fallback={<p className="loading">Loading report...</p>}>
            <DTRReport />
          </Suspense>
        )}
      </div>
    </div>
  );
};


export default Dashboard;
