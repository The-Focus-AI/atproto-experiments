/**
 * Job Queue Types (Lexicon-based)
 */

export const JOB_COLLECTION = 'ai.focus.jobqueue.job';

export interface JobPayload {
  type: string;
  data: any;
  [key: string]: any;
}

export interface JobRecord {
  $type: 'ai.focus.jobqueue.job';
  payload: JobPayload;
  status: 'pending' | 'working' | 'success' | 'failed';
  createdAt: string;
  workerDid?: string;
  result?: any;
  error?: string;
  blobRef?: {
    $type: 'blob';
    ref: { $link: string };
    mimeType: string;
    size: number;
  };
}

export interface JobPost {
  uri: string;
  cid: string;
  record: JobRecord;
}

export interface JobResult {
  status: 'success' | 'failed';
  data?: any;
  error?: string;
  blobRef?: {
    path: string;
    mimeType: string;
    alt?: string;
  };
}
