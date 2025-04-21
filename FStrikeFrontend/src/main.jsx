import { StrictMode } from 'react'
import React from 'react'
import { Provider } from "react-redux";
import store from "./Store/store.js"
import { createRoot } from 'react-dom/client'
import AppRoutes from './Routes/AppRoutes.jsx'
import './index.css'


createRoot(document.getElementById('root')).render(
  <Provider store={store}>
    <AppRoutes />
  </Provider>,
)
