import { useEffect, useState } from 'react';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
} from 'firebase/auth';
import { auth, db } from '../firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { getOfficeDisplayName } from '../utils/officeDirectory';
import { AuthContext } from './auth-context';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        // Fetch user data from Firestore
        const userDocRef = doc(db, 'users', currentUser.uid);
        const userDoc = await getDoc(userDocRef);
        const userDocData = userDoc.data() || {};
        const derivedName = getOfficeDisplayName(currentUser.email);
        setUserData({
          ...userDocData,
          email: currentUser.email,
          name: userDocData.name || derivedName || currentUser.email,
          office: userDocData.office || derivedName || ''
        });
      } else {
        setUser(null);
        setUserData(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const register = async (email, password, name, role = 'employee') => {
    const derivedName = getOfficeDisplayName(email);
    const result = await createUserWithEmailAndPassword(auth, email, password);
    await setDoc(doc(db, 'users', result.user.uid), {
      email,
      name: name || derivedName || email,
      office: derivedName || '',
      role,
      createdAt: new Date(),
      isActive: true
    });
    return result.user;
  };

  const login = async (email, password) => signInWithEmailAndPassword(auth, email, password);

  const logout = async () => signOut(auth);

  return (
    <AuthContext.Provider value={{ user, userData, loading, register, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
