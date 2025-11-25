import { defineConfig } from 'vite';

export default defineConfig(async () => {
  const react = (await import('@vitejs/plugin-react-swc')).default;

  return {
    plugins: [react()],
    server: {
      port: 5174
    }
  };
});


