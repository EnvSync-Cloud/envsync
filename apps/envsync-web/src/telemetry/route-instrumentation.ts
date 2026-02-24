import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { getTracer } from "./tracing";

export function RouteChangeTracker(): null {
  const location = useLocation();
  const prevPath = useRef(location.pathname);

  useEffect(() => {
    if (prevPath.current === location.pathname) return;

    const tracer = getTracer();
    const span = tracer.startSpan("route_change", {
      attributes: {
        "route.from": prevPath.current,
        "route.to": location.pathname,
        "route.search": location.search,
      },
    });
    span.end();

    prevPath.current = location.pathname;
  }, [location]);

  return null;
}
