import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type {
  Ammunition,
  CreateAmmunitionInput,
  CreateDogInput,
  CreateLocationInput,
  CreateSessionInput,
  CreateWeaponInput,
  Dog,
  Location,
  Session,
  UserData,
  Weapon,
} from '@huntledger/shared';
import { useAuth } from '../auth/useAuth';
import type { DataAdapter } from './DataAdapter';
import { LocalStorageDataAdapter } from './LocalStorageDataAdapter';
import { ApiDataAdapter } from './ApiDataAdapter';
import { buildSeedData } from './seed';

export interface DataContextValue {
  data: UserData;
  isLoading: boolean;
  refresh: () => Promise<void>;
  createWeapon: (input: CreateWeaponInput) => Promise<Weapon>;
  createAmmunition: (input: CreateAmmunitionInput) => Promise<Ammunition>;
  createDog: (input: CreateDogInput) => Promise<Dog>;
  createLocation: (input: CreateLocationInput) => Promise<Location>;
  createSession: (input: CreateSessionInput) => Promise<Session>;
  archiveWeapon: (id: string) => Promise<void>;
  archiveAmmunition: (id: string) => Promise<void>;
  archiveLocation: (id: string) => Promise<void>;
  unarchiveWeapon: (id: string) => Promise<void>;
  unarchiveAmmunition: (id: string) => Promise<void>;
  unarchiveLocation: (id: string) => Promise<void>;
  deleteWeapon: (id: string) => Promise<void>;
  deleteAmmunition: (id: string) => Promise<void>;
  deleteLocation: (id: string) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
  updateLocation: (id: string, input: Record<string, unknown>) => Promise<void>;
  updateWeapon: (id: string, input: Record<string, unknown>) => Promise<void>;
  updateAmmunition: (id: string, input: Record<string, unknown>) => Promise<void>;
  updateSession: (id: string, input: Record<string, unknown>) => Promise<void>;
}

const empty: UserData = {
  sessions: [],
  weapons: [],
  ammunition: [],
  dogs: [],
  locations: [],
};

export const DataContext = createContext<DataContextValue | undefined>(undefined);

// F2: use ApiDataAdapter when VITE_USE_BACKEND === 'true'
const adapter: DataAdapter =
  import.meta.env.VITE_USE_BACKEND === 'true'
    ? new ApiDataAdapter()
    : new LocalStorageDataAdapter();

export function DataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [data, setData] = useState(empty);
  const [isLoading, setIsLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) {
      setData(empty);
      return;
    }
    // Always load archived so components can filter per-category client-side
    const loaded = await (adapter as ApiDataAdapter).load(user.id, { includeArchived: true });
    const isEmpty =
      loaded.sessions.length === 0 &&
      loaded.weapons.length === 0 &&
      loaded.ammunition.length === 0 &&
      loaded.dogs.length === 0 &&
      loaded.locations.length === 0;

    if (isEmpty && import.meta.env.VITE_USE_BACKEND !== 'true') {
      const seeded = buildSeedData(user.id);
      await adapter.save(user.id, seeded);
      setData(seeded);
    } else {
      setData(loaded);
    }
  }, [user]);

  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setData(empty);
      return;
    }
    setIsLoading(true);
    refresh()
      .catch((err) => console.error('Failed to load HuntLedger data', err))
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user, refresh]);

  const createWeapon = useCallback(
    async (input: CreateWeaponInput) => {
      if (!user) throw new Error('not signed in');
      const weapon = await adapter.createWeapon(user.id, input);
      await refresh();
      return weapon;
    },
    [user, refresh],
  );

  const createAmmunition = useCallback(
    async (input: CreateAmmunitionInput) => {
      if (!user) throw new Error('not signed in');
      const ammo = await adapter.createAmmunition(user.id, input);
      await refresh();
      return ammo;
    },
    [user, refresh],
  );

  const createDog = useCallback(
    async (input: CreateDogInput) => {
      if (!user) throw new Error('not signed in');
      const dog = await adapter.createDog(user.id, input);
      await refresh();
      return dog;
    },
    [user, refresh],
  );

  const createLocation = useCallback(
    async (input: CreateLocationInput) => {
      if (!user) throw new Error('not signed in');
      const location = await adapter.createLocation(user.id, input);
      await refresh();
      return location;
    },
    [user, refresh],
  );

  const createSession = useCallback(
    async (input: CreateSessionInput) => {
      if (!user) throw new Error('not signed in');
      const session = await adapter.createSession(user.id, input);
      await refresh();
      return session;
    },
    [user, refresh],
  );

  const archiveWeapon = useCallback(
    async (id: string) => {
      if (!user) throw new Error('not signed in');
      const apiAdapter = adapter as ApiDataAdapter;
      if (typeof apiAdapter.archiveWeapon === 'function') {
        await apiAdapter.archiveWeapon(user.id, id);
      }
      await refresh();
    },
    [user, refresh],
  );

  const archiveAmmunition = useCallback(
    async (id: string) => {
      if (!user) throw new Error('not signed in');
      const apiAdapter = adapter as ApiDataAdapter;
      if (typeof apiAdapter.archiveAmmunition === 'function') {
        await apiAdapter.archiveAmmunition(user.id, id);
      }
      await refresh();
    },
    [user, refresh],
  );

  const archiveLocation = useCallback(
    async (id: string) => {
      if (!user) throw new Error('not signed in');
      const apiAdapter = adapter as ApiDataAdapter;
      if (typeof apiAdapter.archiveLocation === 'function') {
        await apiAdapter.archiveLocation(user.id, id);
      }
      await refresh();
    },
    [user, refresh],
  );

  const unarchiveWeapon = useCallback(
    async (id: string) => {
      if (!user) throw new Error('not signed in');
      const apiAdapter = adapter as ApiDataAdapter;
      if (typeof apiAdapter.unarchiveWeapon === 'function') {
        await apiAdapter.unarchiveWeapon(user.id, id);
      }
      await refresh();
    },
    [user, refresh],
  );

  const unarchiveAmmunition = useCallback(
    async (id: string) => {
      if (!user) throw new Error('not signed in');
      const apiAdapter = adapter as ApiDataAdapter;
      if (typeof apiAdapter.unarchiveAmmunition === 'function') {
        await apiAdapter.unarchiveAmmunition(user.id, id);
      }
      await refresh();
    },
    [user, refresh],
  );

  const unarchiveLocation = useCallback(
    async (id: string) => {
      if (!user) throw new Error('not signed in');
      const apiAdapter = adapter as ApiDataAdapter;
      if (typeof apiAdapter.unarchiveLocation === 'function') {
        await apiAdapter.unarchiveLocation(user.id, id);
      }
      await refresh();
    },
    [user, refresh],
  );

  const deleteWeapon = useCallback(
    async (id: string) => {
      if (!user) throw new Error('not signed in');
      const apiAdapter = adapter as ApiDataAdapter;
      if (typeof apiAdapter.deleteWeapon === 'function') {
        await apiAdapter.deleteWeapon(user.id, id);
      }
      await refresh();
    },
    [user, refresh],
  );

  const deleteAmmunition = useCallback(
    async (id: string) => {
      if (!user) throw new Error('not signed in');
      const apiAdapter = adapter as ApiDataAdapter;
      if (typeof apiAdapter.deleteAmmunition === 'function') {
        await apiAdapter.deleteAmmunition(user.id, id);
      }
      await refresh();
    },
    [user, refresh],
  );

  const deleteLocation = useCallback(
    async (id: string) => {
      if (!user) throw new Error('not signed in');
      const apiAdapter = adapter as ApiDataAdapter;
      if (typeof apiAdapter.deleteLocation === 'function') {
        await apiAdapter.deleteLocation(user.id, id);
      }
      await refresh();
    },
    [user, refresh],
  );

  const deleteSession = useCallback(
    async (id: string) => {
      if (!user) throw new Error('not signed in');
      const apiAdapter = adapter as ApiDataAdapter;
      if (typeof apiAdapter.deleteSession === 'function') {
        await apiAdapter.deleteSession(user.id, id);
      }
      await refresh();
    },
    [user, refresh],
  );

  const updateLocation = useCallback(
    async (id: string, input: Record<string, unknown>) => {
      if (!user) throw new Error('not signed in');
      const apiAdapter = adapter as ApiDataAdapter;
      if (typeof apiAdapter.updateLocation === 'function') {
        await apiAdapter.updateLocation(user.id, id, input);
      }
      await refresh();
    },
    [user, refresh],
  );

  const updateWeapon = useCallback(
    async (id: string, input: Record<string, unknown>) => {
      if (!user) throw new Error('not signed in');
      const apiAdapter = adapter as ApiDataAdapter;
      if (typeof apiAdapter.updateWeapon === 'function') {
        await apiAdapter.updateWeapon(user.id, id, input);
      }
      await refresh();
    },
    [user, refresh],
  );

  const updateAmmunition = useCallback(
    async (id: string, input: Record<string, unknown>) => {
      if (!user) throw new Error('not signed in');
      const apiAdapter = adapter as ApiDataAdapter;
      if (typeof apiAdapter.updateAmmunition === 'function') {
        await apiAdapter.updateAmmunition(user.id, id, input);
      }
      await refresh();
    },
    [user, refresh],
  );

  const updateSession = useCallback(
    async (id: string, input: Record<string, unknown>) => {
      if (!user) throw new Error('not signed in');
      const apiAdapter = adapter as ApiDataAdapter;
      if (typeof apiAdapter.updateSession === 'function') {
        await apiAdapter.updateSession(user.id, id, input);
      }
      await refresh();
    },
    [user, refresh],
  );

  const value = useMemo(
    () => ({
      data,
      isLoading,
      refresh,
      createWeapon,
      createAmmunition,
      createDog,
      createLocation,
      createSession,
      archiveWeapon,
      archiveAmmunition,
      archiveLocation,
      unarchiveWeapon,
      unarchiveAmmunition,
      unarchiveLocation,
      deleteWeapon,
      deleteAmmunition,
      deleteLocation,
      deleteSession,
      updateLocation,
      updateWeapon,
      updateAmmunition,
      updateSession,
    }),
    [
      data, isLoading, refresh,
      createWeapon, createAmmunition, createDog, createLocation, createSession,
      archiveWeapon, archiveAmmunition, archiveLocation,
      unarchiveWeapon, unarchiveAmmunition, unarchiveLocation,
      deleteWeapon, deleteAmmunition, deleteLocation,
      deleteSession, updateLocation, updateWeapon, updateAmmunition, updateSession,
    ],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}
