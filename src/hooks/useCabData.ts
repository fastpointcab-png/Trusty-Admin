import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  FirestoreDriver,
  FirestoreTrip,
  SystemControlSettings,
  FareRateCard,
  SystemEventLog,
  FirebaseConnectionConfig,
  VehicleCategory,
  DriverStatus,
  AdminUser,
  CustomerTrackingSession,
} from '../types';
import {
  INITIAL_DRIVERS,
  INITIAL_TRIPS,
  INITIAL_SYSTEM_SETTINGS,
  INITIAL_RATE_CARDS,
  INITIAL_LOGS,
  INITIAL_ADMIN_USERS,
} from '../data/seedData';
import {
  getStoredFirebaseConfig,
  saveStoredFirebaseConfig,
  subscribeToFirestoreDrivers,
  subscribeToFirestoreTrips,
  subscribeToFirestoreSystemSettings,
  upsertDriverInFirestore,
  deleteDriverFromFirestore,
  upsertTripInFirestore,
  deleteTripFromFirestore,
  updateSystemSettingsInFirestore,
  cleanUpLegacyDriverControlInFirestore,
  testFirebaseConnection,
  createTrackingSessionInFirestore,
  disableTrackingSessionInFirestore,
  cleanAndDeduplicateDriversInFirestore,
  startUninstalledDriversCleaner,
  setDriverOfficeDue as setDriverOfficeDueInFirestore,
  clearDriverOfficeDue as clearDriverOfficeDueInFirestore,
} from '../firebase/config';

const DRIVERS_STORAGE_KEY = 'trusty_cab_drivers_local_v1';
const TRIPS_STORAGE_KEY = 'trusty_cab_trips_local_v1';
const SETTINGS_STORAGE_KEY = 'trusty_cab_settings_local_v1';
const RATES_STORAGE_KEY = 'trusty_cab_rates_local_v1';
const ADMINS_STORAGE_KEY = 'trusty_cab_admins_local_v1';

export function useCabData() {
  const [firebaseConfig, setFirebaseConfig] = useState<FirebaseConnectionConfig>(getStoredFirebaseConfig);
  const [isFirebaseConnected, setIsFirebaseConnected] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [connectionStatusText, setConnectionStatusText] = useState('Checking database connection...');

  // Admin users state
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>(() => {
    try {
      const saved = localStorage.getItem(ADMINS_STORAGE_KEY);
      const parsed: AdminUser[] = saved ? JSON.parse(saved) : INITIAL_ADMIN_USERS;
      return parsed.map((a) => ({
        ...a,
        email: a.email === '123mdcreation@gmail.com' ? 'admin@trustyyellowcab.com' : a.email,
        name: a.name?.replace(/Primary Super Administrator|Super Administrator|Super Admin/gi, 'Administrator') || 'Administrator',
      }));
    } catch {
      return INITIAL_ADMIN_USERS;
    }
  });

  const [currentAdmin, setCurrentAdmin] = useState<AdminUser>(() => {
    return adminUsers[0] || INITIAL_ADMIN_USERS[0];
  });

  // Core Data States
  const [drivers, setDrivers] = useState<FirestoreDriver[]>(() => {
    try {
      const saved = localStorage.getItem(DRIVERS_STORAGE_KEY);
      return saved ? JSON.parse(saved) : INITIAL_DRIVERS;
    } catch {
      return INITIAL_DRIVERS;
    }
  });

  // Stable reference for 2000-5000+ drivers to prevent callback thrashing during live GPS pings
  const driversRef = useRef<FirestoreDriver[]>(drivers);
  useEffect(() => {
    driversRef.current = drivers;
  }, [drivers]);

  // Fast O(1) driver lookup map for instant cross-referencing
  const driversMap = useMemo(() => {
    const map = new Map<string, FirestoreDriver>();
    for (let i = 0; i < drivers.length; i++) {
      const d = drivers[i];
      map.set(d.driver_id, d);
      if (d.doc_id) map.set(d.doc_id, d);
    }
    return map;
  }, [drivers]);

  const [trips, setTrips] = useState<FirestoreTrip[]>(() => {
    try {
      const saved = localStorage.getItem(TRIPS_STORAGE_KEY);
      const rawTrips: FirestoreTrip[] = saved ? JSON.parse(saved) : INITIAL_TRIPS;
      return rawTrips.map((t) => ({
        ...t,
        tracking_token: t.tracking_token || `TRK-${t.trip_id}`,
        tracking_enabled: t.tracking_enabled ?? true,
        tracking_created_at: t.tracking_created_at || t.created_at || Date.now(),
      }));
    } catch {
      return INITIAL_TRIPS;
    }
  });

  const [systemSettings, setSystemSettings] = useState<SystemControlSettings>(() => {
    try {
      const saved = localStorage.getItem(SETTINGS_STORAGE_KEY);
      return saved ? JSON.parse(saved) : INITIAL_SYSTEM_SETTINGS;
    } catch {
      return INITIAL_SYSTEM_SETTINGS;
    }
  });

  // Track timestamp of admin manual cutoff actions to protect against older remote snapshot overwrites
  const lastManualKillswitchActionRef = useRef<number>(0);

  const [rateCards, setRateCards] = useState<FareRateCard[]>(() => {
    try {
      const saved = localStorage.getItem(RATES_STORAGE_KEY);
      return saved ? JSON.parse(saved) : INITIAL_RATE_CARDS;
    } catch {
      return INITIAL_RATE_CARDS;
    }
  });

  const [logs, setLogs] = useState<SystemEventLog[]>(INITIAL_LOGS);

  // Helper to append log entries
  const addLog = useCallback((level: SystemEventLog['level'], source: SystemEventLog['source'], title: string, message: string) => {
    const newLog: SystemEventLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: Date.now(),
      level,
      source,
      title,
      message,
    };
    setLogs((prev) => [newLog, ...prev.slice(0, 99)]);
  }, []);

  // Save to LocalStorage with debouncing and idle scheduling to prevent UI blocking
  // Optimized for 5,000 to 10,000 drivers with instant local data sync
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const compact = drivers.map((d) => ({
          doc_id: d.doc_id,
          driver_id: d.driver_id,
          driver_name: d.driver_name,
          mobile_number: d.mobile_number,
          vehicle_number: d.vehicle_number,
          vehicle_category: d.vehicle_category,
          status: d.status,
          is_online: d.is_online,
          latitude: d.latitude,
          longitude: d.longitude,
          rating: d.rating,
          total_trips: d.total_trips,
          payment_amount: d.payment_amount,
          payment_status: d.payment_status,
          payment_note: d.payment_note,
          office_upi_id: d.office_upi_id,
          driver_payment_status: d.driver_payment_status,
          payment_updated_at: d.payment_updated_at,
        }));
        localStorage.setItem(DRIVERS_STORAGE_KEY, JSON.stringify(compact));
      } catch (e) {
        // Fallback for browser storage quota: keep core essential fleet index
        try {
          const fallback = drivers.slice(0, 2500).map((d) => ({
            driver_id: d.driver_id,
            driver_name: d.driver_name,
            mobile_number: d.mobile_number,
            vehicle_number: d.vehicle_number,
            vehicle_category: d.vehicle_category,
            status: d.status,
            is_online: d.is_online,
            payment_amount: d.payment_amount,
            payment_status: d.payment_status,
            payment_note: d.payment_note,
            office_upi_id: d.office_upi_id,
          }));
          localStorage.setItem(DRIVERS_STORAGE_KEY, JSON.stringify(fallback));
        } catch {}
        console.warn('Driver storage save notice (quota limit handled)', e);
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [drivers]);

  const suppressTripsLocalStorageRef = useRef<boolean>(false);

  useEffect(() => {
    if (suppressTripsLocalStorageRef.current) {
      return;
    }
    const timer = setTimeout(() => {
      try {
        if (trips.length > 1000) {
          // Cache the 1000 most recent trips to keep local storage fast and comprehensive
          localStorage.setItem(TRIPS_STORAGE_KEY, JSON.stringify(trips.slice(0, 1000)));
        } else if (trips.length > 0) {
          localStorage.setItem(TRIPS_STORAGE_KEY, JSON.stringify(trips));
        } else {
          localStorage.removeItem(TRIPS_STORAGE_KEY);
        }
      } catch (e) {
        console.warn('Trips storage save notice (quota limit handled)', e);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [trips]);

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(systemSettings));
      } catch (e) {
        console.warn('Storage save failed', e);
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [systemSettings]);

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(ADMINS_STORAGE_KEY, JSON.stringify(adminUsers));
      } catch (e) {
        console.warn('Storage save failed', e);
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [adminUsers]);

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(RATES_STORAGE_KEY, JSON.stringify(rateCards));
      } catch (e) {
        console.warn('Storage save failed', e);
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [rateCards]);

  // Handle Firestore Live Synchronization
  useEffect(() => {
    let unsubs: (() => void)[] = [];

    async function setupLiveSync() {
      setIsSyncing(true);
      const test = await testFirebaseConnection(firebaseConfig);
      if (test.success) {
        setIsFirebaseConnected(true);
        setConnectionStatusText(`Live Firestore: ${firebaseConfig.projectId}`);
        addLog('SUCCESS', 'FIRESTORE', 'Firestore Connected', `Connected to live Firestore project "${firebaseConfig.projectId}".`);

        // Subscribe to drivers
        const unsubDrivers = subscribeToFirestoreDrivers(
          firebaseConfig,
          (remoteDrivers) => {
            if (remoteDrivers && remoteDrivers.length > 0) {
              setDrivers(remoteDrivers);
              addLog('INFO', 'FIRESTORE', 'Drivers Synced', `Received ${remoteDrivers.length} drivers from Firestore.`);
            }
          },
          (err) => {
            console.warn('Driver sync notice:', err);
          }
        );
        if (unsubDrivers) unsubs.push(unsubDrivers);

        // Ensure driver table is clean of any legacy admin control documents
        cleanUpLegacyDriverControlInFirestore(firebaseConfig).catch(() => {});

        // Automatically clean and deduplicate repeated data in drivers table in background
        cleanAndDeduplicateDriversInFirestore(firebaseConfig).catch(() => {});

        // Auto-sweep uninstalled/dead drivers every 30 seconds
        const stopUninstalledCleaner = startUninstalledDriversCleaner(firebaseConfig, (offlineDriverId) => {
          setDrivers((prev) =>
            prev.map((d) =>
              d.driver_id === offlineDriverId || (d as any).doc_id === offlineDriverId
                ? { ...d, is_online: false, last_heartbeat: 0, device_id: '' }
                : d
            )
          );
          addLog(
            'WARNING',
            'ADMIN',
            'Driver Offline Swept',
            `Driver ${offlineDriverId} uninstalled or closed (>75s no heartbeat). Marked OFFLINE and device cleared.`
          );
        });
        if (stopUninstalledCleaner) unsubs.push(stopUninstalledCleaner);

        // Subscribe to trips
        const unsubTrips = subscribeToFirestoreTrips(
          firebaseConfig,
          (remoteTrips) => {
            if (remoteTrips && remoteTrips.length > 0) {
              setTrips(remoteTrips);
              addLog('INFO', 'FIRESTORE', 'Trips Synced', `Received ${remoteTrips.length} trips from Firestore.`);
            }
          },
          (err) => {
            console.warn('Trip sync notice:', err);
          }
        );
        if (unsubTrips) unsubs.push(unsubTrips);

        // Subscribe to system settings
        const unsubSettings = subscribeToFirestoreSystemSettings(
          firebaseConfig,
          (remoteSettings) => {
            if (remoteSettings) {
              // Snapshot Conflict Protection:
              // If the admin made a manual killswitch action recently (< 15 seconds)
              // and the incoming remote snapshot's updated_at is older than our manual action,
              // do NOT let the stale remote snapshot revert the admin's cutoff!
              if (
                lastManualKillswitchActionRef.current > 0 &&
                Date.now() - lastManualKillswitchActionRef.current < 15000 &&
                (remoteSettings.updated_at || 0) < lastManualKillswitchActionRef.current
              ) {
                return;
              }

              setSystemSettings((prev) => ({
                ...prev,
                ...remoteSettings,
                rule_permission_notice: prev.rule_permission_notice,
              }));
              addLog('INFO', 'FIRESTORE', 'System Settings Synced', `Admin status: ${remoteSettings.status}`);
            }
          },
          (err) => {
            console.warn('Settings sync notice:', err);
          }
        );
        if (unsubSettings) unsubs.push(unsubSettings);
      } else {
        setIsFirebaseConnected(false);
        setConnectionStatusText(
          test.isUnavailable
            ? `Local Offline Mode (Ready for Firestore: ${firebaseConfig.projectId})`
            : `Local Console Mode (Ready for Firestore: ${firebaseConfig.projectId})`
        );
        addLog(
          'INFO',
          'ADMIN',
          test.isUnavailable ? 'Offline Local Console Mode' : 'Local Mode Active',
          test.isUnavailable
            ? 'Firestore backend is currently unreachable. Operating locally with instant dispatch and demo fleet.'
            : 'Operating with instant local dispatch engine and demo fleet.'
        );
      }
      setIsSyncing(false);
    }

    setupLiveSync();

    const handleOnline = () => {
      addLog('INFO', 'NETWORK', 'Network Reconnected', 'Device is back online. Re-checking Firestore sync...');
      setupLiveSync();
    };
    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('online', handleOnline);
      unsubs.forEach((fn) => fn());
    };
  }, [firebaseConfig, addLog]);

  // Periodic simulated live GPS driver movement (subtle drift for realism in demo mode only)
  useEffect(() => {
    if (isFirebaseConnected) return; // Do not drift simulated GPS when live Firestore is connected

    const interval = setInterval(() => {
      setDrivers((prevDrivers) =>
        prevDrivers.map((drv) => {
          if (!drv.is_online || drv.status !== 'ACTIVE' || drv.latitude === null || drv.longitude === null) {
            return drv;
          }
          // Small random coordinate drift (~5-15 meters)
          const deltaLat = (Math.random() - 0.5) * 0.0004;
          const deltaLng = (Math.random() - 0.5) * 0.0004;
          return {
            ...drv,
            latitude: Number((drv.latitude + deltaLat).toFixed(5)),
            longitude: Number((drv.longitude + deltaLng).toFixed(5)),
            last_heartbeat: Date.now(),
          };
        })
      );
    }, 15000);

    return () => clearInterval(interval);
  }, []);

  // Local/Offline driver heartbeat auto-sweep (check every 30 seconds)
  useEffect(() => {
    if (isFirebaseConnected) return; // Managed by Firestore cleaner when live

    const interval = setInterval(() => {
      const cutoffTime = Date.now() - 75000;
      setDrivers((prev) => {
        let changed = false;
        const next = prev.map((d) => {
          const heartbeat = d.last_heartbeat || 0;
          if (d.is_online && heartbeat > 0 && heartbeat < cutoffTime) {
            changed = true;
            console.log(`Driver ${d.driver_id} uninstalled or closed. Marking OFFLINE.`);
            return {
              ...d,
              is_online: false,
              last_heartbeat: 0,
              device_id: '',
            };
          }
          return d;
        });
        return changed ? next : prev;
      });
    }, 30000);

    return () => clearInterval(interval);
  }, [isFirebaseConnected]);

  // -------------------------------------------------------------
  // DISPATCH & TRIP ACTIONS
  // -------------------------------------------------------------

  const createTrip = useCallback(
    async (tripInput: Partial<FirestoreTrip>): Promise<FirestoreTrip> => {
      const now = Date.now();
      const tripId = tripInput.trip_id
        ? tripInput.trip_id.toString().replace(/^TRIP-?/i, '').trim()
        : `${Math.floor(1000 + Math.random() * 9000)}`;
      const docId = `trip_doc_${Date.now()}`;

      // OTP is optional: If provided and non-empty, use it; otherwise null
      const otp = tripInput.otp && String(tripInput.otp).trim() ? String(tripInput.otp).trim() : null;

      // Guard against assigning a driver who is already on an ongoing trip (IN_PROGRESS or ACCEPTED)
      if (tripInput.driver_id) {
        const busyTrip = trips.find(
          (t) =>
            t.driver_id === tripInput.driver_id &&
            (t.status === 'IN_PROGRESS' || t.status === 'ACCEPTED')
        );
        if (busyTrip) {
          const errorMsg = `Driver is already on an ongoing in-process trip (${busyTrip.trip_id} - ${busyTrip.status}). Cannot assign new ride to an ongoing driver.`;
          addLog('WARN', 'DISPATCH', 'Create Trip Blocked', errorMsg);
          throw new Error(errorMsg);
        }
      }

      const newTrip: FirestoreTrip = {
        doc_id: docId,
        trip_id: tripId,
        customer_name: tripInput.customer_name || 'Passenger',
        customer_phone: tripInput.customer_phone || '',
        pickup_location: tripInput.pickup_location || 'Coimbatore',
        drop_location: tripInput.drop_location || '',
        pickup_lat: tripInput.pickup_lat ?? 11.0168,
        pickup_lng: tripInput.pickup_lng ?? 76.9558,
        drop_lat: tripInput.drop_lat ?? 11.0268,
        drop_lng: tripInput.drop_lng ?? 76.9658,
        status: tripInput.driver_id ? 'ACCEPTED' : 'OPEN',
        driver_id: tripInput.driver_id || null,
        driver_name: tripInput.driver_name || null,
        driver_phone: tripInput.driver_phone || null,
        vehicle_number: tripInput.vehicle_number || null,
        vehicle_category: tripInput.vehicle_category || 'MINI',
        estimated_fare: tripInput.estimated_fare !== undefined ? Number(tripInput.estimated_fare) : 0,
        final_fare: null,
        notes: tripInput.notes || '',
        created_at: now,
        updated_at: now,
        accepted_at: tripInput.driver_id ? now : null,
        started_at: null,
        completed_at: null,
        trip_type: tripInput.trip_type || 'REGULAR',
        base_fare: tripInput.is_package ? null : (tripInput.base_fare !== undefined && tripInput.base_fare !== null ? Number(tripInput.base_fare) : null),
        kms_fare: tripInput.kms_fare !== undefined && tripInput.kms_fare !== null ? Number(tripInput.kms_fare) : null,
        hour_fare: tripInput.hour_fare !== undefined && tripInput.hour_fare !== null ? Number(tripInput.hour_fare) : null,
        is_package: Boolean(tripInput.is_package),
        package_hours: tripInput.package_hours !== undefined ? tripInput.package_hours : undefined,
        package_kms: tripInput.package_kms !== undefined ? tripInput.package_kms : undefined,
        dispatch_type: tripInput.dispatch_type || 'BROADCAST',
        radius_kms: tripInput.dispatch_type === 'RADIUS' && tripInput.radius_kms ? Number(tripInput.radius_kms) : null,
        otp,
        distance_km: tripInput.distance_km !== undefined ? tripInput.distance_km : undefined,
        tracking_token: tripInput.tracking_token || `TRK-${now.toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
        tracking_enabled: true,
        tracking_created_at: now,
      };

      // Update local state
      setTrips((prev) => [newTrip, ...prev]);

      // If driver was directly assigned, update driver state
      if (newTrip.driver_id) {
        setDrivers((prev) =>
          prev.map((d) => (d.driver_id === newTrip.driver_id ? { ...d, current_trip_id: newTrip.trip_id } : d))
        );
      }

      addLog('SUCCESS', 'DISPATCH', 'Trip Created', `Trip ${newTrip.trip_id} dispatched for ${newTrip.customer_name} (${newTrip.pickup_location} -> ${newTrip.drop_location}).`);

      // Write to Firestore if live connected
      if (isFirebaseConnected) {
        await upsertTripInFirestore(firebaseConfig, newTrip);
      }

      return newTrip;
    },
    [isFirebaseConnected, firebaseConfig, addLog, trips]
  );

  const assignDriverToTrip = useCallback(
    async (tripDocId: string, driver: FirestoreDriver) => {
      // Guard against assigning a driver who is already on an ongoing in-process trip (IN_PROGRESS or ACCEPTED)
      const busyTrip = trips.find(
        (t) =>
          t.driver_id === driver.driver_id &&
          t.doc_id !== tripDocId &&
          t.trip_id !== tripDocId &&
          (t.status === 'IN_PROGRESS' || t.status === 'ACCEPTED')
      );
      if (busyTrip) {
        const errorMsg = `Driver ${driver.driver_name} (${driver.driver_id}) is already on an ongoing in-process trip (${busyTrip.trip_id} - ${busyTrip.status}). Trips cannot be assigned to an ongoing driver.`;
        addLog('WARN', 'DISPATCH', 'Assignment Blocked', errorMsg);
        throw new Error(errorMsg);
      }

      const now = Date.now();
      setTrips((prev) =>
        prev.map((t) => {
          if (t.doc_id === tripDocId || t.trip_id === tripDocId) {
            const updated: FirestoreTrip = {
              ...t,
              status: 'ACCEPTED',
              driver_id: driver.driver_id,
              driver_name: driver.driver_name,
              driver_phone: driver.mobile_number,
              vehicle_number: driver.vehicle_number,
              vehicle_category: driver.vehicle_category,
              accepted_at: now,
              updated_at: now,
            };
            if (isFirebaseConnected) {
              upsertTripInFirestore(firebaseConfig, updated);
            }
            return updated;
          }
          return t;
        })
      );

      setDrivers((prev) =>
        prev.map((d) => (d.driver_id === driver.driver_id ? { ...d, current_trip_id: tripDocId } : d))
      );

      addLog('INFO', 'DISPATCH', 'Driver Assigned', `Driver ${driver.driver_name} (${driver.driver_id}) assigned to trip.`);
    },
    [isFirebaseConnected, firebaseConfig, addLog, trips]
  );

  const startTripWithOtp = useCallback(
    async (tripDocId: string, enteredOtp?: string) => {
      const now = Date.now();
      let matched = false;
      setTrips((prev) =>
        prev.map((t) => {
          if (t.doc_id === tripDocId || t.trip_id === tripDocId) {
            if (enteredOtp && t.otp && enteredOtp !== t.otp) {
              throw new Error(`Invalid OTP. Ride expected ${t.otp}`);
            }
            matched = true;
            const updated: FirestoreTrip = {
              ...t,
              status: 'IN_PROGRESS',
              started_at: now,
              updated_at: now,
            };
            if (isFirebaseConnected) {
              upsertTripInFirestore(firebaseConfig, updated);
            }
            return updated;
          }
          return t;
        })
      );
      if (matched) {
        addLog('INFO', 'DRIVER', 'Trip Started', `Trip ${tripDocId} started with verified OTP.`);
      }
    },
    [isFirebaseConnected, firebaseConfig, addLog]
  );

  const completeTrip = useCallback(
    async (
      tripDocId: string,
      finalFare: number,
      distanceKm: number = 0,
      durationSec: number = 0,
      waitingSec: number = 0
    ) => {
      const now = Date.now();
      let assignedDriverId: string | null = null;

      setTrips((prev) =>
        prev.map((t) => {
          if (t.doc_id === tripDocId || t.trip_id === tripDocId) {
            assignedDriverId = t.driver_id;
            const updated: FirestoreTrip = {
              ...t,
              status: 'COMPLETED',
              final_fare: finalFare,
              completed_at: now,
              updated_at: now,
              distance_km: distanceKm || t.distance_km || 12,
              duration_seconds: durationSec || 1500,
              waiting_seconds: waitingSec || 0,
              tracking_enabled: false, // Auto-expire tracking
            };
            if (isFirebaseConnected) {
              upsertTripInFirestore(firebaseConfig, updated);
              if (t.tracking_token) {
                disableTrackingSessionInFirestore(firebaseConfig, t.tracking_token, tripDocId).catch(() => {});
              }
            }
            return updated;
          }
          return t;
        })
      );

      if (assignedDriverId) {
        setDrivers((prev) =>
          prev.map((d) =>
            d.driver_id === assignedDriverId
              ? {
                  ...d,
                  current_trip_id: null,
                  total_trips: (d.total_trips || 0) + 1,
                }
              : d
          )
        );
      }

      addLog('SUCCESS', 'DISPATCH', 'Trip Completed', `Trip ${tripDocId} marked completed. Final fare: ₹${finalFare}.`);
    },
    [isFirebaseConnected, firebaseConfig, addLog]
  );

  const cancelTrip = useCallback(
    async (tripDocId: string, reason: string = 'Cancelled by Admin') => {
      const now = Date.now();
      let assignedDriverId: string | null = null;
      let targetTrip: FirestoreTrip | null = null;

      setTrips((prev) =>
        prev.map((t) => {
          if (t.doc_id === tripDocId || t.trip_id === tripDocId) {
            assignedDriverId = t.driver_id;
            const updated: FirestoreTrip = {
              ...t,
              status: 'CANCELLED',
              notes: t.notes ? `${t.notes} [${reason}]` : reason,
              updated_at: now,
              tracking_enabled: false, // Auto-expire tracking
            };
            if (isFirebaseConnected && t.tracking_token) {
              disableTrackingSessionInFirestore(firebaseConfig, t.tracking_token, tripDocId).catch(() => {});
            }
            targetTrip = updated;
            return updated;
          }
          return t;
        })
      );

      if (targetTrip && isFirebaseConnected) {
        await upsertTripInFirestore(firebaseConfig, targetTrip);
      }

      if (assignedDriverId) {
        setDrivers((prev) =>
          prev.map((d) => (d.driver_id === assignedDriverId ? { ...d, current_trip_id: null } : d))
        );
        if (isFirebaseConnected) {
          const releasedDriver = driversRef.current.find((d) => d.driver_id === assignedDriverId);
          if (releasedDriver) {
            await upsertDriverInFirestore(firebaseConfig, { ...releasedDriver, current_trip_id: null });
          }
        }
      }

      addLog('WARNING', 'DISPATCH', 'Trip Cancelled', `Trip ${tripDocId} was cancelled (${reason}).`);
    },
    [isFirebaseConnected, firebaseConfig, addLog]
  );

  const unassignDriverFromTrip = useCallback(
    async (tripDocId: string, reason: string = 'Driver unassigned by dispatcher') => {
      const now = Date.now();
      let unassignedDriverId: string | null = null;
      let targetTrip: FirestoreTrip | null = null;

      setTrips((prev) =>
        prev.map((t) => {
          if (t.doc_id === tripDocId || t.trip_id === tripDocId) {
            unassignedDriverId = t.driver_id;
            const updated: FirestoreTrip = {
              ...t,
              status: 'OPEN',
              driver_id: null,
              driver_name: null,
              driver_phone: null,
              vehicle_number: null,
              notes: '',
              updated_at: now,
            };
            targetTrip = updated;
            return updated;
          }
          return t;
        })
      );

      if (targetTrip && isFirebaseConnected) {
        await upsertTripInFirestore(firebaseConfig, targetTrip);
      }

      if (unassignedDriverId) {
        setDrivers((prev) =>
          prev.map((d) => (d.driver_id === unassignedDriverId ? { ...d, current_trip_id: null } : d))
        );
        if (isFirebaseConnected) {
          const releasedDriver = driversRef.current.find((d) => d.driver_id === unassignedDriverId);
          if (releasedDriver) {
            await upsertDriverInFirestore(firebaseConfig, { ...releasedDriver, current_trip_id: null });
          }
        }
      }

      addLog(
        'INFO',
        'DISPATCH',
        'Driver Assignment Cancelled',
        `Trip ${tripDocId} returned to OPEN status. Driver released (${reason}).`
      );
    },
    [isFirebaseConnected, firebaseConfig, addLog]
  );

  const updateTripDetails = useCallback(
    async (tripDocId: string, updates: Partial<FirestoreTrip>) => {
      const now = Date.now();
      let oldDriverId: string | null = null;
      let newDriverId: string | null = null;
      let targetTrip: FirestoreTrip | null = null;

      const normalizedUpdates: Partial<FirestoreTrip> = {
        ...updates,
        dispatch_type: updates.dispatch_type || 'BROADCAST',
        radius_kms: updates.dispatch_type === 'RADIUS' && updates.radius_kms ? Number(updates.radius_kms) : null,
      };

      // If assigning or changing to a new driver, guard against ongoing in-process trips
      if (normalizedUpdates.driver_id) {
        const busyTrip = trips.find(
          (t) =>
            t.driver_id === normalizedUpdates.driver_id &&
            t.doc_id !== tripDocId &&
            t.trip_id !== tripDocId &&
            (t.status === 'IN_PROGRESS' || t.status === 'ACCEPTED')
        );
        if (busyTrip) {
          const errorMsg = `Driver is already on an ongoing in-process trip (${busyTrip.trip_id} - ${busyTrip.status}). Trips cannot be assigned to an ongoing driver.`;
          addLog('WARN', 'DISPATCH', 'Update Trip Blocked', errorMsg);
          throw new Error(errorMsg);
        }
      }

      setTrips((prev) =>
        prev.map((t) => {
          if (t.doc_id === tripDocId || t.trip_id === tripDocId) {
            oldDriverId = t.driver_id;
            newDriverId = normalizedUpdates.driver_id !== undefined ? normalizedUpdates.driver_id : t.driver_id;
            const updated: FirestoreTrip = {
              ...t,
              ...normalizedUpdates,
              updated_at: now,
            };
            targetTrip = updated;
            return updated;
          }
          return t;
        })
      );

      if (targetTrip && isFirebaseConnected) {
        await upsertTripInFirestore(firebaseConfig, targetTrip);
      }

      // Manage driver assignments if driver changed or status changed
      if (oldDriverId && oldDriverId !== newDriverId) {
        setDrivers((prev) =>
          prev.map((d) => (d.driver_id === oldDriverId ? { ...d, current_trip_id: null } : d))
        );
        if (isFirebaseConnected) {
          const oldD = driversRef.current.find((d) => d.driver_id === oldDriverId);
          if (oldD) {
            await upsertDriverInFirestore(firebaseConfig, { ...oldD, current_trip_id: null });
          }
        }
      }
      if (newDriverId && newDriverId !== oldDriverId) {
        setDrivers((prev) =>
          prev.map((d) => (d.driver_id === newDriverId ? { ...d, current_trip_id: tripDocId } : d))
        );
        if (isFirebaseConnected) {
          const newD = driversRef.current.find((d) => d.driver_id === newDriverId);
          if (newD) {
            await upsertDriverInFirestore(firebaseConfig, { ...newD, current_trip_id: tripDocId });
          }
        }
      }
      if (normalizedUpdates.status === 'CANCELLED' || normalizedUpdates.status === 'COMPLETED') {
        const finalDriverId = newDriverId || oldDriverId;
        if (finalDriverId) {
          setDrivers((prev) =>
            prev.map((d) => (d.driver_id === finalDriverId ? { ...d, current_trip_id: null } : d))
          );
        }
      }

      addLog(
        'SUCCESS',
        'DISPATCH',
        'Trip Details Updated',
        `Trip ${tripDocId} details were successfully updated by admin.`
      );
    },
    [isFirebaseConnected, firebaseConfig, addLog, trips]
  );

  const deleteTrip = useCallback(
    async (tripDocId: string) => {
      setTrips((prev) => prev.filter((t) => t.doc_id !== tripDocId && t.trip_id !== tripDocId));
      if (isFirebaseConnected) {
        await deleteTripFromFirestore(firebaseConfig, tripDocId);
      }
      addLog('INFO', 'ADMIN', 'Trip Deleted', `Trip record ${tripDocId} removed from database.`);
    },
    [isFirebaseConnected, firebaseConfig, addLog]
  );

  // Clear Local Storage ONLY (Guaranteed zero deletion on remote Firestore/backend database)
  const clearLocalTripsStorage = useCallback(
    (clearLocalViewOnly: boolean = false) => {
      suppressTripsLocalStorageRef.current = true;
      try {
        localStorage.removeItem(TRIPS_STORAGE_KEY);
        localStorage.removeItem('trusty_cab_trips_local_v1');
      } catch (err) {
        console.warn('Failed to clear local trips storage:', err);
      }

      if (clearLocalViewOnly) {
        // Only clear local browser memory state - ZERO backend deletions
        setTrips([]);
      }

      addLog(
        'INFO',
        'ADMIN',
        'Local Storage Cleaned',
        'Trip History local storage was cleared. Cloud Firestore records were completely untouched.'
      );
    },
    [addLog]
  );

  // -------------------------------------------------------------
  // OPTIONAL CUSTOMER LIVE TRACKING ACTIONS (Customer-request based only)
  // -------------------------------------------------------------

  const generateCustomerTrackingLink = useCallback(
    async (tripDocId: string): Promise<{ token: string; link: string }> => {
      // Generate secure unique tracking token (e.g. TRK + 8 alphanumeric chars)
      const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
      let token = 'TRK';
      if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
        const randomValues = new Uint8Array(8);
        window.crypto.getRandomValues(randomValues);
        for (let i = 0; i < 8; i++) {
          token += chars[randomValues[i] % chars.length];
        }
      } else {
        for (let i = 0; i < 8; i++) {
          token += chars[Math.floor(Math.random() * chars.length)];
        }
      }

      const now = Date.now();
      let targetTrip: FirestoreTrip | null = null;

      setTrips((prev) =>
        prev.map((t) => {
          if (t.doc_id === tripDocId || t.trip_id === tripDocId) {
            const updated: FirestoreTrip = {
              ...t,
              tracking_token: token,
              tracking_enabled: true,
              tracking_created_at: now,
              updated_at: now,
            };
            targetTrip = updated;
            return updated;
          }
          return t;
        })
      );

      if (targetTrip) {
        const trip = targetTrip as FirestoreTrip;
        if (isFirebaseConnected) {
          const session: CustomerTrackingSession = {
            token,
            trip_id: trip.trip_id || tripDocId,
            created_at: now,
            is_active: true,
            customer_name: trip.customer_name || 'Customer',
            customer_phone: trip.customer_phone || '',
            driver_id: trip.driver_id || null,
          };
          await createTrackingSessionInFirestore(firebaseConfig, session, trip.doc_id || tripDocId);
          await upsertTripInFirestore(firebaseConfig, trip);
        }
        addLog(
          'INFO',
          'DISPATCH',
          'Tracking Link Generated',
          `Customer tracking link generated for trip ${trip.trip_id} (${token}) upon customer request.`
        );
      }

      const origin = typeof window !== 'undefined' ? window.location.origin : 'https://track.trustyyellowcab.com';
      const link = `${origin}/?track=${token}`;
      return { token, link };
    },
    [isFirebaseConnected, firebaseConfig, addLog]
  );

  const disableCustomerTrackingLink = useCallback(
    async (tripDocId: string) => {
      let tokenToDisable: string | undefined;
      let targetTripId: string | undefined;
      let targetDocId: string = tripDocId;

      setTrips((prev) =>
        prev.map((t) => {
          if (t.doc_id === tripDocId || t.trip_id === tripDocId) {
            tokenToDisable = t.tracking_token;
            targetTripId = t.trip_id;
            targetDocId = t.doc_id || tripDocId;
            return {
              ...t,
              tracking_enabled: false,
              updated_at: Date.now(),
            };
          }
          return t;
        })
      );

      if (tokenToDisable && isFirebaseConnected) {
        await disableTrackingSessionInFirestore(firebaseConfig, tokenToDisable, targetDocId);
      }

      addLog(
        'WARNING',
        'DISPATCH',
        'Tracking Link Revoked',
        `Customer live tracking link disabled by dispatch for trip ${targetTripId || tripDocId}.`
      );
    },
    [isFirebaseConnected, firebaseConfig, addLog]
  );

  // -------------------------------------------------------------
  // DRIVER ROSTER & FLEET ACTIONS
  // -------------------------------------------------------------

  const registerDriver = useCallback(
    async (driverData: Partial<FirestoreDriver>): Promise<FirestoreDriver> => {
      // 1. Resolve Driver ID: user input or generate unique ID in backend
      let driverId = driverData.driver_id?.trim() || '';
      if (!driverId) {
        let candidateNum = Math.floor(1000 + Math.random() * 9000);
        let attempts = 0;
        while (drivers.some((d) => d.driver_id === `DRV-${candidateNum}`) && attempts < 20) {
          candidateNum = Math.floor(1000 + Math.random() * 9000);
          attempts++;
        }
        driverId = `DRV-${candidateNum}`;
      }

      // 2. Resolve Expiry Date: 1 year auto fallback or custom input
      let expiryDate = driverData.expiry_date?.trim() || '';
      if (!expiryDate) {
        const d = new Date();
        d.setFullYear(d.getFullYear() + 1);
        expiryDate = d.toISOString().split('T')[0];
      }

      // 3. Resolve FCM Token: auto-generate FCM token or use provided
      let fcmToken = driverData.fcm_token?.trim() || '';
      if (!fcmToken) {
        const cleanId = driverId.toLowerCase().replace(/[^a-z0-9]/g, '');
        const rnd1 = Math.random().toString(36).substring(2, 10);
        const rnd2 = Math.random().toString(36).substring(2, 10);
        fcmToken = `fcm_${cleanId || 'drv'}_${Date.now().toString(36)}_${rnd1}${rnd2}`;
      }

      // 4. Clean single dataset - no duplicate alias fields
      const newDriver: FirestoreDriver = {
        driver_id: driverId,
        driver_name: driverData.driver_name?.trim() || '',
        mobile_number: driverData.mobile_number?.trim() || '',
        vehicle_number: driverData.vehicle_number?.trim() || '',
        vehicle_category: driverData.vehicle_category?.trim() || 'MINI',
        status: driverData.status || 'ACTIVE',
        is_online: Boolean(driverData.is_online),
        latitude: driverData.latitude ?? null,
        longitude: driverData.longitude ?? null,
        photo_url: driverData.photo_url?.trim() || '',
        expiry_date: expiryDate,
        photo_version: 1,
        device_id: '', // Device ID strictly blank empty until driver connects Android app
        fcm_token: fcmToken, // Auto FCM token
        rating: 5.0,
        total_trips: 0,
        current_trip_id: null,
      };

      // 3. Deduplicate: if same driver ID already exists, update/replace so table has exactly ONE entry
      setDrivers((prev) => [newDriver, ...prev.filter((d) => d.driver_id !== driverId)]);
      addLog('SUCCESS', 'ADMIN', 'Driver Registered', `Driver ${newDriver.driver_name || driverId} (${driverId}) added to fleet.`);

      if (isFirebaseConnected) {
        await upsertDriverInFirestore(firebaseConfig, newDriver);
      }

      return newDriver;
    },
    [drivers, isFirebaseConnected, firebaseConfig, addLog]
  );

  const updateDriver = useCallback(
    async (driverId: string, partial: Partial<FirestoreDriver>) => {
      let updatedDriver: FirestoreDriver | null = null;
      setDrivers((prev) =>
        prev.map((d) => {
          if (d.driver_id === driverId) {
            updatedDriver = { ...d, ...partial };
            return updatedDriver;
          }
          return d;
        })
      );

      if (updatedDriver && isFirebaseConnected) {
        await upsertDriverInFirestore(firebaseConfig, updatedDriver);
      }
      addLog('INFO', 'ADMIN', 'Driver Updated', `Driver profile for ${driverId} updated.`);
    },
    [isFirebaseConnected, firebaseConfig, addLog]
  );

  const toggleDriverStatus = useCallback(
    async (driverId: string) => {
      const trimmedId = (driverId || '').trim().toLowerCase();
      let nextStatus: DriverStatus = 'ACTIVE';
      let targetDriver: FirestoreDriver | null = null;

      // Calculate new state synchronously from current state
      setDrivers((prev) => {
        const found = prev.find(
          (d) =>
            d.driver_id.trim().toLowerCase() === trimmedId ||
            (d as any).doc_id === driverId
        );

        const isCurrentlyActive = (found?.status || '').toUpperCase() === 'ACTIVE';
        nextStatus = isCurrentlyActive ? 'BLOCKED' : 'ACTIVE';

        return prev.map((d) => {
          if (
            d.driver_id.trim().toLowerCase() === trimmedId ||
            (d as any).doc_id === driverId
          ) {
            targetDriver = {
              ...d,
              status: nextStatus,
              is_online: nextStatus === 'ACTIVE' ? (d.is_online ?? true) : false,
            };
            return targetDriver;
          }
          return d;
        });
      });

      // If targetDriver wasn't captured or if fallback needed, fetch from drivers ref
      if (!targetDriver) {
        const existing = driversRef.current.find(
          (d) =>
            d.driver_id.trim().toLowerCase() === trimmedId ||
            (d as any).doc_id === driverId
        );
        if (existing) {
          const isCurrentlyActive = (existing.status || '').toUpperCase() === 'ACTIVE';
          nextStatus = isCurrentlyActive ? 'BLOCKED' : 'ACTIVE';
          targetDriver = {
            ...existing,
            status: nextStatus,
            is_online: nextStatus === 'ACTIVE' ? (existing.is_online ?? true) : false,
          };
        }
      }

      if (targetDriver && isFirebaseConnected) {
        await upsertDriverInFirestore(firebaseConfig, targetDriver);
      }

      addLog(
        nextStatus === 'BLOCKED' ? 'WARNING' : 'SUCCESS',
        'ADMIN',
        nextStatus === 'BLOCKED' ? 'Driver Blocked' : 'Driver Unblocked & Activated',
        `Driver ${driverId} status successfully set to ${nextStatus}.`
      );
    },
    [isFirebaseConnected, firebaseConfig, addLog]
  );

  const resetDriverDeviceBinding = useCallback(
    async (driverId: string) => {
      let targetDriver: FirestoreDriver | null = null;
      setDrivers((prev) =>
        prev.map((d) => {
          if (d.driver_id === driverId) {
            targetDriver = {
              ...d,
              device_id: '',
              is_online: false,
            };
            return targetDriver;
          }
          return d;
        })
      );

      if (targetDriver && isFirebaseConnected) {
        await upsertDriverInFirestore(firebaseConfig, targetDriver);
      }
      addLog('INFO', 'ADMIN', 'Device Session Cleared', `Device ID unlinked for driver ${driverId}. Driver can now login on new mobile hardware.`);
    },
    [isFirebaseConnected, firebaseConfig, addLog]
  );

  const deleteDriver = useCallback(
    async (driverId: string, docId?: string) => {
      let targetDocId = docId;
      if (!targetDocId) {
        const found = driversRef.current.find((d) => d.driver_id === driverId);
        if (found?.doc_id) {
          targetDocId = found.doc_id;
        }
      }

      setDrivers((prev) =>
        prev.filter((d) => d.driver_id !== driverId && (!targetDocId || d.doc_id !== targetDocId))
      );
      if (isFirebaseConnected) {
        await deleteDriverFromFirestore(firebaseConfig, driverId, targetDocId);
      }
      addLog('WARNING', 'ADMIN', 'Driver Deleted', `Driver ${driverId} removed from fleet.`);
    },
    [isFirebaseConnected, firebaseConfig, addLog]
  );

  const cleanDriversTable = useCallback(async () => {
    if (!isFirebaseConnected) {
      return {
        totalScanned: 0,
        fieldsCleaned: 0,
        duplicatesRemoved: 0,
        success: false,
        message: 'Firebase is not connected.',
      };
    }
    addLog('INFO', 'FIRESTORE', 'Cleaning Drivers Table', 'Scanning Firebase drivers table to remove duplicate fields and deduplicate colliding records...');
    const result = await cleanAndDeduplicateDriversInFirestore(firebaseConfig);
    if (result.success) {
      addLog(
        'SUCCESS',
        'FIRESTORE',
        'Drivers Table Cleaned',
        `Scanned ${result.totalScanned} records, purged ${result.fieldsCleaned} duplicate fields, deduplicated ${result.duplicatesRemoved} duplicate documents.`
      );
    }
    return { ...result, message: 'Cleanup complete' };
  }, [isFirebaseConnected, firebaseConfig, addLog]);

  const setDriverOfficeDue = useCallback(
    async (
      driverId: string,
      amount: number,
      note: string = 'Trip CC (Convenience Charge)',
      officeUpiId: string = ''
    ) => {
      const cleanAmount = Math.max(0, Number(amount) || 0);
      const paymentStatus = cleanAmount > 0 ? 'DUE' : 'CLEARED';
      const targetDriver = driversRef.current.find(
        (d) => d.driver_id === driverId || d.driver_id === driverId.trim().toUpperCase()
      );
      const targetDocId = targetDriver?.doc_id;

      setDrivers((prev) =>
        prev.map((d) => {
          if (d.driver_id === driverId || (targetDocId && d.doc_id === targetDocId)) {
            return {
              ...d,
              payment_amount: cleanAmount,
              payment_status: paymentStatus,
              payment_note: note,
              office_upi_id: (officeUpiId || '').trim(),
              payment_updated_at: Date.now(),
            };
          }
          return d;
        })
      );

      if (isFirebaseConnected) {
        await setDriverOfficeDueInFirestore(
          firebaseConfig,
          driverId,
          cleanAmount,
          note,
          officeUpiId,
          targetDocId
        );
      }

      addLog(
        cleanAmount > 0 ? 'INFO' : 'SUCCESS',
        'PAYMENT',
        cleanAmount > 0 ? 'Office Due Set' : 'Office Due Cleared',
        `Driver ${driverId}: ₹${cleanAmount} (${paymentStatus}) - "${note}"`
      );
    },
    [isFirebaseConnected, firebaseConfig, addLog]
  );

  const clearDriverOfficeDue = useCallback(
    async (driverId: string) => {
      const targetDriver = driversRef.current.find(
        (d) => d.driver_id === driverId || d.driver_id === driverId.trim().toUpperCase()
      );
      const targetDocId = targetDriver?.doc_id;

      setDrivers((prev) =>
        prev.map((d) => {
          if (d.driver_id === driverId || (targetDocId && d.doc_id === targetDocId)) {
            return {
              ...d,
              payment_amount: 0.0,
              payment_status: 'CLEARED',
              payment_note: 'No Dues Pending',
              driver_payment_status: 'VERIFIED',
              payment_updated_at: Date.now(),
            };
          }
          return d;
        })
      );

      if (isFirebaseConnected) {
        await clearDriverOfficeDueInFirestore(firebaseConfig, driverId, targetDocId);
      }

      addLog('SUCCESS', 'PAYMENT', 'Office Due Cleared', `Driver ${driverId} dues cleared to ₹0 (Verified).`);
    },
    [isFirebaseConnected, firebaseConfig, addLog]
  );

  // -------------------------------------------------------------
  // SYSTEM KILLSWITCH & CONTROL
  // -------------------------------------------------------------

  const toggleMasterKillswitch = useCallback(
    async (online: boolean) => {
      const now = Date.now();
      lastManualKillswitchActionRef.current = now;

      const nextSettings: SystemControlSettings = {
        ...systemSettings,
        admin_online: online,
        sync_enabled: online,
        status: online ? 'ONLINE' : 'CUTOFF',
        updated_at: now,
      };

      setSystemSettings(nextSettings);
      addLog(
        online ? 'SUCCESS' : 'ALERT',
        'ADMIN',
        online ? 'Admin Live Sync Enabled' : 'EMERGENCY BACKEND CUTOFF ACTIVATED',
        online
          ? 'Live data exchange with driver applications active.'
          : 'Backend dispatch cutoff activated. Driver apps switch to offline fallback.'
      );

      // Clean, single document update in system_settings/dispatch_control
      // Driver table remains strictly untouched and contains only driver records.
      if (isFirebaseConnected) {
        cleanUpLegacyDriverControlInFirestore(firebaseConfig).catch(() => {});

        const res = await updateSystemSettingsInFirestore(firebaseConfig, nextSettings);
        if (res.permissionDenied) {
          const notice =
            'Remote Firestore rules currently deny direct write to /system_settings/dispatch_control. ' +
            'Open Rules Manager to copy and publish the updated rules in your Firebase Console.';
          setSystemSettings((prev) => ({
            ...prev,
            rule_permission_notice: notice,
          }));
          addLog(
            'WARNING',
            'FIRESTORE',
            'Remote Rules Notice',
            'Remote rules restrict /system_settings/dispatch_control.'
          );
        } else if (res.success) {
          setSystemSettings((prev) => ({
            ...prev,
            rule_permission_notice: undefined,
          }));
        }
      }
    },
    [systemSettings, isFirebaseConnected, firebaseConfig, addLog]
  );

  const updateBroadcastNotice = useCallback(
    async (noticeText: string) => {
      const nextSettings: SystemControlSettings = {
        ...systemSettings,
        broadcast_notice: noticeText,
        updated_at: Date.now(),
      };
      setSystemSettings(nextSettings);
      addLog('INFO', 'ADMIN', 'Broadcast Notice Updated', `Notice broadcast to fleet: "${noticeText}"`);

      if (isFirebaseConnected) {
        const res = await updateSystemSettingsInFirestore(firebaseConfig, nextSettings);
        if (res.permissionDenied) {
          addLog(
            'WARNING',
            'FIRESTORE',
            'Broadcast Notice Alert',
            'Publish rules in Rules Manager for /system_settings/dispatch_control.'
          );
        }
      }
    },
    [systemSettings, isFirebaseConnected, firebaseConfig, addLog]
  );

  // -------------------------------------------------------------
  // FARE RATE CARDS
  // -------------------------------------------------------------

  const updateRateCard = useCallback((updatedCard: FareRateCard) => {
    setRateCards((prev) => prev.map((rc) => (rc.id === updatedCard.id ? updatedCard : rc)));
    addLog('INFO', 'ADMIN', 'Rate Card Updated', `Updated pricing rules for ${updatedCard.name} (${updatedCard.category}).`);
  }, [addLog]);

  // -------------------------------------------------------------
  // FIREBASE CONFIG UPDATER
  // -------------------------------------------------------------

  const updateFirebaseConfig = useCallback(
    async (newConfig: FirebaseConnectionConfig) => {
      saveStoredFirebaseConfig(newConfig);
      setFirebaseConfig(newConfig);
      addLog('INFO', 'ADMIN', 'Firebase Config Updated', `Target project changed to: ${newConfig.projectId}`);
    },
    [addLog]
  );

  // -------------------------------------------------------------
  // ADMIN USERS & PERMISSIONS
  // -------------------------------------------------------------

  const addAdminUser = useCallback(
    async (newAdminData: Omit<AdminUser, 'id' | 'created_at'>) => {
      const newAdmin: AdminUser = {
        ...newAdminData,
        id: `admin_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        created_at: Date.now(),
      };
      setAdminUsers((prev) => [...prev, newAdmin]);
      addLog(
        'SUCCESS',
        'ADMIN',
        'Admin Permissions Granted',
        `Granted ${newAdmin.role} permissions to ${newAdmin.email} (${newAdmin.name}).`
      );
    },
    [addLog]
  );

  const updateAdminUser = useCallback(
    async (id: string, updates: Partial<AdminUser>) => {
      setAdminUsers((prev) =>
        prev.map((adm) => {
          if (adm.id === id) {
            const updated = { ...adm, ...updates };
            if (currentAdmin.id === id) {
              setCurrentAdmin(updated);
            }
            return updated;
          }
          return adm;
        })
      );
      addLog('INFO', 'ADMIN', 'Admin Record Updated', `Updated permissions/status for admin user ID: ${id}`);
    },
    [currentAdmin, addLog]
  );

  const deleteAdminUser = useCallback(
    async (id: string) => {
      const target = adminUsers.find((a) => a.id === id);
      setAdminUsers((prev) => prev.filter((a) => a.id !== id));
      addLog(
        'WARNING',
        'ADMIN',
        'Admin Permissions Revoked',
        `Revoked admin console access for ${target?.email || id}.`
      );
    },
    [adminUsers, addLog]
  );

  const switchCurrentAdmin = useCallback(
    (admin: AdminUser) => {
      setCurrentAdmin(admin);
      addLog('INFO', 'ADMIN', 'Admin Session Switched', `Active console operator switched to: ${admin.email} (${admin.role})`);
    },
    [addLog]
  );

  return {
    // Data
    drivers,
    driversMap,
    trips,
    systemSettings,
    rateCards,
    logs,
    adminUsers,
    currentAdmin,
    firebaseConfig,
    isFirebaseConnected,
    isSyncing,
    connectionStatusText,

    // Admin & Permissions
    addAdminUser,
    updateAdminUser,
    deleteAdminUser,
    switchCurrentAdmin,

    // Trip actions
    createTrip,
    assignDriverToTrip,
    unassignDriverFromTrip,
    updateTripDetails,
    startTripWithOtp,
    completeTrip,
    cancelTrip,
    deleteTrip,
    clearLocalTripsStorage,
    generateCustomerTrackingLink,
    disableCustomerTrackingLink,

    // Driver actions
    registerDriver,
    updateDriver,
    toggleDriverStatus,
    resetDriverDeviceBinding,
    deleteDriver,
    cleanDriversTable,
    setDriverOfficeDue,
    clearDriverOfficeDue,
    setDriverOfficePayment: setDriverOfficeDue,
    markPaymentCleared: clearDriverOfficeDue,

    // System actions
    toggleMasterKillswitch,
    updateBroadcastNotice,
    updateRateCard,
    updateFirebaseConfig,
    addLog,
  };
}

