// Vite config for end-to-end runs: the project config with the /api proxy pointed at API_PORT
// (the real API on 8787 by default, or the contract mock on another port while the real one is being built).
import { mergeConfig } from 'vite';
import base from '../vite.config';

const target = `http://127.0.0.1:${process.env.API_PORT ?? 8787}`;
// Polling: edits made from Windows do not raise file events inside WSL's /mnt/c.
export default mergeConfig(base, { server: { proxy: { '/api': target }, watch: { usePolling: true, interval: 300 } }, preview: { proxy: { '/api': target } } }, false);
