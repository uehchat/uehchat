import { ChatRoomEntry, WaitRoomEntry, LastPersonEntry } from './DatabaseEntry';
import { UserProfileResponse } from './FacebookAPI';

export interface AdminReplyProps {
  success?: boolean;
  error?: boolean;
  errorType?: string;
  chatRoom?: ChatRoomEntry[];
  waitRoom?: WaitRoomEntry[];
  lastPerson?: LastPersonEntry[];
  userProfile?: UserProfileResponse;
  msg?: string;
  cpu?: string;
  mem?: string;
  uptime?: string;
  version?: string;
}
