const RegionalSalary = require('../models/RegionalSalary');

class SalaryService {
    async adjustSalaryForRegion(baseSalary, location) {
        try {
            // Parse location string (expected format: "City, State, Country" or partial)
            const [city, state, country] = this.parseLocation(location);
            
            // Build query based on available location parts
            const query = this.buildLocationQuery(city, state, country);
            
            // Get regional data
            const regionalData = await RegionalSalary.findOne(query);
            
            if (!regionalData) {
                console.log('No regional data found for location:', location);
                return baseSalary; // Return unadjusted salary if no regional data
            }

            // Apply regional adjustment
            const adjustedSalary = baseSalary * regionalData.salaryMultiplier;
            
            console.log('Salary adjustment:', {
                location,
                baseSalary,
                multiplier: regionalData.salaryMultiplier,
                adjustedSalary,
                costOfLivingIndex: regionalData.costOfLivingIndex
            });

            return Math.round(adjustedSalary);
        } catch (error) {
            console.error('Error adjusting salary:', error);
            return baseSalary; // Return unadjusted salary on error
        }
    }

    async adjustSalaryRange(range, location) {
        try {
            // Parse the salary range string (format: "$X,XXX - $Y,YYY")
            const [min, max] = this.parseSalaryRange(range);
            
            // Adjust both min and max salaries
            const adjustedMin = await this.adjustSalaryForRegion(min, location);
            const adjustedMax = await this.adjustSalaryForRegion(max, location);
            
            return this.formatSalaryRange(adjustedMin, adjustedMax);
        } catch (error) {
            console.error('Error adjusting salary range:', error);
            return range; // Return original range on error
        }
    }

    parseLocation(location) {
        if (!location) return [null, null, null];
        
        const parts = location.split(',').map(part => part.trim());
        const [city, state, country] = parts.concat([null, null, null]);
        return [city, state, country];
    }

    buildLocationQuery(city, state, country) {
        const query = {};
        
        if (city) {
            query['region.city'] = new RegExp(city, 'i');
        }
        if (state) {
            query['region.state'] = new RegExp(state, 'i');
        }
        if (country) {
            query['region.country'] = new RegExp(country, 'i');
        }
        
        return query;
    }

    parseSalaryRange(range) {
        try {
            const numbers = range.match(/\d+/g);
            if (numbers && numbers.length >= 2) {
                return [
                    parseInt(numbers[0]) * 1000,
                    parseInt(numbers[1]) * 1000
                ];
            }
            return [50000, 100000]; // Default range if parsing fails
        } catch (error) {
            console.error('Error parsing salary range:', error);
            return [50000, 100000]; // Default range on error
        }
    }

    formatSalaryRange(min, max) {
        return `$${Math.round(min/1000)}k - $${Math.round(max/1000)}k`;
    }

    // Method to update or create regional salary data
    async updateRegionalData(regionData) {
        try {
            const { country, state, city } = regionData.region;
            
            return await RegionalSalary.findOneAndUpdate(
                {
                    'region.country': country,
                    'region.state': state,
                    'region.city': city
                },
                regionData,
                { upsert: true, new: true }
            );
        } catch (error) {
            console.error('Error updating regional data:', error);
            throw error;
        }
    }

    // Method to get regional statistics
    async getRegionalStats(location) {
        try {
            const [city, state, country] = this.parseLocation(location);
            const query = this.buildLocationQuery(city, state, country);
            
            return await RegionalSalary.findOne(query)
                .select('costOfLivingIndex marketData')
                .lean();
        } catch (error) {
            console.error('Error getting regional stats:', error);
            return null;
        }
    }
}

module.exports = new SalaryService(); 