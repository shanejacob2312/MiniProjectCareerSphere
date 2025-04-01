import React from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

const ExperienceGraph = ({ experienceData }) => {
  if (!experienceData || !experienceData.length) {
    return <div>No experience data available</div>;
  }

  // Sort experience by start date
  const sortedExperience = [...experienceData].sort((a, b) => 
    new Date(a.startDate) - new Date(b.startDate)
  );

  // Calculate years of experience for each role
  const experiencePoints = sortedExperience.map(exp => {
    const startDate = new Date(exp.startDate);
    const endDate = exp.endDate ? new Date(exp.endDate) : new Date();
    const years = ((endDate - startDate) / (1000 * 60 * 60 * 24 * 365)).toFixed(1);
    
    // Calculate seniority level (0-100)
    let seniorityScore = 0;
    const title = exp.title.toLowerCase();
    if (title.includes('senior') || title.includes('lead')) seniorityScore += 40;
    if (title.includes('manager') || title.includes('head')) seniorityScore += 50;
    if (title.includes('director') || title.includes('architect')) seniorityScore += 60;
    if (title.includes('vp') || title.includes('chief')) seniorityScore += 70;

    // Add years of experience bonus (max 30 points)
    seniorityScore += Math.min(Number(years) * 3, 30);

    return {
      role: exp.title,
      years: Number(years),
      level: Math.min(seniorityScore, 100)
    };
  });

  const data = {
    labels: experiencePoints.map(exp => exp.role),
    datasets: [
      {
        label: 'Career Progression',
        data: experiencePoints.map(exp => exp.level),
        fill: false,
        borderColor: 'rgb(75, 192, 192)',
        tension: 0.1,
        pointBackgroundColor: 'rgb(75, 192, 192)',
        pointRadius: 6,
        pointHoverRadius: 8
      }
    ]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        beginAtZero: true,
        max: 100,
        title: {
          display: true,
          text: 'Seniority Level'
        },
        ticks: {
          callback: function(value) {
            if (value === 0) return 'Entry Level';
            if (value === 25) return 'Junior';
            if (value === 50) return 'Mid-Level';
            if (value === 75) return 'Senior';
            if (value === 100) return 'Expert';
            return '';
          }
        }
      },
      x: {
        title: {
          display: true,
          text: 'Roles'
        }
      }
    },
    plugins: {
      tooltip: {
        callbacks: {
          label: function(context) {
            const exp = experiencePoints[context.dataIndex];
            return [
              `Role: ${exp.role}`,
              `Years: ${exp.years}`,
              `Level: ${exp.level}/100`
            ];
          }
        }
      },
      legend: {
        display: false
      },
      title: {
        display: true,
        text: 'Career Progression Over Time',
        font: {
          size: 16
        }
      }
    }
  };

  return (
    <div style={{ height: '400px', width: '100%', padding: '20px' }}>
      <Line data={data} options={options} />
    </div>
  );
};

export default ExperienceGraph; 