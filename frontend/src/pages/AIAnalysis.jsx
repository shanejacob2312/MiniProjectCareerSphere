import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Container,
  Typography,
  Box,
  CircularProgress,
  Paper,
  Grid,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  Chip,
  Alert,
  Divider,
  Button,
  Tooltip,
  IconButton,
  TextField
} from '@mui/material';
import {
  Assessment as AssessmentIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  TrendingUp as TrendingUpIcon,
  Work as WorkIcon,
  School as SchoolIcon,
  Refresh as RefreshIcon,
  Share as ShareIcon,
  Download as DownloadIcon,
  Edit as EditIcon
} from '@mui/icons-material';
import { styled, useTheme } from '@mui/material/styles';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';
import '../styles/aianalysis.css';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

const AnalysisContainer = styled(Box)(({ theme }) => ({
  padding: theme.spacing(4),
  maxWidth: 1200,
  margin: '0 auto',
  marginTop: '64px',
  minHeight: 'calc(100vh - 64px)',
}));

const MetricCard = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(3),
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  transition: 'transform 0.2s',
  '&:hover': {
    transform: 'translateY(-4px)',
  },
}));

const LoadingContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '60vh',
  gap: theme.spacing(3),
}));

const RecommendationCard = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(2),
  height: '100%',
  '& .MuiList-root': {
    maxHeight: '300px',
    overflowY: 'auto',
  },
  '& .MuiListItem-root': {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: theme.spacing(1),
  },
  '& .MuiListItemText-primary': {
    fontWeight: 'bold',
  },
  '& .MuiListItemText-secondary': {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  },
}));

// Add error boundary component
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Box sx={{ p: 3, textAlign: 'center' }}>
          <Typography color="error" variant="h6">
            Something went wrong displaying this section
          </Typography>
          <Button 
            variant="contained" 
            onClick={() => this.setState({ hasError: false })}
            sx={{ mt: 2 }}
          >
            Try Again
          </Button>
        </Box>
      );
    }
    return this.props.children;
  }
}

// Add debounced search
const useDebounce = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

const ScoreChip = ({ score }) => {
    const getColor = (score) => {
        if (score >= 80) return 'success';
        if (score >= 60) return 'primary';
        if (score >= 40) return 'warning';
        return 'error';
    };
    
    return (
        <Chip
            label={`${Math.round(score)}% Match`}
            color={getColor(score)}
            size="small"
        />
    );
};

const SkillsList = ({ title, skills, icon }) => {
    if (!skills || skills.length === 0) return null;
    
    return (
        <Box sx={{ mt: 2 }}>
            <Typography component="div" variant="subtitle1" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {icon}
                {title}
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
                {skills.map((skill, index) => (
                    <Chip
                        key={index}
                        label={skill}
                        size="small"
                        variant="outlined"
                    />
                ))}
            </Box>
        </Box>
    );
};

const AIAnalysis = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [sectionLoading, setSectionLoading] = useState({
    skills: false,
    recommendations: false,
    pdf: false
  });
  const [error, setError] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [serverStatus, setServerStatus] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const MAX_RETRIES = 3;
  const [progress, setProgress] = useState(0);
  const progressInterval = useRef(null);
  const theme = useTheme();

  // Clear intervals on unmount
  useEffect(() => {
    return () => {
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
      }
    };
  }, []);

  const validateResumeData = useCallback((data) => {
    console.log('Validating resume data:', data);
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid resume data format');
    }

    // Ensure we have text content from either text or summary field
    const textContent = data.text || data.summary || '';
    if (textContent.trim() === '') {
      throw new Error('Resume text is required');
    }

    // Ensure education array is properly structured
    const education = Array.isArray(data.education) ? data.education.filter(Boolean) : [];
    console.log('Processed education data:', education);

    // Ensure experience array is properly structured
    const experience = Array.isArray(data.experience) ? data.experience.filter(Boolean) : [];
    console.log('Processed experience data:', experience);

    // Ensure skills array is properly structured
    const skills = Array.isArray(data.skills) ? 
      data.skills
        .filter(Boolean)
        .map(skill => typeof skill === 'object' ? skill : { name: skill })
        .filter(skill => skill.name && typeof skill.name === 'string') : [];
    console.log('Processed skills data:', skills);

    return {
      text: textContent.trim(),
      job_type: data.job_type || 'Software Developer',
      skills: skills,
      education: education,
      experience: experience,
      summary: data.summary || textContent.trim()
    };
  }, []);

  const handleRetry = useCallback(async () => {
    if (retryCount >= MAX_RETRIES) {
      setError('Maximum retry attempts reached. Please try again later.');
      return;
    }

    const backoffTime = Math.pow(2, retryCount) * 1000; // Exponential backoff
    await new Promise(resolve => setTimeout(resolve, backoffTime));

    setLoading(true);
    setError(null);
    setRetryCount(prev => prev + 1);
    await analyzeResume();
  }, [retryCount]);

  const checkServerStatus = useCallback(async () => {
    try {
      const response = await fetch('http://localhost:5000/');
      if (!response.ok) {
        throw new Error('Server is not responding');
      }
      const text = await response.text();
      setServerStatus({ status: 'running', message: text });
      return true;
    } catch (err) {
      console.error('Server status check failed:', err);
      setError('Error connecting to server. Please try again later.');
      return false;
    }
  }, []);

  const handleDownload = useCallback(async () => {
    try {
        setSectionLoading(prev => ({ ...prev, pdf: true }));
        
        // Create a new worker instance
        const worker = new Worker('/pdfWorker.js');
        
        // Create a promise to handle worker response
        const workerPromise = new Promise((resolve, reject) => {
            worker.onmessage = (e) => {
                const { type, pdf, error } = e.data;
                
                if (type === 'error') {
                    reject(new Error(error || 'Failed to generate PDF'));
                    return;
                }
                
                if (type === 'complete' && pdf) {
                    resolve(pdf);
                }
            };
            
            worker.onerror = (error) => {
                reject(new Error(error.message || 'Worker error'));
            };
        });
        
        // Send data to worker
        worker.postMessage({ analysis });
        
        // Wait for worker response
        const pdfBlob = await workerPromise;
        
        // Create download link
        const url = URL.createObjectURL(pdfBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'Resume_Analysis_Report.pdf';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
    } catch (error) {
        console.error('Error in handleDownload:', error);
        setError('Failed to generate PDF report: ' + error.message);
    } finally {
        setSectionLoading(prev => ({ ...prev, pdf: false }));
    }
}, [analysis]);

  const analyzeResume = useCallback(async () => {
    try {
      const resumeData = location.state?.resumeData;
      console.log('Raw resume data received:', resumeData);
      
      if (!resumeData) {
        throw new Error('No resume data available for analysis');
      }

      const validatedData = validateResumeData(resumeData);
      console.log('Validated resume data:', validatedData);

      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/login', { state: { from: location } });
        return;
      }

      // Start progress animation
      progressInterval.current = setInterval(() => {
        setProgress(prev => prev < 90 ? prev + 10 : prev);
      }, 500);

      const response = await fetch('http://localhost:5000/api/resumeanalysis/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(validatedData),
      });

      if (progressInterval.current) {
        clearInterval(progressInterval.current);
      }
      setProgress(100);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Backend error response:', errorData);
        throw new Error(errorData.error || 'Analysis request failed');
      }

      const data = await response.json();
      console.log('Response from backend:', data);

      // Validate and sanitize the response data
      const analysisData = {
        ...data,
        overall_score: Math.max(0, Math.min(100, data.overall_score || 0)),
        text_quality: {
          readability_score: Math.max(0, Math.min(100, data.text_quality?.readability_score || 0)),
          sentence_count: Math.max(0, data.text_quality?.sentence_count || 0),
          word_count: Math.max(0, data.text_quality?.word_count || 0),
          avg_word_length: String(data.text_quality?.avg_word_length || '0')
        },
        skills_analysis: {
          matched_skills: Array.isArray(data.skills_analysis?.matched_skills) ? 
            data.skills_analysis.matched_skills.filter(Boolean) : [],
          missing_skills: Array.isArray(data.skills_analysis?.missing_skills) ?
            data.skills_analysis.missing_skills.filter(Boolean) : [],
          skill_scores: {
            total: Math.max(0, Math.min(100, data.skills_analysis?.skill_scores?.total || 0)),
            confidence: Math.max(0, Math.min(1, data.skills_analysis?.skill_scores?.confidence || 0))
          }
        },
        education: Array.isArray(resumeData.education) ? resumeData.education.filter(Boolean) : [],
        experience: Array.isArray(resumeData.experience) ? resumeData.experience.filter(Boolean) : [],
        job_recommendations: Array.isArray(data.job_recommendations) ? 
          data.job_recommendations.filter(Boolean) : [],
        course_recommendations: Array.isArray(data.course_recommendations) ?
          data.course_recommendations.filter(Boolean) : [],
        certification_recommendations: Array.isArray(data.certification_recommendations) ?
          data.certification_recommendations.filter(Boolean) : []
      };

      // Log the processed analysis data
      console.log('Final analysis data:', analysisData);
      setAnalysis(analysisData);
    } catch (err) {
      console.error('Analysis failed:', err);
      setError(err.message || 'Error analyzing resume. Please try again later.');
      
      if (err.message.includes('connecting to server') && retryCount < MAX_RETRIES) {
        setTimeout(handleRetry, 2000 * (retryCount + 1));
      }
    } finally {
      setLoading(false);
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
      }
    }
  }, [location, navigate, retryCount, handleRetry, validateResumeData]);

  // Memoize radar data preparation
  const prepareRadarData = useCallback((analysis) => {
    if (!analysis) return [];
    
    console.log('Preparing radar data with analysis:', analysis);
    
    // Calculate normalized scores
    const textQualityScore = Math.max(0, Math.min(100, analysis.text_quality.readability_score || 0));
    const skillsMatchScore = Math.min(100, ((analysis.skills_analysis.matched_skills.length || 0) * 10));
    const educationScore = Math.max(0, Math.min(100, calculateEducationScore(analysis.education)));
    const experienceScore = Math.max(0, Math.min(100, calculateExperienceScore(analysis.experience)));
    
    // Calculate overall score as weighted average
    const weights = {
      textQuality: 0.2,
      skillsMatch: 0.3,
      education: 0.25,
      experience: 0.25
    };
    
    const overallScore = Math.round(
      textQualityScore * weights.textQuality +
      skillsMatchScore * weights.skillsMatch +
      educationScore * weights.education +
      experienceScore * weights.experience
    );
    
    return [
      {
        skill: 'Text Quality',
        value: textQualityScore,
      },
      {
        skill: 'Skills Match',
        value: skillsMatchScore,
      },
      {
        skill: 'Education',
        value: educationScore,
      },
      {
        skill: 'Experience',
        value: experienceScore,
      },
      {
        skill: 'Overall Score',
        value: Math.max(0, Math.min(100, overallScore)),
      },
    ];
  }, []);

  useEffect(() => {
    const initializeAnalysis = async () => {
      const serverRunning = await checkServerStatus();
      if (serverRunning) {
        await analyzeResume();
      }
    };

    initializeAnalysis();
  }, [location]);

  const calculateEducationScore = (education) => {
    console.log('Raw education data:', education);
    
    if (!Array.isArray(education)) {
      console.log('Education is not an array, type:', typeof education);
      return 0;
    }

    if (education.length === 0) {
      console.log('Education array is empty');
      return 0;
    }
    
    let totalScore = 0;
    education.forEach((edu, index) => {
      if (!edu) {
        console.log(`Education entry ${index} is null or undefined`);
        return;
      }
      
      let entryScore = 0;
      console.log(`Processing education entry ${index}:`, edu);

      // Score for institution (0-40 points)
      if (edu.institution) {
        const institution = edu.institution.toLowerCase();
        if (institution.includes('carnegie mellon') || 
            institution.includes('mit') || 
            institution.includes('stanford') ||
            institution.includes('harvard') ||
            institution.includes('oxford') ||
            institution.includes('cambridge')) {
          entryScore += 40; // Top-tier institutions
          console.log('Top-tier institution bonus:', 40);
        } else if (institution.includes('university') || 
                  institution.includes('college') ||
                  institution.includes('institute') ||
                  institution.includes('school')) {
          entryScore += 30; // Standard institutions
          console.log('Standard institution points:', 30);
        } else {
          entryScore += 25; // Other educational institutions
          console.log('Other institution points:', 25);
        }
      }

      // Score for degree (0-40 points)
      if (edu.degree) {
        const degree = edu.degree.toLowerCase();
        if (degree.includes('ph.d') || degree.includes('doctorate')) {
          entryScore += 40;
          console.log('Doctorate degree points:', 40);
        } else if (degree.includes('master') || degree.includes('m.s.') || degree.includes('m.tech')) {
          entryScore += 35;
          console.log('Masters degree points:', 35);
        } else if (degree.includes('b.s.') || 
                  degree.includes('bachelor') || 
                  degree.includes('b.tech') ||
                  degree.includes('computer science') ||
                  degree.includes('engineering')) {
          entryScore += 30;
          console.log('Bachelors/Engineering degree points:', 30);
        } else if (degree.includes('associate')) {
          entryScore += 20;
          console.log('Associate degree points:', 20);
        }
      }

      // Score for recency (0-20 points)
      if (edu.year) {
        const year = parseInt(edu.year);
        const currentYear = new Date().getFullYear();
        const yearDiff = Math.abs(currentYear - year);
        
        if (yearDiff <= 2) {
          entryScore += 20;
          console.log('Very recent education points:', 20);
        } else if (yearDiff <= 5) {
          entryScore += 15;
          console.log('Recent education points:', 15);
        } else if (yearDiff <= 10) {
          entryScore += 10;
          console.log('Moderately recent education points:', 10);
        } else {
          entryScore += 5;
          console.log('Older education points:', 5);
        }
      }

      console.log(`Total points for entry ${index}:`, entryScore);
      totalScore += entryScore;
    });

    // Normalize to 100-point scale
    const finalScore = Math.min(100, totalScore);
    console.log('Final education score:', finalScore);
    return finalScore;
  };

  const calculateExperienceScore = (experience) => {
    if (!Array.isArray(experience)) return 0;
    
    let score = 0;
    experience.forEach(exp => {
      if (!exp) return;
      
      // Base points for having experience entry
      let entryScore = 20;
      
      // Points for position level
      if (exp.title) {
        const title = exp.title.toLowerCase();
        if (title.includes('senior') || title.includes('lead') || title.includes('manager')) {
          entryScore += 30;
        } else if (title.includes('developer') || title.includes('engineer')) {
          entryScore += 20;
        }
      }
      
      // Points for duration
      if (exp.duration) {
        const durationText = exp.duration.toLowerCase();
        const years = durationText.includes('present') ? 
          new Date().getFullYear() - parseInt(durationText.match(/\d{4}/)[0]) :
          (durationText.match(/\d{4}/g) || []).reduce((a, b) => Math.abs(parseInt(b) - parseInt(a)), 0);
        entryScore += Math.min(30, years * 10); // 10 points per year up to 30 points
      }
      
      // Points for description detail
      if (Array.isArray(exp.description) && exp.description.length > 0) {
        entryScore += Math.min(20, exp.description.length * 5); // 5 points per bullet point up to 20 points
      }
      
      score += entryScore;
    });
    
    return Math.min(100, score);
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: 'Resume Analysis Results',
        text: `My resume analysis score: ${analysis.overall_score}`,
      });
    }
  };

  const renderRecommendations = () => {
    console.log('Rendering recommendations with analysis:', analysis);
    
    if (!analysis) {
      console.log('No analysis data found');
      return null;
    }

    const courses = analysis.course_recommendations || [];
    const certifications = analysis.certification_recommendations || [];
    console.log('Recommendations data:', { courses, certifications });

    return (
      <>
        <Grid item xs={12} md={6}>
          <RecommendationCard elevation={3}>
            <Typography variant="h6" gutterBottom>
              <SchoolIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
              Recommended Courses
            </Typography>
            <List>
              {courses && courses.length > 0 ? (
                courses.map((course, index) => (
                  <ListItem key={index} divider={index < courses.length - 1}>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <Typography component="div" variant="subtitle1">{course.title}</Typography>
                          <Chip 
                            label={`${course.match_score}% Match`}
                            color="primary"
                            size="small"
                            sx={{ ml: 1 }}
                          />
                        </Box>
                      }
                      secondary={
                        <>
                          <Typography component="div" variant="body2" color="text.secondary">
                            {course.description}
                          </Typography>
                          <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Chip 
                              label={`Provider: ${course.provider}`}
                              variant="outlined"
                              size="small"
                            />
                            <Chip 
                              label={`Level: ${course.level}`}
                              variant="outlined"
                              size="small"
                            />
                          </Box>
                          <Button
                            variant="outlined"
                            size="small"
                            href={course.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            sx={{ mt: 1 }}
                          >
                            Learn More
                          </Button>
                        </>
                      }
                    />
                  </ListItem>
                ))
              ) : (
                <ListItem>
                  <ListItemText 
                    primary="No course recommendations available" 
                    secondary="Try uploading a resume with more detailed skills"
                  />
                </ListItem>
              )}
            </List>
          </RecommendationCard>
        </Grid>
        <Grid item xs={12} md={6}>
          <RecommendationCard elevation={3}>
            <Typography variant="h6" gutterBottom>
              <WorkIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
              Recommended Certifications
            </Typography>
            <List>
              {certifications && certifications.length > 0 ? (
                certifications.map((cert, index) => (
                  <ListItem key={index} divider={index < certifications.length - 1}>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <Typography component="div" variant="subtitle1">{cert.title}</Typography>
                          {cert.match_score && (
                            <Chip 
                              label={`${cert.match_score}% Match`}
                              color="primary"
                              size="small"
                              sx={{ ml: 1 }}
                            />
                          )}
                        </Box>
                      }
                      secondary={
                        <>
                          <Typography component="div" variant="body2" color="text.secondary">
                            {cert.description}
                          </Typography>
                          <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Chip 
                              label={`Provider: ${cert.provider}`}
                              variant="outlined"
                              size="small"
                            />
                            <Chip 
                              label={`Level: ${cert.level}`}
                              variant="outlined"
                              size="small"
                            />
                          </Box>
                          <Button
                            variant="outlined"
                            size="small"
                            href={cert.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            sx={{ mt: 1 }}
                          >
                            Learn More
                          </Button>
                        </>
                      }
                    />
                  </ListItem>
                ))
              ) : (
                <ListItem>
                  <ListItemText 
                    primary="No certification recommendations available" 
                    secondary="Try uploading a resume with more detailed skills"
                  />
                </ListItem>
              )}
            </List>
          </RecommendationCard>
        </Grid>
      </>
    );
  };

  const radarData = useMemo(() => {
    if (!analysis) return [];
    
    console.log('Preparing radar data with analysis:', analysis);
    
    // Calculate normalized scores
    const textQualityScore = Math.round(analysis.text_quality?.readability_score || 0);
    const skillsMatchScore = Math.round((analysis.skills_analysis?.matched_skills?.length || 0) / 
                                     (analysis.skills_analysis?.matched_skills?.length + 
                                      analysis.skills_analysis?.missing_skills?.length || 1) * 100);
    const educationScore = Math.round(analysis.education_score || 0);
    const experienceScore = Math.round(analysis.experience_score || 0);
    const overallScore = Math.round(analysis.overall_score || 0);
    
    return [
      {
        subject: 'Text Quality',
        A: textQualityScore,
        fullMark: 100,
        description: 'Measures the clarity and professionalism of your writing'
      },
      {
        subject: 'Skills Match',
        A: skillsMatchScore,
        fullMark: 100,
        description: 'How well your skills match job requirements'
      },
      {
        subject: 'Education',
        A: educationScore,
        fullMark: 100,
        description: 'Assessment of your educational background'
      },
      {
        subject: 'Experience',
        A: experienceScore,
        fullMark: 100,
        description: 'Evaluation of your work experience'
      },
      {
        subject: 'Overall',
        A: overallScore,
        fullMark: 100,
        description: 'Combined score of all factors'
      }
    ];
  }, [analysis]);

  // Update the radar chart component
  const renderRadarChart = () => (
    <ResponsiveContainer width="100%" height={300}>
      <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
        <PolarGrid gridType="polygon" />
        <PolarAngleAxis
          dataKey="subject"
          tick={{ fill: theme.palette.text.primary, fontSize: 12 }}
        />
        <PolarRadiusAxis
          angle={90}
          domain={[0, 100]}
          tick={{ fontSize: 10 }}
          axisLine={false}
        />
        <Radar
          name="Skills Analysis"
          dataKey="A"
          stroke={theme.palette.primary.main}
          fill={theme.palette.primary.main}
          fillOpacity={0.5}
        />
        <Tooltip content={<CustomTooltip />} />
      </RadarChart>
    </ResponsiveContainer>
  );

  // Update the CustomTooltip component
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload[0]) {
      const data = payload[0].payload;
      return (
        <Paper sx={{ p: 2, backgroundColor: 'background.paper' }}>
          <Typography variant="subtitle2" gutterBottom>
            {data.subject}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {data.description}
          </Typography>
          <Typography variant="body1" sx={{ mt: 1, fontWeight: 'bold' }}>
            Score: {data.A}%
          </Typography>
        </Paper>
      );
    }
    return null;
  };

  // Add validation function
  const validateAnalysisData = useCallback((data) => {
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid analysis data format');
    }

    // Validate skills analysis
    if (!data.skills_analysis || typeof data.skills_analysis !== 'object') {
      throw new Error('Invalid skills analysis data');
    }

    // Ensure arrays exist and are properly formatted
    data.skills_analysis.matched_skills = Array.isArray(data.skills_analysis.matched_skills) ? 
      data.skills_analysis.matched_skills : [];
    data.skills_analysis.missing_skills = Array.isArray(data.skills_analysis.missing_skills) ? 
      data.skills_analysis.missing_skills : [];

    // Validate recommendations
    data.job_recommendations = Array.isArray(data.job_recommendations) ? 
      data.job_recommendations : [];
    data.course_recommendations = Array.isArray(data.course_recommendations) ? 
      data.course_recommendations : [];
    data.certification_recommendations = Array.isArray(data.certification_recommendations) ? 
      data.certification_recommendations : [];

    // Ensure scores are numbers
    data.overall_score = Number(data.overall_score) || 0;
    data.education_score = Number(data.education_score) || 0;
    data.experience_score = Number(data.experience_score) || 0;

    return data;
  }, []);

  // Update initializeAnalysis
  const initializeAnalysis = useCallback(async () => {
    if (!location.state?.resumeData) {
      setError('No resume data provided');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setProgress(0);

      // Start progress animation
      progressInterval.current = setInterval(() => {
        setProgress(prev => Math.min(prev + 5, 90));
      }, 500);

      const response = await fetch('http://localhost:5000/api/resumeanalysis/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(location.state.resumeData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to analyze resume');
      }

      const data = await response.json();
      const validatedData = validateAnalysisData(data);
      setAnalysis(validatedData);
      setProgress(100);

    } catch (error) {
      console.error('Analysis error:', error);
      setError(error.message || 'Failed to analyze resume');
      setAnalysis(null);
    } finally {
      clearInterval(progressInterval.current);
      setLoading(false);
    }
  }, [location.state, validateAnalysisData]);

  // Add cleanup effect
  useEffect(() => {
    return () => {
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
      }
    };
  }, []);

  if (loading) {
    return (
      <LoadingContainer>
        <CircularProgress size={60} />
        <Typography variant="h6">Analyzing your resume...</Typography>
        <Box sx={{ width: '100%', maxWidth: 400 }}>
          <LinearProgress variant="determinate" value={progress} />
        </Box>
        <Typography variant="body2" color="text.secondary">
          {progress < 30 ? 'Extracting text...' :
           progress < 60 ? 'Analyzing content...' :
           progress < 90 ? 'Generating insights...' :
           'Finalizing report...'}
        </Typography>
      </LoadingContainer>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography color="error" variant="h6">{error}</Typography>
        <Button 
          variant="contained" 
          onClick={() => navigate('/uploadresume')}
          sx={{ mt: 2 }}
        >
          Try Again
        </Button>
      </Box>
    );
  }

  if (!analysis) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="h6">No analysis data available</Typography>
        <Button 
          variant="contained" 
          onClick={() => navigate('/uploadresume')}
          sx={{ mt: 2 }}
        >
          Upload Resume
        </Button>
      </Box>
    );
  }

  return (
    <AnalysisContainer>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Typography variant="h4" component="h1">
          Resume Analysis Results
        </Typography>
        <Box>
          <Tooltip title="Share Analysis">
            <IconButton onClick={handleShare}>
              <ShareIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Download Report">
            <IconButton onClick={handleDownload}>
              <DownloadIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      <Grid container spacing={3}>
        {/* Overall Score Card */}
        <Grid item xs={12} md={4}>
          <MetricCard elevation={3}>
            <Typography variant="h6" gutterBottom>
              Overall Score
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <CircularProgress 
                variant="determinate" 
                value={analysis.overall_score} 
                size={80}
                thickness={4}
              />
              <Typography variant="h4">
                {analysis.overall_score}%
              </Typography>
            </Box>
          </MetricCard>
        </Grid>

        {/* Text Quality Card */}
        <Grid item xs={12} md={4}>
          <MetricCard elevation={3}>
            <Typography variant="h6" gutterBottom>
              Text Quality
            </Typography>
            <Typography variant="h4" color="primary">
              {analysis.text_quality.readability_score}%
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Readability Score
            </Typography>
          </MetricCard>
        </Grid>

        {/* Skills Match Card */}
        <Grid item xs={12} md={4}>
          <MetricCard elevation={3}>
            <Typography variant="h6" gutterBottom>
              Skills Match
            </Typography>
            <Typography variant="h4" color="primary">
              {analysis.skills_analysis.matched_skills.length}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Matched Skills
            </Typography>
          </MetricCard>
        </Grid>

        {/* Skills Analysis Chart */}
        <Grid item xs={12}>
          <Paper elevation={3} sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <AssessmentIcon />
              Skills Analysis
            </Typography>
            <Box sx={{ height: 300, mt: 2 }}>
              {renderRadarChart()}
            </Box>
          </Paper>
        </Grid>

        {/* Job Recommendations */}
        <Grid item xs={12}>
          <Typography variant="h5" gutterBottom sx={{ mt: 4, mb: 2 }}>
            <WorkIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            Recommended Jobs
          </Typography>
          <Grid container spacing={3}>
            {analysis.job_recommendations.map((job, index) => (
              <Grid item xs={12} md={4} key={index}>
                <MetricCard elevation={3}>
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="h6" gutterBottom>
                      {job.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      {job.description}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                      <Chip
                        label={`${job.match_percentage}% Match`}
                        color={job.match_percentage >= 80 ? 'success' : 
                               job.match_percentage >= 60 ? 'primary' : 
                               job.match_percentage >= 40 ? 'warning' : 'error'}
                        size="small"
                      />
                      <Chip
                        label={job.level}
                        variant="outlined"
                        size="small"
                      />
                    </Box>
                    <Typography variant="subtitle2" color="primary">
                      Salary Range: {job.salary_range}
                    </Typography>
                  </Box>
                  <Box sx={{ mt: 'auto' }}>
                    <Typography variant="subtitle2" gutterBottom>
                      Required Skills:
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
                      {job.required_skills?.slice(0, 3).map((skill, i) => (
                        <Chip
                          key={i}
                          label={skill}
                          size="small"
                          variant="outlined"
                          color="primary"
                        />
                      ))}
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2 }}>
                      <Chip
                        label={`Growth: ${job.growth_potential}`}
                        size="small"
                        color="success"
                      />
                      <Chip
                        label={`Demand: ${job.market_demand}`}
                        size="small"
                        color="info"
                      />
                    </Box>
                  </Box>
                </MetricCard>
              </Grid>
            ))}
          </Grid>
        </Grid>

        {/* Course and Certification Recommendations */}
        <Grid item xs={12}>
          <Typography variant="h5" gutterBottom sx={{ mt: 4, mb: 2 }}>
            <SchoolIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            Recommendations
          </Typography>
          <Grid container spacing={3}>
            {renderRecommendations()}
          </Grid>
        </Grid>

        {/* Skills Details */}
        <Grid item xs={12} md={6}>
          <MetricCard elevation={3}>
            <Typography variant="h6" gutterBottom>
              <CheckCircleIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
              Matched Skills
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {analysis.skills_analysis.matched_skills.map((skill, index) => (
                <Chip
                  key={index}
                  label={`${skill.name} (${skill.proficiency})`}
                  color="success"
                  variant="outlined"
                  sx={{ mb: 1 }}
                />
              ))}
              {analysis.skills_analysis.matched_skills.length === 0 && (
                <Typography variant="body2" color="text.secondary">
                  No matched skills found. Try adding more relevant skills to your resume.
                </Typography>
              )}
            </Box>
          </MetricCard>
        </Grid>

        <Grid item xs={12} md={6}>
          <MetricCard elevation={3}>
            <Typography variant="h6" gutterBottom>
              <WarningIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
              Missing Skills
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {analysis.skills_analysis.missing_skills.map((skill, index) => (
                <Chip
                  key={index}
                  label={`${skill.name} (${skill.market_demand})`}
                  color="warning"
                  variant="outlined"
                  sx={{ mb: 1 }}
                />
              ))}
              {analysis.skills_analysis.missing_skills.length === 0 && (
                <Typography variant="body2" color="text.secondary">
                  Great job! You have all the required skills.
                </Typography>
              )}
            </Box>
          </MetricCard>
        </Grid>
      </Grid>
    </AnalysisContainer>
  );
};

export default AIAnalysis; 