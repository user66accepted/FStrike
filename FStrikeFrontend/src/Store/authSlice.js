import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  id: null,
  username: '',
  role: '',
  token: '',
  isAuthenticated: false,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    // Set user details and authentication status on login
    login(state, action) {
      state.id = action.payload.id;
      state.username = action.payload.username;
      state.role = action.payload.role;
      state.token = action.payload.token;
      state.isAuthenticated = true;
    },
    // Logout: clear all user details and set authentication to false
    logout(state) {
      state.id = null;
      state.username = '';
      state.role = '';
      state.token = '';
      state.isAuthenticated = false;
    },
  },
});

export const { login, logout } = authSlice.actions;
export default authSlice.reducer;
