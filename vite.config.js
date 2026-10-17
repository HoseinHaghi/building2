import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins:[react()],
  server:{port:5173,strictPort:true,watch:{ignored:['**/test-results/**','**/playwright-report/**','**/reference/**','**/server/storage/**','**/backups/**']},proxy:{'/api':{target:'http://127.0.0.1:5000',changeOrigin:false}}},
  build:{sourcemap:false},
});
