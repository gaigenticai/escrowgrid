import http from 'k6/http';
import { check, sleep } from 'k6';

// Simple k6 load test for TAAS positions API.
//
// Preconditions:
// - A TAAS backend is running and reachable at API_URL.
// - An institution admin API key is available for API_KEY.
// - An assetId is available for ASSET_ID (the asset should exist and be accessible to API_KEY).
//
// Usage:
//   k6 run \
//     -e API_URL=http://localhost:4000 \
//     -e API_KEY=... \
//     -e ASSET_ID=... \
//     load/positions-k6.js
//
// This script will continuously create positions and transition them to FUNDED.

export const options = {
  stages: [
    { duration: '30s', target: 10 },
    { duration: '1m', target: 50 },
    { duration: '30s', target: 0 },
  ],
};

const API_URL = __ENV.API_URL || 'http://localhost:4000';
const API_KEY = __ENV.API_KEY;
const ASSET_ID = __ENV.ASSET_ID;

if (!API_KEY) {
  throw new Error('API_KEY env var is required');
}
if (!ASSET_ID) {
  throw new Error('ASSET_ID env var is required');
}

export default function () {
  const createRes = http.post(
    `${API_URL}/positions`,
    JSON.stringify({
      assetId: ASSET_ID,
      holderReference: `LOAD_TEST_${__VU}_${Date.now()}`,
      currency: 'USD',
      amount: 1000,
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': API_KEY,
      },
    },
  );

  check(createRes, {
    'position created or rejected with 4xx (policy)': (r) =>
      r.status === 201 || (r.status >= 400 && r.status < 500),
  });

  if (createRes.status === 201) {
    const body = createRes.json();
    const positionId = body.id;

    const transitionRes = http.post(
      `${API_URL}/positions/${positionId}/transition`,
      JSON.stringify({
        toState: 'FUNDED',
        reason: 'load test funding',
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': API_KEY,
        },
      },
    );

    check(transitionRes, {
      'transition FUNDED success or 4xx': (r) =>
        r.status === 200 || (r.status >= 400 && r.status < 500),
    });
  }

  sleep(1);
}
