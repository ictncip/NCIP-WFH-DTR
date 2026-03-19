import { useState, useEffect, useCallback } from 'react';
import { EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { db } from '../../firebase';
import { auth } from '../../firebase';
import { collection, getDocs, addDoc, doc, updateDoc, writeBatch } from 'firebase/firestore';
import './EmployeeList.css';

const EmployeeList = () => {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [name, setName] = useState('');
  const [office, setOffice] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [error, setError] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [officeFilter, setOfficeFilter] = useState('all');
  const [importing, setImporting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [authError, setAuthError] = useState('');

  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    try {
      let q = collection(db, 'users');
      const snapshot = await getDocs(q);
      let data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      if (filter === 'active') {
        const dtrSnap = await getDocs(collection(db, 'dtr'));
        const activeUserIds = new Set(
          dtrSnap.docs.map(doc => doc.data().userId).filter(Boolean)
        );
        data = data.filter(emp => activeUserIds.has(emp.id));
      }

      data = data.sort((a, b) => {
        const officeA = (a.office || '').toLowerCase();
        const officeB = (b.office || '').toLowerCase();
        if (officeA !== officeB) return officeA.localeCompare(officeB);
        const nameA = (a.name || '').toLowerCase();
        const nameB = (b.name || '').toLowerCase();
        return nameA.localeCompare(nameB);
      });

      setEmployees(data);
    } catch (error) {
      console.error('Error fetching employees:', error);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  const handleAddEmployee = async (e) => {
    e.preventDefault();
    setError('');
    if (!name.trim() || !office) {
      setError('Name and office are required.');
      return;
    }
    const normalizedName = name.trim().toLowerCase();
    const normalizedOffice = office.toLowerCase();
    const duplicate = employees.find(emp =>
      (emp.name || '').trim().toLowerCase() === normalizedName &&
      (emp.office || '').trim().toLowerCase() === normalizedOffice
    );
    if (duplicate) {
      setError('Duplicate employee already exists.');
      return;
    }
    setSaving(true);
    try {
      await addDoc(collection(db, 'users'), {
        name: name.trim(),
        office,
        role: 'employee'
      });
      setName('');
      setOffice('');
      setShowAddForm(false);
      await fetchEmployees();
    } catch (err) {
      setError(err.message || 'Failed to add employee.');
    } finally {
      setSaving(false);
    }
  };

  const handleEditEmployee = (emp) => {
    setEditingEmployee(emp);
    setName(emp.name || '');
    setOffice(emp.office || '');
    setError('');
    setShowAddForm(true);
  };

  const toggleSelectAll = () => {
    const term = searchTerm.trim().toLowerCase();
    let filtered = employees;
    if (officeFilter !== 'all') {
      filtered = filtered.filter(emp => (emp.office || '') === officeFilter);
    }
    if (term) {
      filtered = filtered.filter(emp => (emp.name || '').toLowerCase().includes(term));
    }
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(filtered.map(e => e.id)));
  };

  const toggleSelect = (id) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleRemoveSelected = async () => {
    if (selectedIds.size === 0) return;
    setAuthError('');
    setAdminPassword('');
    setShowDeleteConfirm(true);
  };

  const confirmRemoveSelected = async (e) => {
    e.preventDefault();
    if (!adminPassword) return;
    setError('');
    setAuthError('');
    setSaving(true);
    try {
      const currentUser = auth.currentUser;
      if (!currentUser?.email) {
        setAuthError('No authenticated admin.');
        return;
      }
      const credential = EmailAuthProvider.credential(currentUser.email, adminPassword);
      await reauthenticateWithCredential(currentUser, credential);

      const batchSize = 400;
      const ids = Array.from(selectedIds);
      for (let i = 0; i < ids.length; i += batchSize) {
        const batch = writeBatch(db);
        ids.slice(i, i + batchSize).forEach(id => {
          batch.delete(doc(db, 'users', id));
        });
        await batch.commit();
      }
      setSelectedIds(new Set());
      setShowDeleteConfirm(false);
      await fetchEmployees();
    } catch (err) {
      setAuthError(err.message || 'Admin password verification failed.');
    } finally {
      setSaving(false);
    }
  };

  const handleImportFile = async (file) => {
    if (!file) return;
    setError('');
    setImporting(true);
    try {
      const XLSX = await import('xlsx');
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: '' });

      if (rows.length === 0) {
        setError('Empty file.');
        return;
      }

      const headerRow = rows[0].map(h => String(h).trim().toLowerCase());
      const nameIdx = headerRow.findIndex(h => h === 'name');
      const officeIdx = headerRow.findIndex(h => h === 'office');
      const dataRows = (nameIdx >= 0 && officeIdx >= 0) ? rows.slice(1) : rows;

      const normalizedExisting = new Set(
        employees.map(emp => `${(emp.name || '').trim().toLowerCase()}::${(emp.office || '').trim().toLowerCase()}`)
      );

      const toInsert = [];
      dataRows.forEach(row => {
        const name = String(row[nameIdx >= 0 ? nameIdx : 0] || '').trim();
        const office = String(row[officeIdx >= 0 ? officeIdx : 1] || '').trim();
        if (!name || !office) return;
        const key = `${name.toLowerCase()}::${office.toLowerCase()}`;
        if (normalizedExisting.has(key)) return;
        normalizedExisting.add(key);
        toInsert.push({ name, office });
      });

      if (toInsert.length === 0) {
        setError('No new employees to import.');
        return;
      }

      const batchSize = 400;
      for (let i = 0; i < toInsert.length; i += batchSize) {
        const batch = writeBatch(db);
        const chunk = toInsert.slice(i, i + batchSize);
        chunk.forEach(item => {
          const ref = doc(collection(db, 'users'));
          batch.set(ref, {
            name: item.name,
            office: item.office,
            role: 'employee'
          });
        });
        await batch.commit();
      }

      await fetchEmployees();
    } catch (err) {
      setError(err.message || 'Failed to import file.');
    } finally {
      setImporting(false);
    }
  };


  const handleSaveEmployee = async (e) => {
    e.preventDefault();
    setError('');
    if (!name.trim() || !office) {
      setError('Name and office are required.');
      return;
    }
    if (!editingEmployee) return;
    const normalizedName = name.trim().toLowerCase();
    const normalizedOffice = office.toLowerCase();
    const duplicate = employees.find(emp =>
      emp.id !== editingEmployee.id &&
      (emp.name || '').trim().toLowerCase() === normalizedName &&
      (emp.office || '').trim().toLowerCase() === normalizedOffice
    );
    if (duplicate) {
      setError('Duplicate employee already exists.');
      return;
    }
    setSaving(true);
    try {
      const update = {
        name: name.trim(),
        office
      };
      await updateDoc(doc(db, 'users', editingEmployee.id), update);
      setEditingEmployee(null);
      setName('');
      setOffice('');
      setShowAddForm(false);
      await fetchEmployees();
    } catch (err) {
      setError(err.message || 'Failed to update employee.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="employee-list">
      <div className="list-header">
        <h2>Employee List</h2>
        <div className="filter-buttons">
          <button 
            className={filter === 'all' ? 'active' : ''}
            onClick={() => setFilter('all')}
          >
            All
          </button>
          <button 
            className={filter === 'active' ? 'active' : ''}
            onClick={() => setFilter('active')}
          >
            With DTR
          </button>
          <label className="import-btn">
            {importing ? 'Importing...' : 'Upload Excel'}
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => handleImportFile(e.target.files?.[0])}
              disabled={importing}
            />
          </label>
          <button onClick={() => {
            setEditingEmployee(null);
            setName('');
            setOffice('');
            setShowAddForm(true);
          }}>Add Employee</button>
        </div>
      </div>

      {showDeleteConfirm && (
        <div className="add-employee-modal">
          <div className="add-employee-card">
            <div className="modal-header">
              <h3>Confirm Delete</h3>
              <button
                type="button"
                className="modal-close"
                onClick={() => setShowDeleteConfirm(false)}
              >
                ✕
              </button>
            </div>
            <p>Enter admin password to delete selected employees.</p>
            {authError && <p className="error-text">{authError}</p>}
            <form className="add-employee-form" onSubmit={confirmRemoveSelected}>
              <div className="form-field">
                <label>Admin Password</label>
                <input
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="Password"
                  required
                />
              </div>
              <button type="submit" disabled={saving}>
                {saving ? 'Verifying...' : 'Confirm Delete'}
              </button>
            </form>
          </div>
        </div>
      )}

      <div className="list-filters">
        {selectedIds.size > 0 && (
          <button className="delete-selected-btn" onClick={handleRemoveSelected} disabled={saving}>
            Delete Selected ({selectedIds.size})
          </button>
        )}
        <div className="filter-field">
          <label>Search</label>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name"
          />
        </div>
        <div className="filter-field">
          <label>Office</label>
          <select value={officeFilter} onChange={(e) => setOfficeFilter(e.target.value)}>
            <option value="all">All offices</option>
            <option value="ABRA, DANGLAS">ABRA, DANGLAS</option>
            <option value="ABRA, LICUAN-BAAY">ABRA, LICUAN-BAAY</option>
            <option value="ABRA, MANABO">ABRA, MANABO</option>
            <option value="ABRA, PO">ABRA, PO</option>
            <option value="APAYAO, CONNER">APAYAO, CONNER</option>
            <option value="APAYAO, KABUGAO">APAYAO, KABUGAO</option>
            <option value="APAYAO, LUNA">APAYAO, LUNA</option>
            <option value="APAYAO, PO">APAYAO, PO</option>
            <option value="BAGUIO CSC">BAGUIO CSC</option>
            <option value="BAGUIO, CO">BAGUIO, CO</option>
            <option value="BENGUET PO">BENGUET PO</option>
            <option value="BENGUET, ATOK">BENGUET, ATOK</option>
            <option value="BENGUET, BOKOD">BENGUET, BOKOD</option>
            <option value="BENGUET, ITOGON">BENGUET, ITOGON</option>
            <option value="BENGUET, SABLAN">BENGUET, SABLAN</option>
            <option value="CENTRAL OFFICE, OEHR">CENTRAL OFFICE, OEHR</option>
            <option value="IFUGAO, AGUINALDO">IFUGAO, AGUINALDO</option>
            <option value="IFUGAO, BANAUE">IFUGAO, BANAUE</option>
            <option value="IFUGAO, PO">IFUGAO, PO</option>
            <option value="IFUGAO, TINOC">IFUGAO, TINOC</option>
            <option value="KALINGA, BALBALAN">KALINGA, BALBALAN</option>
            <option value="KALINGA, PO">KALINGA, PO</option>
            <option value="KALINGA, TANUDAN">KALINGA, TANUDAN</option>
            <option value="KALINGA, TINGLAYAN">KALINGA, TINGLAYAN</option>
            <option value="MOUNTAIN PO">MOUNTAIN PO</option>
            <option value="MOUNTAIN, PANABA">MOUNTAIN, PANABA</option>
            <option value="MOUNTAIN, SABATA">MOUNTAIN, SABATA</option>
            <option value="MOUNTAIN, SABEBOSA">MOUNTAIN, SABEBOSA</option>
            <option value="RO-FASD">RO-FASD</option>
            <option value="RO-ORD">RO-ORD</option>
            <option value="RO-RHU">RO-RHU</option>
            <option value="RO-TMSD">RO-TMSD</option>
          </select>
        </div>
      </div>

      {showAddForm && (
        <div className="add-employee-modal">
          <div className="add-employee-card">
            <div className="modal-header">
              <h3>{editingEmployee ? 'Edit Employee' : 'Add Employee'}</h3>
              <button
                type="button"
                className="modal-close"
                onClick={() => setShowAddForm(false)}
              >
                ✕
              </button>
            </div>
            {error && <p className="error-text">{error}</p>}
            <form className="add-employee-form" onSubmit={editingEmployee ? handleSaveEmployee : handleAddEmployee}>
              <div className="form-field">
                <label>Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Employee name"
                  required
                />
              </div>
              <div className="form-field">
                <label>Office</label>
                <select value={office} onChange={(e) => setOffice(e.target.value)} required>
                  <option value="">Select office</option>
                  <option value="ABRA, DANGLAS">ABRA, DANGLAS</option>
                  <option value="ABRA, LICUAN-BAAY">ABRA, LICUAN-BAAY</option>
                  <option value="ABRA, MANABO">ABRA, MANABO</option>
                  <option value="ABRA, PO">ABRA, PO</option>
                  <option value="APAYAO, CONNER">APAYAO, CONNER</option>
                  <option value="APAYAO, KABUGAO">APAYAO, KABUGAO</option>
                  <option value="APAYAO, LUNA">APAYAO, LUNA</option>
                  <option value="APAYAO, PO">APAYAO, PO</option>
                  <option value="BAGUIO CSC">BAGUIO CSC</option>
                  <option value="BAGUIO, CO">BAGUIO, CO</option>
                  <option value="BENGUET PO">BENGUET PO</option>
                  <option value="BENGUET, ATOK">BENGUET, ATOK</option>
                  <option value="BENGUET, BOKOD">BENGUET, BOKOD</option>
                  <option value="BENGUET, ITOGON">BENGUET, ITOGON</option>
                  <option value="BENGUET, SABLAN">BENGUET, SABLAN</option>
                  <option value="CENTRAL OFFICE, OEHR">CENTRAL OFFICE, OEHR</option>
                  <option value="IFUGAO, AGUINALDO">IFUGAO, AGUINALDO</option>
                  <option value="IFUGAO, BANAUE">IFUGAO, BANAUE</option>
                  <option value="IFUGAO, PO">IFUGAO, PO</option>
                  <option value="IFUGAO, TINOC">IFUGAO, TINOC</option>
                  <option value="KALINGA, BALBALAN">KALINGA, BALBALAN</option>
                  <option value="KALINGA, PO">KALINGA, PO</option>
                  <option value="KALINGA, TANUDAN">KALINGA, TANUDAN</option>
                  <option value="KALINGA, TINGLAYAN">KALINGA, TINGLAYAN</option>
                  <option value="MOUNTAIN PO">MOUNTAIN PO</option>
                  <option value="MOUNTAIN, PANABA">MOUNTAIN, PANABA</option>
                  <option value="MOUNTAIN, SABATA">MOUNTAIN, SABATA</option>
                  <option value="MOUNTAIN, SABEBOSA">MOUNTAIN, SABEBOSA</option>
                  <option value="RO-FASD">RO-FASD</option>
                  <option value="RO-ORD">RO-ORD</option>
                  <option value="RO-RHU">RO-RHU</option>
                  <option value="RO-TMSD">RO-TMSD</option>
                </select>
              </div>
              <button type="submit" disabled={saving}>
                {saving ? 'Saving...' : (editingEmployee ? 'Save Changes' : 'Add Employee')}
              </button>
            </form>
          </div>
        </div>
      )}

      {(() => {
        const term = searchTerm.trim().toLowerCase();
        let filtered = employees;
        if (officeFilter !== 'all') {
          filtered = filtered.filter(emp => (emp.office || '') === officeFilter);
        }
        if (term) {
          filtered = filtered.filter(emp => (emp.name || '').toLowerCase().includes(term));
        }
        const allSelected = filtered.length > 0 && filtered.every(emp => selectedIds.has(emp.id));
        return (
          <>
            {loading ? (
              <p className="loading">Loading employees...</p>
            ) : (
              <div className="table-container">
                <table className="employees-table">
                  <thead>
                    <tr>
                      <th>
                        <input
                          type="checkbox"
                          checked={allSelected}
                          onChange={toggleSelectAll}
                        />
                      </th>
                      <th>Edit</th>
                      <th>Name</th>
                      <th>Office</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 ? (
                      <tr>
                        <td colSpan="4" className="no-data">No employees found</td>
                      </tr>
                    ) : (
                      filtered.map(emp => (
                        <tr key={emp.id}>
                          <td>
                            <input
                              type="checkbox"
                              checked={selectedIds.has(emp.id)}
                              onChange={() => toggleSelect(emp.id)}
                            />
                          </td>
                          <td className="actions-cell">
                            <button className="edit-icon-btn" onClick={() => handleEditEmployee(emp)} aria-label="Edit">
                              ✎
                            </button>
                          </td>
                          <td>{emp.name}</td>
                          <td>{emp.office || '-'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </>
        );
      })()}
    </div>
  );
};

export default EmployeeList;
