const RegionalSalary = require('../models/RegionalSalary');
const axios = require('axios');

class RegionalDataController {
    // Get regional data with pagination and filters
    async getRegionalData(req, res) {
        try {
            const { 
                country, 
                state, 
                city, 
                page = 1, 
                limit = 10 
            } = req.query;

            const query = {};
            if (country) query['region.country'] = new RegExp(country, 'i');
            if (state) query['region.state'] = new RegExp(state, 'i');
            if (city) query['region.city'] = new RegExp(city, 'i');

            const data = await RegionalSalary.find(query)
                .skip((page - 1) * limit)
                .limit(limit)
                .sort({ 'region.country': 1, 'region.state': 1, 'region.city': 1 });

            const total = await RegionalSalary.countDocuments(query);

            res.json({
                data,
                total,
                page: parseInt(page),
                pages: Math.ceil(total / limit)
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    // Add or update regional data
    async updateRegionalData(req, res) {
        try {
            const { region, ...data } = req.body;
            
            const updated = await RegionalSalary.findOneAndUpdate(
                {
                    'region.country': region.country,
                    'region.state': region.state,
                    'region.city': region.city
                },
                { ...data, region },
                { upsert: true, new: true }
            );

            res.json(updated);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    // Bulk update regional data
    async bulkUpdateRegionalData(req, res) {
        try {
            const { regions } = req.body;
            const operations = regions.map(region => ({
                updateOne: {
                    filter: {
                        'region.country': region.region.country,
                        'region.state': region.region.state,
                        'region.city': region.region.city
                    },
                    update: region,
                    upsert: true
                }
            }));

            const result = await RegionalSalary.bulkWrite(operations);
            res.json(result);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    // Fetch and update Indian salary data
    async updateIndianSalaryData(req, res) {
        try {
            // Fetch data from multiple Indian salary sources
            const [payscaleData, glassdoorData, naukri] = await Promise.all([
                this.fetchPayscaleIndiaData(),
                this.fetchGlassdoorIndiaData(),
                this.fetchNaukriData()
            ]);

            // Process and merge data
            const processedData = this.processIndianSalaryData(
                payscaleData, 
                glassdoorData, 
                naukri
            );

            // Bulk update the database
            const operations = processedData.map(data => ({
                updateOne: {
                    filter: {
                        'region.country': 'India',
                        'region.state': data.state,
                        'region.city': data.city
                    },
                    update: {
                        costOfLivingIndex: data.costOfLivingIndex,
                        salaryMultiplier: data.salaryMultiplier,
                        marketData: data.marketData,
                        metadata: {
                            source: 'Multiple (Payscale, Glassdoor, Naukri)',
                            lastUpdated: new Date()
                        }
                    },
                    upsert: true
                }
            }));

            const result = await RegionalSalary.bulkWrite(operations);
            res.json({
                message: 'Indian salary data updated successfully',
                result
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    // Helper methods for fetching Indian salary data
    async fetchPayscaleIndiaData() {
        // Implementation would use Payscale's API or web scraping
        // This is a placeholder structure
        return [
            {
                city: 'Bangalore',
                state: 'Karnataka',
                averageSalary: 1200000,
                salaryRanges: {
                    entry: 400000,
                    mid: 1200000,
                    senior: 2500000
                }
            },
            // Add more cities...
        ];
    }

    async fetchGlassdoorIndiaData() {
        // Implementation would use Glassdoor's API
        // This is a placeholder structure
        return [
            {
                city: 'Mumbai',
                state: 'Maharashtra',
                averageSalary: 1400000,
                salaryRanges: {
                    entry: 500000,
                    mid: 1400000,
                    senior: 3000000
                }
            },
            // Add more cities...
        ];
    }

    async fetchNaukriData() {
        // Implementation would use Naukri's API or web scraping
        // This is a placeholder structure
        return [
            {
                city: 'Delhi',
                state: 'Delhi',
                averageSalary: 1300000,
                salaryRanges: {
                    entry: 450000,
                    mid: 1300000,
                    senior: 2800000
                }
            },
            // Add more cities...
        ];
    }

    processIndianSalaryData(payscale, glassdoor, naukri) {
        const cities = new Map();

        // Helper to process each data source
        const processSource = (data, weight) => {
            data.forEach(cityData => {
                const key = `${cityData.city}-${cityData.state}`;
                if (!cities.has(key)) {
                    cities.set(key, {
                        city: cityData.city,
                        state: cityData.state,
                        sources: []
                    });
                }
                cities.get(key).sources.push({
                    averageSalary: cityData.averageSalary,
                    salaryRanges: cityData.salaryRanges,
                    weight
                });
            });
        };

        // Process each source with different weights
        processSource(payscale, 0.4);    // 40% weight to Payscale
        processSource(glassdoor, 0.35);   // 35% weight to Glassdoor
        processSource(naukri, 0.25);      // 25% weight to Naukri

        // Calculate weighted averages
        return Array.from(cities.values()).map(city => {
            const totalWeight = city.sources.reduce((sum, s) => sum + s.weight, 0);
            const weightedAvg = city.sources.reduce((sum, s) => 
                sum + (s.averageSalary * s.weight), 0) / totalWeight;

            // Calculate salary ranges
            const ranges = {
                entry: 0,
                mid: 0,
                senior: 0
            };

            Object.keys(ranges).forEach(level => {
                ranges[level] = city.sources.reduce((sum, s) => 
                    sum + (s.salaryRanges[level] * s.weight), 0) / totalWeight;
            });

            // Calculate cost of living index (relative to Mumbai as base 100)
            const colIndex = (weightedAvg / 1400000) * 100; // Using Mumbai's average as base

            return {
                city: city.city,
                state: city.state,
                costOfLivingIndex: Math.round(colIndex),
                salaryMultiplier: colIndex / 100,
                marketData: {
                    averageSalary: Math.round(weightedAvg),
                    medianSalary: Math.round(weightedAvg * 0.9), // Approximation
                    salaryRange: {
                        entry: Math.round(ranges.entry),
                        mid: Math.round(ranges.mid),
                        senior: Math.round(ranges.senior)
                    }
                }
            };
        });
    }
}

module.exports = new RegionalDataController(); 