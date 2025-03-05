import axios from 'axios';

const API_URL = 'http://localhost:5000/api/auth';

// Register user
export const register = async (userData) => {
    const response = await axios.post(`${API_URL}/register`, userData);
    return response.data;
};

// Login user
export const login = async (userData) => {
    const response = await axios.post(`${API_URL}/login`, userData);
    return response.data;
};

// Get user profile
export const getUser = async (token) => {
    const response = await axios.get(`${API_URL}/me`, {
        headers: { Authorization: token }
    });
    return response.data;
};
