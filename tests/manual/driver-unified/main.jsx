import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { DriverMobileShell } from "@/components/features/staff-portal/driver/driver-mobile-shell";
import { DriverNativeHome } from "@/components/features/staff-pwa/driver/driver-native-home";
import { DriverMoreContent } from "@/components/features/staff-pwa/driver/driver-more-content";
import { DriverJourneyTasks } from "@/components/features/staff-pwa/driver/driver-journey-tasks";
import { StaffQrScanner } from "@/components/features/scanner/staff-qr-scanner";
import "@/app/globals.css";
import "./review.css";
const staff = {
  id: "11111111-1111-4111-8111-111111111111",
  full_name: "Test Driver",
  nickname: "Alex",
  system_role: "driver",
  staff_type: "driver",
  branch_id: "test-branch",
};
const base = {
  bookingId: "22222222-2222-4222-8222-222222222222",
  revision: 5,
  stage: "pickup_pending",
  leg: "pickup",
  destination: { lat: 10.676, lng: 122.956, label: "Test branch · Bacolod" },
  observedAt: new Date().toISOString(),
  therapistName: "Test Provider",
  customerName: "Test Customer",
  branchName: "Test branch",
  bookingDate: "2026-11-17",
  startTime: "16:00:00",
  pickupLabel: "Test branch",
  customerAddress: "Example residence · Bacolod",
};
function App() {
  const [url, setUrl] = useState(location.href);
  useEffect(() => {
    const fn = () => setUrl(location.href);
    window.addEventListener("popstate", fn);
    const click = (e) => {
      const a = e.target.closest("a");
      if (!a || !a.href.startsWith(location.origin)) return;
      e.preventDefault();
      history.pushState({}, "", a.href);
      window.dispatchEvent(new PopStateEvent("popstate"));
    };
    document.addEventListener("click", click);
    return () => {
      window.removeEventListener("popstate", fn);
      document.removeEventListener("click", click);
    };
  }, []);
  const u = new URL(url),
    path = u.pathname,
    scenario = u.searchParams.get("scenario"),
    journeys =
      scenario === "empty" || scenario === "error"
        ? []
        : [
            scenario === "collection"
              ? {
                  ...base,
                  stage: "collection_pending",
                  leg: "collection",
                  destination: { ...base.destination, label: "Example residence · Bacolod" },
                }
              : scenario === "board"
                ? { ...base, stage: "pickup_arrived" }
                : base,
          ];
  return (
    <>
      <div className="preview-notice">
        LOCAL TEST · SYNTHETIC DATA · BACKEND / MAP / PUSH DISCONNECTED
      </div>
      <DriverMobileShell staff={staff} mode="canonical">
        {path.includes("/more") ? (
          <DriverMoreContent staff={staff} logoutAction={async () => {}} />
        ) : path.includes("/scan") ? (
          <StaffQrScanner returnHref="/staff/driver" locationRequired={false} />
        ) : path.includes("/map") ? (
          <main className="mx-auto max-w-md p-5">
            <h1 className="text-xl font-bold">Your journey</h1>
            <p className="mt-2 text-sm">
              Native Google guidance requires the Android host. This browser preview does not render
              navigation.
            </p>
            <DriverJourneyTasks journeys={journeys} navigationPane />
          </main>
        ) : (
          <DriverNativeHome
            staff={staff}
            items={[]}
            businessDate="2026-11-17"
            attendanceData={null}
            journeys={journeys}
            journeyError={
              scenario === "error" ? "Assignments unavailable. Reconnect to verify." : undefined
            }
            verifiedAt={new Date().toISOString()}
          />
        )}
      </DriverMobileShell>
    </>
  );
}
window.fetch = async () =>
  new Response(
    JSON.stringify({ ok: false, message: "Disconnected LOCAL TEST preview; no state changed." }),
    { status: 503, headers: { "content-type": "application/json" } }
  );
createRoot(document.getElementById("root")).render(<App />);
