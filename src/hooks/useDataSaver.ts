import { useCallback, useEffect, useState } from 'react';
import {
  DATA_SAVER_EVENT,
  DataSaverPreference,
  DataSaverStatus,
  getDataSaverStatus,
  getNetworkConnection,
  saveDataSaverPreference,
} from '../utils/dataSaver.ts';

export function useDataSaver() {
  const [status, setStatus] = useState<DataSaverStatus>(() => getDataSaverStatus());

  const refresh = useCallback(() => {
    setStatus(getDataSaverStatus());
  }, []);

  useEffect(() => {
    const handleCustom = () => refresh();
    const handleStorage = (e: StorageEvent) => {
      if (!e.key || e.key === 'kingdom_plus_data_saver_pref') {
        refresh();
      }
    };

    window.addEventListener(DATA_SAVER_EVENT, handleCustom);
    window.addEventListener('storage', handleStorage);

    const conn = getNetworkConnection();
    if (conn && typeof conn.addEventListener === 'function') {
      conn.addEventListener('change', handleCustom);
    }

    return () => {
      window.removeEventListener(DATA_SAVER_EVENT, handleCustom);
      window.removeEventListener('storage', handleStorage);
      if (conn && typeof conn.removeEventListener === 'function') {
        conn.removeEventListener('change', handleCustom);
      }
    };
  }, [refresh]);

  const setPreference = useCallback((pref: DataSaverPreference) => {
    saveDataSaverPreference(pref);
    setStatus(getDataSaverStatus());
  }, []);

  const toggleQuickDataSaver = useCallback(() => {
    const current = getDataSaverStatus();
    const nextPref: DataSaverPreference = current.isDataSaverActive ? 'off' : 'on';
    saveDataSaverPreference(nextPref);
    setStatus(getDataSaverStatus());
    return nextPref === 'on';
  }, []);

  return {
    ...status,
    setPreference,
    toggleQuickDataSaver,
  };
}
