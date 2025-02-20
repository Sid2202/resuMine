

async function getExperienceDetails() {
    try {
        const experienceSection = Array.from(document.querySelectorAll('section'))
            .find(section => {
                const heading = section.querySelector('h3');
                return heading && heading.textContent.trim() === "Experience";
            });
        
        
        if (!experienceSection) {
            return {
                yearsOfExperience: "0",
                currentRole: 'Not currently employed',
                currentCompany: 'Not currently employed',
                experienceString: 'No experience listed'
            };
        }

        const experienceItems = Array.from(experienceSection.querySelectorAll('ul > li')).filter(Boolean);

        const experiences = experienceItems.map(item => {
            if (!item) return null;

            const roleElement = item.querySelector('.t-14.t-black');
            const companyElement = item.querySelector('.t-14.t-black--light');
            const durationElement = item.querySelector('.t-12.t-black--light span[aria-hidden="true"]');

            const role = roleElement?.textContent?.trim() || 'Unknown Role';
            const company = companyElement?.textContent?.trim() || 'Unknown Company';
            const duration = durationElement?.textContent?.trim() || 'Unknown Duration';

            return {
                role,
                company,
                duration,
                isPresent: duration.includes('Present')
            };
        }).filter(exp => exp?.role && exp?.company && exp?.duration); // Remove any null entries


        
        if (!experiences.length) {
            return {
                yearsOfExperience: "0",
                currentRole: 'Not currently employed',
                currentCompany: 'Not currently employed',
                experienceString: 'No experience listed'
            };
        }

        const yearsOfExperience = await calculateYearsOfExperience(experiences);
        const currentPosition = experiences.find(exp => exp.isPresent);
        const currentRole = currentPosition ? currentPosition.role : 'Not currently employed';
        const currentCompany = currentPosition ? currentPosition.company : 'Not currently employed';
        const experienceString = experiences
            .map(exp => `${exp.role} at ${exp.company} (${exp.duration})`)
            .join(' | ');

        return {
            yearsOfExperience: yearsOfExperience.toString(),
            currentRole,
            currentCompany,
            experienceString
        };
    } catch (error) {
        console.log("Error in getExperienceDetails:", error);
        return {
            yearsOfExperience: "0",
            currentRole: 'Error processing role',
            currentCompany: 'Error processing company',
            experienceString: 'Error processing experience'
        };
    }
}

async function calculateYearsOfExperience(experiences) {
    try {
        if (!Array.isArray(experiences) || experiences.length === 0) return 0;

        let totalMonths = 0;
        let currentYear = new Date().getFullYear();

        for (let exp of experiences) {
            if (!exp?.duration) continue;

            const parts = exp.duration.split(' – ');
            if (parts.length !== 2) continue;

            let startYear = parseInt(parts[0]);
            let endYear = parts[1] === 'Present' ? currentYear : parseInt(parts[1]);
            
            if (isNaN(startYear) || isNaN(endYear)) continue;
            
            totalMonths += (endYear - startYear) * 12;
        }

        return (totalMonths / 12).toFixed(1);
    } catch (error) {
        console.log("Error in calculateYearsOfExperience:", error);
        return "0";
    }
}

async function downloadResume(resumeUrl, serialNumber, candidateName) {
    try {
        // Send message to background script to handle download
        const sanitizedName = candidateName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        chrome.runtime.sendMessage({
            type: "downloadResume",
            data: {
                url: resumeUrl,
                serialNumber: serialNumber,
                filename: `${sanitizedName}.pdf`
            }
        });
        return true;
    } catch (error) {
        console.error('Error initiating download:', error);
        return false;
    }
}

let autoStarted = false;

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

const waitForNewPageLoad = async (selector, attempts = 3, interval = 3000) => {
    // Wait for the page to fully load
    await new Promise((resolve) => {
        if (document.readyState === "complete") {
            resolve(); // Page is already loaded
        } else {
            window.addEventListener("load", resolve); // Wait for the load event
        }
    });


    // Try to find the element with a limited number of attempts
    for (let attempt = 1; attempt <= attempts; attempt++) {
        const element = document.querySelector(selector);
        if (element) {
            return element; // Return the element if found
        }
        console.log(`Attempt ${attempt} failed. Retrying in ${interval}ms...`);
        await new Promise((resolve) => setTimeout(resolve, interval)); // Wait before retrying
    }

    throw new Error(`Element with selector "${selector}" not found after ${attempts} attempts`);
};




async function getApplications() {
    console.log("Starting getApplications function");
    let allApplications = [];
    
    // Get total pages
    const pageState = document.querySelector('.artdeco-pagination__page-state');
    const totalPages = pageState ? parseInt(pageState.textContent.match(/of (\d+)/)[1]) : 1;
    console.log(`Total pages found: ${totalPages}`);

    let currentPage = 1;
    if (pageState) {
        const currentPageMatch = pageState.textContent.match(/(\d+) of/);
        if (currentPageMatch) {
            currentPage = parseInt(currentPageMatch[1]);
        }
    }
    console.log(`Starting from page ${currentPage} of ${totalPages}`);

    for(; currentPage <= totalPages; currentPage++) {
        console.log(`Processing page ${currentPage}`);
        
        // Send progress update
        chrome.runtime.sendMessage({ 
            type: "progressUpdate",
            data: {
                currentPage: currentPage,
                totalPages: totalPages
            }
        });
        let numberOfApplicants = 25;
        if (currentPage == totalPages) {
            console.log('last page reached');
            // sleep(3000);
            // numberOfApplicants = document.querySelectorAll('.artdeco-list .hiring-applicants__list-item[data-view-name="job-applicant-list-profile-card"]').length;
            numberOfApplicants = 25;
        }
        
        console.log(`Found ${numberOfApplicants} applicants on page ${currentPage}`);
        for (let i = 0; i < numberOfApplicants; i++) {
            const applicantElements = Array.from(document.querySelectorAll(
                '.artdeco-list .hiring-applicants__list-item[data-view-name="job-applicant-list-profile-card"]'
            ));
            const applicant = applicantElements[i];
            
            if (!applicant) {
                console.log("Skipping null applicant element:", i);
                continue;
            }

            const basicData = {
                serialNumber: allApplications.length + 1,
                name: applicant.querySelector(".hiring-people-card__title")?.textContent?.trim() || 'Unknown Name',
                location: applicant.querySelector(".artdeco-entity-lockup__metadata + .artdeco-entity-lockup__metadata")?.textContent?.trim() || 'Unknown Location',
                appliedAgo: applicant.querySelector(".display-flex.t-black--light span")?.textContent?.trim() || 'Unknown Time',
                resumeUrl: '',
                yearsOfExperience: "0",
                currentRole: 'Not currently employed',
                currentCompany: 'Not currently employed',
                experienceString: 'No experience listed'
            };

            try {
                const clickableLink = applicant.querySelector('a.ember-view');
                if (clickableLink) {
                    // clickableLink.click();
                    // await sleep(5000);

                    const event = new MouseEvent('click', {
                        bubbles: true,
                        cancelable: true,
                        view: window,
                    });
                
                    // Prevent the default navigation behavior
                    clickableLink.addEventListener('click', (e) => {
                        e.preventDefault();
                        console.log("Navigation prevented for:", clickableLink.href);
                        // You can implement your custom navigation logic here, e.g., fetch content dynamically.
                    });
                
                    // Dispatch the event
                    clickableLink.dispatchEvent(event);

                    await sleep(500)

                    // const downloadLink = document.querySelector('a[aria-label*="Download"][target="_blank"]');
                    // downloadLink = document.querySelector('a[aria-label*="Download"]');
                    downloadLink = await waitForNewPageLoad('a[aria-label*="Download"]');

                                        
                    if (downloadLink) {
                        basicData.resumeUrl = downloadLink.href;
                        if (basicData.resumeUrl) {
                            try {
                                await downloadResume(basicData.resumeUrl, basicData.serialNumber, basicData.name);
                                basicData.downloadStatus = 'Download initiated';
                            } catch (error) {
                                console.error(`Failed to download resume for ${basicData.name}:`, error);
                                basicData.downloadStatus = 'Download failed';
                            }
                        }
                    } else {
                        console.log("DOWNLOAD LINK NOT FOUND FOR SERIAL NUMBER : ", basicData.serialNumber, " NAME : ", basicData.name)
                        basicData.resumeUrl = "COULD NOT DOWNLOAD"
                    }

                    const experienceData = await getExperienceDetails();
                    basicData.yearsOfExperience = experienceData.yearsOfExperience;
                    // basicData.currentRole = experienceData.currentRole;
                    // basicData.currentCompany = experienceData.currentCompany;
                    // basicData.experienceString = experienceData.experienceString;
                    Object.assign(basicData, experienceData);

                    if (i < numberOfApplicants - 1) {
                        const nextApplicant = applicantElements[i + 1];
                        const nextLink = nextApplicant?.querySelector('a.ember-view');
                        if (nextLink) {
                            nextLink.click();
                        }
                    }
                }
            } catch (error) {
                console.log(`Error processing applicant ${basicData.name}:`, error);
            }

            allApplications.push(basicData);
            await sleep(1000);
        }

        // Go to next page if not on last page
        // Inside getApplications function, replace the pagination section with:

        if (currentPage < totalPages) {
            console.log(`Attempting to go to page ${currentPage + 1}`);
            console.log('applications till now count : ', allApplications.length);
            
            // Get all page buttons
            const allPageButtons = Array.from(document.querySelectorAll('.artdeco-pagination__indicator--number button'));

            // Find the next page button directly
            let nextPageButton = allPageButtons.find(button => {
                const pageNum = parseInt(button.querySelector('span')?.textContent);
                return !isNaN(pageNum) && pageNum === currentPage + 1;
            });

            // If next page button is not found, look for ellipsis
            if (!nextPageButton) {
                console.log('Next page button not found, looking for ellipsis...');
                const ellipsisButtons = allPageButtons.filter(button => button.querySelector('span')?.textContent === '…');
                
                if (ellipsisButtons.length > 0) {
                    // Determine which ellipsis to click
                    let ellipsisToClick = null;
        
                    for (const ellipsis of ellipsisButtons) {
                        const ellipsisParent = ellipsis.closest('li');
                        const ellipsisIndex = Array.from(ellipsisParent.parentNode.children).indexOf(ellipsisParent);
        
                        // Check if the ellipsis comes after the current page
                        const currentPageIndex = allPageButtons.findIndex(button => {
                            const pageNum = parseInt(button.querySelector('span')?.textContent);
                            return pageNum === currentPage;
                        });
        
                        if (ellipsisIndex > currentPageIndex) {
                            ellipsisToClick = ellipsis;
                            break;
                        }
                    }
        
                    if (ellipsisToClick) {
                        console.log('Found appropriate ellipsis, clicking it');
                        
                        const clickEvent = new MouseEvent('click', {
                            bubbles: true,
                            cancelable: true,
                            view: window
                        });
                        ellipsisToClick.dispatchEvent(clickEvent);

                        await sleep(2500); // Wait for UI to update
        
                        // Recheck for the next page button after ellipsis expands
                        const updatedButtons = Array.from(document.querySelectorAll('.artdeco-pagination__indicator--number button'));
                        nextPageButton = updatedButtons.find(button => {
                            const pageNum = parseInt(button.querySelector('span')?.textContent);
                            return !isNaN(pageNum) && pageNum === currentPage + 1;
                        });
                        console.log('Next page button after ellipsis:', nextPageButton);
                    }
                }
            }

            // If still not found, throw an error
            if (!nextPageButton) {
                throw new Error(`Next page button not found after checking ellipsis for page ${currentPage + 1}`);
            }

            // Prevent default behavior and simulate the click
            const clickEvent = new MouseEvent('click', {
                bubbles: true,
                cancelable: true,
                view: window
            });
            nextPageButton.dispatchEvent(clickEvent);
            await sleep(2000); 
        }
    }

    console.log("All applications:", allApplications);

    // Format the data before returning
    // try {
    //     const formattedApplications = allApplications.map(app => ({
    //         name: app.name,
    //         location: app.location,
    //         appliedAgo: app.appliedAgo,
    //         resumeUrl: app.resumeUrl,
    //         yearsOfExperience: app.yearsOfExperience.toString(),
    //         currentRole: app.currentRole,
    //         currentCompany: app.currentCompany,
    //         experienceString: Array.isArray(app.experiences) ? 
    //             app.experiences.map(exp => 
    //                 `${exp.role} at ${exp.company} (${exp.duration})`
    //             ).join(' | ') : ''
    //     }));
    // } catch (error) {
    //     console.log("Error formatting applications:", error);
    // }

    // console.log("Formatted applications:", formattedApplications);
    const validApplications = allApplications.filter(app => app != null);

    return validApplications;
}




chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("Message received:", request);
    if (request.action === 'extract' && !autoStarted) {
        autoStarted = true;
        getApplications().then(applications => {
            if (applications.length === 0) {
                chrome.runtime.sendMessage({ 
                    success: false, 
                    error: "No applications found on the page" 
                });
            } else {
                console.log("Applications found:", applications);
                const values = applications.map(app => [
                    app.serialNumber,
                    app.name,
                    app.location,
                    app.appliedAgo,
                    app.resumeUrl,
                    app.yearsOfExperience,
                    app.currentRole,
                    app.currentCompany,
                    app.experienceString
                ]);
                console.log("Values to send:", values);
                chrome.runtime.sendMessage({ 
                    type: "processApplications", 
                    data: {
                        headers: [
                            'Serial No.', 
                            'Name',
                            'Location',
                            'Applied Ago',
                            'Resume URL',
                            'Years of Experience',
                            'Current Role',
                            'Current Company',
                            'Experience History'
                        ],
                        values: values
                    } 
                });
            }
            autoStarted = false;
        }).catch(error => {
            console.log('Error:', error);
            chrome.runtime.sendMessage({ 
                success: false, 
                error: error.message 
            });
            autoStarted = false;
        });
        sendResponse({ success: true });
    }
    return true;
});