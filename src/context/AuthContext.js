import React, { createContext, useMemo, useState } from 'react';

export const AuthContext = createContext({
  isLoggedIn: false,
  userRole: null,
  userId: null,
  familyName: null,
  login: () => {},
  logout: () => {},
  setFamilyName: () => {}
});

export const AuthProvider = ({ children }) => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const [userId, setUserId] = useState(null);
  const [familyName, setFamilyName] = useState(null);

  const login = (role, id, family) => {
    setUserRole(role);
    setUserId(id);
    setFamilyName(family || null);
    setIsLoggedIn(true);
  };

  const logout = () => {
    setIsLoggedIn(false);
    setUserRole(null);
    setUserId(null);
    setFamilyName(null);
  };

  const value = useMemo(
    () => ({
      isLoggedIn,
      userRole,
      userId,
      familyName,
      login,
      logout,
      setFamilyName
    }),
    [isLoggedIn, userRole, userId, familyName]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
