
// background.js
try {
    importScripts('xlsx.full.min.js');
} catch (e) {
    console.error('Error loading XLSX:', e);
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "downloadResume") {
        const { url, serialNumber, filename } = message.data;
        
        // Create folder structure: resumes/serialNumber/filename
        const folderPath = `resumes/${serialNumber}`;
        const fullPath = `${folderPath}/${filename}`;

        chrome.downloads.download({
            url: url,
            filename: fullPath,
            conflictAction: 'uniquify'
        }, (downloadId) => {
            if (chrome.runtime.lastError) {
                console.error('Download failed:', chrome.runtime.lastError);
            }
        });
    }
    if (message.type === "processApplications") {
        console.log("Processing applications RECEIVED:", message.data);
        
        try {
            if (typeof XLSX === 'undefined') {
                throw new Error('XLSX library not loaded properly');
            }

            // Create worksheet data
            const { headers, values } = message.data;
            const allValues = [headers, ...values];

            // Create workbook
            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.aoa_to_sheet(allValues);
            XLSX.utils.book_append_sheet(wb, ws, "LinkedIn Resumes");

            // Generate binary
            const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });

            // Download file directly using chrome.downloads
            const blob = new Blob([wbout], { 
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            });

            // Convert blob to base64
            const reader = new FileReader();
            reader.readAsDataURL(blob);
            reader.onload = function() {
                const base64data = reader.result;
                
                chrome.downloads.download({
                    url: base64data,
                    filename: 'LinkedIn_Resumes.xlsx',
                    saveAs: true
                }, (downloadId) => {
                    // Send success message
                    chrome.runtime.sendMessage({
                        success: true,
                        message: "Excel file downloaded successfully"
                    });
                });
            };

        } catch (error) {
            console.error("Error processing applications:", error);
            chrome.runtime.sendMessage({
                success: false,
                error: error.message
            });
        }

        return true; // Keep the message channel open for async response
    }
});