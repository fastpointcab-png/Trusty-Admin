import React, { useMemo } from 'react';
import { FirestoreDriver, FirestoreTrip } from '../types';
import {
  CheckCircle2,
  Radio,
  Gauge,
  Award,
  IndianRupee,
  Layers,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LabelList,
} from 'recharts';

interface FleetAnalyticsProps {
  drivers: FirestoreDriver[];
  trips: FirestoreTrip[];
  onOpenAssignModal?: (trip: FirestoreTrip) => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  Sedan: '#f59e0b',
  Mini: '#3b82f6',
  SUV: '#8b5cf6',
  'SUV+': '#ec4899',
  Innova: '#10b981',
  Auto: '#f97316',
};

export const FleetAnalytics: React.FC<FleetAnalyticsProps> = ({ drivers, trips }) => {
  // Pre-index active trip driver IDs in O(Trips) to avoid O(Drivers * Trips) loops with 5000+ drivers
  const { activeDriverIdSet, driverTripStatsMap } = useMemo(() => {
    const activeSet = new Set<string>();
    const statsMap = new Map<string, { count: number; earnings: number }>();

    for (let i = 0; i < trips.length; i++) {
      const t = trips[i];
      if (!t.driver_id) continue;

      if (t.status === 'ACCEPTED' || t.status === 'IN_PROGRESS') {
        activeSet.add(t.driver_id);
      } else if (t.status === 'COMPLETED') {
        const fare = t.final_fare || t.estimated_fare || 0;
        const current = statsMap.get(t.driver_id);
        if (current) {
          current.count += 1;
          current.earnings += fare;
        } else {
          statsMap.set(t.driver_id, { count: 1, earnings: fare });
        }
      }
    }

    return { activeDriverIdSet: activeSet, driverTripStatsMap: statsMap };
  }, [trips]);

  // Real database calculations directly from Firestore props in single-pass
  const totalDrivers = drivers.length;
  const onlineDrivers = useMemo(
    () => drivers.filter((d) => d.is_online && d.status === 'ACTIVE'),
    [drivers]
  );
  const activeInTripDrivers = useMemo(
    () =>
      drivers.filter(
        (d) =>
          d.is_online &&
          (Boolean(d.current_trip_id) || activeDriverIdSet.has(d.driver_id))
      ),
    [drivers, activeDriverIdSet]
  );
  const freeDrivers = useMemo(() => {
    const busySet = new Set(activeInTripDrivers.map((d) => d.driver_id));
    return onlineDrivers.filter((d) => !busySet.has(d.driver_id));
  }, [onlineDrivers, activeInTripDrivers]);

  const completedTrips = trips.filter((t) => t.status === 'COMPLETED');
  const inProgressTrips = trips.filter((t) => t.status === 'IN_PROGRESS');
  const acceptedTrips = trips.filter((t) => t.status === 'ACCEPTED');
  const openTrips = trips.filter((t) => t.status === 'OPEN');
  const cancelledTrips = trips.filter((t) => t.status === 'CANCELLED');

  const totalRevenue = completedTrips.reduce(
    (sum, t) => sum + (t.final_fare || t.estimated_fare || 0),
    0
  );

  const totalDistanceKm = completedTrips.reduce(
    (sum, t) => sum + (t.distance_km || 0),
    0
  );

  const averageFare =
    completedTrips.length > 0 ? Math.round(totalRevenue / completedTrips.length) : 0;

  const completionRate =
    completedTrips.length + cancelledTrips.length > 0
      ? Math.round(
          (completedTrips.length / (completedTrips.length + cancelledTrips.length)) * 100
        )
      : 100;

  // Real vehicle category breakdown from drivers
  const categoryDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    drivers.forEach((d) => {
      const cat = d.vehicle_category || 'Mini';
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({
      name,
      value,
      color: CATEGORY_COLORS[name] || '#64748b',
    }));
  }, [drivers]);

  // Real Trip Status Operational Volume (Direct from actual Firestore trips)
  const tripStatusData = useMemo(() => {
    return [
      { status: 'Open Queue', count: openTrips.length, fill: '#f59e0b', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', dot: 'bg-amber-500' },
      { status: 'Accepted', count: acceptedTrips.length, fill: '#0284c7', color: 'text-sky-700', bg: 'bg-sky-50', border: 'border-sky-200', dot: 'bg-sky-500' },
      { status: 'On Ride', count: inProgressTrips.length, fill: '#9333ea', color: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-200', dot: 'bg-purple-500' },
      { status: 'Completed', count: completedTrips.length, fill: '#10b981', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', dot: 'bg-emerald-500' },
      { status: 'Cancelled', count: cancelledTrips.length, fill: '#f43f5e', color: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-200', dot: 'bg-rose-500' },
    ];
  }, [openTrips.length, acceptedTrips.length, inProgressTrips.length, completedTrips.length, cancelledTrips.length]);

  // Real Category Revenue Breakdown (Direct from completed & active trips)
  const categoryRevenueData = useMemo(() => {
    const map: Record<string, { trips: number; revenue: number }> = {
      Sedan: { trips: 0, revenue: 0 },
      Mini: { trips: 0, revenue: 0 },
      Innova: { trips: 0, revenue: 0 },
      SUV: { trips: 0, revenue: 0 },
      Auto: { trips: 0, revenue: 0 },
    };

    trips.forEach((t) => {
      const cat = t.vehicle_category || 'Mini';
      if (!map[cat]) map[cat] = { trips: 0, revenue: 0 };
      map[cat].trips += 1;
      if (t.status === 'COMPLETED') {
        map[cat].revenue += t.final_fare || t.estimated_fare || 0;
      }
    });

    return Object.entries(map)
      .filter(([_, d]) => d.trips > 0 || d.revenue > 0)
      .map(([name, d]) => ({
        category: name,
        trips: d.trips,
        revenue: d.revenue,
        color: CATEGORY_COLORS[name] || '#64748b',
      }));
  }, [trips]);

  // Driver leaderboard based on pre-indexed stats (instant O(Drivers) instead of O(Drivers * Trips))
  const driverLeaderboard = useMemo(() => {
    return drivers
      .map((driver) => {
        const stats = driverTripStatsMap.get(driver.driver_id);
        return {
          ...driver,
          completedCount: stats?.count || (driver.total_trips || 0),
          totalEarnings: stats?.earnings || 0,
        };
      })
      .sort((a, b) => b.completedCount - a.completedCount);
  }, [drivers, driverTripStatsMap]);

  return (
    <div className="space-y-6 pb-6 animate-in fade-in duration-300">
      {/* 4 Clean KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4 w-full min-w-0">
        {/* Total Revenue */}
        <div className="min-w-0 bg-white p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between gap-1.5 sm:gap-2">
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider truncate">
              Total Revenue
            </p>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200 shrink-0">
              <IndianRupee className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div className="mt-2 sm:mt-3 flex items-baseline gap-1.5 sm:gap-2 flex-wrap min-w-0">
            <span className="text-xl sm:text-2xl lg:text-3xl font-bold text-slate-900 tracking-tight tabular-nums truncate">
              ₹{totalRevenue.toLocaleString()}
            </span>
            <span className="text-[10px] sm:text-xs text-slate-400 font-medium truncate">
              from {completedTrips.length} rides
            </span>
          </div>
        </div>

        {/* Online Fleet */}
        <div className="min-w-0 bg-white p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between gap-1.5 sm:gap-2">
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider truncate">
              Online Fleet
            </p>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200 shrink-0">
              <Radio className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-pulse" />
            </div>
          </div>
          <div className="mt-2 sm:mt-3 flex items-baseline gap-1.5 sm:gap-2 flex-wrap min-w-0">
            <span className="text-xl sm:text-2xl lg:text-3xl font-bold text-emerald-600 tracking-tight tabular-nums truncate">
              {onlineDrivers.length}
            </span>
            <span className="text-[10px] sm:text-xs text-slate-400 font-medium truncate">
              {freeDrivers.length} available
            </span>
          </div>
        </div>

        {/* Completed Rides */}
        <div className="min-w-0 bg-white p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between gap-1.5 sm:gap-2">
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider truncate">
              Completed Rides
            </p>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center border border-purple-200 shrink-0">
              <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div className="mt-2 sm:mt-3 flex items-baseline gap-1.5 sm:gap-2 flex-wrap min-w-0">
            <span className="text-xl sm:text-2xl lg:text-3xl font-bold text-purple-700 tracking-tight tabular-nums truncate">
              {completedTrips.length}
            </span>
            <span className="text-[10px] sm:text-xs text-slate-400 font-medium truncate">
              {completionRate}% success
            </span>
          </div>
        </div>

        {/* Total Distance */}
        <div className="min-w-0 bg-white p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between gap-1.5 sm:gap-2">
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider truncate">
              Total Distance
            </p>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center border border-sky-200 shrink-0">
              <Gauge className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div className="mt-2 sm:mt-3 flex items-baseline gap-1.5 sm:gap-2 flex-wrap min-w-0">
            <span className="text-xl sm:text-2xl lg:text-3xl font-bold text-sky-600 tracking-tight tabular-nums truncate">
              {totalDistanceKm} km
            </span>
            <span className="text-[10px] sm:text-xs text-slate-400 font-medium truncate">
              avg ₹{averageFare}/ride
            </span>
          </div>
        </div>
      </div>

      {/* Useful Real Data Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: Trip Status Operations Breakdown */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">
                Rides Operational Status
              </h3>
              <p className="text-xs text-slate-500"></p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700 bg-slate-100 px-3 py-1 rounded-xl">
                {trips.length} Total Bookings
              </span>
            </div>
          </div>

          {/* Operational Status Legend & Metric Badges */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-3.5">
            {tripStatusData.map((s) => (
              <div
                key={s.status}
                className={`${s.bg} ${s.border} border rounded-xl p-2.5 flex flex-col justify-between shadow-2xs`}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className={`w-2 h-2 rounded-full ${s.dot} shrink-0`} />
                  <span className={`text-[11px] font-bold ${s.color} truncate`}>{s.status}</span>
                </div>
                <div className="mt-1.5 flex items-baseline justify-between">
                  <span className={`text-base sm:text-lg font-black ${s.color} tabular-nums`}>
                    {s.count}
                  </span>
                  <span className="text-[10px] text-slate-400 font-semibold">
                    {trips.length > 0 ? Math.round((s.count / trips.length) * 100) : 0}%
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="h-56 mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={tripStatusData} margin={{ top: 22, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="status"
                  tick={{ fontSize: 11, fill: '#475569', fontWeight: 600 }}
                  axisLine={{ stroke: '#e2e8f0' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderRadius: '12px',
                    color: '#fff',
                    fontSize: '12px',
                    border: 'none',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
                  }}
                  formatter={(value: number) => [`${value} rides`, 'Total']}
                />
                <Bar
                  dataKey="count"
                  fill="#f59e0b"
                  minPointSize={8}
                  radius={[6, 6, 0, 0]}
                >
                  <LabelList
                    dataKey="count"
                    position="top"
                    style={{ fill: '#1e293b', fontSize: '12px', fontWeight: 800 }}
                  />
                  {tripStatusData.map((entry, index) => (
                    <Cell key={`status-cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right: Vehicle Fleet Category Breakdown */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <Layers className="w-4 h-4 text-sky-500" />
                <span>Vehicle Fleet Mix</span>
              </h3>
              <span className="text-xs text-slate-500 font-medium">{totalDrivers} registered</span>
            </div>

            <div className="h-44 mt-3">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryDistribution}
                    innerRadius={45}
                    outerRadius={68}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {categoryDistribution.map((entry, index) => (
                      <Cell key={`pie-cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderRadius: '12px',
                      color: '#fff',
                      fontSize: '11px',
                      border: 'none',
                    }}
                    formatter={(value: number) => [`${value} cabs`, 'Count']}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="space-y-2 pt-3 border-t border-slate-100">
            {categoryDistribution.map((item) => (
              <div key={item.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="font-semibold text-slate-700">{item.name}</span>
                </div>
                <span className="font-bold text-slate-900">{item.value} cabs</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Revenue by Vehicle Category (Real Firestore Data) */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900">
              Revenue by Vehicle Category
            </h3>
            <p className="text-xs text-slate-500"></p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mt-4">
          {categoryRevenueData.map((item) => (
            <div
              key={item.category}
              className="bg-slate-50/90 rounded-xl p-3.5 border border-slate-200/90 flex flex-col justify-between"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800 text-xs">{item.category}</span>
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
              </div>
              <div className="mt-3">
                <div className="text-lg font-black text-slate-900 tabular-nums">
                  ₹{item.revenue.toLocaleString()}
                </div>
                <div className="text-[10px] text-slate-500 font-medium mt-0.5">
                  {item.trips} total ride{item.trips !== 1 ? 's' : ''}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Driver Performance Leaderboard (Real Firestore Data) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Award className="w-4 h-4 text-amber-500" />
            <h3 className="text-sm font-extrabold text-slate-900">Driver Performance Leaderboard</h3>
          </div>
          <span className="text-xs text-slate-500 font-medium">Real-time driver trip count</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-slate-700 uppercase font-bold text-[10px] tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Driver</th>
                <th className="py-3 px-4">Vehicle & Category</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-center">Completed Trips</th>
                <th className="py-3 px-4 text-right">Total Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {driverLeaderboard.map((drv) => (
                <tr key={drv.driver_id} className="hover:bg-slate-50 transition">
                  <td className="py-3 px-4">
                    <div>
                      <div className="font-bold text-slate-900">{drv.driver_name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{drv.mobile_number}</div>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-semibold text-slate-800">{drv.vehicle_category}</div>
                    <div className="text-[10px] text-slate-400 font-mono">{drv.vehicle_number}</div>
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        drv.is_online
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${drv.is_online ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                      {drv.is_online ? 'Online' : 'Offline'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center font-bold text-slate-900">
                    {drv.completedCount}
                  </td>
                  <td className="py-3 px-4 text-right font-black text-slate-900">
                    ₹{drv.totalEarnings.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
