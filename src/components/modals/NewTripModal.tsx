import React, { useState, useEffect, useCallback, useRef } from 'react';
import { FirestoreTrip, FirestoreDriver, VehicleCategory, TripType, DispatchType } from '../../types';
import {
  Car,
  MapPin,
  User,
  Phone,
  KeyRound,
  X,
  Radio,
  Zap,
  Clock,
  Compass,
  Calculator,
  RotateCcw,
  Navigation,
  Check,
  ChevronRight,
  ShieldCheck,
  FileText,
  Send,
  Sliders,
  AlertTriangle,
  ClipboardPaste,
  Sparkles,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  PhoneCall,
  ArrowLeft,
  ArrowRight,
  MessageSquare,
} from 'lucide-react';
import { DriverAvatar } from '../DriverAvatar';
import { DriverSearchSelect } from '../DriverSearchSelect';
import { GooglePlacesInput } from '../GooglePlacesInput';
import { RouteMapPreview } from '../RouteMapPreview';
import { CustomerOtpSender } from '../CustomerOtpSender';
import { parseBookingText, ParsedBookingData } from '../../services/bookingParser';
import { geocodeAddress } from '../../services/googleMapsService';

interface NewTripModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (trip: Partial<FirestoreTrip>) => Promise<FirestoreTrip>;
  drivers: FirestoreDriver[];
  trips?: FirestoreTrip[];
  initialBookingData?: ParsedBookingData | null;
}

const CATEGORY_DEFAULT_RATES: Record<
  string,
  { baseFare: number; kmsFare: number; hourFare: number }
> = {
  Mini: { baseFare: 80, kmsFare: 28, hourFare: 350 },
  MINI: { baseFare: 80, kmsFare: 28, hourFare: 350 },
  Sedan: { baseFare: 80, kmsFare: 28, hourFare: 375 },
  SEDAN: { baseFare: 80, kmsFare: 28, hourFare: 375 },
  SUV: { baseFare: 200, kmsFare: 35, hourFare: 425 },
  'SUV+': { baseFare: 250, kmsFare: 45, hourFare: 450 },
  Innova: { baseFare: 250, kmsFare: 45, hourFare: 450 },
  INNOVA: { baseFare: 250, kmsFare: 24, hourFare: 450 },
  'INNOVA CRYSTA': { baseFare: 300, kmsFare: 50, hourFare: 500 },
  CUSTOM: { baseFare: 300, kmsFare: 45, hourFare: 500 },
};

export const NewTripModal: React.FC<NewTripModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  drivers,
  trips = [],
  initialBookingData,
}) => {
  const [customerName, setCustomerName] = useState('Walk-in Customer');
  const [customerPhone, setCustomerPhone] = useState('');
  const [tripType, setTripType] = useState<TripType>('REGULAR');
  const [pickupLocation, setPickupLocation] = useState('');
  const [dropLocation, setDropLocation] = useState('');
  const [pickupLat, setPickupLat] = useState('');
  const [pickupLng, setPickupLng] = useState('');
  const [dropLat, setDropLat] = useState('');
  const [dropLng, setDropLng] = useState('');
  const [showCoordinates, setShowCoordinates] = useState(false);
  const [vehicleCategory, setVehicleCategory] = useState<VehicleCategory>('MINI');
  const [customVehicleName, setCustomVehicleName] = useState('');

  // Quick Paste Drawer State
  const [isPasteDrawerOpen, setIsPasteDrawerOpen] = useState(false);
  const [pastedText, setPastedText] = useState('');
  const [pasteNotice, setPasteNotice] = useState<string | null>(null);
  const hasInitializedRef = useRef(false);

  // Pricing inputs - blank by default, fully optional
  const [baseFare, setBaseFare] = useState('');
  const [kmsFare, setKmsFare] = useState('');
  const [distanceKm, setDistanceKm] = useState('');

  // Package pricing inputs - blank by default
  const [hourFare, setHourFare] = useState('');
  const [packageHours, setPackageHours] = useState('');
  const [packageKms, setPackageKms] = useState('');
  const [includeKmInPackageTotal, setIncludeKmInPackageTotal] = useState(false);

  // Total Estimated Fare
  const [estimatedFare, setEstimatedFare] = useState('');
  const [assignedDriverId, setAssignedDriverId] = useState<string>('');
  const [dispatchType, setDispatchType] = useState<DispatchType>('RADIUS');
  const [radiusKms, setRadiusKms] = useState('5');
  const [notes, setNotes] = useState('');
  const [sendSmsNotification, setSendSmsNotification] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // OTP - Optional! Starts blank
  const [otp, setOtp] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Mobile Step-by-Step Wizard state (1: Passenger, 2: Route, 3: Fare, 4: Driver & Dispatch)
  const [mobileStep, setMobileStep] = useState<1 | 2 | 3 | 4>(1);

  // Apply parsed booking data to form fields
  const applyParsedData = useCallback(async (data: ParsedBookingData) => {
    if (data.customerName) setCustomerName(data.customerName);
    if (data.customerPhone) setCustomerPhone(data.customerPhone);
    if (data.tripType) setTripType(data.tripType);
    if (data.vehicleCategory) setVehicleCategory(data.vehicleCategory);
    if (data.pickupLocation) setPickupLocation(data.pickupLocation);
    if (data.dropLocation) setDropLocation(data.dropLocation);
    if (data.packageHours) setPackageHours(data.packageHours);
    if (data.packageKms) setPackageKms(data.packageKms);
    if (data.estimatedFare) setEstimatedFare(data.estimatedFare);
    if (data.notes) setNotes(data.notes);

    setPasteNotice('Booking details extracted & filled successfully!');
    setTimeout(() => setPasteNotice(null), 6000);

    // Asynchronously resolve coordinates for pickup & drop
    if (data.pickupLat && data.pickupLng) {
      setPickupLat(String(data.pickupLat));
      setPickupLng(String(data.pickupLng));
    } else if (data.pickupLocation) {
      try {
        const geo = await geocodeAddress(data.pickupLocation);
        if (geo) {
          setPickupLat(String(geo.lat));
          setPickupLng(String(geo.lng));
        }
      } catch (err) {
        console.warn('Geocoding pickup failed:', err);
      }
    }

    if (data.dropLat && data.dropLng) {
      setDropLat(String(data.dropLat));
      setDropLng(String(data.dropLng));
    } else if (data.dropLocation) {
      try {
        const geo = await geocodeAddress(data.dropLocation);
        if (geo) {
          setDropLat(String(geo.lat));
          setDropLng(String(geo.lng));
        }
      } catch (err) {
        console.warn('Geocoding drop failed:', err);
      }
    }
  }, []);

  const NEW_TRIP_DRAFT_KEY = 'trusty_cab_new_trip_draft_v1';

  // Check whether form contains meaningful user-entered data
  const hasEnteredData = Boolean(
    (customerPhone && customerPhone.trim()) ||
    (pickupLocation && pickupLocation.trim()) ||
    (dropLocation && dropLocation.trim()) ||
    (notes && notes.trim()) ||
    (estimatedFare && estimatedFare !== '0' && estimatedFare.trim()) ||
    (customerName && customerName !== 'Walk-in Customer')
  );

  // Complete reset to clean default values
  const resetForm = useCallback(() => {
    setCustomerName('Walk-in Customer');
    setCustomerPhone('');
    setTripType('REGULAR');
    setPickupLocation('');
    setDropLocation('');
    setPickupLat('');
    setPickupLng('');
    setDropLat('');
    setDropLng('');
    setShowCoordinates(false);
    setVehicleCategory('MINI');
    setCustomVehicleName('');
    setBaseFare('');
    setKmsFare('');
    setDistanceKm('');
    setHourFare('');
    setPackageHours('');
    setPackageKms('');
    setIncludeKmInPackageTotal(false);
    setEstimatedFare('');
    setAssignedDriverId('');
    setDispatchType('RADIUS');
    setRadiusKms('5');
    setNotes('');
    setSendSmsNotification(true);
    setOtp('');
    setErrorMessage(null);
    setIsSubmitting(false);
    setIsPasteDrawerOpen(false);
    setPastedText('');
    setPasteNotice(null);
    setMobileStep(1);
  }, []);

  // Clear draft from localStorage and reset form
  const handleClearDraft = useCallback(() => {
    try {
      localStorage.removeItem(NEW_TRIP_DRAFT_KEY);
    } catch {}
    resetForm();
  }, [resetForm]);

  // Auto-save form draft to localStorage while typing
  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      if (hasEnteredData) {
        try {
          const draft = {
            customerName,
            customerPhone,
            tripType,
            pickupLocation,
            dropLocation,
            pickupLat,
            pickupLng,
            dropLat,
            dropLng,
            vehicleCategory,
            customVehicleName,
            baseFare,
            kmsFare,
            distanceKm,
            hourFare,
            packageHours,
            packageKms,
            estimatedFare,
            assignedDriverId,
            dispatchType,
            radiusKms,
            otp,
            notes,
          };
          localStorage.setItem(NEW_TRIP_DRAFT_KEY, JSON.stringify(draft));
        } catch {}
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [
    isOpen,
    hasEnteredData,
    customerName,
    customerPhone,
    tripType,
    pickupLocation,
    dropLocation,
    pickupLat,
    pickupLng,
    dropLat,
    dropLng,
    vehicleCategory,
    customVehicleName,
    baseFare,
    kmsFare,
    distanceKm,
    hourFare,
    packageHours,
    packageKms,
    estimatedFare,
    assignedDriverId,
    dispatchType,
    radiusKms,
    otp,
    notes,
  ]);

  // Prevent accidental tab closure or browser refresh while user is typing in form
  useEffect(() => {
    if (!isOpen) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasEnteredData) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isOpen, hasEnteredData]);

  // When modal is opened, restore draft if present, or apply initialBookingData
  useEffect(() => {
    if (isOpen) {
      if (!hasInitializedRef.current) {
        hasInitializedRef.current = true;
        if (initialBookingData) {
          applyParsedData(initialBookingData);
        } else {
          try {
            const rawDraft = localStorage.getItem(NEW_TRIP_DRAFT_KEY);
            if (rawDraft) {
              const draft = JSON.parse(rawDraft);
              if (draft && typeof draft === 'object') {
                if (draft.customerName) setCustomerName(draft.customerName);
                if (draft.customerPhone) setCustomerPhone(draft.customerPhone);
                if (draft.tripType) setTripType(draft.tripType);
                if (draft.pickupLocation) setPickupLocation(draft.pickupLocation);
                if (draft.dropLocation) setDropLocation(draft.dropLocation);
                if (draft.pickupLat) setPickupLat(draft.pickupLat);
                if (draft.pickupLng) setPickupLng(draft.pickupLng);
                if (draft.dropLat) setDropLat(draft.dropLat);
                if (draft.dropLng) setDropLng(draft.dropLng);
                if (draft.vehicleCategory) setVehicleCategory(draft.vehicleCategory);
                if (draft.customVehicleName) setCustomVehicleName(draft.customVehicleName);
                if (draft.baseFare) setBaseFare(draft.baseFare);
                if (draft.kmsFare) setKmsFare(draft.kmsFare);
                if (draft.distanceKm) setDistanceKm(draft.distanceKm);
                if (draft.hourFare) setHourFare(draft.hourFare);
                if (draft.packageHours) setPackageHours(draft.packageHours);
                if (draft.packageKms) setPackageKms(draft.packageKms);
                if (draft.estimatedFare) setEstimatedFare(draft.estimatedFare);
                if (draft.assignedDriverId) setAssignedDriverId(draft.assignedDriverId);
                if (draft.dispatchType) setDispatchType(draft.dispatchType);
                if (draft.radiusKms) setRadiusKms(draft.radiusKms);
                if (draft.otp) setOtp(draft.otp);
                if (draft.notes) setNotes(draft.notes);
                return;
              }
            }
          } catch {}
          // Otherwise clean defaults
          resetForm();
        }
      }
    } else {
      hasInitializedRef.current = false;
    }
  }, [isOpen, initialBookingData, applyParsedData, resetForm]);

  const handleClose = useCallback(() => {
    try {
      localStorage.removeItem(NEW_TRIP_DRAFT_KEY);
    } catch {}
    resetForm();
    onClose();
  }, [resetForm, onClose]);

  // Handle ESC key to go back and close modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // If user is actively typing in an input, do not close modal on ESC
        const activeTag = document.activeElement?.tagName;
        if (activeTag === 'INPUT' || activeTag === 'TEXTAREA') {
          return;
        }
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleClose]);

  if (!isOpen) return null;

  const handleCategoryChange = (cat: VehicleCategory) => {
    setVehicleCategory(cat);
    const defaults = CATEGORY_DEFAULT_RATES[cat] || { baseFare: 80, kmsFare: 15, hourFare: 140 };
    setBaseFare(String(defaults.baseFare));
    setKmsFare(String(defaults.kmsFare));
    setHourFare(String(defaults.hourFare));

    if (tripType === 'REGULAR') {
      const dist = distanceKm ? Number(distanceKm) : 0;
      const calc = defaults.baseFare + defaults.kmsFare * dist;
      setEstimatedFare(String(Math.max(defaults.baseFare, Math.round(calc))));
    } else {
      recalculatePackageFare(
        String(defaults.hourFare),
        packageHours,
        String(defaults.kmsFare),
        packageKms,
        includeKmInPackageTotal
      );
    }
  };

  const recalculateRegularFare = (b: string, k: string, d: string) => {
    const base = Number(b) || 0;
    const perKm = Number(k) || 0;
    const dist = d ? Number(d) || 0 : 0;
    const total = base + perKm * dist;
    if (total > 0) {
      setEstimatedFare(String(Math.round(total)));
    }
  };

  const recalculatePackageFare = (
    hFare: string,
    hours: string,
    kFare: string = kmsFare,
    kms: string = packageKms,
    includeKm: boolean = includeKmInPackageTotal
  ) => {
    const rate = Number(hFare) || 0;
    const hrs = Number(hours) || 0;
    const kRate = Number(kFare) || 0;
    const distKm = Number(kms) || 0;
    let total = rate * hrs;
    if (includeKm && distKm > 0 && kRate > 0) {
      total += kRate * distKm;
    }
    if (total > 0) {
      setEstimatedFare(String(Math.round(total)));
    }
  };

  const handleTripTypeChange = (type: TripType) => {
    setTripType(type);
    if (type === 'REGULAR') {
      recalculateRegularFare(baseFare, kmsFare, distanceKm);
    } else {
      recalculatePackageFare(hourFare, packageHours, kmsFare, packageKms, includeKmInPackageTotal);
    }
  };

  const regenerateOtp = () => {
    setOtp(String(Math.floor(1000 + Math.random() * 9000)));
  };

  const handleRouteCalculated = (distKm: number) => {
    setDistanceKm(String(distKm));
    if (tripType === 'REGULAR') {
      const b = Number(baseFare) || 0;
      const k = Number(kmsFare) || 0;
      const total = b + k * distKm;
      if (total > 0) {
        setEstimatedFare(String(Math.round(total)));
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const selectedDriver = drivers.find((d) => d.driver_id === assignedDriverId);
    const isPkg = tripType === 'PACKAGE';

    try {
      await onSubmit({
        customer_name: customerName.trim() || 'Passenger',
        customer_phone: customerPhone.trim() || '',
        trip_type: tripType,
        is_package: isPkg,
        pickup_location: pickupLocation.trim() || 'Coimbatore',
        drop_location: dropLocation.trim() || (isPkg ? pickupLocation.trim() || 'Coimbatore' : ''),
        pickup_lat: pickupLat ? Number(pickupLat) : 11.0168,
        pickup_lng: pickupLng ? Number(pickupLng) : 76.9558,
        drop_lat: dropLat ? Number(dropLat) : (pickupLat ? Number(pickupLat) : 11.0268),
        drop_lng: dropLng ? Number(dropLng) : (pickupLng ? Number(pickupLng) : 76.9658),
        vehicle_category:
          vehicleCategory === 'CUSTOM'
            ? customVehicleName.trim() || 'Custom Vehicle'
            : vehicleCategory,
        base_fare: !isPkg ? (baseFare ? Number(baseFare) : null) : null,
        kms_fare: kmsFare ? Number(kmsFare) : null,
        distance_km: !isPkg && distanceKm ? Number(distanceKm) : (isPkg && packageKms ? Number(packageKms) : undefined),
        hour_fare: isPkg ? (hourFare ? Number(hourFare) : null) : null,
        package_hours: isPkg && packageHours ? Number(packageHours) : undefined,
        package_kms: isPkg && packageKms ? Number(packageKms) : undefined,
        estimated_fare: estimatedFare ? Number(estimatedFare) : 0,
        driver_id: selectedDriver ? selectedDriver.driver_id : null,
        driver_name: selectedDriver ? selectedDriver.driver_name : null,
        driver_phone: selectedDriver ? selectedDriver.mobile_number : null,
        vehicle_number: selectedDriver ? selectedDriver.vehicle_number : null,
        dispatch_type: dispatchType,
        radius_kms: dispatchType === 'RADIUS' && radiusKms ? Number(radiusKms) : null,
        otp: otp && otp.trim() ? otp.trim() : null,
        notes: notes.trim(),
      });
      try {
        localStorage.removeItem(NEW_TRIP_DRAFT_KEY);
      } catch {}
      resetForm();
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Error dispatching trip');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedDriver = drivers.find((d) => d.driver_id === assignedDriverId);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 md:p-6 bg-slate-900/60 backdrop-blur-xs"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          // If user has already entered ride info, don't close on accidental backdrop click
          if (!hasEnteredData) {
            handleClose();
          }
        }
      }}
    >
      <div className="w-full max-w-5xl h-[100dvh] sm:h-auto sm:max-h-[94vh] bg-slate-50 rounded-none sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden border-0 sm:border sm:border-slate-200/90 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Top Header Bar */}
        <div className="px-3.5 sm:px-6 py-2.5 sm:py-3.5 bg-white border-b border-slate-200 flex items-center justify-between shrink-0 gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-bold shadow-xs shrink-0">
              <Car className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1 text-[11px] sm:text-xs text-slate-400 font-medium">
                <span>Dispatch</span>
                <ChevronRight className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                <span className="text-slate-700 font-semibold truncate">New Booking</span>
              </div>
              <h2 className="text-sm sm:text-base md:text-lg font-bold text-slate-900 leading-tight truncate">
                Create New Ride Dispatch
              </h2>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => {
                setPastedText('');
                setIsPasteDrawerOpen((prev) => !prev);
              }}
              title="Paste booking from Email or WhatsApp"
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-bold rounded-xl transition cursor-pointer ${
                isPasteDrawerOpen
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'bg-amber-50 hover:bg-amber-100 text-amber-950 border border-amber-200/80'
              }`}
            >
              <ClipboardPaste className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span className="hidden xs:inline sm:inline">{isPasteDrawerOpen ? 'Close' : 'Paste'}</span>
            </button>
            <button
              type="button"
              onClick={resetForm}
              title="Reset all form fields to default"
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <span>Reset</span>
            </button>
            <button
              type="button"
              onClick={handleClose}
              title="Close and Reset"
              className="w-8 h-8 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Quick Paste Booking Drawer */}
        {isPasteDrawerOpen && (
          <div className="mx-4 sm:mx-6 mt-3 p-4 bg-amber-50/70 border-2 border-amber-300/80 rounded-2xl space-y-3 animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-600" />
                <h4 className="text-xs font-bold text-slate-900">
                  Paste Booking Details (From Email, Website or WhatsApp)
                </h4>
              </div>
              <button
                type="button"
                onClick={async () => {
                  try {
                    if (navigator?.clipboard?.readText) {
                      const text = await navigator.clipboard.readText();
                      if (text) setPastedText(text);
                    }
                  } catch {}
                }}
                className="text-[11px] font-bold text-amber-800 hover:text-amber-950 flex items-center gap-1 bg-amber-100 hover:bg-amber-200/80 px-2.5 py-1 rounded-lg transition cursor-pointer"
              >
                <ClipboardPaste className="w-3 h-3" />
                <span>Paste Clipboard</span>
              </button>
            </div>

            <textarea
              rows={4}
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              placeholder="Paste booking text here (e.g. Pickup, Drop, Phone, Vehicle, Fare)..."
              className="w-full bg-white border border-amber-200 rounded-xl p-3 text-xs font-mono text-slate-900 outline-none focus:ring-2 focus:ring-amber-500/20 resize-none shadow-2xs"
            />

            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-[11px] text-slate-500">
                Auto-detects phone, pickup, drop, rental package, vehicle & fare.
              </span>
              <div className="flex items-center gap-2 ml-auto">
                <button
                  type="button"
                  onClick={() => {
                    setPastedText('');
                    setIsPasteDrawerOpen(false);
                  }}
                  className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-800 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!pastedText.trim()}
                  onClick={() => {
                    const parsed = parseBookingText(pastedText);
                    applyParsedData(parsed);
                    setPastedText('');
                    setIsPasteDrawerOpen(false);
                  }}
                  className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-xs transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                  <span>Auto-Fill Form</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Paste Success Notice */}
        {pasteNotice && (
          <div className="mx-4 sm:mx-6 mt-2 p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-center justify-between animate-in fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{pasteNotice}</span>
            </div>
            <button
              type="button"
              onClick={() => setPasteNotice(null)}
              className="text-emerald-700 hover:text-emerald-900 p-0.5 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Inline Error Notice */}
        {errorMessage && (
          <div className="mx-5 sm:mx-7 mt-3 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              className="text-rose-500 hover:text-rose-800 p-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Mobile Step-by-Step Navigation Bar (Visible only on mobile screens < lg) */}
        <div className="lg:hidden px-3 sm:px-4 py-2 bg-slate-100/95 border-b border-slate-200 shrink-0 select-none">
          <div className="grid grid-cols-4 gap-1 sm:gap-1.5">
            {[
              { step: 1, title: 'Passenger', icon: User },
              { step: 2, title: 'Route', icon: MapPin },
              { step: 3, title: 'Fare', icon: Car },
              { step: 4, title: 'Dispatch', icon: Zap },
            ].map(({ step, title, icon: Icon }) => {
              const isActive = mobileStep === step;
              const isCompleted = mobileStep > step;
              return (
                <button
                  key={step}
                  type="button"
                  onClick={() => setMobileStep(step as 1 | 2 | 3 | 4)}
                  className={`py-1.5 px-1 rounded-xl transition flex flex-col items-center justify-center text-center cursor-pointer min-h-[44px] ${
                    isActive
                      ? 'bg-amber-500 text-slate-950 font-black shadow-xs ring-2 ring-amber-500/30'
                      : isCompleted
                      ? 'bg-emerald-50 text-emerald-800 font-bold border border-emerald-200/80 hover:bg-emerald-100/60'
                      : 'bg-white text-slate-600 font-medium border border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-1">
                    {isCompleted ? (
                      <Check className="w-3.5 h-3.5 text-emerald-700 stroke-[3]" />
                    ) : (
                      <span
                        className={`text-[10px] w-3.5 h-3.5 rounded-full flex items-center justify-center font-bold ${
                          isActive
                            ? 'bg-slate-950 text-amber-400'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {step}
                      </span>
                    )}
                    <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-slate-950' : isCompleted ? 'text-emerald-700' : 'text-slate-400'}`} />
                  </div>
                  <span className="text-[10px] font-bold leading-tight truncate mt-0.5">
                    {title}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 2-Column Responsive Body */}
        <form
          id="new-trip-form"
          onSubmit={handleSubmit}
          onKeyDown={(e) => {
            // Prevent accidental form submission and modal closing on Enter key in input fields
            if (e.key === 'Enter') {
              const target = e.target as HTMLElement;
              const isSubmitButton = target.tagName === 'BUTTON' && target.getAttribute('type') === 'submit';
              if (!isSubmitButton && target.tagName !== 'TEXTAREA') {
                e.preventDefault();
              }
            }
          }}
          className="flex-1 overflow-y-auto p-3 sm:p-5 md:p-6 pb-28 lg:pb-6 grid grid-cols-1 lg:grid-cols-12 gap-3.5 sm:gap-4.5"
        >
          {/* LEFT COLUMN: Main Form Sections (8 cols on lg) */}
          <div className="lg:col-span-8 space-y-3.5 sm:space-y-4">

            {/* STEP 1 (Mobile): Ride Type & Passenger Details */}
            <div className={`space-y-3.5 sm:space-y-4 ${mobileStep === 1 ? 'block' : 'hidden lg:block'}`}>

              {/* SECTION 1: Ride Type Selection */}
              <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-slate-900">Ride Type</h3>
                  <p className="text-[11px] sm:text-xs text-slate-500">Choose the trip model for this booking</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={() => handleTripTypeChange('REGULAR')}
                  className={`p-2.5 sm:p-3.5 rounded-xl border text-left transition flex items-start justify-between gap-2 cursor-pointer min-h-[64px] ${
                    tripType === 'REGULAR'
                      ? 'border-amber-500 bg-amber-50/40 ring-2 ring-amber-500/20'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex items-start gap-2 sm:gap-3 min-w-0">
                    <div
                      className={`w-7 h-7 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        tripType === 'REGULAR' ? 'bg-amber-500 text-slate-950' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      <Navigation className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs sm:text-sm font-bold text-slate-900 leading-tight">Regular Ride</div>
                      <div className="text-[10px] sm:text-[11px] text-slate-500 leading-tight mt-0.5">Point-to-point drop</div>
                    </div>
                  </div>
                  <div
                    className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                      tripType === 'REGULAR'
                        ? 'border-amber-500 bg-amber-500 text-slate-950'
                        : 'border-slate-300'
                    }`}
                  >
                    {tripType === 'REGULAR' && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleTripTypeChange('PACKAGE')}
                  className={`p-2.5 sm:p-3.5 rounded-xl border text-left transition flex items-start justify-between gap-2 cursor-pointer min-h-[64px] ${
                    tripType === 'PACKAGE'
                      ? 'border-purple-600 bg-purple-50/40 ring-2 ring-purple-600/20'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex items-start gap-2 sm:gap-3 min-w-0">
                    <div
                      className={`w-7 h-7 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        tripType === 'PACKAGE' ? 'bg-purple-600 text-white' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs sm:text-sm font-bold text-slate-900 leading-tight">Rental Package</div>
                      <div className="text-[10px] sm:text-[11px] text-slate-500 leading-tight mt-0.5">Hourly package</div>
                    </div>
                  </div>
                  <div
                    className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                      tripType === 'PACKAGE'
                        ? 'border-purple-600 bg-purple-600 text-white'
                        : 'border-slate-300'
                    }`}
                  >
                    {tripType === 'PACKAGE' && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                  </div>
                </button>
              </div>
            </div>

            {/* SECTION 2: Passenger & Contact Info */}
            <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3">
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <User className="w-4 h-4 text-slate-600" />
                  Passenger Information
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Customer Name <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Passenger Name"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full h-11 bg-white border border-slate-200 rounded-xl px-3.5 text-xs sm:text-sm font-medium text-slate-900 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 focus:outline-none transition shadow-2xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Phone Number <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <div className="h-11 relative flex items-center bg-white border border-slate-200 rounded-xl focus-within:border-amber-500 focus-within:ring-2 focus-within:ring-amber-500/20 transition shadow-2xs overflow-hidden">
                    <div className="pl-3 pr-2.5 flex items-center gap-1 border-r border-slate-100 text-slate-600 text-xs font-semibold shrink-0">
                      <span>+91</span>
                    </div>
                    <input
                      type="tel"
                      placeholder="98000 00000"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      className="w-full h-full bg-transparent px-3 text-xs sm:text-sm font-mono font-medium text-slate-900 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Start OTP & Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-0.5">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                      <KeyRound className="w-3.5 h-3.5 text-amber-600" /> Start OTP
                    </label>
                    <button
                      type="button"
                      onClick={regenerateOtp}
                      className="text-[10px] text-amber-700 hover:underline font-bold flex items-center gap-0.5 cursor-pointer"
                    >
                      <RotateCcw className="w-2.5 h-2.5" /> {otp ? 'New' : 'Generate'}
                    </button>
                  </div>
                  <input
                    type="text"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    maxLength={6}
                    placeholder="Optional OTP"
                    className="w-full h-11 bg-white border border-slate-200 rounded-xl px-3 text-sm font-mono font-bold text-center text-slate-900 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 focus:outline-none shadow-2xs"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Trip Notes / Special Instructions <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Notes..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full h-11 bg-white border border-slate-200 rounded-xl px-3.5 text-xs sm:text-sm text-slate-900 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 focus:outline-none shadow-2xs"
                  />
                </div>
              </div>

              {/* Instant Customer OTP Sender */}
              {otp && otp.trim().length > 0 && (
                <div className="pt-1">
                  <CustomerOtpSender
                    otp={otp.trim()}
                    customerPhone={customerPhone}
                    customerName={customerName}
                  />
                </div>
              )}
            </div>
          </div>

          {/* STEP 2 (Mobile): Route & Locations */}
          <div className={`space-y-3.5 sm:space-y-4 ${mobileStep === 2 ? 'block' : 'hidden lg:block'}`}>

            {/* SECTION 3: Route & Locations (Clean Google Places Autocomplete) */}
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3.5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-emerald-600" />
                    Trip Route & Location
                  </h3>
                  <p className="text-xs text-slate-500"></p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCoordinates(!showCoordinates)}
                  className="text-[11px] text-amber-700 hover:text-amber-800 font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <Compass className="w-3 h-3" />
                  {showCoordinates ? 'Hide GPS Lat/Lng' : 'GPS Lat/Lng'}
                </button>
              </div>

              {/* Pickup Location */}
              <GooglePlacesInput
                label="Pickup Location"
                value={pickupLocation}
                onChange={(address, lat, lng) => {
                  setPickupLocation(address);
                  if (lat !== undefined && lng !== undefined) {
                    setPickupLat(String(lat));
                    setPickupLng(String(lng));
                  }
                }}
                placeholder="Search pickup address or landmark..."
                pinColor="emerald"
                iconType="pickup"
                required={false}
              />

              {showCoordinates && (
                <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  <div>
                    <label className="block text-[10px] font-mono text-slate-500">Pickup Lat</label>
                    <input
                      type="number"
                      step="0.000001"
                      value={pickupLat}
                      onChange={(e) => setPickupLat(e.target.value)}
                      onWheel={(e) => e.currentTarget.blur()}
                      className="w-full border border-slate-200 rounded-lg px-2 py-1 text-slate-900 font-mono text-xs bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono text-slate-500">Pickup Lng</label>
                    <input
                      type="number"
                      step="0.000001"
                      value={pickupLng}
                      onChange={(e) => setPickupLng(e.target.value)}
                      onWheel={(e) => e.currentTarget.blur()}
                      className="w-full border border-slate-200 rounded-lg px-2 py-1 text-slate-900 font-mono text-xs bg-white"
                    />
                  </div>
                </div>
              )}

              {/* Drop Location */}
              <GooglePlacesInput
                label={tripType === 'PACKAGE' ? 'Rental Scope / Destination (Optional)' : 'Drop Destination'}
                value={dropLocation}
                onChange={(address, lat, lng) => {
                  setDropLocation(address);
                  if (lat !== undefined && lng !== undefined) {
                    setDropLat(String(lat));
                    setDropLng(String(lng));
                  }
                }}
                placeholder={tripType === 'PACKAGE' ? 'e.g. Coimbatore Local / Return to pickup' : 'Search drop destination...'}
                pinColor="rose"
                iconType="drop"
                required={false}
              />

              {showCoordinates && (
                <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  <div>
                    <label className="block text-[10px] font-mono text-slate-500">Drop Lat</label>
                    <input
                      type="number"
                      step="0.000001"
                      value={dropLat}
                      onChange={(e) => setDropLat(e.target.value)}
                      onWheel={(e) => e.currentTarget.blur()}
                      className="w-full border border-slate-200 rounded-lg px-2 py-1 text-slate-900 font-mono text-xs bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono text-slate-500">Drop Lng</label>
                    <input
                      type="number"
                      step="0.000001"
                      value={dropLng}
                      onChange={(e) => setDropLng(e.target.value)}
                      onWheel={(e) => e.currentTarget.blur()}
                      className="w-full border border-slate-200 rounded-lg px-2 py-1 text-slate-900 font-mono text-xs bg-white"
                    />
                  </div>
                </div>
              )}

              {/* Big, Clear & Responsive Route Map */}
              <RouteMapPreview
                pickupLocation={pickupLocation}
                pickupLat={pickupLat ? Number(pickupLat) : undefined}
                pickupLng={pickupLng ? Number(pickupLng) : undefined}
                dropLocation={dropLocation}
                dropLat={dropLat ? Number(dropLat) : undefined}
                dropLng={dropLng ? Number(dropLng) : undefined}
                onCalculatedDistance={handleRouteCalculated}
                onPickupSelect={(address, lat, lng) => {
                  // Only set address text if empty, never overwrite user's typed address
                  if (!pickupLocation || !pickupLocation.trim()) {
                    setPickupLocation(address);
                  }
                  setPickupLat(String(lat));
                  setPickupLng(String(lng));
                }}
                onDropSelect={(address, lat, lng) => {
                  // Only set address text if empty, never overwrite user's typed address
                  if (!dropLocation || !dropLocation.trim()) {
                    setDropLocation(address);
                  }
                  setDropLat(String(lat));
                  setDropLng(String(lng));
                }}
              />
            </div>
          </div>

          {/* STEP 3 (Mobile): Vehicle Category & Pricing */}
          <div className={`space-y-3.5 sm:space-y-4 ${mobileStep === 3 ? 'block' : 'hidden lg:block'}`}>

            {/* SECTION 4: Vehicle Category & Pricing */}
            <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3">
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <Calculator className="w-4 h-4 text-amber-600" />
                  Vehicle Category & Pricing
                </h3>
              </div>

              {/* Category Dropdown */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Vehicle Category</label>
                <select
                  value={vehicleCategory}
                  onChange={(e) => handleCategoryChange(e.target.value as VehicleCategory)}
                  className="w-full h-11 border border-slate-200 rounded-xl px-3.5 text-xs sm:text-sm text-slate-900 bg-white font-bold focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 focus:outline-none transition shadow-2xs"
                >
                  <option value="MINI">MINI</option>
                  <option value="SEDAN">SEDAN</option>
                  <option value="SUV">SUV</option>
                  <option value="SUV+">SUV+</option>
                  <option value="INNOVA">INNOVA</option>
                  <option value="INNOVA CRYSTA">INNOVA CRYSTA</option>
                  <option value="CUSTOM">Custom Vehicle Type...</option>
                </select>

                {vehicleCategory === 'CUSTOM' && (
                  <div className="mt-2.5">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Enter Custom Vehicle Name / Type
                    </label>
                    <input
                      type="text"
                      value={customVehicleName}
                      onChange={(e) => setCustomVehicleName(e.target.value)}
                      placeholder="e.g. Tempo Traveller, Force Urbania, Van, Mini Bus..."
                      className="w-full h-11 border border-amber-400 bg-amber-50/50 rounded-xl px-3.5 text-xs sm:text-sm text-slate-900 font-bold placeholder:font-normal placeholder:text-slate-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 focus:outline-none shadow-2xs"
                      autoFocus
                    />
                  </div>
                )}
              </div>

              {/* REGULAR FARE INPUTS: 2x2 grid on mobile, 4 columns on sm+ */}
              {tripType === 'REGULAR' ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 pt-0.5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1 truncate">
                      Base Fare (₹)
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={baseFare}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '' || /^\d*\.?\d*$/.test(val)) {
                          setBaseFare(val);
                          recalculateRegularFare(val, kmsFare, distanceKm);
                        }
                      }}
                      onWheel={(e) => e.currentTarget.blur()}
                      className="w-full h-11 border border-slate-200 rounded-xl px-3 text-xs sm:text-sm font-bold text-slate-900 bg-white focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 focus:outline-none shadow-2xs"
                      placeholder="150"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1 truncate">
                      KM Rate (₹/km)
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={kmsFare}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '' || /^\d*\.?\d*$/.test(val)) {
                          setKmsFare(val);
                          recalculateRegularFare(baseFare, val, distanceKm);
                        }
                      }}
                      onWheel={(e) => e.currentTarget.blur()}
                      className="w-full h-11 border border-slate-200 rounded-xl px-3 text-xs sm:text-sm font-bold text-slate-900 bg-white focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 focus:outline-none shadow-2xs"
                      placeholder="28"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1 truncate">
                      Distance (km)
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={distanceKm}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '' || /^\d*\.?\d*$/.test(val)) {
                          setDistanceKm(val);
                          recalculateRegularFare(baseFare, kmsFare, val);
                        }
                      }}
                      onWheel={(e) => e.currentTarget.blur()}
                      placeholder="e.g. 37.2"
                      className="w-full h-11 border border-slate-200 rounded-xl px-3 text-xs sm:text-sm font-bold text-slate-900 bg-white focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 focus:outline-none shadow-2xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-amber-950 mb-1 truncate">
                      Total Fare (₹)
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="e.g. 250"
                      value={estimatedFare}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '' || /^\d*\.?\d*$/.test(val)) {
                          setEstimatedFare(val);
                        }
                      }}
                      onWheel={(e) => e.currentTarget.blur()}
                      className="w-full h-11 border border-amber-400 rounded-xl px-3 text-xs sm:text-sm font-black text-amber-950 bg-amber-50/70 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 focus:outline-none shadow-2xs"
                    />
                  </div>
                </div>
              ) : (
                /* PACKAGE FARE INPUTS */
                <div className="space-y-3 pt-0.5">
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-purple-950 mb-1 truncate">
                        Hour Rate (₹/hr)
                      </label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={hourFare}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === '' || /^\d*\.?\d*$/.test(val)) {
                            setHourFare(val);
                            recalculatePackageFare(
                              val,
                              packageHours,
                              kmsFare,
                              packageKms,
                              includeKmInPackageTotal
                            );
                          }
                        }}
                        onWheel={(e) => e.currentTarget.blur()}
                        className="w-full h-11 border border-slate-200 rounded-xl px-3 text-xs sm:text-sm font-bold text-slate-900 bg-white focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 focus:outline-none shadow-2xs"
                        placeholder="e.g. 140"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-purple-950 mb-1 truncate">
                        Hours
                      </label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={packageHours}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === '' || /^\d*\.?\d*$/.test(val)) {
                            setPackageHours(val);
                            recalculatePackageFare(
                              hourFare,
                              val,
                              kmsFare,
                              packageKms,
                              includeKmInPackageTotal
                            );
                          }
                        }}
                        onWheel={(e) => e.currentTarget.blur()}
                        className="w-full h-11 border border-slate-200 rounded-xl px-3 text-xs sm:text-sm font-bold text-slate-900 bg-white focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 focus:outline-none shadow-2xs"
                        placeholder="e.g. 4"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-purple-950 mb-1 truncate">
                        KM Rate (₹/km)
                      </label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={kmsFare}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === '' || /^\d*\.?\d*$/.test(val)) {
                            setKmsFare(val);
                            recalculatePackageFare(
                              hourFare,
                              packageHours,
                              val,
                              packageKms,
                              includeKmInPackageTotal
                            );
                          }
                        }}
                        onWheel={(e) => e.currentTarget.blur()}
                        className="w-full h-11 border border-slate-200 rounded-xl px-3 text-xs sm:text-sm font-bold text-slate-900 bg-white focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 focus:outline-none shadow-2xs"
                        placeholder="e.g. 15"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-purple-950 mb-1 truncate">
                        Package KMs
                      </label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={packageKms}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === '' || /^\d*\.?\d*$/.test(val)) {
                            setPackageKms(val);
                            recalculatePackageFare(
                              hourFare,
                              packageHours,
                              kmsFare,
                              val,
                              includeKmInPackageTotal
                            );
                          }
                        }}
                        onWheel={(e) => e.currentTarget.blur()}
                        className="w-full h-11 border border-slate-200 rounded-xl px-3 text-xs sm:text-sm font-bold text-slate-900 bg-white focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 focus:outline-none shadow-2xs"
                        placeholder="e.g. 40"
                      />
                    </div>

                    <div className="col-span-2 sm:col-span-1">
                      <label className="block text-xs font-bold text-purple-950 mb-1 truncate">
                        Total Fare (₹)
                      </label>
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="e.g. 500"
                        value={estimatedFare}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === '' || /^\d*\.?\d*$/.test(val)) {
                            setEstimatedFare(val);
                          }
                        }}
                        onWheel={(e) => e.currentTarget.blur()}
                        className="w-full h-11 border border-purple-400 rounded-xl px-3 text-xs sm:text-sm font-black text-purple-950 bg-purple-50/70 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 focus:outline-none shadow-2xs"
                      />
                    </div>
                  </div>

                  {/* Calculation Mode */}
                  <div className="bg-purple-50/50 border border-purple-100 rounded-xl p-3 flex items-center justify-between flex-wrap gap-2 text-xs">
                    <label className="flex items-center gap-2 text-purple-950 font-semibold cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={includeKmInPackageTotal}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setIncludeKmInPackageTotal(checked);
                          recalculatePackageFare(
                            hourFare,
                            packageHours,
                            kmsFare,
                            packageKms,
                            checked
                          );
                        }}
                        className="rounded text-purple-600 focus:ring-purple-500"
                      />
                      <span>Include KMs in total fare (Hours × Rate + KMs × Rate)</span>
                    </label>

                    <span className="font-mono font-bold text-purple-800">
                      Calculated: ₹{
                        includeKmInPackageTotal
                          ? (Number(hourFare) || 0) * (Number(packageHours) || 0) +
                            (Number(kmsFare) || 0) * (Number(packageKms) || 0)
                          : (Number(hourFare) || 0) * (Number(packageHours) || 0)
                      }
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* STEP 4 (Mobile): Dispatch Mode & Driver Allocation */}
          <div className={`space-y-3.5 sm:space-y-4 ${mobileStep === 4 ? 'block' : 'hidden lg:block'}`}>

            {/* SECTION 5: Dispatch Mode & Driver Allocation */}
            <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3">
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <Sliders className="w-4 h-4 text-sky-600" />
                  Dispatch Mode & Driver Allocation
                </h3>
              </div>

              <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                <button
                  type="button"
                  onClick={() => setDispatchType('RADIUS')}
                  className={`p-2.5 sm:p-3 rounded-xl border flex items-center gap-2 sm:gap-2.5 transition cursor-pointer text-left min-h-[58px] ${
                    dispatchType === 'RADIUS'
                      ? 'bg-sky-600 text-white border-sky-700 font-bold shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 font-medium'
                  }`}
                >
                  <Radio className={`w-4 h-4 shrink-0 ${dispatchType === 'RADIUS' ? 'text-white' : 'text-sky-600'}`} />
                  <div className="min-w-0">
                    <div className="text-xs font-bold leading-tight truncate">RADIUS GEOFENCE</div>
                    <div className={`text-[10px] truncate ${dispatchType === 'RADIUS' ? 'text-sky-100' : 'text-slate-500'}`}>
                      Nearby within {radiusKms || 5} km
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setDispatchType('BROADCAST')}
                  className={`p-2.5 sm:p-3 rounded-xl border flex items-center gap-2 sm:gap-2.5 transition cursor-pointer text-left min-h-[58px] ${
                    dispatchType === 'BROADCAST'
                      ? 'bg-amber-500 text-slate-950 border-amber-600 font-bold shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 font-medium'
                  }`}
                >
                  <Zap className={`w-4 h-4 shrink-0 ${dispatchType === 'BROADCAST' ? 'fill-slate-950 text-slate-950' : 'text-amber-500'}`} />
                  <div className="min-w-0">
                    <div className="text-xs font-bold leading-tight truncate">BROADCAST</div>
                    <div className={`text-[10px] truncate ${dispatchType === 'BROADCAST' ? 'text-slate-900' : 'text-slate-500'}`}>
                      All online fleet
                    </div>
                  </div>
                </button>
              </div>

              {dispatchType === 'RADIUS' && (
                <div className="bg-sky-50/50 p-3 rounded-xl border border-sky-100 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700">Dispatch Search Radius:</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={radiusKms}
                        onChange={(e) => setRadiusKms(e.target.value)}
                        className="w-14 text-center font-bold font-mono text-slate-900 border border-slate-300 rounded-lg px-1.5 py-0.5 bg-white text-xs"
                      />
                      <span className="font-bold text-sky-800">km</span>
                    </div>
                  </div>

                  <input
                    type="range"
                    min="1"
                    max="50"
                    step="1"
                    value={radiusKms}
                    onChange={(e) => setRadiusKms(e.target.value)}
                    className="w-full accent-sky-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                  />

                  {/* Quick Radius Presets - 3 columns on mobile, flexible row on sm+ */}
                  <div className="grid grid-cols-3 sm:flex sm:flex-wrap gap-1.5 pt-1">
                    {[3, 5, 8, 10, 15, 25].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setRadiusKms(String(preset))}
                        className={`py-1.5 px-2 rounded-lg text-[11px] font-bold transition cursor-pointer text-center ${
                          Number(radiusKms) === preset
                            ? 'bg-sky-600 text-white shadow-xs'
                            : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {preset} km{preset === 5 ? ' ★' : ''}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <DriverSearchSelect
                drivers={drivers}
                selectedDriverId={assignedDriverId}
                onSelect={setAssignedDriverId}
                dispatchType={dispatchType}
                onDispatchTypeChange={setDispatchType}
                radiusKms={radiusKms}
                onRadiusChange={setRadiusKms}
                pickupLat={pickupLat ? Number(pickupLat) : undefined}
                pickupLng={pickupLng ? Number(pickupLng) : undefined}
                pickupLocation={pickupLocation}
                trips={trips}
                label="Direct Driver Assignment"
              />
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: Sticky Trip Summary & Publish Settings (Step 4 on mobile, always on desktop) */}
        <div className={`space-y-4 lg:col-span-4 ${mobileStep === 4 ? 'block' : 'hidden lg:block'}`}>
            
            {/* Form Summary Card */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-4 lg:sticky lg:top-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Trip Summary</h3>
                <p className="text-xs text-slate-500">Review dispatch specifications</p>
              </div>

              <div className="divide-y divide-slate-100 text-xs space-y-2.5 pt-1">
                <div className="flex items-center justify-between pt-1">
                  <span className="text-slate-500 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-slate-400" /> Passenger
                  </span>
                  <span className="font-semibold text-slate-900 truncate max-w-[140px]">
                    {customerName || 'Passenger'}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <span className="text-slate-500 flex items-center gap-1.5">
                    <Car className="w-3.5 h-3.5 text-slate-400" /> Vehicle
                  </span>
                  <span className="font-semibold text-slate-900 truncate max-w-[150px]">
                    {vehicleCategory === 'CUSTOM'
                      ? customVehicleName.trim() || 'Custom Vehicle'
                      : vehicleCategory}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <span className="text-slate-500 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-400" /> Type
                  </span>
                  <span className="font-semibold text-slate-900">
                    {tripType === 'REGULAR'
                      ? 'Regular'
                      : packageHours && packageKms
                      ? `Package (${packageHours}h / ${packageKms}km)`
                      : packageHours
                      ? `Package (${packageHours}h)`
                      : packageKms
                      ? `Package (${packageKms}km)`
                      : 'Package'}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <span className="text-slate-500 flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-slate-400" /> Mode
                  </span>
                  <span className="font-semibold text-slate-900">
                    {dispatchType === 'BROADCAST' ? 'Broadcast' : `Radius (${radiusKms}km)`}
                  </span>
                </div>

                {/* Direct Driver Profile Card in Summary */}
                {selectedDriver ? (
                  <div className="pt-2 pb-1">
                    <div className="p-3 bg-gradient-to-br from-amber-50/80 to-white rounded-xl border border-amber-300 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-amber-900 uppercase tracking-wider flex items-center gap-1">
                          <ShieldCheck className="w-3 h-3 text-emerald-600" />
                          Assigned Driver
                        </span>
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                            selectedDriver.is_online
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {selectedDriver.is_online ? 'Online' : 'Offline'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2.5">
                        <DriverAvatar
                          photoUrl={selectedDriver.photo_url || selectedDriver.profile_photo_url}
                          name={selectedDriver.driver_name}
                          size="sm"
                          isOnline={selectedDriver.is_online}
                          showStatusBadge={true}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 truncate font-bold text-xs text-slate-900">
                            <span className="truncate">{selectedDriver.driver_name}</span>
                            <span className="bg-slate-800 text-amber-400 text-[10px] font-mono px-1 py-0.2 rounded shrink-0">
                              {selectedDriver.driver_id}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-600 font-mono flex items-center gap-1.5 mt-0.5">
                            <span className="font-bold text-slate-700">{selectedDriver.vehicle_number}</span>
                            <span>•</span>
                            <span>{selectedDriver.vehicle_category}</span>
                          </div>
                        </div>
                      </div>

                      {/* Direct Driver Call & WhatsApp Quick Buttons */}
                      <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                        <a
                          href={`tel:${
                            selectedDriver.mobile_number.replace(/\D/g, '')
                              ? `+91${selectedDriver.mobile_number.replace(/\D/g, '').slice(-10)}`
                              : selectedDriver.mobile_number
                          }`}
                          className="py-1.5 px-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-[11px] flex items-center justify-center gap-1 transition cursor-pointer shadow-2xs select-none"
                        >
                          <PhoneCall className="w-3 h-3" />
                          <span>Call Driver</span>
                        </a>
                        <a
                          href={`https://wa.me/${
                            selectedDriver.mobile_number.replace(/\D/g, '').length === 10
                              ? `91${selectedDriver.mobile_number.replace(/\D/g, '')}`
                              : selectedDriver.mobile_number.replace(/\D/g, '')
                          }?text=${encodeURIComponent(
                            `Hello ${selectedDriver.driver_name}, you are assigned to a new ride: Pickup: ${pickupLocation || 'Pickup Point'} | Drop: ${dropLocation || 'Destination'}. Fare: ₹${estimatedFare || '0'}.`
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="py-1.5 px-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold text-[11px] flex items-center justify-center gap-1 transition cursor-pointer select-none"
                        >
                          <MessageSquare className="w-3 h-3 text-emerald-600" />
                          <span>WhatsApp</span>
                        </a>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between pt-2">
                    <span className="text-slate-500 flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-slate-400" /> Driver
                    </span>
                    <span className="font-semibold text-slate-900 truncate max-w-[140px]">
                      Auto Broadcast
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between pt-2 pb-1">
                  <span className="text-slate-500 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-slate-400" /> Status
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Open Ready
                  </span>
                </div>
              </div>

              {/* Total Estimated Fare Box */}
              <div className="p-3.5 bg-amber-50/80 rounded-xl border border-amber-200 text-center">
                <div className="text-[11px] font-bold text-amber-800 uppercase tracking-wide">
                  Estimated Trip Fare
                </div>
                <div className="text-2xl font-black text-slate-950 mt-0.5">
                  ₹{estimatedFare || '0'}
                </div>
              </div>

              {/* Publish & Notification Settings */}
              <div className="pt-2 border-t border-slate-100 space-y-2.5">
                <div className="text-xs font-bold text-slate-800">Dispatch Settings</div>
                
                <label className="flex items-start gap-2 text-xs text-slate-600 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={sendSmsNotification}
                    onChange={(e) => setSendSmsNotification(e.target.checked)}
                    className="mt-0.5 rounded text-amber-600 focus:ring-amber-500"
                  />
                  <span>Send WhatsApp / SMS broadcast ping to active drivers</span>
                </label>
              </div>

              {/* Action Buttons (Visible only on desktop screens lg+, mobile uses step navigation bottom bar) */}
              <div className="pt-3 space-y-2 hidden lg:block">
                <button
                  type="submit"
                  form="new-trip-form"
                  disabled={isSubmitting}
                  className="w-full py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-950 font-bold text-xs shadow-md hover:shadow-lg transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                  <span>
                    {isSubmitting
                      ? 'Creating Trip...'
                      : `Dispatch Booking (₹${estimatedFare || '0'})`}
                  </span>
                </button>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleClearDraft}
                    className="w-full py-2.5 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 font-semibold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
                    <span>Reset</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleClose}
                    className="w-full py-2.5 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-semibold text-xs transition cursor-pointer text-center"
                  >
                    Cancel / Back
                  </button>
                </div>
              </div>

            </div>

          </div>
        </form>

        {/* Sticky Mobile Step-by-Step Bottom Bar (Visible only on mobile screens < lg) */}
        <div className="lg:hidden sticky bottom-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-3 py-2.5 flex items-center justify-between gap-1.5 sm:gap-2 shadow-lg">
          {mobileStep === 1 && (
            <>
              <button
                type="button"
                onClick={handleClose}
                className="px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-rose-600 hover:text-rose-700 font-bold text-xs transition cursor-pointer min-h-[44px] shrink-0"
              >
                Cancel
              </button>
              <div className="min-w-0 text-center px-1 flex-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Step 1 of 4
                </span>
                <span className="text-xs font-bold text-slate-800 truncate block">
                  {customerPhone ? customerPhone : 'Passenger Info'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setMobileStep(2)}
                className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-950 font-extrabold text-xs shadow-md transition flex items-center gap-1.5 cursor-pointer min-h-[44px] shrink-0"
              >
                <span>Next: Route</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </>
          )}

          {mobileStep === 2 && (
            <>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-2.5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-rose-600 hover:text-rose-700 font-bold text-xs transition cursor-pointer min-h-[44px]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => setMobileStep(1)}
                  className="px-2.5 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs transition cursor-pointer flex items-center gap-1 min-h-[44px]"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back</span>
                </button>
              </div>
              <div className="min-w-0 text-center px-1 flex-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Step 2 of 4
                </span>
                <span className="text-xs font-bold text-emerald-700 truncate block">
                  {distanceKm ? `${distanceKm} km` : 'Route'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setMobileStep(3)}
                className="px-3.5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-950 font-extrabold text-xs shadow-md transition flex items-center gap-1.5 cursor-pointer min-h-[44px] shrink-0"
              >
                <span>Next: Fare</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </>
          )}

          {mobileStep === 3 && (
            <>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-2.5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-rose-600 hover:text-rose-700 font-bold text-xs transition cursor-pointer min-h-[44px]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => setMobileStep(2)}
                  className="px-2.5 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs transition cursor-pointer flex items-center gap-1 min-h-[44px]"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back</span>
                </button>
              </div>
              <div className="min-w-0 text-center px-1 flex-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Estimated Fare
                </span>
                <span className="text-base font-black text-slate-950 truncate block">
                  ₹{estimatedFare || '0'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setMobileStep(4)}
                className="px-3.5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-950 font-extrabold text-xs shadow-md transition flex items-center gap-1.5 cursor-pointer min-h-[44px] shrink-0"
              >
                <span>Next: Driver</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </>
          )}

          {mobileStep === 4 && (
            <>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-2.5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-rose-600 hover:text-rose-700 font-bold text-xs transition cursor-pointer min-h-[44px]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => setMobileStep(3)}
                  className="px-2.5 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs transition cursor-pointer flex items-center gap-1 min-h-[44px]"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back</span>
                </button>
              </div>
              <div className="min-w-0 flex-1 px-1">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider truncate">
                  {selectedDriver ? selectedDriver.driver_name.split(' ')[0] : dispatchType === 'RADIUS' ? `Radius (${radiusKms}km)` : 'Broadcast'}
                </div>
                <div className="text-base font-black text-slate-900 leading-tight">
                  ₹{estimatedFare || '0'}
                </div>
              </div>
              <button
                type="submit"
                form="new-trip-form"
                disabled={isSubmitting}
                className="px-3.5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-950 font-black text-xs shadow-md transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer min-h-[44px] shrink-0"
              >
                <Send className="w-4 h-4" />
                <span>{isSubmitting ? 'Dispatching...' : 'Dispatch'}</span>
              </button>
            </>
          )}
        </div>

      </div>
    </div>
  );
};

