import {useEffect, useMemo, useRef, useState} from 'react';

import type {
  StreamlineData,
  TorusSimulationParameters,
  TorusWorkerRequest,
  TorusWorkerResponse,
} from './torusDynamics';

type TorusSimulationState = {
  computing: boolean;
  data: StreamlineData | null;
  error: string | null;
};

export function useTorusSimulation(
  parameters: TorusSimulationParameters,
  recomputeToken: number,
) {
  const workerRef = useRef<Worker | null>(null);
  const requestIdRef = useRef(0);
  const serializedParameters = useMemo(() => JSON.stringify(parameters), [parameters]);
  const [state, setState] = useState<TorusSimulationState>({
    computing: true,
    data: null,
    error: null,
  });

  useEffect(() => {
    workerRef.current?.terminate();
    workerRef.current = null;
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setState((current) => ({...current, computing: true, error: null}));

    const timeout = window.setTimeout(() => {
      const worker = new Worker(new URL('./torusWorker.ts', import.meta.url), {type: 'module'});
      workerRef.current = worker;

      worker.onmessage = (event: MessageEvent<TorusWorkerResponse>) => {
        if (event.data.requestId !== requestIdRef.current) return;
        setState({computing: false, data: event.data.data, error: null});
        worker.terminate();
        if (workerRef.current === worker) workerRef.current = null;
      };
      worker.onerror = (event) => {
        if (requestId !== requestIdRef.current) return;
        setState((current) => ({
          ...current,
          computing: false,
          error: event.message || 'Streamline worker failed.',
        }));
        worker.terminate();
        if (workerRef.current === worker) workerRef.current = null;
      };

      const request: TorusWorkerRequest = {
        parameters: JSON.parse(serializedParameters) as TorusSimulationParameters,
        requestId,
      };
      worker.postMessage(request);
    }, 220);

    return () => {
      window.clearTimeout(timeout);
      if (requestId === requestIdRef.current) {
        workerRef.current?.terminate();
        workerRef.current = null;
      }
    };
  }, [recomputeToken, serializedParameters]);

  useEffect(() => () => {
    workerRef.current?.terminate();
    workerRef.current = null;
  }, []);

  return state;
}
