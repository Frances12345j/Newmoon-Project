import { useEffect } from "react";

export const useOrderWebSocket = ({ onOrderStatusUpdated, onNewOrderCreated }) => {
  useEffect(() => {
    const interval = setInterval(() => {
      onOrderStatusUpdated?.();
      onNewOrderCreated?.();
    }, 15000);
    return () => clearInterval(interval);
  }, []);
};
