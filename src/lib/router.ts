/** Minimal hash router: "#/" (home) and "#/settings". */
import { useCallback, useEffect, useState } from "react";

export type Route = { screen: "home" } | { screen: "settings" };

export function parseRoute(hash: string): Route {
  const parts = hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  return parts[0] === "settings" ? { screen: "settings" } : { screen: "home" };
}

export function routeToHash(route: Route): string {
  return route.screen === "settings" ? "#/settings" : "#/";
}

export function useRoute(): [Route, (r: Route) => void] {
  const [route, setRoute] = useState<Route>(() => parseRoute(window.location.hash));
  useEffect(() => {
    const onHash = () => setRoute(parseRoute(window.location.hash));
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  const navigate = useCallback((r: Route) => {
    window.location.hash = routeToHash(r);
  }, []);
  return [route, navigate];
}
