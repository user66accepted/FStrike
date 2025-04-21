const aiScraperService = require('../services/aiScraperService');

/**
 * Controller for AI scraping operations
 */
const aiScraperController = {
  /**
   * Search for person information
   * @param {object} req - Express request object
   * @param {object} res - Express response object
   */
  async searchPerson(req, res) {
    try {
      const { name } = req.body;
      
      if (!name) {
        return res.status(400).json({ 
          success: false, 
          message: 'Name is required' 
        });
      }
      
      console.log(`Searching for person: ${name}`);
      const results = await aiScraperService.searchPerson(name);
      
      return res.status(200).json({
        success: true,
        data: results
      });
    } catch (error) {
      console.error('Error searching for person:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to search for person',
        error: error.message
      });
    }
  },
  
  /**
   * Search for organization employees
   * @param {object} req - Express request object
   * @param {object} res - Express response object
   */
  async searchOrganization(req, res) {
    try {
      const { name } = req.body;
      
      if (!name) {
        return res.status(400).json({ 
          success: false, 
          message: 'Organization name is required' 
        });
      }
      
      console.log(`Searching for organization: ${name}`);
      const results = await aiScraperService.searchOrganization(name);
      
      return res.status(200).json({
        success: true,
        data: results
      });
    } catch (error) {
      console.error('Error searching for organization:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to search for organization',
        error: error.message
      });
    }
  }
};

module.exports = aiScraperController;
