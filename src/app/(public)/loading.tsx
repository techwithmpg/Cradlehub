export default function PublicLoading() {
  return (
    <div
      aria-hidden="true"
      className="public-route-loading-track pointer-events-none fixed inset-x-0 z-[70] h-[3px] overflow-hidden md:hidden"
    >
      <div className="public-route-loading-line" data-phase="loading" />
    </div>
  );
}
