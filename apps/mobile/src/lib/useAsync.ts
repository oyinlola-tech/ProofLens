import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { messageOf } from "./api";

interface State<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  refreshing: boolean;
}

/** Loads server state with explicit loading, error, and pull-to-refresh states. */
export function useAsync<T>(loader: () => Promise<T>, deps: unknown[] = []) {
  const [state, setState] = useState<State<T>>({ data: null, error: null, loading: true, refreshing: false });
  const loaderRef = useRef(loader);
  loaderRef.current = loader;
  const seq = useRef(0);

  const run = useCallback(async (mode: "load" | "refresh" | "silent") => {
    const id = ++seq.current;
    setState((s) => ({ ...s, loading: mode === "load", refreshing: mode === "refresh", error: mode === "silent" ? s.error : null }));
    try {
      const data = await loaderRef.current();
      if (id !== seq.current) return;
      setState({ data, error: null, loading: false, refreshing: false });
    } catch (e) {
      if (id !== seq.current) return;
      setState((s) => ({ ...s, error: messageOf(e), loading: false, refreshing: false }));
    }
  }, []);

  useEffect(() => {
    run("load");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  // Stable identities: these are used as effect dependencies by callers.
  const actions = useMemo(
    () => ({ reload: () => run("load"), refresh: () => run("refresh"), silentRefresh: () => run("silent") }),
    [run],
  );

  return { ...state, ...actions };
}

/** Re-runs `refresh` each time the screen regains focus. The first focus is skipped: the initial load covers it. */
export function useRefreshOnFocus(refresh: () => void) {
  const first = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (first.current) {
        first.current = false;
        return;
      }
      refresh();
    }, [refresh]),
  );
}
