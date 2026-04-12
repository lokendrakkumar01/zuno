/**
 * Non-blocking route load indicator — thin top bar instead of a full-screen spinner.
 */
const RouteSuspenseFallback = () => (
      <div className="route-suspense-fallback" role="progressbar" aria-label="Loading page">
            <div className="route-suspense-fallback-bar" />
      </div>
);

export default RouteSuspenseFallback;
