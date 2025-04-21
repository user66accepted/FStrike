# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react/README.md) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

# FStrike Frontend

## API Configuration

The application uses a centralized API configuration for all backend communication. The configuration is stored in:

```
src/config/apiConfig.js
```

To change the backend endpoint, simply edit this file and update the `API_BASE_URL` value. For example:

```js
// API Configuration
const config = {
  API_BASE_URL: 'https://fstrike-api.example.com/api',
};

export default config;
```

### API Services

- All API calls are centralized in `src/services/apiService.js`
- The HTTP client is configured in `src/services/httpClient.js`

This architecture ensures:
1. A single point of configuration for backend URL
2. Consistent error handling across all API calls
3. Automatic authentication token inclusion
4. Standardized API method signatures
