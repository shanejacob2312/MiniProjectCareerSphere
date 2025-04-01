import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/dashboard.css";
import createResumeIcon from "../assets/createicon.png";
import uploadResumeIcon from "../assets/uploadicon.png";
import { 
  Card, 
  CardContent, 
  Typography, 
  Grid, 
  Button, 
  Box,
  CircularProgress
} from '@mui/material';
import { 
  Description as DescriptionIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon
} from '@mui/icons-material';

const Dashboard = () => {
  const navigate = useNavigate();
  const [resumes, setResumes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchResumes();
  }, []);

  const fetchResumes = async () => {
    try {
      const token = localStorage.getItem('token');
      console.log('Token present:', !!token);
      
      if (!token) {
        console.log('No token found, redirecting to login');
        navigate('/login');
        return;
      }

      console.log('Fetching resumes from:', 'http://localhost:5000/api/resumes');
      const response = await fetch('http://localhost:5000/api/resumes', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      console.log('Response status:', response.status);
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('Error response:', errorData);
        throw new Error(errorData.message || errorData.error || 'Failed to fetch resumes');
      }

      const data = await response.json();
      console.log('Received resumes:', data);
      setResumes(data);
    } catch (err) {
      console.error('Detailed error in fetchResumes:', {
        message: err.message,
        stack: err.stack,
        name: err.name
      });
      setError(err.message || 'Failed to load resumes. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const handleViewResume = (resumeId) => {
    navigate(`/resumebuilder`, { 
      state: { 
        resumeData: resumes.find(r => r._id === resumeId),
        isEditing: true
      } 
    });
  };

  const handleDeleteResume = async (resumeId) => {
    if (!window.confirm('Are you sure you want to delete this resume?')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5000/api/resumes/${resumeId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to delete resume');
      }

      setResumes(resumes.filter(resume => resume._id !== resumeId));
    } catch (err) {
      console.error('Error deleting resume:', err);
      alert('Failed to delete resume');
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" minHeight="60vh">
        <Typography color="error" gutterBottom>
          {error}
        </Typography>
        <Button 
          variant="contained" 
          color="primary" 
          onClick={fetchResumes}
          sx={{ mt: 2 }}
        >
          Retry
        </Button>
      </Box>
    );
  }

  return (
    <div className="dashboard-container">
      <div className="action-buttons">
        <div className="dashboard-button" onClick={() => navigate("/resumeinput")}>
          <img src={createResumeIcon} alt="Create Resume" className="button-icon" />
          <button className="btn">Create a Resume</button>
        </div>
        <div className="dashboard-button" onClick={() => navigate("/uploadresume")}>
          <img src={uploadResumeIcon} alt="Upload Resume" className="button-icon" />
          <button className="btn">Upload a Resume</button>
        </div>
      </div>

      <div className="view-resumes-section">
        <Typography variant="h4" gutterBottom>
          Your Resumes
        </Typography>
        <Grid container spacing={3}>
          {resumes.map((resume) => (
            <Grid item xs={12} sm={6} md={4} key={resume._id}>
              <Card>
                <CardContent>
                  <Box display="flex" alignItems="center" mb={2}>
                    <DescriptionIcon sx={{ mr: 1 }} />
                    <Typography variant="h6">
                      {resume.name || 'Untitled Resume'}
                    </Typography>
                  </Box>
                  <Typography color="textSecondary" gutterBottom>
                    Created: {new Date(resume.createdAt).toLocaleDateString()}
                  </Typography>
                  <Typography color="textSecondary" gutterBottom>
                    Last Modified: {new Date(resume.updatedAt).toLocaleDateString()}
                  </Typography>
                  <Box display="flex" justifyContent="flex-end" mt={2}>
                    <Button
                      startIcon={<ViewIcon />}
                      onClick={() => handleViewResume(resume._id)}
                      sx={{ mr: 1 }}
                    >
                      View
                    </Button>
                    <Button
                      startIcon={<EditIcon />}
                      onClick={() => handleViewResume(resume._id)}
                      sx={{ mr: 1 }}
                    >
                      Edit
                    </Button>
                    <Button
                      startIcon={<DeleteIcon />}
                      color="error"
                      onClick={() => handleDeleteResume(resume._id)}
                    >
                      Delete
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
          {resumes.length === 0 && (
            <Grid item xs={12}>
              <Typography variant="body1" color="textSecondary" align="center">
                No resumes found. Create or upload a resume to get started!
              </Typography>
            </Grid>
          )}
        </Grid>
      </div>
    </div>
  );
};

export default Dashboard;
