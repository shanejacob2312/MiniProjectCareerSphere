const JobMarket = require('../models/JobMarket');
const salaryService = require('./salaryService');

class JobMarketService {
    async getJobRecommendations(field, skills, education, location = '') {
        try {
            console.log('Getting job recommendations:', {
                field,
                skillsCount: skills?.length,
                hasEducation: !!education,
                location
            });

            // Get base jobs for the field
            const baseJobs = this.getBaseJobsForField(field);
            
            if (!baseJobs || baseJobs.length === 0) {
                console.log('No base jobs found for field:', field);
                return [{
                    job_title: field || 'Entry Level Position',
                    match_percentage: 30,
                    salary_range: "Entry Level",
                    description: `Entry level position in ${field || 'technology'}`,
                    missing_skills: []
                }];
            }

            // Ensure skills is an array
            const userSkills = Array.isArray(skills) ? skills : [];
            console.log('Processing user skills:', userSkills);

            // Calculate matches and sort by match percentage
            const jobMatches = baseJobs.map(job => {
                const matchScore = this.calculateSkillMatch(job, userSkills);
                const missingSkills = this.getMissingSkills(job, userSkills);
                
                return {
                    job_title: job.title,
                    match_percentage: Math.round(matchScore),
                    salary_range: job.salaryRange || "Competitive",
                    description: job.description || `Position matching your profile in ${field}`,
                    missing_skills: missingSkills
                };
            });

            // Sort by match percentage and return top matches
            const sortedMatches = jobMatches
                .sort((a, b) => b.match_percentage - a.match_percentage)
                .slice(0, 5);

            console.log('Generated job matches:', {
                totalMatches: jobMatches.length,
                topMatchPercentage: sortedMatches[0]?.match_percentage,
                returnedMatches: sortedMatches.length
            });

            return sortedMatches;
        } catch (error) {
            console.error('Error getting job recommendations:', error);
            return [{
                job_title: field || 'Entry Level Position',
                match_percentage: 30,
                salary_range: "Entry Level",
                description: `Entry level position in ${field || 'technology'}`,
                missing_skills: []
            }];
        }
    }

    getBaseJobsForField(field) {
        console.log('Getting base jobs for field:', field);
        
        // Define base jobs with requirements
        const baseJobs = {
            'Software Developer': [
                {
                    title: 'Junior Software Developer',
                    requiredSkills: [
                        { name: 'JavaScript', importance: 8 },
                        { name: 'HTML', importance: 7 },
                        { name: 'CSS', importance: 7 },
                        { name: 'Git', importance: 6 }
                    ],
                    preferredSkills: [
                        { name: 'React', importance: 6 },
                        { name: 'Node.js', importance: 6 },
                        { name: 'TypeScript', importance: 5 }
                    ],
                    salaryRange: "$50,000 - $80,000",
                    description: "Entry level software development position focusing on web technologies"
                },
                {
                    title: 'Full Stack Developer',
                    requiredSkills: [
                        { name: 'JavaScript', importance: 9 },
                        { name: 'React', importance: 8 },
                        { name: 'Node.js', importance: 8 },
                        { name: 'SQL', importance: 7 }
                    ],
                    preferredSkills: [
                        { name: 'TypeScript', importance: 7 },
                        { name: 'MongoDB', importance: 6 },
                        { name: 'AWS', importance: 6 }
                    ],
                    salaryRange: "$70,000 - $120,000",
                    description: "Full stack development role working with modern web technologies"
                },
                {
                    title: 'Senior Software Developer',
                    requiredSkills: [
                        { name: 'JavaScript', importance: 9 },
                        { name: 'React', importance: 8 },
                        { name: 'Node.js', importance: 8 },
                        { name: 'System Design', importance: 8 }
                    ],
                    preferredSkills: [
                        { name: 'TypeScript', importance: 7 },
                        { name: 'AWS', importance: 7 },
                        { name: 'Docker', importance: 7 }
                    ],
                    salaryRange: "$100,000 - $160,000",
                    description: "Senior level position with architecture and team leadership responsibilities"
                }
            ],
            'Data Analyst': [
                {
                    title: 'Junior Data Analyst',
                    requiredSkills: [
                        { name: 'SQL', importance: 8 },
                        { name: 'Excel', importance: 7 },
                        { name: 'Python', importance: 6 },
                        { name: 'Data Visualization', importance: 6 }
                    ],
                    preferredSkills: [
                        { name: 'Tableau', importance: 6 },
                        { name: 'Power BI', importance: 6 },
                        { name: 'R', importance: 5 }
                    ],
                    salaryRange: "$45,000 - $75,000",
                    description: "Entry level data analysis position focusing on SQL and visualization"
                },
                {
                    title: 'Data Analyst',
                    requiredSkills: [
                        { name: 'SQL', importance: 9 },
                        { name: 'Python', importance: 8 },
                        { name: 'Data Visualization', importance: 8 },
                        { name: 'Statistical Analysis', importance: 7 }
                    ],
                    preferredSkills: [
                        { name: 'Tableau', importance: 7 },
                        { name: 'Machine Learning', importance: 6 },
                        { name: 'Big Data', importance: 6 }
                    ],
                    salaryRange: "$65,000 - $100,000",
                    description: "Mid-level data analyst position with focus on advanced analytics"
                },
                {
                    title: 'Senior Data Analyst',
                    requiredSkills: [
                        { name: 'SQL', importance: 9 },
                        { name: 'Python', importance: 8 },
                        { name: 'Statistical Analysis', importance: 8 },
                        { name: 'Machine Learning', importance: 7 }
                    ],
                    preferredSkills: [
                        { name: 'Big Data', importance: 7 },
                        { name: 'Cloud Platforms', importance: 7 },
                        { name: 'Deep Learning', importance: 6 }
                    ],
                    salaryRange: "$85,000 - $140,000",
                    description: "Senior data analyst position with machine learning focus"
                }
            ]
        };

        return baseJobs[field] || [];
    }

    calculateSkillMatch(job, userSkills) {
        if (!Array.isArray(userSkills)) return 0;
        
        const userSkillsLower = userSkills.map(s => 
            typeof s === 'string' ? s.toLowerCase() : 
            (s.name ? s.name.toLowerCase() : '')
        ).filter(Boolean);
        
        // Calculate required skills match (70% weight)
        const requiredMatch = job.requiredSkills.reduce((score, skill) => {
            const hasSkill = userSkillsLower.some(us => 
                us.includes(skill.name.toLowerCase()) || 
                skill.name.toLowerCase().includes(us)
            );
            return score + (hasSkill ? (skill.importance / 10) : 0);
        }, 0) / Math.max(1, job.requiredSkills.length) * 70;

        // Calculate preferred skills match (30% weight)
        const preferredMatch = job.preferredSkills.reduce((score, skill) => {
            const hasSkill = userSkillsLower.some(us => 
                us.includes(skill.name.toLowerCase()) || 
                skill.name.toLowerCase().includes(us)
            );
            return score + (hasSkill ? (skill.importance / 10) : 0);
        }, 0) / Math.max(1, job.preferredSkills.length) * 30;

        const totalScore = Math.min(100, requiredMatch + preferredMatch);
        
        console.log('Skill match calculation:', {
            job: job.title,
            requiredMatch,
            preferredMatch,
            totalScore
        });

        return totalScore;
    }

    calculateEducationMatch(job, education) {
        if (!education || !job.education.length) return 0;
        
        return job.education.reduce((score, edu) => {
            const matches = education.some(userEdu => 
                userEdu.toLowerCase().includes(edu.field.toLowerCase()) ||
                edu.field.toLowerCase().includes(userEdu.toLowerCase())
            );
            return score + (matches ? (edu.importance / 10) : 0);
        }, 0) / job.education.length * 100;
    }

    formatSalaryRange(salaryRange) {
        if (!salaryRange) return "Competitive";
        return `$${Math.round(salaryRange.min/1000)}k - $${Math.round(salaryRange.max/1000)}k`;
    }

    generateJobDescription(job, skillMatch, eduMatch, regionalStats) {
        const matchLevel = skillMatch >= 80 ? "strongly" : skillMatch >= 60 ? "well" : "reasonably";
        let description = `This role ${matchLevel} aligns with your background` + 
                         (eduMatch >= 70 ? " and education" : "") + 
                         `. Market demand is ${job.marketDemand.trend}`;
        
        // Add regional insights if available
        if (regionalStats) {
            const colIndex = regionalStats.costOfLivingIndex;
            if (colIndex < 90) {
                description += `. This area has a lower cost of living than average`;
            } else if (colIndex > 110) {
                description += `. This area has a higher cost of living than average`;
            }
        }

        return description;
    }

    getMissingSkills(job, userSkills) {
        if (!Array.isArray(userSkills)) return job.requiredSkills.map(s => s.name);
        
        const userSkillsLower = userSkills.map(s => 
            typeof s === 'string' ? s.toLowerCase() : 
            (s.name ? s.name.toLowerCase() : '')
        ).filter(Boolean);

        // Get missing required skills first
        const missingRequired = job.requiredSkills
            .filter(skill => 
                !userSkillsLower.some(us => 
                    us.includes(skill.name.toLowerCase()) || 
                    skill.name.toLowerCase().includes(us)
                )
            )
            .map(s => s.name);

        // Then get missing preferred skills
        const missingPreferred = job.preferredSkills
            .filter(skill => 
                !userSkillsLower.some(us => 
                    us.includes(skill.name.toLowerCase()) || 
                    skill.name.toLowerCase().includes(us)
                )
            )
            .map(s => s.name);

        return [...missingRequired, ...missingPreferred];
    }

    // Additional methods for data updates and maintenance
    async updateMarketData(jobData) {
        try {
            return await JobMarket.findOneAndUpdate(
                { title: jobData.title },
                jobData,
                { upsert: true, new: true }
            );
        } catch (error) {
            console.error('Error updating market data:', error);
            throw error;
        }
    }

    async getMarketTrends(category) {
        try {
            return await JobMarket.aggregate([
                { $match: { category } },
                { $group: {
                    _id: '$marketDemand.trend',
                    count: { $sum: 1 },
                    avgSalary: { 
                        $avg: { 
                            $avg: ['$salaryRanges.min', '$salaryRanges.max'] 
                        }
                    }
                }}
            ]);
        } catch (error) {
            console.error('Error getting market trends:', error);
            return [];
        }
    }
}

module.exports = new JobMarketService(); 