const { Builder, By, Key, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const { promises: fs } = require('fs');

/**
 * AI Scraper Service for extracting information about people or organizations
 * Uses Selenium WebDriver with Bing search to avoid bot detection
 */
class AiScraperService {
  /**
   * Setup Chrome WebDriver with anti-detection configurations
   * @private
   */
  async setupDriver() {
    // Configure Chrome options for better scraping
    const options = new chrome.Options();
    options.addArguments(
      '--headless',
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--window-size=1920,1080'
    );
    options.addArguments('--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Disable automation flags
    options.excludeSwitches(['enable-automation']);
    options.setUserPreferences({
      'credentials_enable_service': false,
      'profile.password_manager_enabled': false
    });
    
    // Create and return the WebDriver
    const driver = await new Builder()
      .forBrowser('chrome')
      .setChromeOptions(options)
      .build();
    
    return driver;
  }

  /**
   * Search for a person's information
   * @param {string} name - The person's name to search for
   * @returns {Promise<Array>} - Array of found persons with their details
   */
  async searchPerson(name) {
    console.log(`Searching for person: ${name}`);
    
    let driver;
    try {
      // Search for the person using Bing
      driver = await this.setupDriver();
      const searchResults = await this.bingSearch(driver, `${name} contact information`);
      
      if (searchResults.length === 0) {
        throw new Error('No search results found');
      }
      
      // Process the top 3 search results
      const allNames = new Set();
      const allEmails = new Set();
      const personDetails = [];
      
      // Process first few results
      for (let i = 0; i < Math.min(searchResults.length, 3); i++) {
        const [title, url] = searchResults[i];
        console.log(`Processing result ${i+1}: ${title}`);
        
        // Extract information from the URL
        const { names, emails, positions } = await this.extractInfoFromUrl(driver, url);
        
        // Add to our collections
        names.forEach(name => allNames.add(name));
        emails.forEach(email => allEmails.add(email));
        
        // Match names with emails and positions when possible
        this.matchPersonDetails(names, emails, positions, personDetails);
      }
      
      // If we didn't find good matches, use the search name with found emails
      if (personDetails.length === 0 && name.includes(' ')) {
        const nameParts = name.split(' ');
        const firstName = nameParts[0];
        const lastName = nameParts.slice(1).join(' ');
        
        // If we found emails, use the first one
        const email = Array.from(allEmails)[0] || `${firstName.toLowerCase()}.${lastName.toLowerCase()}@example.com`;
        
        personDetails.push({
          firstName,
          lastName,
          email,
          position: 'Professional',
          source: 'Bing Search'
        });
      }
      
      return personDetails;
    } catch (error) {
      console.error(`Error in searchPerson: ${error.message}`);
      throw error;
    } finally {
      if (driver) {
        try {
          await driver.quit();
        } catch (err) {
          console.error('Error closing driver:', err);
        }
      }
    }
  }

  /**
   * Search for organization employees
   * @param {string} organizationName - The organization name to search for
   * @returns {Promise<Array>} - Array of employees with their details
   */
  async searchOrganization(organizationName) {
    console.log(`Searching for organization: ${organizationName}`);
    
    let driver;
    try {
      // Search for the organization using Bing
      driver = await this.setupDriver();
      const searchResults = await this.bingSearch(driver, `${organizationName} employees contact`);
      
      if (searchResults.length === 0) {
        throw new Error('No search results found');
      }
      
      // Process the search results
      const allNames = new Set();
      const allEmails = new Set();
      const employeeDetails = [];
      
      // Process several results for organization info
      for (let i = 0; i < Math.min(searchResults.length, 5); i++) {
        const [title, url] = searchResults[i];
        console.log(`Processing result ${i+1}: ${title}`);
        
        // Extract information from the URL
        const { names, emails, positions } = await this.extractInfoFromUrl(driver, url);
        
        // Add to our collections
        names.forEach(name => allNames.add(name));
        emails.forEach(email => allEmails.add(email));
        
        // Match employees with possible positions and emails
        this.matchPersonDetails(names, emails, positions, employeeDetails, organizationName);
      }
      
      // Make sure we return organization information
      employeeDetails.forEach(employee => {
        employee.organization = organizationName;
      });
      
      // Limit to 10 results max
      return employeeDetails.slice(0, 10);
    } catch (error) {
      console.error(`Error in searchOrganization: ${error.message}`);
      throw error;
    } finally {
      if (driver) {
        try {
          await driver.quit();
        } catch (err) {
          console.error('Error closing driver:', err);
        }
      }
    }
  }

  /**
   * Match person names with emails and positions to create person details
   * @private
   */
  matchPersonDetails(names, emails, positions, detailsArray, organizationName = null) {
    // Get arrays from sets
    const nameArray = Array.from(names);
    const emailArray = Array.from(emails);
    const positionArray = Object.entries(positions);
    
    // For each name, try to find a matching email and position
    for (const fullName of nameArray) {
      // Skip if already processed this name
      if (detailsArray.some(d => `${d.firstName} ${d.lastName}` === fullName)) {
        continue;
      }
      
      const nameParts = fullName.split(' ');
      if (nameParts.length < 2) continue;  // Skip if not a full name
      
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(' ');
      
      // Try to find a matching email
      let matchedEmail = null;
      for (const email of emailArray) {
        const lowerEmail = email.toLowerCase();
        if (
          lowerEmail.includes(firstName.toLowerCase()) || 
          lowerEmail.includes(lastName.toLowerCase())
        ) {
          matchedEmail = email;
          break;
        }
      }
      
      // If no email match found, generate one or use the first available
      if (!matchedEmail) {
        if (emailArray.length > 0) {
          matchedEmail = emailArray[0];
        } else if (organizationName) {
          // Generate organization email
          const domain = organizationName.toLowerCase().replace(/\s+/g, '');
          matchedEmail = `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${domain}.com`;
        } else {
          // Generate generic email
          matchedEmail = `${firstName.toLowerCase()}.${lastName.toLowerCase()}@example.com`;
        }
      }
      
      // Find position
      let matchedPosition = 'Professional';
      for (const [position, names] of positionArray) {
        if (names.includes(fullName)) {
          matchedPosition = position;
          break;
        }
      }
      
      // Add to details array
      detailsArray.push({
        firstName,
        lastName,
        email: matchedEmail,
        position: matchedPosition,
        source: organizationName ? `${organizationName} Employee` : 'Bing Search'
      });
    }
  }

  /**
   * Search on Bing and extract search results
   * @private
   */
  async bingSearch(driver, query, numResults = 10) {
    const results = [];
    
    try {
      // Encode the search query
      const searchQuery = encodeURIComponent(query);
      const url = `https://www.bing.com/search?q=${searchQuery}&count=${numResults}`;
      
      // Navigate to Bing
      await driver.get(url);
      
      // Wait for search results to load (try different selectors)
      try {
        await driver.wait(until.elementLocated(By.css('li.b_algo, .b_algo')), 10000);
      } catch (err) {
        console.log('Waiting for alternate selectors...');
        await driver.wait(until.elementLocated(By.css('h2 a')), 5000);
      }
      
      // Scroll to load more results
      await driver.executeScript("window.scrollTo(0, document.body.scrollHeight);");
      await new Promise(resolve => setTimeout(resolve, 2000));  // Wait 2 seconds
      
      // Try multiple selectors for different Bing layouts
      const selectors = [
        "li.b_algo h2 a",
        ".b_algo h2 a",
        ".b_title a",
        "h2 a"
      ];
      
      for (const selector of selectors) {
        try {
          const elements = await driver.findElements(By.css(selector));
          
          for (const element of elements) {
            if (results.length >= numResults) break;
            
            const title = await element.getText();
            const link = await element.getAttribute('href');
            
            if (link && link.startsWith('http')) {
              results.push([title, link]);
            }
          }
          
          if (results.length > 0) break;  // Stop trying selectors if we found results
        } catch (err) {
          console.log(`Selector "${selector}" failed:`, err.message);
        }
      }
    } catch (error) {
      console.error(`Error during Bing search: ${error.message}`);
    }
    
    return results;
  }

  /**
   * Extract information from a webpage
   * @private
   */
  async extractInfoFromUrl(driver, url) {
    const names = new Set();
    const emails = new Set();
    const positions = {};  // Map positions to names
    
    try {
      // Navigate to the URL
      await driver.get(url);
      
      // Wait for page to load
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Get page content
      const pageText = await driver.findElement(By.css('body')).getText();
      
      // Extract names using regex
      const nameMatches = pageText.match(/\b[A-Z][a-z]{1,20}\s+[A-Z][a-z]{1,20}(?:\s+[A-Z][a-z]{1,20})?\b/g) || [];
      nameMatches.forEach(name => names.add(name));
      
      // Extract emails using regex
      const emailMatches = pageText.match(/\b[\w.+-]+@[\w-]+\.[a-zA-Z0-9-.]+\b/g) || [];
      emailMatches.forEach(email => emails.add(email));
      
      // Try to find positions/titles
      const positionTitles = [
        'CEO', 'CTO', 'CFO', 'President', 'Director', 'Manager', 'VP', 
        'Vice President', 'Founder', 'Co-founder', 'Engineer', 'Developer',
        'Consultant', 'Specialist', 'Analyst'
      ];
      
      // Look for position patterns
      for (const title of positionTitles) {
        const regex = new RegExp(`([A-Z][a-z]+\\s+[A-Z][a-z]+)(?:.{0,30}${title}|${title}.{0,30})`, 'g');
        let match;
        
        while ((match = regex.exec(pageText)) !== null) {
          const name = match[1];
          if (!positions[title]) positions[title] = [];
          positions[title].push(name);
          // Also add the name to our names set
          names.add(name);
        }
      }
    } catch (error) {
      console.error(`Error extracting info from ${url}: ${error.message}`);
    }
    
    return { names, emails, positions };
  }
}

module.exports = new AiScraperService();
