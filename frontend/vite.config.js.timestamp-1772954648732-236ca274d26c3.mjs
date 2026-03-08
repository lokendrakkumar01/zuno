// vite.config.js
import { defineConfig } from "file:///C:/Users/loken/Downloads/zuno/frontend/node_modules/vite/dist/node/index.js";
import react from "file:///C:/Users/loken/Downloads/zuno/frontend/node_modules/@vitejs/plugin-react/dist/index.js";
import { nodePolyfills } from "file:///C:/Users/loken/Downloads/zuno/frontend/node_modules/vite-plugin-node-polyfills/dist/index.js";
import basicSsl from "file:///C:/Users/loken/Downloads/zuno/frontend/node_modules/@vitejs/plugin-basic-ssl/dist/index.mjs";
var vite_config_default = defineConfig({
  plugins: [
    react(),
    nodePolyfills(),
    basicSsl()
  ],
  build: {
    outDir: "dist",
    sourcemap: false
  },
  server: {
    port: 3e3,
    proxy: {
      "/api": {
        target: "http://localhost:5000",
        changeOrigin: true
      },
      "/socket.io": {
        target: "ws://localhost:5000",
        ws: true
      }
    }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxsb2tlblxcXFxEb3dubG9hZHNcXFxcenVub1xcXFxmcm9udGVuZFwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiQzpcXFxcVXNlcnNcXFxcbG9rZW5cXFxcRG93bmxvYWRzXFxcXHp1bm9cXFxcZnJvbnRlbmRcXFxcdml0ZS5jb25maWcuanNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL0M6L1VzZXJzL2xva2VuL0Rvd25sb2Fkcy96dW5vL2Zyb250ZW5kL3ZpdGUuY29uZmlnLmpzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSAndml0ZSdcclxuaW1wb3J0IHJlYWN0IGZyb20gJ0B2aXRlanMvcGx1Z2luLXJlYWN0J1xyXG5pbXBvcnQgeyBub2RlUG9seWZpbGxzIH0gZnJvbSAndml0ZS1wbHVnaW4tbm9kZS1wb2x5ZmlsbHMnXHJcblxyXG5pbXBvcnQgYmFzaWNTc2wgZnJvbSAnQHZpdGVqcy9wbHVnaW4tYmFzaWMtc3NsJ1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcclxuICAgICAgcGx1Z2luczogW1xyXG4gICAgICAgICAgICByZWFjdCgpLFxyXG4gICAgICAgICAgICBub2RlUG9seWZpbGxzKCksXHJcbiAgICAgICAgICAgIGJhc2ljU3NsKClcclxuICAgICAgXSxcclxuICAgICAgYnVpbGQ6IHtcclxuICAgICAgICAgICAgb3V0RGlyOiAnZGlzdCcsXHJcbiAgICAgICAgICAgIHNvdXJjZW1hcDogZmFsc2VcclxuICAgICAgfSxcclxuICAgICAgc2VydmVyOiB7XHJcbiAgICAgICAgICAgIHBvcnQ6IDMwMDAsXHJcbiAgICAgICAgICAgIHByb3h5OiB7XHJcbiAgICAgICAgICAgICAgICAgICcvYXBpJzoge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0YXJnZXQ6ICdodHRwOi8vbG9jYWxob3N0OjUwMDAnLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBjaGFuZ2VPcmlnaW46IHRydWVcclxuICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICAgJy9zb2NrZXQuaW8nOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRhcmdldDogJ3dzOi8vbG9jYWxob3N0OjUwMDAnLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICB3czogdHJ1ZVxyXG4gICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgfVxyXG59KVxyXG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQWdULFNBQVMsb0JBQW9CO0FBQzdVLE9BQU8sV0FBVztBQUNsQixTQUFTLHFCQUFxQjtBQUU5QixPQUFPLGNBQWM7QUFFckIsSUFBTyxzQkFBUSxhQUFhO0FBQUEsRUFDdEIsU0FBUztBQUFBLElBQ0gsTUFBTTtBQUFBLElBQ04sY0FBYztBQUFBLElBQ2QsU0FBUztBQUFBLEVBQ2Y7QUFBQSxFQUNBLE9BQU87QUFBQSxJQUNELFFBQVE7QUFBQSxJQUNSLFdBQVc7QUFBQSxFQUNqQjtBQUFBLEVBQ0EsUUFBUTtBQUFBLElBQ0YsTUFBTTtBQUFBLElBQ04sT0FBTztBQUFBLE1BQ0QsUUFBUTtBQUFBLFFBQ0YsUUFBUTtBQUFBLFFBQ1IsY0FBYztBQUFBLE1BQ3BCO0FBQUEsTUFDQSxjQUFjO0FBQUEsUUFDUixRQUFRO0FBQUEsUUFDUixJQUFJO0FBQUEsTUFDVjtBQUFBLElBQ047QUFBQSxFQUNOO0FBQ04sQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
