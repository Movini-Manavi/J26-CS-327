import { API_MODE } from '../config';
import { createHttpApi } from './httpApi';
import { createMockApi } from './mockApi';
import { IGroomingApi } from './types';

export const groomingApi: IGroomingApi =
  API_MODE === 'http' ? createHttpApi() : createMockApi();

export type { IGroomingApi, IIncomingResult } from './types';
