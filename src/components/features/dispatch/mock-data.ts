import type { DispatchItem, DispatchAlert, ActiveTrip, TripStep } from "./types";

export const MOCK_DISPATCHES: DispatchItem[] = [
  {
    id: "001",
    number: "#001",
    customerName: "Jane Doe",
    serviceName: "Home Massage",
    area: "Bacolod City",
    driverName: "Mark Reyes",
    therapistName: "Ana Lopez",
    status: "in_route",
    etaMinutes: 16,
    paymentStatus: "paid",
  },
  {
    id: "002",
    number: "#002",
    customerName: "Michael Tan",
    serviceName: "Physio Therapy",
    area: "Bacolod City",
    driverName: "Carlo Diaz",
    therapistName: "Maria Santos",
    status: "ready",
    etaMinutes: 10,
    paymentStatus: "paid",
  },
  {
    id: "003",
    number: "#003",
    customerName: "Grace Lim",
    serviceName: "Body Scrub",
    area: "Bacolod City",
    driverName: "David Go",
    therapistName: "Lea Cruz",
    status: "en_route_to_therapist",
    etaMinutes: 21,
    paymentStatus: "paid",
  },
  {
    id: "004",
    number: "#004",
    customerName: "James Uy",
    serviceName: "Home Massage",
    area: "Bacolod City",
    driverName: "Ana Lopez",
    status: "awaiting_driver",
    paymentStatus: "pending",
  },
  {
    id: "005",
    number: "#005",
    customerName: "Rosa Guevarra",
    serviceName: "Foot Spa",
    area: "Bacolod City",
    driverName: "Mark Reyes",
    therapistName: "Ana Lopez",
    status: "arrived_at_customer",
    etaMinutes: 5,
    paymentStatus: "paid",
  },
];

export const MOCK_COMPLETED: DispatchItem[] = [
  { id: "c001", number: "#001", customerName: "Jane Doe", serviceName: "Home Massage", area: "Bacolod City", driverName: "Mark Reyes", therapistName: "Ana Lopez", status: "completed", completedAt: "9:05 AM", rating: 5, paymentStatus: "paid" },
  { id: "c002", number: "#002", customerName: "Michael Tan", serviceName: "Physio Therapy", area: "Bacolod City", driverName: "Carlo Diaz", therapistName: "Maria Santos", status: "completed", completedAt: "9:10 AM", rating: 5, paymentStatus: "paid" },
  { id: "c003", number: "#003", customerName: "Grace Lim", serviceName: "Body Scrub", area: "Bacolod City", driverName: "David Go", therapistName: "Lea Cruz", status: "completed", completedAt: "9:15 AM", rating: 4, paymentStatus: "paid" },
  { id: "c004", number: "#004", customerName: "James Uy", serviceName: "Home Massage", area: "Bacolod City", driverName: "Ana Lopez", status: "completed", completedAt: "9:20 AM", rating: 5, paymentStatus: "paid" },
  { id: "c005", number: "#005", customerName: "Rosa Guevarra", serviceName: "Foot Spa", area: "Bacolod City", driverName: "Mark Reyes", therapistName: "Ana Lopez", status: "completed", completedAt: "9:25 AM", rating: 5, paymentStatus: "paid" },
];

export const MOCK_ALERTS: DispatchAlert[] = [
  { id: "a1", title: "Traffic Delay", description: "Heavy traffic on Main Avenue causing 15–20 min delay for #001.", timeAgo: "2 min ago", severity: "danger", dispatchNumber: "#001", bookingId: "mock-001" },
  { id: "a2", title: "Driver Running Late", description: "Driver Mark Reyes is running late for #004.", timeAgo: "5 min ago", severity: "warning", dispatchNumber: "#004", bookingId: "mock-004" },
  { id: "a3", title: "Therapist Not Ready", description: "Therapist Lea Cruz not ready for #003.", timeAgo: "10 min ago", severity: "warning", dispatchNumber: "#003", bookingId: "mock-003" },
  { id: "a4", title: "Location Issue", description: "Customer location not confirmed for #005.", timeAgo: "15 min ago", severity: "info", dispatchNumber: "#005", bookingId: "mock-005" },
  { id: "a5", title: "Detour Added", description: "Detour added for #002 due to road construction.", timeAgo: "18 min ago", severity: "info", dispatchNumber: "#002", bookingId: "mock-002" },
];

export const MOCK_ACTIVE_TRIPS: ActiveTrip[] = [
  { number: "#001", customerName: "Jane Doe", status: "In Route", etaMinutes: 16 },
  { number: "#002", customerName: "Michael Tan", status: "En Route to Therapist", etaMinutes: 10 },
  { number: "#003", customerName: "Grace Lim", status: "Arrived at Customer", etaMinutes: 5 },
];

export const MOCK_TRIP_STEPS: TripStep[] = [
  { label: "Accepted", time: "8:00 AM", state: "done" },
  { label: "En Route", time: "8:05 AM", state: "done" },
  { label: "Arrived", time: "8:18 AM", state: "done" },
  { label: "In Service", time: "8:25 AM", state: "active" },
  { label: "Complete", time: "9:05 AM", state: "pending" },
];
