import React, { createContext, useContext, useReducer, useMemo, useCallback } from 'react';

export interface CartItem {
  productId: number;
  name: string;
  price: number;
  quantity: number;
  image?: string | null;
}

interface CartState {
  items: CartItem[];
  branchId: number | null;
  branchName: string | null;
}

type CartAction =
  | { type: 'ADD_ITEM'; payload: { productId: number; name: string; price: number; branchId: number; branchName: string; image?: string | null } }
  | { type: 'REMOVE_ITEM'; payload: { productId: number } }
  | { type: 'UPDATE_QTY'; payload: { productId: number; quantity: number } }
  | { type: 'CLEAR' }
  | { type: 'SET_BRANCH'; payload: { branchId: number; branchName: string } };

const initialState: CartState = {
  items: [],
  branchId: null,
  branchName: null,
};

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'ADD_ITEM': {
      const existing = state.items.find(i => i.productId === action.payload.productId);
      if (existing) {
        return {
          ...state,
          items: state.items.map(i =>
            i.productId === action.payload.productId
              ? { ...i, quantity: i.quantity + 1, image: i.image ?? action.payload.image ?? null }
              : i
          ),
          branchId: action.payload.branchId,
          branchName: action.payload.branchName,
        };
      }
      return {
        ...state,
        items: [...state.items, {
          productId: action.payload.productId,
          name: action.payload.name,
          price: action.payload.price,
          quantity: 1,
          image: action.payload.image ?? null,
        }],
        branchId: action.payload.branchId,
        branchName: action.payload.branchName,
      };
    }
    case 'REMOVE_ITEM':
      return {
        ...state,
        items: state.items.filter(i => i.productId !== action.payload.productId),
      };
    case 'UPDATE_QTY': {
      if (action.payload.quantity <= 0) {
        return {
          ...state,
          items: state.items.filter(i => i.productId !== action.payload.productId),
        };
      }
      return {
        ...state,
        items: state.items.map(i =>
          i.productId === action.payload.productId
            ? { ...i, quantity: action.payload.quantity }
            : i
        ),
      };
    }
    case 'CLEAR':
      return initialState;
    case 'SET_BRANCH':
      return { ...state, branchId: action.payload.branchId, branchName: action.payload.branchName };
    default:
      return state;
  }
}

interface CartContextValue {
  items: CartItem[];
  branchId: number | null;
  branchName: string | null;
  itemCount: number;
  subtotal: number;
  addItem: (productId: number, name: string, price: number, branchId: number, branchName: string, image?: string | null) => void;
  removeItem: (productId: number) => void;
  updateQuantity: (productId: number, quantity: number) => void;
  clearCart: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, initialState);

  const itemCount = useMemo(() =>
    state.items.reduce((sum, i) => sum + i.quantity, 0),
    [state.items]
  );

  const subtotal = useMemo(() =>
    state.items.reduce((sum, i) => sum + i.price * i.quantity, 0),
    [state.items]
  );

  const addItem = useCallback((productId: number, name: string, price: number, branchId: number, branchName: string, image?: string | null) => {
    dispatch({ type: 'ADD_ITEM', payload: { productId, name, price, branchId, branchName, image } });
  }, []);

  const removeItem = useCallback((productId: number) => {
    dispatch({ type: 'REMOVE_ITEM', payload: { productId } });
  }, []);

  const updateQuantity = useCallback((productId: number, quantity: number) => {
    dispatch({ type: 'UPDATE_QTY', payload: { productId, quantity } });
  }, []);

  const clearCart = useCallback(() => {
    dispatch({ type: 'CLEAR' });
  }, []);

  return (
    <CartContext.Provider value={{ items: state.items, branchId: state.branchId, branchName: state.branchName, itemCount, subtotal, addItem, removeItem, updateQuantity, clearCart }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
