import {generateStreamlineData} from './torusDynamics';
import type {TorusWorkerRequest, TorusWorkerResponse} from './torusDynamics';

type WorkerScope = {
  onmessage: ((event: MessageEvent<TorusWorkerRequest>) => void) | null;
  postMessage: (message: TorusWorkerResponse, transfer: Transferable[]) => void;
};

const workerScope = self as unknown as WorkerScope;

workerScope.onmessage = (event) => {
  const {parameters, requestId} = event.data;
  const data = generateStreamlineData(parameters);
  const response: TorusWorkerResponse = {data, requestId};
  workerScope.postMessage(response, [
    data.positions.buffer,
    data.pathPositions.buffer,
    data.seeds.buffer,
    data.speeds.buffer,
    data.radii.buffer,
    data.intensities.buffer,
  ]);
};

export {};
