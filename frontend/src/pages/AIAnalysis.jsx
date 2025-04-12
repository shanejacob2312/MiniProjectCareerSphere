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
  TextField,
  Link,
  Card,
  CardContent,
  CardActions
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
  Edit as EditIcon,
  BusinessCenter as BusinessCenterIcon,
  OpenInNew as OpenInNewIcon
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

// Move validateAnalysisData before analyzeResume
const validateAnalysisData = (data) => {
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
  const [radarData, setRadarData] = useState([
    {
      subject: 'Text Quality',
      A: 0,
      fullMark: 100,
      description: 'Measures the clarity and professionalism of your writing'
    },
    {
      subject: 'Skills Match',
      A: 0,
      fullMark: 100,
      description: 'How well your skills match industry standards'
    },
    {
      subject: 'Education',
      A: 0,
      fullMark: 100,
      description: 'Assessment of your educational background'
    },
    {
      subject: 'Experience',
      A: 0,
      fullMark: 100,
      description: 'Evaluation of your work experience'
    },
    {
      subject: 'Overall',
      A: 0,
      fullMark: 100,
      description: 'Combined score of all factors'
    }
  ]);

  // Add new state for resume type
  const [resumeType, setResumeType] = useState('');

  // Update radar data when analysis changes
  useEffect(() => {
    if (analysis) {
        console.log('Updating radar data with analysis:', analysis);
        
        setRadarData([
            {
                subject: 'Text Quality',
                A: analysis.text_quality?.score || 0,
                fullMark: 100,
                description: 'Measures the clarity and professionalism of your writing'
            },
            {
                subject: 'Skills Match',
                A: analysis.skills_analysis?.skills_match_score || 0,
                fullMark: 100,
                description: 'How well your skills match industry standards'
            },
            {
                subject: 'Education',
                A: analysis.education_score || 0,
                fullMark: 100,
                description: 'Evaluation of your educational background'
            },
            {
                subject: 'Experience',
                A: analysis.experience_score || 0,
                fullMark: 100,
                description: 'Assessment of your work experience'
            }
        ]);
    }
}, [analysis]);

  // Clear intervals on unmount
  useEffect(() => {
    return () => {
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
      }
    };
  }, []);

  const validateResumeData = useCallback((data) => {
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid resume data format');
    }

    // Process skills array properly
    let processedSkills = [];
    if (Array.isArray(data.skills)) {
      processedSkills = data.skills
        .filter(Boolean)
        .map(skill => {
          if (typeof skill === 'string') {
            return { name: skill, level: 'intermediate' };
          }
          return {
            name: skill.name || '',
            level: skill.level || 'intermediate',
            years: skill.years || null
          };
        })
        .filter(skill => skill.name);
    }

    return {
      text: data.text || '',
      job_type: data.job_type || 'Software Developer',
      skills: processedSkills,
      education: Array.isArray(data.education) ? data.education.filter(Boolean) : [],
      experience: Array.isArray(data.experience) ? data.experience.filter(Boolean) : [],
      summary: data.summary || data.text || '',
      industry_sector: data.industry_sector || 'Technology'
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
      await response.text();
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

  const handleShare = useCallback(() => {
    if (navigator.share) {
      // Use Web Share API if available
      navigator.share({
        title: 'Resume Analysis Results',
        text: `Overall Score: ${analysis?.overall_score}%\nSkills Match: ${analysis?.skills_analysis?.industry_comparison?.overall_comparison || 0}%`,
        url: window.location.href
      }).catch(err => console.log('Error sharing:', err));
    } else {
      // Fallback to copying to clipboard
      const shareText = `Resume Analysis Results\n` +
        `Overall Score: ${analysis?.overall_score}%\n` +
        `Skills Match: ${analysis?.skills_analysis?.industry_comparison?.overall_comparison || 0}%`;
      
      navigator.clipboard.writeText(shareText)
        .then(() => alert('Analysis results copied to clipboard!'))
        .catch(err => console.error('Failed to copy:', err));
    }
  }, [analysis]);

  const processSkillsAnalysis = (skillsAnalysis) => {
    console.log('🔄 Processing skills analysis:', skillsAnalysis);

    if (!skillsAnalysis) {
      console.log('⚠️ No skills analysis data provided');
      return { matched_skills: [], missing_skills: [] };
    }

    // Define relevant technical skills and common words to exclude
    const commonWords = ['using', 'based', 'years', 'skills', 'expert', 'successfully', 'implemented', 'developed', 'leading'];
    const technicalSkills = ['python', 'react', 'node.js', 'aws', 'docker', 'kubernetes', 
      'git', 'agile', 'ci/cd', 'microservices', 'testing', 'javascript', 'html', 'css', 
      'rest', 'api', 'sql', 'database', 'cloud', 'development', 'software', 'engineering',
      'java', 'spring', 'angular', 'vue', 'typescript', 'mongodb', 'postgresql', 'redis',
      'elasticsearch', 'kafka', 'rabbitmq', 'graphql', 'react native', 'flutter', 'swift',
      'kotlin', 'android', 'ios', 'machine learning', 'ai', 'data science', 'devops'];

    // Process matched skills
    const matched = Array.isArray(skillsAnalysis.matched_skills) 
      ? skillsAnalysis.matched_skills
        .filter(skill => {
          const skillName = typeof skill === 'string' ? skill.toLowerCase() : skill.name?.toLowerCase();
          return skillName && 
                 !commonWords.includes(skillName) &&
                 (technicalSkills.includes(skillName) || 
                  technicalSkills.some(tech => skillName.includes(tech)));
        })
        .map(skill => {
          if (typeof skill === 'string') {
            return {
              name: skill,
              level: 'intermediate',
              years: null
            };
          }
          return {
            name: skill.name,
            level: skill.level || skill.proficiency || 'intermediate',
            years: skill.years || null
          };
        })
      : [];

    // Process missing skills
    const missing = Array.isArray(skillsAnalysis.missing_skills)
      ? skillsAnalysis.missing_skills
        .filter(skill => {
          const skillName = typeof skill === 'string' ? skill.toLowerCase() : skill.name?.toLowerCase();
          return skillName && 
                 !commonWords.includes(skillName) &&
                 (technicalSkills.includes(skillName) || 
                  technicalSkills.some(tech => skillName.includes(tech)));
        })
        .map(skill => ({
          name: typeof skill === 'string' ? skill : skill.name,
          required_level: typeof skill === 'object' ? skill.required_level || 'high' : 'high',
          market_demand: typeof skill === 'object' ? skill.market_demand || 'high' : 'high'
        }))
      : [];

    console.log('Processed matched skills:', matched);
    console.log('Processed missing skills:', missing);

    const result = {
      matched_skills: matched,
      missing_skills: missing,
      skills_match_score: (matched.length / (matched.length + missing.length)) * 100 || 0
    };

    console.log('✅ Processed skills analysis result:', result);
    return result;
  };

  // Update analyzeResume to include detailed logging
  const analyzeResume = useCallback(async () => {
    if (!location.state?.resumeData) {
        console.log('❌ No resume data provided in location state');
        setError('No resume data provided');
        setLoading(false);
        return;
    }

    try {
        setLoading(true);
        setError(null);
        setProgress(0);

        console.log('🔄 Starting resume analysis...');
        console.log('📄 Initial resume data:', location.state.resumeData);

        // Start progress animation
        progressInterval.current = setInterval(() => {
            setProgress(prev => {
                const newProgress = Math.min(prev + 1, 90);
                console.log(`⏳ Analysis progress: ${newProgress}%`);
                return newProgress;
            });
        }, 500);

        const token = localStorage.getItem('token');
        if (!token) {
            console.log('❌ Authentication token missing');
            throw new Error('Authentication required');
        }

        const resumeData = location.state.resumeData;
        console.log('🔍 Processing resume type:', resumeData.type || 'created');
        setResumeType(resumeData.type || 'created');

        // Format request data based on resume type
        const requestData = {
            text: resumeData.text || '',
            job_type: resumeData.job_type || resumeData.jobType || '',
            location: resumeData.location || '',
            type: resumeData.type || 'created',
            skills: Array.isArray(resumeData.skills) ? resumeData.skills.flatMap(skill => {
                // Split the skills string by newlines and process each skill
                return skill.name.split('\n').map(skillStr => {
                    // Extract skill name, level, and years
                    const match = skillStr.match(/([^-]+)\s*-\s*(\w+)\s*\((\d+)\s*years?\)/);
                    if (match) {
                        return {
                            name: match[1].trim(),
                            level: match[2],
                            yearsOfExperience: parseInt(match[3])
                        };
                    }
                    return {
                        name: skillStr.trim(),
                        level: 'Intermediate',
                        yearsOfExperience: 0
                    };
                });
            }) : [],
            education: Array.isArray(resumeData.education) ? resumeData.education.map(edu => ({
                degree: edu.degree || '',
                institution: edu.institution || '',
                year: edu.year || '',
                gpa: edu.gpa || '',
                honors: edu.honors || ''
            })) : [],
            experience: [
                {
                    title: 'Senior Software Engineer',
                    company: 'Tech Innovation Corp',
                    duration: '2019-2023',
                    description: 'Led development of cloud-native applications, mentored junior developers, and implemented agile methodologies. Reduced cloud costs by 35% through optimization of AWS resources. Introduced Kubernetes for container orchestration, improving system reliability by 99.99%.'
                },
                {
                    title: 'Software Engineer',
                    company: 'Digital Solutions Inc',
                    duration: '2015-2018',
                    description: 'Developed full-stack applications using React and Node.js. Implemented automated testing reducing bugs in production by 70%. Led migration from monolithic to microservices architecture.'
                }
            ],
            summary: resumeData.summary || ''
        };

        // Add type-specific fields
        if (resumeData.type === 'uploaded') {
            requestData.structure_score = resumeData.structure_score || 0;
            requestData.formatting = resumeData.formatting || {};
            requestData.parsed_sections = resumeData.parsed_sections || {};
        }

        console.log('📤 Sending analysis request with data:', JSON.stringify(requestData, null, 2));

        const response = await fetch('http://localhost:5000/api/resumeanalysis/analyze', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(requestData)
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.log('❌ Analysis request failed:', errorData);
            throw new Error(errorData.message || 'Failed to analyze resume');
        }

        const data = await response.json();
        console.log('📥 Received analysis response:', JSON.stringify(data, null, 2));

        const validatedData = validateAnalysisData(data);
        console.log('✅ Validated analysis data:', JSON.stringify(validatedData, null, 2));

        // Log specific sections of the analysis
        console.log('📊 Skills Analysis:', {
            matched_skills: validatedData.skills_analysis.matched_skills,
            missing_skills: validatedData.skills_analysis.missing_skills,
            skills_match_score: validatedData.skills_analysis.skills_match_score
        });

        console.log('📈 Scores:', {
            overall: validatedData.overall_score,
            education: validatedData.education_score,
            experience: validatedData.experience_score,
            text_quality: validatedData.text_quality
        });

        console.log('💡 Recommendations:', {
            jobs: validatedData.job_recommendations,
            courses: validatedData.course_recommendations,
            certifications: validatedData.certification_recommendations
        });

        setAnalysis(validatedData);
        setProgress(100);
        console.log('✨ Analysis complete!');

    } catch (error) {
        console.error('Error in analyzeResume:', error);
        setError('Failed to analyze resume: ' + error.message);
    } finally {
        clearInterval(progressInterval.current);
        setLoading(false);
    }
}, [location.state?.resumeData]);

  // Render skills section
  const renderSkillsSection = () => {
    if (!analysis?.skills_analysis) {
      console.log('No skills analysis data available');
      return null;
    }

    const { matched_skills = [], missing_skills = [], skills_match_score = 0 } = analysis.skills_analysis;
    
    console.log('Rendering skills section:', {
      matched_skills,
      missing_skills,
      skills_match_score
    });
    
    return (
      <>
        <Typography variant="h6" gutterBottom>
          <AssessmentIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
          Skills Analysis
        </Typography>
        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <Typography variant="subtitle1">
              Skills Match
            </Typography>
            <Chip
              label={`${Math.round(skills_match_score)}% Match`}
              color={skills_match_score >= 80 ? 'success' : 
                     skills_match_score >= 60 ? 'primary' : 
                     skills_match_score >= 40 ? 'warning' : 'error'}
              variant="outlined"
            />
          </Box>
          <Typography variant="subtitle1" gutterBottom>
            Your Technical Skills ({matched_skills.length})
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {matched_skills.map((skill, index) => (
              <Tooltip 
                key={index} 
                title={
                  `Level: ${skill.level || 'Not specified'}
                  ${skill.years ? `\nExperience: ${skill.years} years` : ''}`
                }
              >
                <Chip
                  label={skill.name}
                  color="primary"
                  variant="outlined"
                />
              </Tooltip>
            ))}
            {matched_skills.length === 0 && (
              <Typography variant="body2" color="text.secondary">
                No matched skills found. Try adding more relevant skills to your resume.
              </Typography>
            )}
          </Box>
        </Box>
        <Box>
          <Typography variant="subtitle1" gutterBottom>
            Suggested Skills for Growth
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Based on job market demand and your profile
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {missing_skills.map((skill, index) => (
              <Tooltip 
                key={index} 
                title={`Market Demand: ${skill.market_demand || 'High'}\nRequired Level: ${skill.required_level || 'High'}`}
              >
                <Chip
                  label={skill.name}
                  color="info"
                  variant="outlined"
                />
              </Tooltip>
            ))}
            {missing_skills.length === 0 && (
              <Typography variant="body2" color="text.secondary">
                Great job! Your skills align well with industry standards.
              </Typography>
            )}
          </Box>
        </Box>
      </>
    );
  };

  // Render recommendations
  const renderRecommendations = () => {
    if (!analysis) return null;

    const { job_recommendations = [], course_recommendations = [], certification_recommendations = [] } = analysis;

    return (
      <Grid container spacing={3}>
        {/* Job Recommendations */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Recommended Jobs
            </Typography>
            {job_recommendations.length > 0 ? (
              <List>
                {job_recommendations.map((job, index) => (
                  <ListItem key={index} divider>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="subtitle1">
                            {job.title}
                          </Typography>
                          <Chip 
                            label={job.company} 
                            size="small" 
                            color="primary" 
                            sx={{ ml: 1 }} 
                          />
                          <Chip 
                            label={job.location} 
                            size="small" 
                            variant="outlined" 
                          />
                        </Box>
                      }
                      secondary={
                        <Box>
                          <Typography variant="body2" color="text.secondary" paragraph>
                            {job.description}
                          </Typography>
                          <Box sx={{ mt: 1 }}>
                            <Chip 
                              label={job.experience_level} 
                              size="small" 
                              color="primary" 
                              sx={{ mr: 1 }} 
                            />
                            <Chip 
                              label={`${Math.round(job.match_score)}% Match`}
                              size="small"
                              color="success"
                              sx={{ mr: 1 }}
                            />
                            <Chip 
                              label={job.salary_range} 
                              size="small" 
                              variant="outlined" 
                            />
                          </Box>
                          <Box sx={{ mt: 1 }}>
                            <Typography variant="caption" color="text.secondary">
                              Match Details:
                            </Typography>
                            <Typography variant="body2">
                              {job.match_details}
                            </Typography>
                          </Box>
                          {Array.isArray(job.matched_skills) && job.matched_skills.length > 0 && (
                            <Box sx={{ mt: 1 }}>
                              <Typography variant="caption" color="text.secondary">
                                Matched Skills:
                              </Typography>
                              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                                {job.matched_skills.map((skill, skillIndex) => (
                                  <Chip
                                    key={skillIndex}
                                    label={skill}
                                    size="small"
                                    color="success"
                                    variant="outlined"
                                  />
                                ))}
                              </Box>
                            </Box>
                          )}
                          {Array.isArray(job.missing_skills) && job.missing_skills.length > 0 && (
                            <Box sx={{ mt: 1 }}>
                              <Typography variant="caption" color="text.secondary">
                                Skills to Develop:
                              </Typography>
                              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                                {job.missing_skills.map((skill, skillIndex) => (
                                  <Chip
                                    key={skillIndex}
                                    label={skill}
                                    size="small"
                                    color="error"
                                    variant="outlined"
                                  />
                                ))}
                              </Box>
                            </Box>
                          )}
                          {job.job_link && (
                            <Box sx={{ mt: 1 }}>
                              <Link 
                                href={job.job_link}
                                target="_blank"
                                rel="noopener noreferrer"
                                sx={{
                                  color: 'primary.main',
                                  textDecoration: 'none',
                                  '&:hover': {
                                    textDecoration: 'underline',
                                  },
                                }}
                              >
                                <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                  <OpenInNewIcon sx={{ fontSize: 14 }} />
                                  Apply for this position
                                </Typography>
                              </Link>
                            </Box>
                          )}
                        </Box>
                      }
                    />
                  </ListItem>
                ))}
              </List>
            ) : (
              <Typography color="text.secondary">
                Based on your current resume, no matching jobs are available in your area. Consider updating your skills or expanding your job search area.
              </Typography>
            )}
          </Paper>
        </Grid>

        {/* Course Recommendations */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Recommended Courses
            </Typography>
            {course_recommendations.length > 0 ? (
              <List>
                {course_recommendations.map((course, index) => (
                  <ListItem key={index} divider>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="subtitle1">
                            {course.title}
                          </Typography>
                          <Chip 
                            label={course.provider} 
                            size="small" 
                            color="primary" 
                            sx={{ ml: 1 }} 
                          />
                        </Box>
                      }
                      secondary={
                        <Box>
                          <Typography variant="body2" color="text.secondary" paragraph>
                            {course.description}
                          </Typography>
                          <Box sx={{ mt: 1 }}>
                            <Chip 
                              label={course.level} 
                              size="small" 
                              color="primary" 
                              sx={{ mr: 1 }} 
                            />
                            <Chip 
                              label={`${Math.round(course.match_score)}% Match`}
                              size="small"
                              color="success"
                              sx={{ mr: 1 }}
                            />
                            <Chip 
                              label={course.duration} 
                              size="small" 
                              variant="outlined" 
                              sx={{ mr: 1 }}
                            />
                            <Chip 
                              label={`${course.rating}/5`} 
                              size="small" 
                              variant="outlined" 
                              sx={{ mr: 1 }}
                            />
                            <Chip 
                              label={`${course.students_count} students`} 
                              size="small" 
                              variant="outlined" 
                            />
                          </Box>
                          {Array.isArray(course.skills_covered) && course.skills_covered.length > 0 && (
                            <Box sx={{ mt: 1 }}>
                              <Typography variant="caption" color="text.secondary">
                                Skills Covered:
                              </Typography>
                              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                                {course.skills_covered.map((skill, skillIndex) => (
                                  <Chip
                                    key={skillIndex}
                                    label={skill}
                                    size="small"
                                    variant="outlined"
                                  />
                                ))}
                              </Box>
                            </Box>
                          )}
                          {Array.isArray(course.prerequisites) && course.prerequisites.length > 0 && (
                            <Box sx={{ mt: 1 }}>
                              <Typography variant="caption" color="text.secondary">
                                Prerequisites:
                              </Typography>
                              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                                {course.prerequisites.map((prereq, prereqIndex) => (
                                  <Chip
                                    key={prereqIndex}
                                    label={prereq}
                                    size="small"
                                    variant="outlined"
                                    color="warning"
                                  />
                                ))}
                              </Box>
                            </Box>
                          )}
                          <Box sx={{ mt: 1 }}>
                            <Typography variant="caption" color="text.secondary">
                              Instructor: {course.instructor}
                            </Typography>
                          </Box>
                          {course.course_link && (
                            <Box sx={{ mt: 1 }}>
                              <Link 
                                href={course.course_link}
                                target="_blank"
                                rel="noopener noreferrer"
                                sx={{
                                  color: 'primary.main',
                                  textDecoration: 'none',
                                  '&:hover': {
                                    textDecoration: 'underline',
                                  },
                                }}
                              >
                                <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                  <OpenInNewIcon sx={{ fontSize: 14 }} />
                                  Enroll in this course
                                </Typography>
                              </Link>
                            </Box>
                          )}
                        </Box>
                      }
                    />
                  </ListItem>
                ))}
              </List>
            ) : (
              <Typography color="text.secondary">
                No course recommendations available at your current skill level. Consider updating your resume with more details about your experience and skills.
              </Typography>
            )}
          </Paper>
        </Grid>

        {/* Certification Recommendations */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Recommended Certifications
            </Typography>
            {certification_recommendations.length > 0 ? (
              <List>
                {certification_recommendations.map((cert, index) => (
                  <ListItem key={index} divider>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="subtitle1">
                            {cert.title}
                          </Typography>
                          <Chip 
                            label={cert.provider} 
                            size="small" 
                            color="primary" 
                            sx={{ ml: 1 }} 
                          />
                        </Box>
                      }
                      secondary={
                        <Box>
                          <Typography variant="body2" color="text.secondary" paragraph>
                            {cert.description}
                          </Typography>
                          <Box sx={{ mt: 1 }}>
                            <Chip 
                              label={cert.level} 
                              size="small" 
                              color="primary" 
                              sx={{ mr: 1 }} 
                            />
                            <Chip 
                              label={`${Math.round(cert.match_score)}% Match`}
                              size="small"
                              color="success"
                              sx={{ mr: 1 }}
                            />
                            <Chip 
                              label={cert.duration} 
                              size="small" 
                              variant="outlined" 
                              sx={{ mr: 1 }}
                            />
                            <Chip 
                              label={cert.exam_format} 
                              size="small" 
                              variant="outlined" 
                            />
                          </Box>
                          {Array.isArray(cert.skills_validated) && cert.skills_validated.length > 0 && (
                            <Box sx={{ mt: 1 }}>
                              <Typography variant="caption" color="text.secondary">
                                Skills Validated:
                              </Typography>
                              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                                {cert.skills_validated.map((skill, skillIndex) => (
                                  <Chip
                                    key={skillIndex}
                                    label={skill}
                                    size="small"
                                    variant="outlined"
                                  />
                                ))}
                              </Box>
                            </Box>
                          )}
                          {Array.isArray(cert.prerequisites) && cert.prerequisites.length > 0 && (
                            <Box sx={{ mt: 1 }}>
                              <Typography variant="caption" color="text.secondary">
                                Prerequisites:
                              </Typography>
                              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                                {cert.prerequisites.map((prereq, prereqIndex) => (
                                  <Chip
                                    key={prereqIndex}
                                    label={prereq}
                                    size="small"
                                    variant="outlined"
                                    color="warning"
                                  />
                                ))}
                              </Box>
                            </Box>
                          )}
                          <Box sx={{ mt: 1 }}>
                            <Typography variant="caption" color="text.secondary">
                              Validity Period: {cert.validity_period}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                              Career Impact: {cert.career_impact}
                            </Typography>
                          </Box>
                          {cert.cert_link && (
                            <Box sx={{ mt: 1 }}>
                              <Link 
                                href={cert.cert_link}
                                target="_blank"
                                rel="noopener noreferrer"
                                sx={{
                                  color: 'primary.main',
                                  textDecoration: 'none',
                                  '&:hover': {
                                    textDecoration: 'underline',
                                  },
                                }}
                              >
                                <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                  <OpenInNewIcon sx={{ fontSize: 14 }} />
                                  Learn more about this certification
                                </Typography>
                              </Link>
                            </Box>
                          )}
                        </Box>
                      }
                    />
                  </ListItem>
                ))}
              </List>
            ) : (
              <Typography color="text.secondary">
                No certification recommendations available at your current skill level. Consider updating your resume with more details about your experience and skills.
              </Typography>
            )}
          </Paper>
        </Grid>
      </Grid>
    );
  };

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

  // Add function to render resume structure analysis (for uploaded resumes)
  const renderStructureAnalysis = () => {
    if (resumeType !== 'uploaded' || !analysis?.structure_analysis) return null;

    return (
      <Grid item xs={12}>
        <Paper elevation={3} sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Resume Structure Analysis
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Box>
                <Typography variant="subtitle1" gutterBottom>
                  Format Quality
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={analysis.structure_analysis.format_score || 0}
                  sx={{ mb: 1, height: 8, borderRadius: 4 }}
                />
                <Typography variant="body2" color="text.secondary">
                  {analysis.structure_analysis.format_feedback || 'No feedback available'}
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} md={6}>
              <Box>
                <Typography variant="subtitle1" gutterBottom>
                  Section Organization
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={analysis.structure_analysis.section_score || 0}
                  sx={{ mb: 1, height: 8, borderRadius: 4 }}
                />
                <Typography variant="body2" color="text.secondary">
                  {analysis.structure_analysis.section_feedback || 'No feedback available'}
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </Paper>
      </Grid>
    );
  };

  // Add cleanup effect
  useEffect(() => {
    return () => {
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
      }
    };
  }, []);

  // Update useEffect to include all dependencies
  useEffect(() => {
    const startAnalysis = async () => {
      const serverRunning = await checkServerStatus();
      if (serverRunning) {
        await analyzeResume();
      }
    };
    startAnalysis();
  }, [checkServerStatus, analyzeResume]);

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
          {resumeType && (
            <Chip
              label={resumeType === 'created' ? 'Created Resume' : 'Uploaded Resume'}
              color="primary"
              size="small"
              sx={{ ml: 2 }}
            />
          )}
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
            <Box sx={{ position: 'relative', display: 'inline-flex', mt: 2 }}>
              <CircularProgress
                variant="determinate"
                value={analysis.overall_score || 0}
                size={80}
                thickness={4}
                color="primary"
              />
              <Box
                sx={{
                  top: 0,
                  left: 0,
                  bottom: 0,
                  right: 0,
                  position: 'absolute',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Typography variant="h5" component="div">
                  {analysis.overall_score || 0}%
                </Typography>
              </Box>
            </Box>
          </MetricCard>
        </Grid>

        {/* Text Quality Card */}
        <Grid item xs={12} md={4}>
          <MetricCard elevation={3}>
            <Typography variant="h6" gutterBottom>
              Text Quality
            </Typography>
            <Box sx={{ mt: 2 }}>
              <Typography variant="h5" color="primary">
                {analysis.text_quality?.score || 0}%
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Readability: {analysis.text_quality?.readability || 'N/A'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Clarity: {analysis.text_quality?.clarity || 'N/A'}
              </Typography>
            </Box>
          </MetricCard>
        </Grid>

        {/* Skills Match Card */}
        <Grid item xs={12} md={4}>
          <MetricCard elevation={3}>
            <Typography variant="h6" gutterBottom>
              Skills Match
            </Typography>
            <Box sx={{ mt: 2 }}>
              <Typography variant="h5" color="primary">
                {analysis.skills_analysis?.skills_match_score || 0}%
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Industry Match
              </Typography>
            </Box>
          </MetricCard>
        </Grid>

        {/* Resume Structure Analysis (Only for uploaded resumes) */}
        {renderStructureAnalysis()}

        {/* Skills Analysis Chart */}
        <Grid item xs={12}>
          <Paper elevation={3} sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <AssessmentIcon />
              Skills Analysis
            </Typography>
            <Box sx={{ width: '100%', height: 400 }}>
              <ResponsiveContainer>
                <RadarChart data={radarData}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="subject" />
                  <PolarRadiusAxis angle={90} domain={[0, 100]} />
                  <Radar
                    name="Score"
                    dataKey="A"
                    stroke={theme.palette.primary.main}
                    fill={theme.palette.primary.main}
                    fillOpacity={0.6}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </Box>
          </Paper>
        </Grid>

        {/* Detailed Skills Analysis */}
        <Grid item xs={12}>
          <Paper elevation={3} sx={{ p: 3 }}>
            {renderSkillsSection()}
          </Paper>
        </Grid>

        {/* Job Recommendations */}
        <Grid item xs={12}>
          <Typography variant="h5" gutterBottom sx={{ mt: 4, mb: 2 }}>
            <WorkIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            Recommended Jobs {analysis.location ? `in ${analysis.location}` : ''}
          </Typography>
          {renderRecommendations()}
        </Grid>

        {/* Skills Details */}
        <Grid item xs={12} md={6}>
          <MetricCard elevation={3}>
            <Typography variant="h6" gutterBottom>
              <CheckCircleIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
              Matched Skills
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {(analysis?.skills_analysis?.matched_skills || []).map((skill, index) => (
                <Chip
                  key={index}
                  label={typeof skill === 'string' ? skill : `${skill.name} (${skill.level || 'N/A'})`}
                  color="success"
                  variant="outlined"
                  sx={{ mb: 1 }}
                />
              ))}
              {(!analysis?.skills_analysis?.matched_skills || analysis.skills_analysis.matched_skills.length === 0) && (
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
              Suggested Skills
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {(analysis?.skills_analysis?.missing_skills || []).map((skill, index) => (
                <Chip
                  key={index}
                  label={typeof skill === 'string' ? skill : `${skill.name} (${skill.demand || 'High'})`}
                  color="info"
                  variant="outlined"
                  sx={{ mb: 1 }}
                />
              ))}
              {(!analysis?.skills_analysis?.missing_skills || analysis.skills_analysis.missing_skills.length === 0) && (
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