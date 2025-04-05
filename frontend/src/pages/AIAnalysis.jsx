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
  Link
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
  const [analysis, setAnalysis] = useState({
    skills_analysis: {
      matched_skills: [],
      missing_skills: [],
      skills_match_score: 0
    },
    text_quality: {
      score: 0,
      readability: 'Good',
      clarity: 'Good'
    },
    education_score: 0,
    experience_score: 0,
    overall_score: 0,
    recommendations: {
      courses: [],
      certifications: [],
      jobs: []
    }
  });
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
    if (!skillsAnalysis) return { matched_skills: [], missing_skills: [] };

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

    return {
      matched_skills: matched,
      missing_skills: missing
    };
  };

  const analyzeResume = useCallback(async () => {
    try {
      const resumeData = location.state?.resumeData;
      if (!resumeData) {
        throw new Error('No resume data available for analysis');
      }

      console.log('Initial resume data:', resumeData);

      const validatedData = validateResumeData(resumeData);
      console.log('Validated resume data:', validatedData);

      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/login', { state: { from: location } });
        return;
      }

      setProgress(0);
      progressInterval.current = setInterval(() => {
        setProgress(prev => prev < 90 ? prev + 10 : prev);
      }, 500);

      const requestBody = {
        ...validatedData,
        request_recommendations: true,
        request_scores: true,
        generate_recommendations: true,
        analyze_skills: true,
        compare_to_industry: true,
        current_skills: Array.isArray(validatedData.skills) ? validatedData.skills.map(skill => {
          if (typeof skill !== 'string') return null;
          // Parse skill string like "React - Master (5 years)"
          const matches = skill.match(/(.+?)\s*-\s*(\w+)\s*\((\d+)\s*years?\)/);
          if (matches) {
            const [, name, level, years] = matches;
            return {
              name: name.trim(),
              level: level.trim(),
              years: parseInt(years)
            };
          }
          // Fallback if skill string doesn't match expected format
          const parts = skill.split('-').map(s => s.trim());
          return {
            name: parts[0] || '',
            level: parts[1] || 'Intermediate',
            years: 0
          };
        }).filter(Boolean) : [],
        job_preferences: {
          job_type: validatedData.job_type || 'software developer',
          industry_sector: validatedData.industry_sector || 'Technology',
          experience_level: validatedData.experience?.length > 0 
            ? (validatedData.experience[0].title?.toLowerCase().includes('senior') ? 'Senior' : 'Mid-Level')
            : 'Entry-Level',
          education_level: validatedData.education?.length > 0 
            ? validatedData.education[0].degree?.toLowerCase().includes('master') 
              ? 'Masters' 
              : validatedData.education[0].degree?.toLowerCase().includes('bachelor')
                ? 'Bachelors'
                : 'Other'
            : 'Other'
        }
      };

      console.log('Sending request with skills and preferences:', {
        skills: requestBody.current_skills,
        preferences: requestBody.job_preferences
      });

      const response = await fetch('http://localhost:5000/api/resumeanalysis/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Server response error:', errorText);
        throw new Error(`Failed to analyze resume: ${errorText}`);
      }

      const data = await response.json();
      console.log('Raw response data:', data);

      // Process recommendations based on user's skills
      const courseRecommendations = Array.isArray(data.course_recommendations) ? 
        data.course_recommendations
          .filter((course, index, self) => 
            // Remove duplicates based on title
            index === self.findIndex((c) => c.name === course.name)
          )
          .map(course => ({
            name: course.name || course.title || '',
            description: course.description || '',
            provider: course.provider || '',
            level: course.level || 'Intermediate',
            match_score: course.match_score || course.match_percentage || 0,
            skills_covered: Array.isArray(course.skills_covered) ? course.skills_covered : [],
            prerequisites: Array.isArray(course.prerequisites) ? course.prerequisites : [],
            skill_improvements: Array.isArray(course.skill_improvements) ? course.skill_improvements : [],
            // Add Udemy course data if available
            udemy_courses: Array.isArray(course.udemy_courses) ? course.udemy_courses : [],
            // Add direct course link
            course_link: course.course_link || course.link || ''
          })) : [];

      // Ensure minimum 3 courses
      if (courseRecommendations.length < 3) {
        // Add default courses if needed
        const defaultCourses = [
          {
            name: "Introduction to Programming",
            description: "Learn the fundamentals of programming and software development",
            provider: "Coursera",
            level: "Beginner",
            match_score: 85,
            skills_covered: ["Programming Basics", "Problem Solving", "Logic"],
            course_link: "https://www.coursera.org/learn/intro-programming"
          },
          {
            name: "Web Development Fundamentals",
            description: "Master the basics of web development and front-end technologies",
            provider: "edX",
            level: "Intermediate",
            match_score: 80,
            skills_covered: ["HTML", "CSS", "JavaScript"],
            course_link: "https://www.edx.org/course/web-development-fundamentals"
          },
          {
            name: "Data Structures and Algorithms",
            description: "Learn essential computer science concepts and problem-solving techniques",
            provider: "Udacity",
            level: "Advanced",
            match_score: 75,
            skills_covered: ["Data Structures", "Algorithms", "Problem Solving"],
            course_link: "https://www.udacity.com/course/data-structures-and-algorithms"
          }
        ];

        // Add default courses only if they don't already exist
        defaultCourses.forEach(defaultCourse => {
          if (!courseRecommendations.some(course => course.name === defaultCourse.name)) {
            courseRecommendations.push(defaultCourse);
          }
        });
      }

      const certificationRecommendations = Array.isArray(data.certification_recommendations) ? 
        data.certification_recommendations.map(cert => ({
          name: cert.name || cert.title || '',
          description: cert.description || '',
          provider: cert.provider || '',
          level: cert.level || 'Professional',
          match_score: cert.match_score || cert.match_percentage || 0,
          skills_validated: Array.isArray(cert.skills_validated) ? cert.skills_validated : [],
          required_skills: Array.isArray(cert.required_skills) ? cert.required_skills : [],
          matched_skills: Array.isArray(cert.matched_skills) ? cert.matched_skills : [],
          career_impact: cert.career_impact || 'High'
        })) : [];

      const jobRecommendations = Array.isArray(data.job_recommendations) ? 
        data.job_recommendations.map(job => ({
          title: job.title || job.name || '',
          description: job.description || '',
          level: job.level || 'Mid-Level',
          salary_range: job.salary_range || 'Competitive',
          match_score: job.match_score || job.match_percentage || 0,
          required_skills: Array.isArray(job.required_skills) ? job.required_skills : [],
          matched_skills: Array.isArray(job.matched_skills) ? job.matched_skills : [],
          missing_skills: Array.isArray(job.missing_skills) ? job.missing_skills : [],
          growth_potential: job.growth_potential || 'High',
          market_demand: job.market_demand || 'High'
        })) : [];

      console.log('Processed recommendations:', {
        courses: courseRecommendations,
        certifications: certificationRecommendations,
        jobs: jobRecommendations
      });

      // Create new radar data with the scores
      const newRadarData = [
        {
          subject: 'Text Quality',
          A: Math.round(data.text_quality?.readability_score || 0),
          fullMark: 100,
          description: 'Measures the clarity and professionalism of your writing'
        },
        {
          subject: 'Skills Match',
          A: Math.round(data.skill_match || 0),
          fullMark: 100,
          description: 'How well your skills match industry standards'
        },
        {
          subject: 'Education',
          A: Math.round(data.education_score || 0),
          fullMark: 100,
          description: 'Assessment of your educational background'
        },
        {
          subject: 'Experience',
          A: Math.round(data.experience_score || 0),
          fullMark: 100,
          description: 'Evaluation of your work experience'
        },
        {
          subject: 'Overall',
          A: Math.round(data.overall_score || 0),
          fullMark: 100,
          description: 'Combined score of all factors'
        }
      ];

      console.log('New radar data:', newRadarData);

      // Process the data into our expected format
      const processedData = {
        skills_analysis: {
          matched_skills: Array.isArray(data.skills_analysis?.matched_skills) ? 
            data.skills_analysis.matched_skills.map(skill => ({
              name: skill.name || skill,
              level: skill.level || 'Intermediate',
              years: skill.years || null
            })) : [],
          missing_skills: Array.isArray(data.skills_analysis?.missing_skills) ? 
            data.skills_analysis.missing_skills.map(skill => ({
              name: skill.name || skill,
              required_level: skill.required_level || 'High',
              market_demand: skill.market_demand || 'High'
            })) : [],
          skills_match_score: data.skill_match || 0
        },
        text_quality: {
          score: data.text_quality?.readability_score || 0,
          readability: data.text_quality?.readability || 'Good',
          clarity: data.text_quality?.clarity || 'Good'
        },
        education_score: data.education_score || 0,
        experience_score: data.experience_score || 0,
        overall_score: data.overall_score || 0,
        recommendations: {
          courses: courseRecommendations,
          certifications: certificationRecommendations,
          jobs: jobRecommendations
        }
      };

      console.log('Processed data:', processedData);

      // Update state with new data
      setRadarData(newRadarData);
      setAnalysis(processedData);
      setLoading(false);

    } catch (err) {
      console.error('Analysis failed:', err);
      setError(err.message || 'Error analyzing resume. Please try again later.');
    } finally {
      setLoading(false);
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
      }
    }
  }, [location, navigate, validateResumeData]);

  // Update the renderSkillsSection function
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

  // Update the renderRecommendations function
  const renderRecommendations = () => {
    if (!analysis?.recommendations) return null;

    const { courses = [], certifications = [], jobs = [] } = analysis.recommendations;

    console.log('Rendering recommendations:', { courses, certifications, jobs });

    return (
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <RecommendationCard elevation={3}>
            <Typography variant="h6" gutterBottom>
              <SchoolIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
              AI-Recommended Courses
            </Typography>
            <List>
              {courses && courses.length > 0 ? (
                courses.map((course, index) => (
                  <ListItem key={index} divider={index < courses.length - 1}>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="subtitle1">
                            {course.name}
                          </Typography>
                          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                            {course.course_link && (
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
                                  View Course
                                </Typography>
                              </Link>
                            )}
                            {course.udemy_courses && course.udemy_courses.length > 0 && (
                              course.udemy_courses.map((udemyCourse, udemyIndex) => (
                                <Link 
                                  key={udemyIndex}
                                  href={udemyCourse.udemy_link}
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
                                    View on Udemy
                                  </Typography>
                                </Link>
                              ))
                            )}
                          </Box>
                        </Box>
                      }
                      secondary={
                        <Box>
                          <Typography variant="body2" color="text.secondary">
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
                            {course.udemy_courses && course.udemy_courses[0] && (
                              <>
                                <Chip 
                                  label={`${course.udemy_courses[0].duration}`} 
                                  size="small" 
                                  variant="outlined" 
                                  sx={{ mr: 1 }} 
                                />
                                <Chip 
                                  label={`${course.udemy_courses[0].rating}/5`} 
                                  size="small" 
                                  variant="outlined" 
                                  sx={{ mr: 1 }}
                                />
                                <Chip 
                                  label={`${course.udemy_courses[0].students_count} students`} 
                                  size="small" 
                                  variant="outlined" 
                                />
                              </>
                            )}
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
                          {course.udemy_courses && course.udemy_courses[0] && (
                            <Box sx={{ mt: 1 }}>
                              <Typography variant="caption" color="text.secondary">
                                Instructor: {course.udemy_courses[0].instructor}
                              </Typography>
                              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                Last Updated: {new Date(course.udemy_courses[0].last_updated).toLocaleDateString()}
                              </Typography>
                            </Box>
                          )}
                        </Box>
                      }
                    />
                  </ListItem>
                ))
              ) : (
                <ListItem>
                  <ListItemText 
                    primary="Analyzing Your Skills..."
                    secondary="Please wait while we find courses that match your skill level and career goals"
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
              AI-Recommended Certifications
            </Typography>
            <List>
              {certifications && certifications.length > 0 ? (
                certifications.map((cert, index) => (
                  <ListItem key={index} divider={index < certifications.length - 1}>
                    <ListItemText
                      primary={cert.name}
                      secondary={
                        <>
                          <Typography variant="body2">{cert.description}</Typography>
                          <Box sx={{ mt: 1 }}>
                            <Chip 
                              size="small" 
                              label={`Match: ${Math.round(cert.match_score)}%`}
                              color="primary"
                              sx={{ mr: 1, mb: 1 }}
                            />
                            {cert.provider && (
                              <Chip size="small" label={`Provider: ${cert.provider}`} sx={{ mr: 1, mb: 1 }} />
                            )}
                            {cert.level && (
                              <Chip size="small" label={`Level: ${cert.level}`} sx={{ mr: 1, mb: 1 }} />
                            )}
                          </Box>
                          {Array.isArray(cert.required_skills) && cert.required_skills.length > 0 && (
                            <Box sx={{ mt: 1 }}>
                              <Typography variant="caption" color="text.secondary">
                                Required Skills:
                              </Typography>
                              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                                {cert.required_skills.map((skill, i) => (
                                  <Chip
                                    key={i}
                                    label={skill}
                                    size="small"
                                    variant="outlined"
                                    color={cert.matched_skills?.includes(skill) ? "success" : "warning"}
                                  />
                                ))}
                              </Box>
                            </Box>
                          )}
                        </>
                      }
                    />
                  </ListItem>
                ))
              ) : (
                <ListItem>
                  <ListItemText 
                    primary="Analyzing Your Skills..."
                    secondary="Please wait while we find certifications that validate your expertise"
                  />
                </ListItem>
              )}
            </List>
          </RecommendationCard>
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

  // Add useEffect to trigger analysis on mount
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
              {analysis.text_quality.score}%
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
              {analysis.skills_analysis.skills_match_score}%
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Industry Match
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
            {(analysis?.recommendations?.jobs || []).map((job, index) => (
              <Grid item xs={12} md={4} key={index}>
                <MetricCard elevation={3}>
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="h6" gutterBottom>
                      {job.title || job.name || 'Job Title'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      {job.description || 'No description available'}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                      <Chip
                        label={`${Math.round(job.match_score || job.match_percentage || 0)}% Match`}
                        color={job.match_score >= 80 ? 'success' : 
                               job.match_score >= 60 ? 'primary' : 
                               job.match_score >= 40 ? 'warning' : 'error'}
                        size="small"
                      />
                      <Chip
                        label={job.level || 'Entry Level'}
                        variant="outlined"
                        size="small"
                      />
                    </Box>
                    <Typography variant="subtitle2" color="primary">
                      Salary Range: {job.salary_range || 'Not specified'}
                    </Typography>
                  </Box>
                  <Box sx={{ mt: 'auto' }}>
                    <Typography variant="subtitle2" gutterBottom>
                      Required Skills:
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
                      {(job.required_skills || []).slice(0, 3).map((skill, i) => (
                        <Chip
                          key={i}
                          label={typeof skill === 'string' ? skill : skill.name}
                          size="small"
                          variant="outlined"
                          color="primary"
                        />
                      ))}
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2 }}>
                      <Chip
                        label={`Growth: ${job.growth_potential || 'High'}`}
                        size="small"
                        color="success"
                      />
                      <Chip
                        label={`Demand: ${job.market_demand || 'High'}`}
                        size="small"
                        color="info"
                      />
                    </Box>
                  </Box>
                </MetricCard>
              </Grid>
            ))}
            {(!analysis?.recommendations?.jobs || analysis.recommendations.jobs.length === 0) && (
              <Grid item xs={12}>
                <Paper elevation={3} sx={{ p: 3, textAlign: 'center' }}>
                  <Typography variant="h6" color="text.secondary">
                    Analyzing Profile
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Please wait while we generate personalized job recommendations
                  </Typography>
                </Paper>
              </Grid>
            )}
          </Grid>
        </Grid>

        {/* Course and Certification Recommendations */}
        <Grid item xs={12}>
          <Typography variant="h5" gutterBottom sx={{ mt: 4, mb: 2 }}>
            <SchoolIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            Recommendations
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