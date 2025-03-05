import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import "../styles/dashboard.css"; // Import the CSS file

const Dashboard = () => {
    const navigate = useNavigate();
    const [resumes, setResumes] = useState([]);

    useEffect(() => {
        const fetchResumes = async () => {
            try {
                const response = await axios.get("http://localhost:5000/api/resume/list");
                setResumes(response.data);
            } catch (err) {
                console.error("Error fetching resumes", err);
            }
        };

        fetchResumes();
    }, []);

    return (
        <div className="dashboard-container">
            <h2>Dashboard</h2>
            
            {/* Buttons for Resume Actions */}
            <div className="dashboard-buttons">
                <button onClick={() => navigate('/createresume')}>Create New Resume</button>
                <button onClick={() => navigate('/uploadresume')}>Upload Resume</button>
            </div>

            {/* Uploaded Resumes Section */}
            <div className="resumes-container">
                <h3>Your Uploaded Resumes</h3>
                {resumes.length > 0 ? (
                    <ul>
                        {resumes.map((resume, index) => (
                            <li key={index}>
                                <a href={`http://localhost:5000/uploads/${resume}`} target="_blank" rel="noopener noreferrer">
                                    View {resume}
                                </a>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="no-resumes">No resumes uploaded yet.</p>
                )}
            </div>
        </div>
    );
};

export default Dashboard;
