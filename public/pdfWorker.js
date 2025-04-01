// Import jsPDF library
self.window = self; // Required for jsPDF to work in worker context
importScripts('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
const { jsPDF } = window.jspdf;

// Task queue for managing PDF generation
let taskQueue = [];
let isProcessing = false;

// Load required scripts
async function loadDependencies() {
    try {
        await Promise.all([
            importScripts('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'),
            importScripts('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.28/jspdf.plugin.autotable.min.js')
        ]);
        return true;
    } catch (error) {
        console.error('Failed to load PDF dependencies:', error);
        return false;
    }
}

// Process tasks in queue
async function processQueue() {
    if (isProcessing || taskQueue.length === 0) return;
    
    isProcessing = true;
    const task = taskQueue[0];
    
    try {
        // Check if dependencies are loaded
        if (!window.jspdf) {
            const loaded = await loadDependencies();
            if (!loaded) throw new Error('Failed to load PDF dependencies');
        }
        
        // Generate PDF
        const doc = await generatePDF(task.data);
        
        // Send success response
        self.postMessage({
            type: 'success',
            taskId: task.id,
            result: doc.output('blob')
        });
        
    } catch (error) {
        // Send error response
        console.error('PDF generation error:', error);
        self.postMessage({
            type: 'error',
            taskId: task.id,
            error: error.message || 'Failed to generate PDF'
        });
        
    } finally {
        // Remove completed task and process next
        taskQueue.shift();
        isProcessing = false;
        processQueue();
    }
}

// Handle incoming messages
self.addEventListener('message', async (e) => {
    if (!e.data) return;
    
    const { type, taskId, data } = e.data;
    
    switch (type) {
        case 'generate':
            // Add task to queue
            taskQueue.push({ id: taskId, data });
            processQueue();
            break;
            
        case 'cancel':
            // Remove task from queue
            taskQueue = taskQueue.filter(task => task.id !== taskId);
            break;
            
        case 'clear':
            // Clear all tasks
            taskQueue = [];
            isProcessing = false;
            break;
    }
});

// Clean up on termination
self.addEventListener('unload', () => {
    taskQueue = [];
    isProcessing = false;
});

async function generatePDF(data) {
    try {
        const doc = new jspdf.jsPDF();
        
        // Add header
        doc.setFontSize(20);
        doc.text('Resume Analysis Report', 20, 20);
        doc.setFontSize(12);
        
        let yPos = 40;
        
        // Add overall scores
        if (data.scores) {
            doc.text('Overall Scores', 20, yPos);
            yPos += 10;
            
            const scores = [
                ['Category', 'Score'],
                ['Experience', data.scores.experience || 'N/A'],
                ['Skills Match', data.scores.skills || 'N/A'],
                ['Education', data.scores.education || 'N/A']
            ];
            
            doc.autoTable({
                startY: yPos,
                head: [scores[0]],
                body: scores.slice(1),
                margin: { left: 20 }
            });
            
            yPos = doc.lastAutoTable.finalY + 20;
        }
        
        // Add skills analysis
        if (data.skills) {
            doc.text('Skills Analysis', 20, yPos);
            yPos += 10;
            
            const skills = [
                ['Skill', 'Proficiency', 'Last Used'],
                ...data.skills.map(skill => [
                    skill.name,
                    skill.proficiency_details?.score || 'N/A',
                    skill.proficiency_details?.last_used || 'N/A'
                ])
            ];
            
            doc.autoTable({
                startY: yPos,
                head: [skills[0]],
                body: skills.slice(1),
                margin: { left: 20 }
            });
            
            yPos = doc.lastAutoTable.finalY + 20;
        }
        
        // Add job recommendations
        if (data.jobs) {
            doc.text('Job Recommendations', 20, yPos);
            yPos += 10;
            
            const jobs = [
                ['Title', 'Match %', 'Required Skills'],
                ...data.jobs.map(job => [
                    job.title,
                    job.match_percentage,
                    job.required_skills?.join(', ') || 'N/A'
                ])
            ];
            
            doc.autoTable({
                startY: yPos,
                head: [jobs[0]],
                body: jobs.slice(1),
                margin: { left: 20 }
            });
            
            yPos = doc.lastAutoTable.finalY + 20;
        }
        
        // Add footer
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(10);
            doc.text(
                `Page ${i} of ${pageCount}`,
                doc.internal.pageSize.width / 2,
                doc.internal.pageSize.height - 10,
                { align: 'center' }
            );
        }
        
        return doc;
        
    } catch (error) {
        console.error('Error generating PDF:', error);
        throw new Error('Failed to generate PDF report');
    }
}