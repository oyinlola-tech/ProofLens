import { act, renderHook, waitFor } from "@testing-library/react-native";
import { useAsync } from "../useAsync";

jest.mock("expo-router", () => ({ useFocusEffect: jest.fn() }));

describe("useAsync", () => {
  it("loads data and clears the loading flag", async () => {
    const { result } = await renderHook(() => useAsync(async () => ["a", "b"]));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual(["a", "b"]);
    expect(result.current.error).toBeNull();
  });

  it("reports a failure as an error message and keeps no data", async () => {
    const { result } = await renderHook(() => useAsync<string[]>(async () => Promise.reject(new Error("offline"))));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toBeNull();
    expect(typeof result.current.error).toBe("string");
  });

  // Regression: these functions are effect dependencies in screens. When they changed on
  // every render, refresh-on-focus re-ran itself until React stopped with
  // "Maximum update depth exceeded".
  it("keeps its actions stable across renders and refreshes", async () => {
    let calls = 0;
    const { result, rerender } = await renderHook(() => useAsync(async () => ++calls));
    await waitFor(() => expect(result.current.loading).toBe(false));
    const first = { reload: result.current.reload, refresh: result.current.refresh, silentRefresh: result.current.silentRefresh };

    await rerender({});
    await act(async () => {
      await result.current.silentRefresh();
    });

    expect(result.current.data).toBe(2);
    expect(result.current.silentRefresh).toBe(first.silentRefresh);
    expect(result.current.refresh).toBe(first.refresh);
    expect(result.current.reload).toBe(first.reload);
  });

  it("keeps showing earlier data and its error state during a silent refresh", async () => {
    let fail = false;
    const { result } = await renderHook(() => useAsync(async () => (fail ? Promise.reject(new Error("x")) : "ok")));
    await waitFor(() => expect(result.current.data).toBe("ok"));
    fail = true;
    await act(async () => {
      await result.current.silentRefresh();
    });
    expect(result.current.data).toBe("ok");
    expect(result.current.loading).toBe(false);
  });

  it("ignores a slow response that a newer request has overtaken", async () => {
    const resolvers: ((v: string) => void)[] = [];
    const { result } = await renderHook(() => useAsync(() => new Promise<string>((r) => resolvers.push(r))));
    await act(async () => {
      void result.current.silentRefresh();
    });
    expect(resolvers).toHaveLength(2);
    await act(async () => {
      resolvers[1]("newer");
    });
    await waitFor(() => expect(result.current.data).toBe("newer"));
    await act(async () => {
      resolvers[0]("older");
      await Promise.resolve();
    });
    expect(result.current.data).toBe("newer");
  });
});
