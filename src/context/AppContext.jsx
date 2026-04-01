import React, { createContext, useContext, useState, useEffect, useRef } from 'react';const AppContext = createContext();

export const useAppContext = () => useContext(AppContext);

export const AppProvider = ({ children }) => {
  // --- STATE ---
  const [currentUser, setCurrentUser] = useState(() =>
    localStorage.getItem('hub_current_user') || null
  );
  // Persistent check for PIN to allow re-encryption on update
  const [currentUserPin, setCurrentUserPin] = useState(() => 
    sessionStorage.getItem('hub_temp_pin') || null
  );
  
  const [usersDB, setUsersDB] = useState(() => {
    const saved = localStorage.getItem('hub_users_db');
    return saved ? JSON.parse(saved) : {};
  });
  const [appData, setAppData] = useState(null);
  const [adminMaster, setAdminMaster] = useState(() => {
    const saved = localStorage.getItem('hub_admin');
    return saved ? JSON.parse(saved) : null;
  });
  const [systemSettings, setSystemSettings] = useState(() => {
    const saved = localStorage.getItem('hub_system_settings');
    return saved ? JSON.parse(saved) : {
      currentPixKey: '',
      planPrices: { monthly: 5, annual: 50 },
      oldPrices: { monthly: null, annual: null },
      isPromo: false,
      onboardingVideos: [], // { id, name, timestamp }
      activeVideoId: null
    };
  });

  // Ref to track if appData change originated from user interaction (not from DB load)
  const appDataFromLoad = useRef(false);

  // --- PERSISTENCE ---
  useEffect(() => {
    if (adminMaster) {
      localStorage.setItem('hub_admin', JSON.stringify(adminMaster));
    } else {
      localStorage.removeItem('hub_admin');
    }
  }, [adminMaster]);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('hub_current_user', currentUser);
    } else {
      localStorage.removeItem('hub_current_user');
      sessionStorage.removeItem('hub_temp_pin');
    }
  }, [currentUser]);

  useEffect(() => {
    if (currentUserPin) {
      sessionStorage.setItem('hub_temp_pin', currentUserPin);
    }
  }, [currentUserPin]);

  useEffect(() => {
    localStorage.setItem('hub_users_db', JSON.stringify(usersDB));
  }, [usersDB]);

  useEffect(() => {
    localStorage.setItem('hub_system_settings', JSON.stringify(systemSettings));
  }, [systemSettings]);

  // Load appData when currentUser changes
  useEffect(() => {
    if (currentUser && currentUser !== 'MASTER') {
      // 1. If user doesn't exist in DB anymore, clear session
      if (!usersDB[currentUser]) {
        setCurrentUser(null);
        setCurrentUserPin(null);
        setAppData(null);
        return;
      }
      
      // 2. If we don't have the PIN in session, force login.
      if (!currentUserPin) {
        setCurrentUser(null);
        setAppData(null);
        return;
      }

      appDataFromLoad.current = true;
      let data = usersDB[currentUser].appData || createDefaultAppData();
      
      setAppData(data);
    } else if (currentUser === 'MASTER') {
      setAppData(null);
    } else {
      setAppData(null);
    }
  }, [currentUser, currentUserPin, usersDB]);

  // Save appData back to usersDB when user updates it (but NOT on load)
  useEffect(() => {
    if (appDataFromLoad.current) {
      appDataFromLoad.current = false;
      return; // skip saving on initial load to avoid loop
    }
    if (currentUser && currentUser !== 'MASTER' && appData && currentUserPin) {
      setUsersDB(prev => ({
        ...prev,
        [currentUser]: {
          ...prev[currentUser],
          appData: appData
        }
      }));
    }
  }, [appData]);

  const createDefaultAppData = () => {
    const now = new Date();
    const expiry = new Date(now.getTime() + 72 * 60 * 60 * 1000); // 72h (3 days)

    return {
      habitsBuffer: [],
      habitsLogsBuffer: [],
      transactionsBuffer: [],
      investmentsBuffer: [],
      depositsBuffer: [],
      booksBuffer: [],
      studiesBuffer: [],
      runningBuffer: [],
      profile: { name: '', email: '', bloodType: '', customFields: [], isFavorite: false },
      financeMeta: { goalAmount: 0, goalPatrimony: 0 },
      subscription: {
        status: 'trial',
        createdAt: now.toISOString(),
        expiresAt: expiry.toISOString(),
        totalHoursBought: 0
      }
    };
  };

  // --- ACTIONS ---
  const login = (id, pin) => {
    if (id === 'MASTER' || usersDB[id]) {
      setCurrentUser(id);
      if (pin) setCurrentUserPin(pin);
      return true;
    }
    return false;
  };

  const logout = () => {
    setCurrentUser(null);
    setCurrentUserPin(null);
    setAppData(null);
  };

  const register = (userObj) => {
    if (usersDB[userObj.id]) return false;
    
    // During registration, the initial appData is plain. 
    // It will be encrypted on the first update if pin is set.
    setUsersDB(prev => ({
      ...prev,
      [userObj.id]: {
        ...userObj,
        appData: createDefaultAppData()
      }
    }));
    return true;
  };

  const updateAppData = (updater) => {
    setAppData(prev => {
      if (!prev) return prev;
      return typeof updater === 'function' ? updater(prev) : { ...prev, ...updater };
    });
  };

  const updateProfile = (profileData) => {
    setAppData(prev => {
      if (!prev) return prev;
      return { ...prev, profile: { ...prev.profile, ...profileData } };
    });
  };

  const value = {
    currentUser,
    currentUserPin,
    setCurrentUserPin,
    appData,
    usersDB,
    adminMaster,
    systemSettings,
    login,
    logout,
    register,
    updateAppData,
    updateProfile,
    setSystemSettings,
    setAdminMaster,
    setUsersDB,
    createDefaultAppData,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};
