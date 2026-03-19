import { useEffect, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/useAuth';
import './UserSelection.css';

const UserSelection = ({ onSelectUser }) => {
  const { userData, logout } = useAuth();
  const [selectedUser, setSelectedUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchEmployees = async () => {
      setLoading(true);
      setError('');
      try {
        const office = userData?.office || '';
        if (!office) {
          setUsers([]);
          return;
        }
        const q = query(
          collection(db, 'users'),
          where('office', '==', office),
          where('role', '==', 'employee')
        );
        const snapshot = await getDocs(q);
        const data = snapshot.docs
          .map(doc => ({
            id: doc.id,
            name: doc.data().name || '',
            office: doc.data().office || ''
          }))
          .filter(u => u.name);

        data.sort((a, b) => a.name.localeCompare(b.name));
        setUsers(data);
      } catch (err) {
        setError(err.message || 'Failed to load employees.');
      } finally {
        setLoading(false);
      }
    };

    fetchEmployees();
  }, [userData?.office]);

  const handleSelect = (user) => {
    setSelectedUser(user.id);
  };

  const handleConfirm = () => {
    if (selectedUser) {
      const user = users.find(u => u.id === selectedUser);
      onSelectUser(user);
    }
  };

  const handleLogout = async () => {
    setError('');
    try {
      await logout();
    } catch (err) {
      setError(err.message || 'Failed to log out.');
    }
  };

  return (
    <div className="user-selection-container">
      <div className="user-selection-card">
        <div className="user-selection-header">
          <h1>Select Your Name</h1>
        </div>
        <p className="subtitle">
          {userData?.office ? `Office: ${userData.office}` : 'Office not set for this login'}
        </p>

        {loading ? (
          <p className="loading">Loading employees...</p>
        ) : error ? (
          <p className="error-message">{error}</p>
        ) : users.length === 0 ? (
          <p className="no-records">No employees found for this office</p>
        ) : (
          <div className="users-grid">
            {users.map(user => (
              <button
                type="button"
                key={user.id}
                className={`user-card ${selectedUser === user.id ? 'selected' : ''}`}
                onClick={() => handleSelect(user)}
              >
                <div className="user-name">{user.name}</div>
              </button>
            ))}
          </div>
        )}

        <div className="selection-actions">
          <button
            className="confirm-btn"
            onClick={handleConfirm}
            disabled={!selectedUser}
          >
            Continue to Time Logs
          </button>
          <button className="user-logout-btn" type="button" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </div>
    </div>
  );
};

export default UserSelection;
