import React, { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react';
import api from '../lib/api';

type Address = {
  id?: number;
  label?: string;
  street?: string;
  barangay?: string;
  city?: string;
  province?: string;
  latitude?: number | null;
  longitude?: number | null;
  is_default?: boolean;
  created_at?: string;
};

type AddressContextType = {
  addressModalVisible: boolean;
  selectedAddress: Address | null;
  openAddressModal: () => void;
  closeAddressModal: () => void;
  setSelectedAddress: (addr: Address) => void;
};

const AddressContext = createContext<AddressContextType>({
  addressModalVisible: false,
  selectedAddress: null,
  openAddressModal: () => {},
  closeAddressModal: () => {},
  setSelectedAddress: () => {},
});

export function AddressProvider({ children }: { children: ReactNode }) {
  const [addressModalVisible, setAddressModalVisible] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState<Address | null>(null);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/addresses');
        const list: Address[] = res.data || [];
        if (isMounted.current && list.length > 0) {
          const defaultAddr = list.find((a) => a.is_default);
          const latest = defaultAddr || list[list.length - 1];
          setSelectedAddress(latest);
        }
      } catch {
        // silently ignore
      }
    })();
  }, []);

  const openAddressModal = useCallback(() => setAddressModalVisible(true), []);
  const closeAddressModal = useCallback(() => setAddressModalVisible(false), []);

  return (
    <AddressContext.Provider
      value={{
        addressModalVisible,
        selectedAddress,
        openAddressModal,
        closeAddressModal,
        setSelectedAddress,
      }}
    >
      {children}
    </AddressContext.Provider>
  );
}

export function useAddress() {
  return useContext(AddressContext);
}
