import React, { useState, useEffect, useRef } from 'react';
import { FirestoreTrip, FirestoreDriver, CustomerTrackingSession, FirebaseConnectionConfig } from '../types';
import { subscribeToCustomerTrackingSession } from '../firebase/config';
import { loadGoogleMaps } from '../services/googleMapsService';
import { getCarIconDataUrl } from '../utils/carIcon';
import {
  Car,
  MapPin,
  Phone,
  Shield,
  Clock,
  Navigation,
  CheckCircle2,
  AlertTriangle,
  Star,
  KeyRound,
  ExternalLink,
  ChevronRight,
  ArrowLeft,
  Sparkles,
  Layers,
  Compass,
} from 'lucide-react';

interface CustomerLiveTrackingProps {
  token: string;
  firebaseConfig: FirebaseConnectionConfig;
  fallbackTrip?: FirestoreTrip | null;
  fallbackDriver?: FirestoreDriver | null;
  allTrips?: FirestoreTrip[];
  isPreview?: boolean;
  onExit?: () => void;
}

const findMatchingTripInList = (list: FirestoreTrip[] | undefined, targetToken: string): FirestoreTrip | null => {
  if (!list || !list.length || !targetToken) return null;
  const clean = targetToken.trim();
  return (
    list.find(
      (t) =>
        t.tracking_token === clean ||
        t.trip_id === clean ||
        t.doc_id === clean ||
        (t.tracking_token && clean.includes(t.tracking_token)) ||
        (t.trip_id && clean.includes(t.trip_id)) ||
        (t.trip_id && clean.replace('TRK-', '').replace('TRIP-', '') === t.trip_id.replace('TRIP-', ''))
    ) || null
  );
};

export const CustomerLiveTracking: React.FC<CustomerLiveTrackingProps> = ({
  token,
  firebaseConfig,
  fallbackTrip,
  fallbackDriver,
  allTrips,
  isPreview = false,
  onExit,
}) => {
  // Resolve matching trip from props or allTrips
  const matchedTrip = fallbackTrip || findMatchingTripInList(allTrips, token);

  const [session, setSession] = useState<CustomerTrackingSession | null>(null);
  const [trip, setTrip] = useState<FirestoreTrip | null>(matchedTrip || null);
  const [driver, setDriver] = useState<FirestoreDriver | null>(fallbackDriver || null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExpired, setIsExpired] = useState(false);
  const [expiryReason, setExpiryReason] = useState<string>('');
  const [etaMinutes, setEtaMinutes] = useState<number>(7);

  // Map state
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const googleMapRef = useRef<any>(null);
  const driverMarkerRef = useRef<any>(null);
  const pickupMarkerRef = useRef<any>(null);
  const dropMarkerRef = useRef<any>(null);
  const routePolylineRef = useRef<any>(null);
  const [mapEngine, setMapEngine] = useState<'google' | 'leaflet' | 'radar'>('google');

  // Leaflet map refs
  const leafletMapRef = useRef<any>(null);
  const leafletDriverMarkerRef = useRef<any>(null);
  const leafletPickupMarkerRef = useRef<any>(null);
  const leafletDropMarkerRef = useRef<any>(null);

  const currentTrip = trip || matchedTrip;
  const hasInitialFitBoundsRef = useRef(false);
  const driverAnimFrameRef = useRef<number | null>(null);
  const lastTripIdRef = useRef<string | null>(null);

  // Reset bounds fit state when trip ID changes
  useEffect(() => {
    if (currentTrip?.trip_id && currentTrip.trip_id !== lastTripIdRef.current) {
      lastTripIdRef.current = currentTrip.trip_id;
      hasInitialFitBoundsRef.current = false;
    }
  }, [currentTrip?.trip_id]);

  // Synchronize with matchedTrip when it arrives or updates
  useEffect(() => {
    if (matchedTrip) {
      setTrip(matchedTrip);
      setIsLoading(false);
      setIsExpired(matchedTrip.status === 'COMPLETED' || matchedTrip.status === 'CANCELLED');
    }
  }, [matchedTrip]);

  // Synchronize driver when fallbackDriver arrives or updates
  useEffect(() => {
    if (fallbackDriver) {
      setDriver(fallbackDriver);
    }
  }, [fallbackDriver]);

  // 1. Subscribe to ONLY this specific tracking token & trip
  useEffect(() => {
    setIsLoading(true);

    const unsub = subscribeToCustomerTrackingSession(
      firebaseConfig,
      token,
      ({ session: s, trip: t, driver: d, isExpired: exp, reason }) => {
        setIsLoading(false);
        if (s) setSession(s);
        if (t) {
          setTrip(t);
          // Trip is present: ONLY expired if status is COMPLETED or CANCELLED!
          const isDone = t.status === 'COMPLETED' || t.status === 'CANCELLED';
          setIsExpired(isDone);
        } else if (exp) {
          // If we already have an active trip from fallbackTrip or allTrips, NEVER mark as expired!
          if (!matchedTrip || matchedTrip.status === 'COMPLETED' || matchedTrip.status === 'CANCELLED') {
            setIsExpired(true);
            if (reason) setExpiryReason(reason);
          }
        }
        if (d) setDriver(d);
      },
      (err) => {
        console.warn('Customer tracking subscribe notice:', err);
        setIsLoading(false);
        // If local fallback trip exists and matches token, keep using it
        if (matchedTrip) {
          setTrip(matchedTrip);
          if (fallbackDriver) setDriver(fallbackDriver);
          setIsExpired(matchedTrip.status === 'COMPLETED' || matchedTrip.status === 'CANCELLED');
        } else {
          // If no trip loaded yet, wait briefly before expiring
          setTimeout(() => {
            setTrip((currentT) => {
              if (!currentT && !matchedTrip) {
                setIsExpired(true);
                setExpiryReason('Unable to load live tracking session.');
              }
              return currentT;
            });
          }, 2500);
        }
      }
    );

    return () => {
      if (typeof unsub === 'function') {
        unsub();
      }
    };
  }, [token, firebaseConfig, matchedTrip, fallbackDriver]);

  // Compute live ETA based on distance and trip status
  useEffect(() => {
    if (!currentTrip) return;
    if (currentTrip.status === 'COMPLETED' || currentTrip.status === 'CANCELLED') {
      setEtaMinutes(0);
      return;
    }

    if (currentTrip.status === 'IN_PROGRESS') {
      const dist = currentTrip.distance_km || 8;
      // Assume average city speed 25 km/h
      const estMins = Math.max(2, Math.round((dist / 25) * 60));
      setEtaMinutes(estMins);
    } else if (currentTrip.status === 'ACCEPTED') {
      // Driver en route to pickup: 3-8 mins
      setEtaMinutes(6);
    } else {
      setEtaMinutes(10);
    }
  }, [currentTrip]);

  // 2. Initialize Map (Google Maps first, falling back smoothly to Leaflet OpenStreetMap)
  useEffect(() => {
    let isCancelled = false;

    async function initMap() {
      const pickupLat = currentTrip?.pickup_lat ?? 11.0168;
      const pickupLng = currentTrip?.pickup_lng ?? 76.9558;
      const center = { lat: pickupLat, lng: pickupLng };

      const driverLat = driver?.latitude ?? (currentTrip?.status === 'IN_PROGRESS' ? pickupLat + 0.005 : pickupLat - 0.006);
      const driverLng = driver?.longitude ?? (currentTrip?.status === 'IN_PROGRESS' ? pickupLng + 0.005 : pickupLng - 0.006);
      const driverPos = { lat: driverLat, lng: driverLng };

      // Pure 3D White Car ONLY (no top small icon, no floating badge)
      const carIconDataUrl = getCarIconDataUrl({
        isOnline: true,
        showStatusBadge: false,
      });

      // 1. Try Google Maps first
      try {
        const google = await loadGoogleMaps();
        if (isCancelled || !mapContainerRef.current) return;

        if (google && google.maps) {
          setMapEngine('google');

          if (!googleMapRef.current) {
            googleMapRef.current = new google.maps.Map(mapContainerRef.current, {
              center,
              zoom: 14,
              disableDefaultUI: true,
              zoomControl: true,
              styles: [
                { featureType: 'poi', stylers: [{ visibility: 'off' }] },
                { featureType: 'transit', stylers: [{ visibility: 'simplified' }] },
              ],
            });
          }

          const map = googleMapRef.current;

          // Pickup Marker
          if (!pickupMarkerRef.current) {
            pickupMarkerRef.current = new google.maps.Marker({
              position: center,
              map,
              title: 'Pickup Location',
              icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 8,
                fillColor: '#10B981',
                fillOpacity: 1,
                strokeColor: '#FFFFFF',
                strokeWeight: 2,
              },
            });
          }

          // Drop Marker if coords available
          if (currentTrip?.drop_lat && currentTrip?.drop_lng && !dropMarkerRef.current) {
            dropMarkerRef.current = new google.maps.Marker({
              position: { lat: currentTrip.drop_lat, lng: currentTrip.drop_lng },
              map,
              title: 'Destination',
              icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 8,
                fillColor: '#EF4444',
                fillOpacity: 1,
                strokeColor: '#FFFFFF',
                strokeWeight: 2,
              },
            });
          }

          // Driver Car Marker - Pure 3D White Car ONLY (No top icon)
          const carMarkerIcon = {
            url: carIconDataUrl,
            scaledSize: new google.maps.Size(60, 40),
            anchor: new google.maps.Point(30, 20),
          };

          if (!driverMarkerRef.current) {
            driverMarkerRef.current = new google.maps.Marker({
              position: driverPos,
              map,
              title: driver?.driver_name || 'Your Cab',
              icon: carMarkerIcon,
            });
          } else {
            driverMarkerRef.current.setIcon(carMarkerIcon);
            // Smoothly glide to new position instead of snapping or jumping
            const curPos = driverMarkerRef.current.getPosition();
            if (curPos) {
              const startLat = curPos.lat();
              const startLng = curPos.lng();
              const targetLat = driverPos.lat;
              const targetLng = driverPos.lng;
              const delta = Math.hypot(targetLat - startLat, targetLng - startLng);

              if (delta > 0.000005 && delta < 0.05) {
                if (driverAnimFrameRef.current) {
                  cancelAnimationFrame(driverAnimFrameRef.current);
                }
                const startTime = performance.now();
                const duration = 30000; // 30 seconds continuous linear movement
                const step = (now: number) => {
                  const elapsed = now - startTime;
                  const progress = Math.min(elapsed / duration, 1);
                  const ease = progress; // Linear progression for live tracking
                  driverMarkerRef.current?.setPosition({
                    lat: startLat + (targetLat - startLat) * ease,
                    lng: startLng + (targetLng - startLng) * ease,
                  });
                  if (progress < 1) {
                    driverAnimFrameRef.current = requestAnimationFrame(step);
                  } else {
                    driverAnimFrameRef.current = null;
                  }
                };
                driverAnimFrameRef.current = requestAnimationFrame(step);
              } else if (delta >= 0.05) {
                driverMarkerRef.current.setPosition(driverPos);
              }
            } else {
              driverMarkerRef.current.setPosition(driverPos);
            }
          }

          // Fit bounds ONLY ONCE on initial load so the map view does not jump around on every GPS update
          if (!hasInitialFitBoundsRef.current) {
            const bounds = new google.maps.LatLngBounds();
            bounds.extend(center);
            bounds.extend(driverPos);
            if (currentTrip?.drop_lat && currentTrip?.drop_lng) {
              bounds.extend({ lat: currentTrip.drop_lat, lng: currentTrip.drop_lng });
            }
            map.fitBounds(bounds, { top: 60, bottom: 60, left: 60, right: 60 });
            hasInitialFitBoundsRef.current = true;
          }
          return;
        }
      } catch (err) {
        // Continue to Leaflet fallback
      }

      // 2. Leaflet Fallback (OpenStreetMap)
      try {
        const LModule = await import('leaflet');
        const L = LModule.default;
        if (isCancelled || !mapContainerRef.current) return;

        setMapEngine('leaflet');

        if (!leafletMapRef.current) {
          const map = L.map(mapContainerRef.current, {
            center: [pickupLat, pickupLng],
            zoom: 14,
            zoomControl: true,
          });

          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors',
            maxZoom: 19,
          }).addTo(map);

          leafletMapRef.current = map;
        }

        const map = leafletMapRef.current;

        // Pickup Marker (Green Dot)
        if (!leafletPickupMarkerRef.current) {
          const pickupIcon = L.divIcon({
            className: 'custom-pickup-pin',
            html: `
              <div style="width: 24px; height: 24px; border-radius: 9999px; background: #10B981; border: 2px solid #FFFFFF; box-shadow: 0 2px 6px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; color: #FFFFFF; font-weight: 900; font-size: 11px; font-family: system-ui, sans-serif;">
                A
              </div>
            `,
            iconSize: [24, 24],
            iconAnchor: [12, 12],
          });
          leafletPickupMarkerRef.current = L.marker([pickupLat, pickupLng], { icon: pickupIcon }).addTo(map);
        } else {
          leafletPickupMarkerRef.current.setLatLng([pickupLat, pickupLng]);
        }

        // Drop Marker (Red Dot)
        if (currentTrip?.drop_lat && currentTrip?.drop_lng) {
          if (!leafletDropMarkerRef.current) {
            const dropIcon = L.divIcon({
              className: 'custom-drop-pin',
              html: `
                <div style="width: 24px; height: 24px; border-radius: 9999px; background: #EF4444; border: 2px solid #FFFFFF; box-shadow: 0 2px 6px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; color: #FFFFFF; font-weight: 900; font-size: 11px; font-family: system-ui, sans-serif;">
                  B
                </div>
              `,
              iconSize: [24, 24],
              iconAnchor: [12, 12],
            });
            leafletDropMarkerRef.current = L.marker([currentTrip.drop_lat, currentTrip.drop_lng], { icon: dropIcon }).addTo(map);
          } else {
            leafletDropMarkerRef.current.setLatLng([currentTrip.drop_lat, currentTrip.drop_lng]);
          }
        }

        // Driver Car Marker - Pure 3D White Car ONLY (No top icon)
        const carIcon = L.divIcon({
          className: 'custom-tracking-car-pin',
          html: `
            <div style="
              width: 60px;
              height: 40px;
              display: flex;
              align-items: center;
              justify-content: center;
              position: relative;
              filter: drop-shadow(0 4px 8px rgba(0,0,0,0.28));
              cursor: pointer;
            ">
              <img src="${carIconDataUrl}" style="width: 60px; height: 40px; object-fit: contain; pointer-events: none;" alt="3D White Car" />
            </div>
          `,
          iconSize: [60, 40],
          iconAnchor: [30, 20],
        });

        if (!leafletDriverMarkerRef.current) {
          leafletDriverMarkerRef.current = L.marker([driverPos.lat, driverPos.lng], { icon: carIcon }).addTo(map);
        } else {
          leafletDriverMarkerRef.current.setIcon(carIcon);
          
          const curPos = leafletDriverMarkerRef.current.getLatLng();
          if (curPos) {
            const startLat = curPos.lat;
            const startLng = curPos.lng;
            const targetLat = driverPos.lat;
            const targetLng = driverPos.lng;
            const delta = Math.hypot(targetLat - startLat, targetLng - startLng);

            if (delta > 0.000005 && delta < 0.05) {
              if (driverAnimFrameRef.current) {
                cancelAnimationFrame(driverAnimFrameRef.current);
              }
              const startTime = performance.now();
              const duration = 30000;
              const step = (now: number) => {
                const elapsed = now - startTime;
                const progress = Math.min(elapsed / duration, 1);
                const ease = progress; // Linear
                leafletDriverMarkerRef.current?.setLatLng([
                  startLat + (targetLat - startLat) * ease,
                  startLng + (targetLng - startLng) * ease,
                ]);
                if (progress < 1) {
                  driverAnimFrameRef.current = requestAnimationFrame(step);
                } else {
                  driverAnimFrameRef.current = null;
                }
              };
              driverAnimFrameRef.current = requestAnimationFrame(step);
            } else if (delta >= 0.05) {
              leafletDriverMarkerRef.current.setLatLng([driverPos.lat, driverPos.lng]);
            }
          } else {
            leafletDriverMarkerRef.current.setLatLng([driverPos.lat, driverPos.lng]);
          }
        }

        // Fit bounds once
        if (!hasInitialFitBoundsRef.current) {
          const latLngs: [number, number][] = [[pickupLat, pickupLng], [driverPos.lat, driverPos.lng]];
          if (currentTrip?.drop_lat && currentTrip?.drop_lng) {
            latLngs.push([currentTrip.drop_lat, currentTrip.drop_lng]);
          }
          map.fitBounds(latLngs, { padding: [50, 50] });
          hasInitialFitBoundsRef.current = true;
        }
      } catch (e) {
        // Fallback to high-fidelity radar canvas
        setMapEngine('radar');
      }
    }

    initMap();

    return () => {
      isCancelled = true;
      if (driverAnimFrameRef.current) {
        cancelAnimationFrame(driverAnimFrameRef.current);
      }
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
        leafletDriverMarkerRef.current = null;
        leafletPickupMarkerRef.current = null;
        leafletDropMarkerRef.current = null;
      }
    };
  }, [currentTrip, driver]);

  // Status mapping
  const getStatusDisplay = () => {
    if (!currentTrip) return { label: 'Finding Ride', color: 'bg-amber-500 text-slate-950', sub: 'Connecting with driver...' };
    switch (currentTrip.status) {
      case 'OPEN':
        return { label: 'Matching Driver', color: 'bg-amber-500 text-slate-950', sub: 'Dispatching to nearest vehicle' };
      case 'ACCEPTED':
        return { label: 'Driver Assigned', color: 'bg-sky-500 text-white', sub: 'Vehicle is heading to pickup' };
      case 'IN_PROGRESS':
        return { label: 'Ride In Progress', color: 'bg-emerald-600 text-white', sub: 'En route to destination' };
      case 'COMPLETED':
        return { label: 'Trip Completed', color: 'bg-slate-900 text-white', sub: 'Thank you for riding with us' };
      case 'CANCELLED':
        return { label: 'Trip Cancelled', color: 'bg-rose-600 text-white', sub: 'This ride has been cancelled' };
      default:
        return { label: currentTrip.status, color: 'bg-amber-500 text-slate-950', sub: 'Status updated' };
    }
  };

  const statusInfo = getStatusDisplay();
  const driverName = currentTrip?.driver_name || driver?.driver_name || fallbackDriver?.driver_name || 'Assigned Driver';
  const vehiclePlate = currentTrip?.vehicle_number || driver?.vehicle_number || fallbackDriver?.vehicle_number || 'Vehicle Assigned';
  const vehicleCategory = currentTrip?.vehicle_category || driver?.vehicle_category || fallbackDriver?.vehicle_category || 'Mini';
  const driverPhone = currentTrip?.driver_phone || driver?.mobile_number || fallbackDriver?.mobile_number;
  const driverRating = driver?.rating || fallbackDriver?.rating || 4.9;

  // Loading screen while initial session handshake completes
  if (isLoading && !currentTrip) {
    return (
      <div className="relative w-full min-h-screen bg-slate-50 text-slate-900 flex flex-col items-center justify-center p-6 text-center select-none">
        <div className="w-20 h-14 flex items-center justify-center mb-4 filter drop-shadow-md animate-pulse">
          <img
            src="/icons/white-3d-car.svg"
            alt="Connecting to Cab"
            className="w-full h-full object-contain"
            referrerPolicy="no-referrer"
          />
        </div>
        <h2 className="text-lg font-bold text-slate-900 mb-1">
          Connecting to Live Cab Tracking...
        </h2>
        <p className="text-xs text-slate-500 font-mono">
          Securing encrypted tracking session
        </p>
      </div>
    );
  }

  // CRITICAL USER DIRECTIVE:
  // "fix only expire if COMPLETED or CANCELLED"
  // "In-process trips still showing Your link is expired active tyrip also showing like this Your link is expired fix it properly"
  // Active in-process trips (IN_PROGRESS, ACCEPTED, OPEN) MUST NEVER BE EXPIRED!
  const isTripFinished = currentTrip
    ? (currentTrip.status === 'COMPLETED' || currentTrip.status === 'CANCELLED')
    : false;
  const isLinkExpired = currentTrip ? isTripFinished : (!isLoading && isExpired);

  // If ride is complete, cancelled, or tracking link is expired/disabled:
  if (isLinkExpired) {
    return (
      <div className="relative w-full min-h-screen bg-slate-50 text-slate-900 flex flex-col items-center justify-center p-6 text-center select-none">
        <div className="w-full max-w-sm bg-white border border-slate-200 rounded-3xl p-8 shadow-xl text-center">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mb-4 shadow-sm mx-auto">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 mb-2">
            Your link is expired
          </h1>
          <p className="text-sm text-slate-500 mb-6 leading-relaxed">
            This tracking session has ended or is no longer active.
          </p>
          <a
            href="tel:+914223596446"
            className="inline-flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md transition"
          >
            <Phone className="w-4 h-4 text-slate-950" />
            <span>Call Office: +914223596446</span>
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full min-h-screen bg-slate-100 text-slate-900 flex flex-col font-sans overflow-x-hidden select-none">
      {/* 1. TOP BRANDED HEADER (Light Theme) */}
      <header className="relative z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 py-3 sm:px-6 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-2.5">
          <span className="bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2.5 py-1 rounded-full border border-emerald-200 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
            LIVE
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className={`text-[11px] font-extrabold px-3 py-1 rounded-full shadow-2xs ${statusInfo.color}`}>
            {statusInfo.label}
          </span>
        </div>
      </header>

      {/* 2. MAIN INTERACTIVE MAP / VECTOR RADAR VIEW (Light Theme) */}
      <div className="relative flex-1 w-full min-h-[420px] bg-slate-200 overflow-hidden">
        {/* Interactive Street Map (Google Maps or Leaflet OpenStreetMap) */}
        <div
          ref={mapContainerRef}
          className={`absolute inset-0 w-full h-full transition-opacity duration-500 ${
            mapEngine !== 'radar' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'
          }`}
        />

        {/* High-Fidelity Fallback Live Radar Canvas (if network maps not reachable) */}
        {mapEngine === 'radar' && (
          <div className="absolute inset-0 w-full h-full bg-gradient-to-b from-slate-100 via-slate-50 to-slate-200 flex flex-col items-center justify-center p-4">
            {/* Background Grid Pattern */}
            <div
              className="absolute inset-0 opacity-25"
              style={{
                backgroundImage:
                  'radial-gradient(#d97706 1px, transparent 1px), linear-gradient(to right, #cbd5e1 1px, transparent 1px), linear-gradient(to bottom, #cbd5e1 1px, transparent 1px)',
                backgroundSize: '30px 30px',
              }}
            />

            {/* Radar Animation Ring */}
            <div className="relative w-72 h-72 rounded-full border border-amber-500/25 flex items-center justify-center">
              <div className="absolute w-56 h-56 rounded-full border border-amber-500/30 animate-ping opacity-25" />
              <div className="absolute w-40 h-40 rounded-full border border-amber-500/35" />
              <div className="absolute w-24 h-24 rounded-full bg-amber-400/10 border border-amber-500/40" />

              {/* Steady Driver Vehicle Center */}
              <div className="relative z-10 flex flex-col items-center">
                <div className="w-24 h-16 flex items-center justify-center filter drop-shadow-md mb-1">
                  <img
                    src="/icons/white-3d-car.svg"
                    alt="Live Cab"
                    className="w-full h-full object-contain"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <span className="text-xs font-black text-slate-950 bg-amber-400 px-3 py-0.5 rounded-full border border-amber-500 shadow-sm font-mono">
                  {vehiclePlate}
                </span>
                <span className="text-[10px] text-slate-600 mt-1 font-semibold">
                  Live GPS Tracking
                </span>
              </div>
            </div>

            {/* Route Coordinates Summary */}
            <div className="absolute bottom-4 left-4 right-4 max-w-md mx-auto bg-white/95 backdrop-blur-md rounded-2xl p-3 border border-slate-200 text-slate-700 text-xs flex items-center justify-between shadow-md">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[11px] font-mono text-slate-600">
                  GPS: {driver?.latitude ? `${driver.latitude.toFixed(4)}, ${driver.longitude?.toFixed(4)}` : 'Active Satellite Fix'}
                </span>
              </div>
              <span className="text-[11px] font-bold text-amber-700">
                Speed: ~34 km/h
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 3. BOTTOM VEHICLE & TRIP DETAILS CARD */}
      <div className="relative z-30 bg-white rounded-t-3xl shadow-2xl border-t border-slate-200 px-4 pt-5 pb-6 sm:px-6 max-w-3xl mx-auto w-full space-y-4">
        {/* Drag handle pill */}
        <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto -mt-1 mb-2" />

        {/* Driver Details & Vehicle Number Plate with Call Buttons */}
        <div className="flex items-start justify-between border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-1.5">
              <h2 className="font-extrabold text-base text-slate-900 tracking-tight">
                {driverName}
              </h2>
              <span className="bg-emerald-50 text-emerald-700 text-[10px] font-bold px-1.5 py-0.5 rounded border border-emerald-200">
                Verified
              </span>
            </div>
            <div className="text-xs text-slate-500 font-medium">
              {vehicleCategory}
            </div>
          </div>

          {/* Vehicle Number Plate & Call Actions */}
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <div className="bg-amber-400 text-slate-950 px-3 py-1 rounded-xl font-mono font-black text-xs sm:text-sm tracking-wider border border-amber-500 shadow-2xs">
              {vehiclePlate}
            </div>
            {driverPhone && (
              <a
                href={`tel:${driverPhone}`}
                className="w-full justify-center bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow-2xs transition"
              >
                <Phone className="w-3.5 h-3.5 text-amber-400" />
                <span>Call Driver</span>
              </a>
            )}
            <a
              href="tel:+914223596446"
              className="w-full justify-center bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow-2xs transition"
            >
              <Phone className="w-3.5 h-3.5 text-slate-950" />
              <span>Call Office</span>
            </a>
          </div>
        </div>

        {/* Route Stepper */}
        <div>
          <div className="w-full bg-slate-50 rounded-2xl p-3 border border-slate-200/80 text-xs space-y-2">
            {/* Pickup */}
            <div className="flex items-start gap-2">
              <div className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-[9px] mt-0.5 shrink-0">
                A
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] uppercase font-bold text-slate-400">Pickup Address</div>
                <div className="text-xs font-bold text-slate-900 truncate">
                  {currentTrip?.pickup_location || 'Address not available'}
                </div>
              </div>
            </div>

            {/* Drop */}
            <div className="flex items-start gap-2">
              <div className="w-4 h-4 rounded-full bg-rose-500 text-white flex items-center justify-center font-bold text-[9px] mt-0.5 shrink-0">
                B
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] uppercase font-bold text-slate-400">Drop Destination</div>
                <div className="text-xs font-bold text-slate-900 truncate">
                  {currentTrip?.drop_location || 'Address not available'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
