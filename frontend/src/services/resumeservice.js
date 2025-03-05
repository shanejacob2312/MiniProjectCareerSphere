import axios from 'axios';

const API_URL = 'http://localhost:5000/api/resume';

// Upload resume
export const uploadResume = async (file, token) => {
    const formData = new FormData();
    formData.append('resume', file);

    const response = await axios.post(`${API_URL}/upload`, formData, {
        headers: {
            Authorization: token,
            'Content-Type': 'multipart/form-data',
        },
    });

    return response.data;
};

// Get user resumes
export const getResumes = async (token) => {
    const response = await axios.get(`${API_URL}/user-resumes`, {
        headers: { Authorization: token },
    });
    return response.data;
};
