'use client';

import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  ReactNode,
} from 'react';
import { Album, GridSize, GRID_SIZES } from '@/types/album';

interface Recommendation {
  title: string;
  artist: string;
  coverUrl: string;
}

interface CollageState {
  screen: 'add' | 'arrange' | 'generate';
  tray: Album[];
  gridSize: GridSize;
  gridOrder: string[];
  recommendations: Recommendation[];
  recsLoading: boolean;
}

type Action =
  | { type: 'ADD_ALBUM'; album: Album }
  | { type: 'REMOVE_ALBUM'; id: string }
  | { type: 'CLEAR_ALL' }
  | { type: 'REORDER_GRID'; gridOrder: string[] }
  | { type: 'SET_GRID_SIZE'; gridSize: GridSize }
  | { type: 'SET_SCREEN'; screen: CollageState['screen'] }
  | { type: 'SET_RECOMMENDATIONS'; recommendations: Recommendation[] }
  | { type: 'SET_RECS_LOADING'; loading: boolean }
  | { type: 'OVERRIDE_COVER'; id: string; coverOverride: string }
  | { type: 'UPDATE_ALBUM_META'; id: string; releaseYear: number; genre: string };

const STORAGE_KEY = 'collage-v1';

function getInitialState(): CollageState {
  return {
    screen: 'add',
    tray: [],
    gridSize: 9,
    gridOrder: [],
    recommendations: [],
    recsLoading: false,
  };
}

function loadFromStorage(): Partial<CollageState> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function largestGridFor(count: number): GridSize {
  const valid = [...GRID_SIZES].reverse().find((s) => s <= count);
  return valid ?? GRID_SIZES[0];
}

function reducer(state: CollageState, action: Action): CollageState {
  switch (action.type) {
    case 'ADD_ALBUM': {
      if (state.tray.find((a) => a.id === action.album.id)) return state;
      const newTray = [...state.tray, action.album];
      const bestSize = largestGridFor(newTray.length);
      return {
        ...state,
        tray: newTray,
        gridSize: bestSize,
        gridOrder: [...state.gridOrder, action.album.id],
      };
    }
    case 'REMOVE_ALBUM': {
      const newTray = state.tray.filter((a) => a.id !== action.id);
      const bestSize = largestGridFor(newTray.length);
      return {
        ...state,
        tray: newTray,
        gridSize: bestSize,
        gridOrder: state.gridOrder.filter((id) => id !== action.id),
      };
    }
    case 'CLEAR_ALL': {
      return { ...getInitialState() };
    }
    case 'REORDER_GRID': {
      return { ...state, gridOrder: action.gridOrder };
    }
    case 'SET_GRID_SIZE': {
      return { ...state, gridSize: action.gridSize };
    }
    case 'SET_SCREEN': {
      return { ...state, screen: action.screen };
    }
    case 'SET_RECOMMENDATIONS': {
      return { ...state, recommendations: action.recommendations };
    }
    case 'SET_RECS_LOADING': {
      return { ...state, recsLoading: action.loading };
    }
    case 'UPDATE_ALBUM_META': {
      return {
        ...state,
        tray: state.tray.map((a) =>
          a.id === action.id ? { ...a, releaseYear: action.releaseYear, genre: action.genre } : a
        ),
      };
    }
    case 'OVERRIDE_COVER': {
      return {
        ...state,
        tray: state.tray.map((a) =>
          a.id === action.id
            ? { ...a, coverOverride: action.coverOverride, coverUrl: action.coverOverride }
            : a
        ),
      };
    }
    default:
      return state;
  }
}

const CollageContext = createContext<{
  state: CollageState;
  dispatch: React.Dispatch<Action>;
} | null>(null);

export function CollageProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, getInitialState(), (base) => {
    const saved = loadFromStorage();
    return {
      ...base,
      tray: saved.tray ?? base.tray,
      gridOrder: saved.gridOrder ?? base.gridOrder,
      gridSize: saved.gridSize ?? base.gridSize,
    };
  });

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ tray: state.tray, gridOrder: state.gridOrder, gridSize: state.gridSize })
      );
    } catch {
      // storage might be unavailable
    }
  }, [state.tray, state.gridOrder, state.gridSize]);

  return (
    <CollageContext.Provider value={{ state, dispatch }}>
      {children}
    </CollageContext.Provider>
  );
}

export function useCollage() {
  const ctx = useContext(CollageContext);
  if (!ctx) throw new Error('useCollage must be used within CollageProvider');
  return ctx;
}
